import { Activity } from '../models/Activity.js';
import { Lead } from '../models/Lead.js';
import { canAccessLead } from './leadService.js';
import { User } from '../models/User.js';

async function getManagerAgentIds(managerId) {
  const agents = await User.find({ role: 'agent', createdByUserId: managerId }).select('_id');
  return agents.map((a) => a._id);
}

async function assertLeadAccess(actor, leadId) {
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
  return lead;
}

export async function listActivities(actor, leadId) {
  await assertLeadAccess(actor, leadId);
  return Activity.find({ leadId })
    .populate('userId', 'profile.name role')
    .sort({ createdAt: -1 });
}

export async function createActivity(actor, leadId, { type, content }) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can log activity on leads');
    err.status = 403;
    throw err;
  }
  await assertLeadAccess(actor, leadId);
  const activity = await Activity.create({
    leadId,
    userId: actor._id,
    type,
    content,
  });
  return activity.populate('userId', 'profile.name role');
}

export async function logStatusChange(leadId, userId, fromStatus, toStatus) {
  return Activity.create({
    leadId,
    userId,
    type: 'status_change',
    content: `Status changed from ${fromStatus} to ${toStatus}`,
  });
}

export async function countActivitiesForLead(leadId) {
  return Activity.countDocuments({ leadId });
}
