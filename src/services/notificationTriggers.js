import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Activity } from '../models/Activity.js';
import { dispatchNotification } from './notificationService.js';
import { getOwningManager } from './userService.js';

export async function resolveUnassignedLeadManagers(lead) {
  if (lead.relatedListingId) {
    const listing = await Listing.findById(lead.relatedListingId).select('assignedAgentId');
    if (listing?.assignedAgentId) {
      const manager = await getOwningManager(listing.assignedAgentId);
      if (manager) return [manager];
    }
  }
  return User.find({ role: 'manager', status: 'active' });
}

export async function notifyLeadAssigned({ lead, manager, agentId, count = 1, skipActivity = false }) {
  const agent = await User.findById(agentId);
  const managerName = manager.profile?.name || 'Manager';
  const title = count > 1 ? `${count} leads assigned to you` : 'New lead assigned to you';
  const message = count > 1
    ? `${count} leads forwarded by ${managerName}`
    : `New lead assigned to you: ${lead.name} — forwarded by ${managerName}`;

  await dispatchNotification({
    userId: agentId,
    type: 'lead_assigned',
    title,
    message,
    relatedLeadId: count === 1 ? lead._id : null,
  });

  if (!skipActivity && count === 1) {
    await Activity.create({
      leadId: lead._id,
      userId: manager._id,
      type: 'assignment',
      content: `Assigned to ${agent?.profile?.name || 'agent'} by ${managerName}`,
    });
  }
}

export async function notifyListingAssigned({ manager, agentId, count }) {
  const managerName = manager.profile?.name || 'Manager';
  await dispatchNotification({
    userId: agentId,
    type: 'listing_assigned',
    title: count > 1 ? `${count} listings assigned to you` : 'Listing assigned to you',
    message: `${count} listing${count > 1 ? 's' : ''} assigned to you by ${managerName}`,
    whatsapp: false,
  });
}

export async function notifyAgentDeactivationReassignment({
  actor,
  targetAgentId,
  deactivatedUser,
  leadsMoved,
  listingsMoved,
  tasksMoved,
}) {
  const actorName = actor.profile?.name || (actor.role === 'superadmin' ? 'Super admin' : 'Manager');
  const fromName = deactivatedUser.profile?.name || 'Agent';

  if (leadsMoved > 0) {
    await dispatchNotification({
      userId: targetAgentId,
      type: 'lead_assigned',
      title: leadsMoved > 1 ? `${leadsMoved} leads assigned to you` : 'Lead assigned to you',
      message: `${leadsMoved} lead${leadsMoved !== 1 ? 's' : ''} transferred from ${fromName} by ${actorName}`,
      whatsapp: false,
    });
  }

  if (listingsMoved > 0) {
    await dispatchNotification({
      userId: targetAgentId,
      type: 'listing_assigned',
      title: listingsMoved > 1 ? `${listingsMoved} listings assigned to you` : 'Listing assigned to you',
      message: `${listingsMoved} listing${listingsMoved !== 1 ? 's' : ''} transferred from ${fromName} by ${actorName}`,
      whatsapp: false,
    });
  }

  if (tasksMoved > 0) {
    await dispatchNotification({
      userId: targetAgentId,
      type: 'task_reminder',
      title: `${tasksMoved} scheduled task${tasksMoved !== 1 ? 's' : ''} transferred to you`,
      message: `Schedule from ${fromName} reassigned by ${actorName} — check My Schedule`,
      whatsapp: false,
    });
  }
}

export async function notifyManagerDeactivationReassignment({
  actor,
  targetManagerId,
  deactivatedUser,
  agentCount,
}) {
  const actorName = actor.profile?.name || 'Super admin';
  const fromName = deactivatedUser.profile?.name || 'Manager';
  await dispatchNotification({
    userId: targetManagerId,
    type: 'lead_assigned',
    title: `${agentCount} agent${agentCount !== 1 ? 's' : ''} assigned to your team`,
    message: `${agentCount} agent${agentCount !== 1 ? 's' : ''} transferred from ${fromName} by ${actorName}. Their leads and listings stay with each agent.`,
    whatsapp: false,
  });
}

export async function notifyDealClosed(lead) {
  if (!lead.assignedAgentId) return;

  const manager = await getOwningManager(lead.assignedAgentId);
  if (!manager) return;

  const agent = await User.findById(lead.assignedAgentId);
  let listingAddr = '';
  if (lead.relatedListingId) {
    const listing = await Listing.findById(lead.relatedListingId).select('address');
    if (listing?.address) {
      const parts = [listing.address.street, listing.address.city].filter(Boolean);
      listingAddr = parts.join(', ');
    }
  }

  const message = `${agent?.profile?.name || 'Agent'} closed a deal — ${lead.name}${listingAddr ? `, ${listingAddr}` : ''}`;
  await dispatchNotification({
    userId: manager._id,
    type: 'deal_closed',
    title: 'Deal closed!',
    message,
    relatedLeadId: lead._id,
    whatsapp: false,
  });
}

export async function notifyWhatsAppDisconnected(user) {
  await dispatchNotification({
    userId: user._id,
    type: 'whatsapp_disconnected',
    title: 'WhatsApp disconnected',
    message: 'Your WhatsApp is disconnected — reconnect in Settings to keep sending messages and receiving alerts.',
    whatsapp: false,
  });

  const manager = await getOwningManager(user._id);
  if (manager) {
    await dispatchNotification({
      userId: manager._id,
      type: 'whatsapp_disconnected',
      title: 'Agent WhatsApp disconnected',
      message: `${user.profile?.name || 'An agent'}'s WhatsApp is disconnected — lead follow-up may be affected.`,
      whatsapp: false,
    });
  }
}
