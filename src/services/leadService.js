import { buildDateRangeFilter } from '../utils/dateRange.js';
import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import {
  Lead,
  BUYER_STATUSES_LIST,
  SELLER_STATUSES_LIST,
  CLOSED_STATUSES,
} from '../models/Lead.js';
import { logStatusChange } from './activityService.js';
import { notifyNewLead, scheduleSpeedToLeadJob } from '../queues/jobQueue.js';
import { notifyLeadAssigned, notifyDealClosed } from './notificationTriggers.js';
import { Activity } from '../models/Activity.js';
import { Task } from '../models/Task.js';
import {
  validateLeadAssignment,
  smartForwardLeads as runSmartForward,
} from './leadAssignmentService.js';

const BUYER_TYPES = ['buyer', 'renter'];

export function statusesForType(type) {
  return BUYER_TYPES.includes(type) ? BUYER_STATUSES_LIST : SELLER_STATUSES_LIST;
}

export function normalizePhone(phone) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

async function getManagerAgentIds(managerId) {
  const agents = await User.find({ role: 'agent', createdByUserId: managerId }).select('_id');
  return agents.map((a) => a._id);
}

function buildScopeQuery(actor, agentIds = []) {
  if (actor.role === 'superadmin') return {};
  if (actor.role === 'agent') return { assignedAgentId: actor._id };
  // Managers see their agents' leads plus the unassigned inbox
  return {
    $or: [
      { assignedAgentId: { $in: agentIds } },
      { assignedAgentId: null },
    ],
  };
}

export function normalizeRefId(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (ref._id) return ref._id.toString();
  return ref.toString();
}

export function canAccessLead(actor, lead, agentIds = []) {
  if (actor.role === 'superadmin') return true;
  const leadAgentId = normalizeRefId(lead.assignedAgentId);
  if (actor.role === 'agent') {
    return leadAgentId === actor._id.toString();
  }
  if (!leadAgentId) return true;
  return agentIds.some((id) => id.toString() === leadAgentId);
}

async function validateAgentForActor(actor, agentId) {
  const agent = await User.findOne({ _id: agentId, role: 'agent', status: 'active' });
  if (!agent) {
    const err = new Error('Invalid or inactive agent');
    err.status = 400;
    throw err;
  }
  if (actor.role === 'manager' && agent.createdByUserId?.toString() !== actor._id.toString()) {
    const err = new Error('Cannot assign to an agent outside your team');
    err.status = 403;
    throw err;
  }
  return agent;
}

function populateOptions() {
  return [
    { path: 'assignedAgentId', select: 'profile.name slug email' },
    { path: 'relatedListingId', select: 'address price status' },
    { path: 'duplicateOfLeadId', select: 'name phone status' },
  ];
}

export async function findDuplicateByPhone(phone, excludeLeadId = null) {
  const digits = phone.replace(/[^\d]/g, '');
  // Match regardless of whether the stored number kept a leading +
  const query = { phone: { $in: [digits, `+${digits}`] } };
  if (excludeLeadId) query._id = { $ne: excludeLeadId };
  return Lead.findOne(query).select('name phone email status type assignedAgentId');
}

export async function listLeads(actor, { status, type, agentId, source, search, dateFrom, dateTo, unassigned } = {}) {
  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  const query = buildScopeQuery(actor, agentIds);

  if (status) query.status = status;
  if (type) query.type = type;
  if (source) query.source = source;
  if (agentId) query.assignedAgentId = agentId;
  if (unassigned === 'true') query.assignedAgentId = null;

  const and = [];
  if (search) {
    and.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    });
  }
  if (dateFrom || dateTo) {
    const createdRange = buildDateRangeFilter(dateFrom, dateTo);
    if (createdRange) and.push({ createdAt: createdRange });
  }
  if (and.length) query.$and = and;

  const leads = await Lead.find(query).populate(populateOptions()).sort({ createdAt: -1 });

  // Attach the next upcoming (or overdue) task per lead so pipeline cards can
  // show schedule labels and urgency colors without extra round trips.
  const leadIds = leads.map((l) => l._id);
  const openTasks = await Task.find({
    leadId: { $in: leadIds },
    status: { $in: ['pending', 'missed'] },
  }).sort({ dueAt: 1 }).select('leadId type dueAt status');

  const nextTaskByLead = new Map();
  for (const task of openTasks) {
    const key = task.leadId.toString();
    if (!nextTaskByLead.has(key)) {
      nextTaskByLead.set(key, {
        _id: task._id,
        type: task.type,
        dueAt: task.dueAt,
        status: task.status,
      });
    }
  }

  return leads.map((lead) => {
    const obj = lead.toObject();
    obj.nextTask = nextTaskByLead.get(lead._id.toString()) || null;
    return obj;
  });
}

export async function getLead(actor, leadId) {
  const lead = await Lead.findById(leadId).populate(populateOptions());
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canAccessLead(actor, lead, agentIds)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  return lead;
}

export async function createLead(actor, data, { allowDuplicate = false } = {}) {
  if (actor.role === 'superadmin') {
    const err = new Error('Super admins cannot create leads — managers import and assign leads');
    err.status = 403;
    throw err;
  }

  const phone = normalizePhone(data.phone);

  let assignedAgentId = null;
  if (actor.role === 'agent') {
    assignedAgentId = actor._id;
  } else if (data.assignedAgentId) {
    await validateAgentForActor(actor, data.assignedAgentId);
    assignedAgentId = data.assignedAgentId;
  }

  const duplicate = await findDuplicateByPhone(phone);
  if (duplicate && !allowDuplicate) {
    const err = new Error('A lead with this phone number already exists');
    err.status = 409;
    err.duplicate = duplicate;
    throw err;
  }

  const lead = await Lead.create({
    type: data.type,
    name: data.name,
    phone,
    email: data.email || null,
    source: data.source || 'manual',
    relatedListingId: data.relatedListingId || null,
    assignedAgentId,
    notes: data.notes || null,
    propertyInterest: data.propertyInterest || null,
    propertyType: data.propertyType || null,
    sourceDetail: data.sourceDetail || null,
    duplicateOfLeadId: duplicate ? duplicate._id : null,
  });

  await notifyNewLead(lead);
  await scheduleSpeedToLeadJob(lead._id);

  return lead.populate(populateOptions());
}

// Public inquiry routing: listing page -> listing's agent; agent page -> that
// agent; general form -> unassigned (manager inbox). Duplicates are flagged
// silently since public visitors can't resolve a merge prompt.
export async function createPublicInquiry({ listingId, agentSlug, name, phone, email, type, message }) {
  const normalized = normalizePhone(phone);
  let assignedAgentId = null;
  let relatedListingId = null;
  let source = 'website_general';

  if (listingId) {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      const err = new Error('Listing not found');
      err.status = 404;
      throw err;
    }
    relatedListingId = listing._id;
    assignedAgentId = listing.assignedAgentId || null;
    source = 'website_listing';
  } else if (agentSlug) {
    const agent = await User.findOne({ slug: agentSlug, role: 'agent', status: 'active' });
    if (!agent) {
      const err = new Error('Agent not found');
      err.status = 404;
      throw err;
    }
    assignedAgentId = agent._id;
    source = 'website_agent_page';
  }

  const duplicate = await findDuplicateByPhone(normalized);

  const lead = await Lead.create({
    type: type || 'buyer',
    name,
    phone: normalized,
    email: email || null,
    source,
    relatedListingId,
    assignedAgentId,
    notes: message || null,
    duplicateOfLeadId: duplicate ? duplicate._id : null,
  });

  await notifyNewLead(lead);
  await scheduleSpeedToLeadJob(lead._id);

  return lead;
}

export async function updateLead(actor, leadId, updates) {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canAccessLead(actor, lead, agentIds)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  if (updates.status !== undefined) {
    if (actor.role === 'manager' || actor.role === 'superadmin') {
      const err = new Error('Only agents can change lead status — view pipeline and logs here');
      err.status = 403;
      throw err;
    }
    const validStatuses = statusesForType(lead.type);
    if (!validStatuses.includes(updates.status)) {
      const err = new Error(`Invalid status for ${lead.type} pipeline`);
      err.status = 400;
      throw err;
    }
    if (updates.status === 'closed_lost' && !updates.lostReason && !lead.lostReason) {
      const err = new Error('lostReason is required when closing a lead as lost');
      err.status = 400;
      throw err;
    }
    const previousStatus = lead.status;
    lead.status = updates.status;
    if (updates.status === 'closed_lost') {
      lead.lostReason = updates.lostReason || lead.lostReason;
    } else {
      lead.lostReason = null;
    }
    if (previousStatus !== updates.status) {
      await logStatusChange(lead._id, actor._id, previousStatus, updates.status);
      if (updates.status === 'closed_won') {
        await notifyDealClosed(lead);
      }
    }
  }

  if (updates.assignedAgentId !== undefined && actor.role !== 'agent') {
    const previousAgentId = normalizeRefId(lead.assignedAgentId);
    const newAgentId = updates.assignedAgentId || null;

    if (newAgentId) {
      await validateLeadAssignment(lead, newAgentId.toString(), { actor });
      lead.assignedAgentId = newAgentId;
    } else {
      if (previousAgentId) {
        await validateLeadAssignment(lead, null, { actor });
      }
      lead.assignedAgentId = null;
    }

    const assignedId = normalizeRefId(lead.assignedAgentId);
    if (actor.role === 'manager' && assignedId && assignedId !== previousAgentId) {
      await notifyLeadAssigned({ lead, manager: actor, agentId: assignedId });
    }
  }

  const fields = ['name', 'email', 'type', 'notes', 'relatedListingId', 'propertyInterest', 'propertyType', 'sourceDetail'];
  for (const field of fields) {
    if (updates[field] !== undefined) lead[field] = updates[field];
  }

  if (updates.phone !== undefined) {
    lead.phone = normalizePhone(updates.phone);
  }

  // Changing type across pipeline groups invalidates the current status
  if (updates.type !== undefined && !statusesForType(lead.type).includes(lead.status)) {
    lead.status = 'new';
  }

  await lead.save();
  return lead.populate(populateOptions());
}

export async function mergeLead(actor, leadId) {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  if (!lead.duplicateOfLeadId) {
    const err = new Error('Lead is not flagged as a duplicate');
    err.status = 400;
    throw err;
  }

  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canAccessLead(actor, lead, agentIds)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const original = await Lead.findById(lead.duplicateOfLeadId);
  if (original) {
    if (!original.email && lead.email) original.email = lead.email;
    if (lead.notes) {
      original.notes = original.notes ? `${original.notes}\n---\n${lead.notes}` : lead.notes;
    }
    if (!original.relatedListingId && lead.relatedListingId) {
      original.relatedListingId = lead.relatedListingId;
    }
    await original.save();
  }

  await lead.deleteOne();
  return original ? original.populate(populateOptions()) : null;
}

export async function bulkAssignLeads(actor, { leadIds, agentId }) {
  if (actor.role !== 'manager') {
    const err = new Error('Only managers can bulk-assign leads');
    err.status = 403;
    throw err;
  }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    const err = new Error('At least one lead is required');
    err.status = 400;
    throw err;
  }

  await validateAgentForActor(actor, agentId);
  const agent = await User.findById(agentId);
  const agentIds = await getManagerAgentIds(actor._id);

  const leads = await Lead.find({ _id: { $in: leadIds } });
  if (leads.length !== leadIds.length) {
    const err = new Error('One or more leads not found');
    err.status = 404;
    throw err;
  }

  for (const lead of leads) {
    if (!canAccessLead(actor, lead, agentIds)) {
      const err = new Error('Insufficient permissions for one or more leads');
      err.status = 403;
      throw err;
    }
  }

  const assignable = [];
  const skipped = [];
  for (const lead of leads) {
    const currentId = normalizeRefId(lead.assignedAgentId);
    if (currentId === agentId.toString()) {
      skipped.push({ leadId: lead._id, leadName: lead.name, reason: `Already assigned to ${agent?.profile?.name}` });
      continue;
    }
    try {
      await validateLeadAssignment(lead, agentId, { actor });
      assignable.push(lead);
    } catch (err) {
      skipped.push({ leadId: lead._id, leadName: lead.name, reason: err.message });
    }
  }

  if (assignable.length === 0) {
    return { assigned: 0, agentId, agentName: agent?.profile?.name || 'Agent', skipped };
  }

  await Lead.updateMany(
    { _id: { $in: assignable.map((l) => l._id) } },
    { assignedAgentId: agentId }
  );

  const count = assignable.length;
  await notifyLeadAssigned({
    lead: assignable[0],
    manager: actor,
    agentId,
    count,
    skipActivity: count > 1,
  });

  const agentName = agent?.profile?.name || 'Agent';
  const managerName = actor.profile?.name || 'Manager';
  for (const lead of assignable) {
    await Activity.create({
      leadId: lead._id,
      userId: actor._id,
      type: 'assignment',
      content: count > 1
        ? `Bulk assigned to ${agentName} by ${managerName}`
        : `Assigned to ${agentName} by ${managerName}`,
    });
  }

  return { assigned: count, agentId, agentName, skipped };
}

export async function smartForward(actor, { leadIds } = {}) {
  const results = await runSmartForward(actor, { leadIds });

  const byAgent = new Map();
  for (const item of results.assigned) {
    if (!byAgent.has(item.agentId.toString())) byAgent.set(item.agentId.toString(), []);
    byAgent.get(item.agentId.toString()).push(item);
  }

  for (const [, items] of byAgent) {
    const lead = await Lead.findById(items[0].leadId);
    if (!lead) continue;
    await notifyLeadAssigned({
      lead,
      manager: actor,
      agentId: items[0].agentId,
      count: items.length,
      skipActivity: items.length > 1,
    });
  }

  for (const item of results.assigned) {
    await Activity.create({
      leadId: item.leadId,
      userId: actor._id,
      type: 'assignment',
      content: `Smart-forwarded to ${item.agentName} (${item.matchReason})`,
    });
  }

  return results;
}

export { CLOSED_STATUSES };
