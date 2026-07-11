import { Lead } from '../models/Lead.js';
import { Activity } from '../models/Activity.js';
import { Listing } from '../models/Listing.js';
import { User } from '../models/User.js';
import { normalizeRefId } from './leadService.js';

const CONTACT_ACTIVITY_TYPES = ['call', 'email', 'whatsapp_sent'];

async function getManagerAgentIds(managerId) {
  const agents = await User.find({ role: 'agent', createdByUserId: managerId, status: 'active' }).select('_id');
  return agents.map((a) => a._id);
}

export async function leadHasBeenTouched(leadId) {
  const lead = await Lead.findById(leadId).select('status');
  if (!lead) return false;
  if (lead.status !== 'new') return true;
  const activityCount = await Activity.countDocuments({
    leadId,
    type: { $in: CONTACT_ACTIVITY_TYPES },
  });
  return activityCount > 0;
}

async function validateAgentForManager(actor, agentId) {
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

export async function validateLeadAssignment(lead, newAgentId, { actor }) {
  const currentAgentId = normalizeRefId(lead.assignedAgentId);

  if (newAgentId && currentAgentId === newAgentId.toString()) {
    const agent = await User.findById(newAgentId).select('profile.name');
    const err = new Error(`Already assigned to ${agent?.profile?.name || 'this agent'}`);
    err.status = 409;
    err.code = 'ALREADY_ASSIGNED';
    throw err;
  }

  if (currentAgentId && newAgentId && currentAgentId !== newAgentId.toString()) {
    const touched = await leadHasBeenTouched(lead._id);
    if (touched) {
      const err = new Error('Cannot reassign — agent has already contacted or attempted contact on this lead');
      err.status = 409;
      err.code = 'LEAD_TOUCHED';
      throw err;
    }
  }

  if (newAgentId) {
    await validateAgentForManager(actor, newAgentId);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreListingMatch(listing, interest, propertyType) {
  const hay = [
    listing.address?.street,
    listing.address?.city,
    listing.description,
    listing.propertyType,
  ].filter(Boolean).join(' ').toLowerCase();
  const needle = interest.toLowerCase();
  let score = 0;
  if (hay.includes(needle)) score += 10;
  for (const word of needle.split(/\s+/).filter((w) => w.length > 2)) {
    if (hay.includes(word)) score += 2;
  }
  if (propertyType && listing.propertyType === propertyType) score += 5;
  return score;
}

export async function resolveAgentForLead(lead, managerId) {
  const agentIds = await getManagerAgentIds(managerId);
  const scope = {
    $or: [
      { createdByUserId: managerId },
      { assignedAgentId: { $in: agentIds } },
    ],
  };

  if (lead.relatedListingId) {
    const listing = await Listing.findOne({
      _id: lead.relatedListingId,
      ...scope,
      assignedAgentId: { $ne: null },
    }).populate('assignedAgentId', 'profile.name');

    if (listing?.assignedAgentId) {
      return {
        agent: listing.assignedAgentId,
        listing,
        matchReason: 'Linked listing',
      };
    }
  }

  const interest = (lead.propertyInterest || '').trim();
  if (!interest) {
    return {
      error: 'No property specified — add property interest on the lead or link a listing',
      code: 'NO_PROPERTY',
    };
  }

  const words = interest.split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
  const pattern = words.length ? words.map(escapeRegex).join('|') : escapeRegex(interest);
  const regex = new RegExp(pattern, 'i');

  const listings = await Listing.find({
    ...scope,
    assignedAgentId: { $ne: null },
    status: { $in: ['active', 'coming_soon'] },
    $or: [
      { 'address.street': regex },
      { 'address.city': regex },
      { description: regex },
    ],
    ...(lead.propertyType ? { propertyType: lead.propertyType } : {}),
  }).populate('assignedAgentId', 'profile.name');

  if (listings.length === 0) {
    const typeHint = lead.propertyType ? ` (${lead.propertyType})` : '';
    return {
      error: `No agent assigned to a listing matching "${interest}"${typeHint}. Create/assign a listing first.`,
      code: 'NO_MATCHING_LISTING',
    };
  }

  const ranked = listings
    .map((l) => ({ listing: l, score: scoreListingMatch(l, interest, lead.propertyType) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best.score === 0 && listings.length > 1) {
    return {
      error: `Multiple listings found for "${interest}" — link a specific listing on the lead`,
      code: 'AMBIGUOUS_PROPERTY',
    };
  }

  const listing = best.listing;
  return {
    agent: listing.assignedAgentId,
    listing,
    matchReason: `Matched listing: ${listing.address?.street}, ${listing.address?.city}`,
  };
}

export async function smartForwardLeads(actor, { leadIds } = {}) {
  if (actor.role !== 'manager') {
    const err = new Error('Only managers can smart-forward leads');
    err.status = 403;
    throw err;
  }

  const leads = leadIds?.length
    ? await Lead.find({ _id: { $in: leadIds } })
    : await Lead.find({ assignedAgentId: null });

  const results = { assigned: [], skipped: [], failed: [] };

  for (const lead of leads) {
    const currentId = normalizeRefId(lead.assignedAgentId);
    if (currentId) {
      const agent = await User.findById(currentId).select('profile.name');
      results.skipped.push({
        leadId: lead._id,
        leadName: lead.name,
        reason: `Already assigned to ${agent?.profile?.name || 'an agent'}`,
        code: 'ALREADY_ASSIGNED',
      });
      continue;
    }

    const match = await resolveAgentForLead(lead, actor._id);
    if (match.error) {
      results.failed.push({
        leadId: lead._id,
        leadName: lead.name,
        propertyInterest: lead.propertyInterest,
        reason: match.error,
        code: match.code,
      });
      continue;
    }

    lead.assignedAgentId = match.agent._id;
    if (match.listing && !lead.relatedListingId) {
      lead.relatedListingId = match.listing._id;
    }
    await lead.save();

    results.assigned.push({
      leadId: lead._id,
      leadName: lead.name,
      agentId: match.agent._id,
      agentName: match.agent.profile?.name,
      listingAddress: `${match.listing.address?.street}, ${match.listing.address?.city}`,
      matchReason: match.matchReason,
    });
  }

  return results;
}
