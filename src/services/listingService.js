import { User } from '../models/User.js';
import { Listing, LISTING_STATUSES_LIST } from '../models/Listing.js';
import { generateUniqueListingSlug } from '../utils/slug.js';
import { buildDateRangeFilter } from '../utils/dateRange.js';
import { notifyListingAssigned } from './notificationTriggers.js';
import { normalizeRefId } from './leadService.js';

async function getManagerAgentIds(managerId) {
  const agents = await User.find({ role: 'agent', createdByUserId: managerId }).select('_id');
  return agents.map((a) => a._id);
}

function buildListQuery(actor, agentIds = []) {
  if (actor.role === 'superadmin') return {};
  if (actor.role === 'agent') return { assignedAgentId: actor._id };
  return {
    $or: [
      { createdByUserId: actor._id },
      { assignedAgentId: { $in: agentIds } },
    ],
  };
}

export function canViewListing(actor, listing, agentIds = []) {
  if (actor.role === 'superadmin') return true;
  if (actor.role === 'agent') {
    return normalizeRefId(listing.assignedAgentId) === actor._id.toString();
  }
  if (normalizeRefId(listing.createdByUserId) === actor._id.toString()) return true;
  const listingAgentId = normalizeRefId(listing.assignedAgentId);
  return listingAgentId ? agentIds.some((id) => id.toString() === listingAgentId) : false;
}

export function canManageListing(actor, listing, agentIds = []) {
  if (actor.role === 'agent') return false;
  if (actor.role === 'superadmin') return true;
  if (normalizeRefId(listing.createdByUserId) === actor._id.toString()) return true;
  const listingAgentId = normalizeRefId(listing.assignedAgentId);
  return listingAgentId ? agentIds.some((id) => id.toString() === listingAgentId) : false;
}

async function validateAgentAssignment(actor, agentId) {
  if (!agentId) return null;

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
    { path: 'createdByUserId', select: 'profile.name role' },
  ];
}

export async function listListings(actor, { status, agentId, search, dateFrom, dateTo } = {}) {
  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  const query = buildListQuery(actor, agentIds);

  if (status) query.status = status;
  if (agentId) query.assignedAgentId = agentId;

  if (search) {
    const searchFilter = {
      $or: [
        { 'address.street': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ],
    };
    query.$and = query.$and ? [...query.$and, searchFilter] : [searchFilter];
  }

  if (dateFrom || dateTo) {
    const createdRange = buildDateRangeFilter(dateFrom, dateTo);
    if (createdRange) {
      const createdFilter = { createdAt: createdRange };
      query.$and = query.$and ? [...query.$and, createdFilter] : [createdFilter];
    }
  }

  return Listing.find(query)
    .populate(populateOptions())
    .sort({ createdAt: -1 });
}

export async function getListing(actor, listingId) {
  const listing = await Listing.findById(listingId).populate(populateOptions());
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canViewListing(actor, listing, agentIds)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  return listing;
}

export async function createListing(actor, data) {
  if (actor.role === 'agent') {
    const err = new Error('Agents cannot create listings');
    err.status = 403;
    throw err;
  }

  if (data.assignedAgentId) {
    await validateAgentAssignment(actor, data.assignedAgentId);
  }

  const slug = await generateUniqueListingSlug(
    Listing,
    `${data.address.street} ${data.address.city}`
  );

  const listing = await Listing.create({
    ...data,
    slug,
    createdByUserId: actor._id,
  });

  return listing.populate(populateOptions());
}

export async function updateListing(actor, listingId, updates) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canManageListing(actor, listing, agentIds)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  if (updates.assignedAgentId !== undefined) {
    if (updates.assignedAgentId) {
      await validateAgentAssignment(actor, updates.assignedAgentId);
    }
    listing.assignedAgentId = updates.assignedAgentId || null;
  }

  const fields = ['address', 'price', 'bedrooms', 'bathrooms', 'sqft', 'description', 'photos', 'status'];
  for (const field of fields) {
    if (updates[field] !== undefined) {
      if (field === 'address') {
        listing.address = { ...listing.address.toObject?.() ?? listing.address, ...updates.address };
      } else {
        listing[field] = updates[field];
      }
    }
  }

  if (!listing.slug) {
    listing.slug = await generateUniqueListingSlug(
      Listing,
      `${listing.address.street} ${listing.address.city}`,
      listing._id
    );
  }

  await listing.save();
  return listing.populate(populateOptions());
}

export async function deleteListing(actor, listingId) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canManageListing(actor, listing, agentIds)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  await listing.deleteOne();
  return { deleted: true };
}

export async function bulkAssignListings(actor, { listingIds, agentId }) {
  if (actor.role !== 'manager') {
    const err = new Error('Only managers can bulk-assign listings');
    err.status = 403;
    throw err;
  }

  if (!Array.isArray(listingIds) || listingIds.length === 0) {
    const err = new Error('At least one listing is required');
    err.status = 400;
    throw err;
  }

  await validateAgentAssignment(actor, agentId);
  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];

  const listings = await Listing.find({ _id: { $in: listingIds } });
  if (listings.length !== listingIds.length) {
    const err = new Error('One or more listings not found');
    err.status = 404;
    throw err;
  }

  for (const listing of listings) {
    if (!canManageListing(actor, listing, agentIds)) {
      const err = new Error('Insufficient permissions for one or more listings');
      err.status = 403;
      throw err;
    }
  }

  await Listing.updateMany({ _id: { $in: listingIds } }, { assignedAgentId: agentId });

  await notifyListingAssigned({ manager: actor, agentId, count: listingIds.length });

  const agent = await User.findById(agentId);
  return { assigned: listingIds.length, agentId, agentName: agent?.profile?.name || 'Agent' };
}

export { LISTING_STATUSES_LIST };
