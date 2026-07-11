import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Lead, CLOSED_STATUSES } from '../models/Lead.js';
import { Listing, ACTIVE_LISTING_STATUSES } from '../models/Listing.js';
import { Task } from '../models/Task.js';
import { generateUniqueSlug } from '../utils/slug.js';
import {
  notifyAgentDeactivationReassignment,
  notifyManagerDeactivationReassignment,
} from './notificationTriggers.js';

const ROLE_CREATE_PERMISSIONS = {
  superadmin: ['manager'],
  manager: ['agent'],
};

export function canManageRole(actorRole, targetRole) {
  return ROLE_CREATE_PERMISSIONS[actorRole]?.includes(targetRole) ?? false;
}

export function canViewUser(actor, target) {
  if (actor._id.toString() === target._id.toString()) return true;
  if (actor.role === 'superadmin') return true;
  if (actor.role === 'manager') {
    return target.role === 'agent' && target.createdByUserId?.toString() === actor._id.toString();
  }
  return false;
}

export async function getOwningManager(agentId) {
  if (!agentId) return null;
  const agent = await User.findById(agentId).select('createdByUserId role status');
  if (!agent?.createdByUserId || agent.status !== 'active') return null;
  return User.findOne({ _id: agent.createdByUserId, role: 'manager', status: 'active' });
}

export function canManageUser(actor, target) {
  if (actor._id.toString() === target._id.toString()) return false;
  if (target.role === 'superadmin') return false;
  if (actor.role === 'superadmin') return target.role === 'manager';
  if (actor.role === 'manager') {
    return target.role === 'agent' && target.createdByUserId?.toString() === actor._id.toString();
  }
  return false;
}

export async function listUsers(actor, { role, status, search } = {}) {
  const query = {};

  if (actor.role === 'manager') {
    query.$or = [
      { _id: actor._id },
      { role: 'agent', createdByUserId: actor._id },
    ];
  }

  if (role) query.role = role;
  if (status) query.status = status;
  if (search) {
    const searchFilter = {
      $or: [
        { 'profile.name': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    };
    query.$and = query.$and ? [...query.$and, searchFilter] : [searchFilter];
  }

  return User.find(query)
    .select('-passwordHash')
    .populate('createdByUserId', 'profile.name email role')
    .sort({ 'profile.name': 1 });
}

export async function createUser(actor, { role, email, password, profile }) {
  if (!canManageRole(actor.role, role)) {
    const err = new Error('Cannot create users with this role');
    err.status = 403;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userData = {
    role,
    email: email.toLowerCase(),
    passwordHash,
    profile,
    createdByUserId: actor._id,
  };

  if (role === 'agent') {
    userData.slug = await generateUniqueSlug(User, profile.name);
  }

  const user = await User.create(userData);
  return user.toSafeJSON();
}

export async function updateUser(actor, userId, updates) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (!canManageUser(actor, user) && actor._id.toString() !== user._id.toString()) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  if (updates.profile) {
    user.profile = { ...user.profile.toObject?.() ?? user.profile, ...updates.profile };
  }

  if (updates.slug && user.role === 'agent') {
    const isSelfOrManager = actor._id.toString() === user._id.toString() || canManageUser(actor, user);
    if (!isSelfOrManager) {
      const err = new Error('Cannot update slug');
      err.status = 403;
      throw err;
    }

    const newSlug = await generateUniqueSlug(User, updates.slug, user._id);
    if (user.slug && user.slug !== newSlug) {
      user.previousSlugs = [...(user.previousSlugs || []), user.slug];
    }
    user.slug = newSlug;
  }

  if (updates.email && canManageUser(actor, user)) {
    user.email = updates.email.toLowerCase();
  }

  await user.save();
  return user.toSafeJSON();
}

export async function getDeactivationPreview(actor, userId) {
  const user = await User.findOne({ _id: userId, status: 'active' });
  if (!user) {
    const err = new Error('Active user not found');
    err.status = 404;
    throw err;
  }

  if (!canManageUser(actor, user)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  if (user.role === 'superadmin') {
    const err = new Error('Cannot deactivate superadmin');
    err.status = 400;
    throw err;
  }

  const activeLeads = await Lead.find({
    assignedAgentId: userId,
    status: { $nin: CLOSED_STATUSES },
  }).select('name phone email status type');

  const activeListings = await Listing.find({
    assignedAgentId: userId,
    status: { $in: ACTIVE_LISTING_STATUSES },
  }).select('address price status');

  const pendingTasks = await Task.find({
    assignedUserId: userId,
    status: { $in: ['pending', 'missed'] },
  }).select('type dueAt status').populate('leadId', 'name');

  let managedAgents = [];
  if (user.role === 'manager') {
    managedAgents = await User.find({
      role: 'agent',
      createdByUserId: userId,
      status: 'active',
    }).select('profile.name email slug');
  }

  const requiresReassignment =
    activeLeads.length > 0
    || activeListings.length > 0
    || pendingTasks.length > 0
    || managedAgents.length > 0;

  return {
    user: { _id: user._id, role: user.role, profile: user.profile },
    activeLeads,
    activeListings,
    pendingTasks,
    managedAgents,
    requiresReassignment,
  };
}

export async function deactivateUser(actor, userId, reassignments = {}) {
  const user = await User.findOne({ _id: userId, status: 'active' });
  if (!user) {
    const err = new Error('Active user not found');
    err.status = 404;
    throw err;
  }

  if (!canManageUser(actor, user)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const preview = await getDeactivationPreview(actor, userId);
  const { leadTargetAgentId, listingTargetAgentId, agentTargetManagerId } = reassignments;

  const needsAgentTarget =
    preview.activeLeads.length > 0
    || preview.activeListings.length > 0
    || preview.pendingTasks.length > 0;

  if (preview.requiresReassignment) {
    if (needsAgentTarget && !leadTargetAgentId) {
      const err = new Error('Reassignment target agent required for leads, listings, and scheduled tasks');
      err.status = 400;
      throw err;
    }

    if (!agentTargetManagerId && preview.managedAgents.length > 0) {
      const err = new Error('Agent reassignment target manager required');
      err.status = 400;
      throw err;
    }

    const listingTarget = listingTargetAgentId || leadTargetAgentId;
    let leadsMoved = 0;
    let listingsMoved = 0;
    let tasksMoved = 0;

    if (leadTargetAgentId) {
      await validateAgentTarget(leadTargetAgentId, userId, actor);

      if (preview.activeLeads.length > 0) {
        const leadResult = await Lead.updateMany(
          { assignedAgentId: userId, status: { $nin: CLOSED_STATUSES } },
          { assignedAgentId: leadTargetAgentId }
        );
        leadsMoved = leadResult.modifiedCount;
      }

      if (preview.activeListings.length > 0 && listingTarget) {
        await validateAgentTarget(listingTarget, userId, actor);
        const listingResult = await Listing.updateMany(
          { assignedAgentId: userId, status: { $in: ACTIVE_LISTING_STATUSES } },
          { assignedAgentId: listingTarget }
        );
        listingsMoved = listingResult.modifiedCount;
      }

      if (preview.pendingTasks.length > 0) {
        const taskResult = await Task.updateMany(
          { assignedUserId: userId, status: { $in: ['pending', 'missed'] } },
          { assignedUserId: leadTargetAgentId }
        );
        tasksMoved = taskResult.modifiedCount;
      }

      if (user.role === 'agent' && (leadsMoved > 0 || listingsMoved > 0 || tasksMoved > 0)) {
        await notifyAgentDeactivationReassignment({
          actor,
          targetAgentId: leadTargetAgentId,
          deactivatedUser: user,
          leadsMoved,
          listingsMoved,
          tasksMoved,
        });
      }
    }

    if (agentTargetManagerId) {
      await validateManagerTarget(agentTargetManagerId, userId);
      const agentCount = preview.managedAgents.length;
      await User.updateMany(
        { role: 'agent', createdByUserId: userId, status: 'active' },
        { createdByUserId: agentTargetManagerId }
      );
      if (agentCount > 0) {
        await notifyManagerDeactivationReassignment({
          actor,
          targetManagerId: agentTargetManagerId,
          deactivatedUser: user,
          agentCount,
        });
      }
    }
  }

  user.status = 'inactive';
  await user.save();
  return user.toSafeJSON();
}

async function validateAgentTarget(targetAgentId, deactivatingUserId, actor) {
  if (targetAgentId === deactivatingUserId) {
    const err = new Error('Cannot reassign to the user being deactivated');
    err.status = 400;
    throw err;
  }

  const target = await User.findOne({ _id: targetAgentId, role: 'agent', status: 'active' });
  if (!target) {
    const err = new Error('Invalid reassignment target agent');
    err.status = 400;
    throw err;
  }

  if (actor?.role === 'manager' && target.createdByUserId?.toString() !== actor._id.toString()) {
    const err = new Error('Cannot reassign to an agent outside your team');
    err.status = 403;
    throw err;
  }

  return target;
}

async function validateManagerTarget(targetManagerId, deactivatingUserId) {
  if (targetManagerId === deactivatingUserId) {
    const err = new Error('Cannot reassign to the manager being deactivated');
    err.status = 400;
    throw err;
  }

  const target = await User.findOne({ _id: targetManagerId, role: 'manager', status: 'active' });
  if (!target) {
    const err = new Error('Invalid reassignment target manager');
    err.status = 400;
    throw err;
  }

  return target;
}

export async function reactivateUser(actor, userId) {
  const user = await User.findOne({ _id: userId, status: 'inactive' });
  if (!user) {
    const err = new Error('Inactive user not found');
    err.status = 404;
    throw err;
  }

  if (!canManageUser(actor, user)) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  user.status = 'active';
  await user.save();
  return user.toSafeJSON();
}

export async function listActiveAgents(actor = null, excludeUserId = null) {
  const query = { role: 'agent', status: 'active' };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  if (actor?.role === 'manager') query.createdByUserId = actor._id;
  return User.find(query).select('profile.name slug email').sort({ 'profile.name': 1 });
}

export async function listActiveManagers(excludeUserId = null) {
  const query = { role: 'manager', status: 'active' };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  return User.find(query).select('profile.name email').sort({ 'profile.name': 1 });
}
