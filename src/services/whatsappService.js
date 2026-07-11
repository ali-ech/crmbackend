import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { getWhatsAppProvider, getProviderName } from './whatsapp/WhatsAppProvider.js';
import { isWhatsAppDisconnectError } from './notification/whatsappPushChannel.js';
import { notifyWhatsAppDisconnected } from './notificationTriggers.js';
import { getLead } from './leadService.js';
import { createActivity } from './activityService.js';
import { normalizePhoneForWhatsApp } from '../utils/phone.js';
import { generateUniqueListingSlug } from '../utils/slug.js';
import { buildLeadPropertyWhatsAppMessage } from '../utils/leadWhatsAppMessage.js';

async function ensureListingSlug(listing) {
  if (listing.slug) return listing;
  listing.slug = await generateUniqueListingSlug(
    Listing,
    `${listing.address?.street || ''} ${listing.address?.city || ''}`.trim(),
    listing._id
  );
  await listing.save();
  return listing;
}

function assertMessageSent(data, context = 'message') {
  const sent = data?.sent;
  if (sent === false || sent === 'false' || data?.error) {
    const err = new Error(data?.error || data?.message || `WhatsApp ${context} was not delivered`);
    err.status = 502;
    throw err;
  }
}

export async function getWhatsAppStatus(actor) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can manage WhatsApp connections');
    err.status = 403;
    throw err;
  }

  const user = await User.findById(actor._id);
  const config = user.whatsappConfig;
  if (!config?.instanceId || !config?.token) {
    return { connected: false, provider: config?.provider || getProviderName(), status: 'not_configured' };
  }

  const provider = await getWhatsAppProvider(config.provider);
  const { authenticated, status } = await provider.getInstanceStatus(config.instanceId, config.token);

  if (authenticated !== config.connected) {
    user.whatsappConfig.connected = authenticated;
    await user.save();
  }

  return {
    connected: authenticated,
    provider: config.provider,
    status,
    instanceId: config.instanceId,
  };
}

export async function connectWhatsApp(actor, { instanceId, token, provider }) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can connect WhatsApp');
    err.status = 403;
    throw err;
  }

  if (!instanceId?.trim() || !token?.trim()) {
    const err = new Error('Instance ID and token are required');
    err.status = 400;
    throw err;
  }

  const providerName = provider || getProviderName();
  const whatsappProvider = await getWhatsAppProvider(providerName);

  const { authenticated, status } = await whatsappProvider.getInstanceStatus(
    instanceId.trim(),
    token.trim()
  );

  const user = await User.findById(actor._id);
  user.whatsappConfig = {
    provider: providerName,
    instanceId: instanceId.trim(),
    token: token.trim(),
    connected: authenticated,
  };
  await user.save();

  return {
    instanceId: instanceId.trim(),
    provider: providerName,
    status,
    connected: authenticated,
    message: authenticated
      ? 'WhatsApp connected successfully.'
      : 'Credentials saved. If you linked WhatsApp on the UltraMsg dashboard, click Check connection.',
  };
}

export async function getWhatsAppQR(actor) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can access WhatsApp QR');
    err.status = 403;
    throw err;
  }

  const user = await User.findById(actor._id);
  const { instanceId, token, provider: providerName } = user.whatsappConfig || {};
  if (!instanceId || !token) {
    const err = new Error('Enter your instance ID and token first');
    err.status = 400;
    throw err;
  }

  const provider = await getWhatsAppProvider(providerName);
  return provider.getQRCode(instanceId, token);
}

export async function disconnectWhatsApp(actor) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can disconnect WhatsApp');
    err.status = 403;
    throw err;
  }

  const user = await User.findById(actor._id);
  user.whatsappConfig = {
    provider: null,
    instanceId: null,
    token: null,
    connected: false,
  };
  await user.save();
  return { disconnected: true };
}

export async function listSendableListings(actor, leadId) {
  const lead = await getLead(actor, leadId);
  if (!lead.assignedAgentId) {
    const err = new Error('Lead has no assigned agent');
    err.status = 400;
    throw err;
  }

  const agentId = lead.assignedAgentId._id || lead.assignedAgentId;
  const listings = await Listing.find({
    assignedAgentId: agentId,
    status: { $in: ['active', 'coming_soon'] },
  }).sort({ createdAt: -1 });

  const relatedId = lead.relatedListingId?._id?.toString() || lead.relatedListingId?.toString();

  return listings.map((l) => ({
    ...l.toObject(),
    isDefault: relatedId ? l._id.toString() === relatedId : false,
  }));
}

export async function sendPropertyViaWhatsApp(actor, leadId, listingId) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can send WhatsApp messages to leads');
    err.status = 403;
    throw err;
  }

  const lead = await getLead(actor, leadId);

  if (!lead.assignedAgentId) {
    const err = new Error('Lead has no assigned agent');
    err.status = 400;
    throw err;
  }

  const agent = await User.findById(lead.assignedAgentId._id || lead.assignedAgentId);
  if (!agent?.whatsappConfig?.instanceId || !agent.whatsappConfig?.token) {
    const err = new Error('Assigned agent has not connected WhatsApp');
    err.status = 400;
    throw err;
  }

  if (!agent.whatsappConfig.connected) {
    const err = new Error('Assigned agent WhatsApp is not authenticated');
    err.status = 400;
    throw err;
  }

  if (!agent.slug) {
    const err = new Error('Assigned agent has no public portfolio slug — update profile settings first');
    err.status = 400;
    throw err;
  }

  const listing = await Listing.findOne({
    _id: listingId,
    assignedAgentId: agent._id,
    status: { $in: ['active', 'coming_soon'] },
  });

  if (!listing) {
    const err = new Error('Listing not found or not assigned to this agent');
    err.status = 404;
    throw err;
  }

  await ensureListingSlug(listing);

  const provider = await getWhatsAppProvider(agent.whatsappConfig.provider);
  const to = normalizePhoneForWhatsApp(lead.phone);
  const message = buildLeadPropertyWhatsAppMessage(lead, listing, agent);

  try {
    const textResult = await provider.sendMessage(
      agent.whatsappConfig.instanceId,
      agent.whatsappConfig.token,
      to,
      message
    );
    assertMessageSent(textResult, 'text message');
  } catch (err) {
    if (isWhatsAppDisconnectError(err)) {
      await notifyWhatsAppDisconnected(agent);
    }
    throw err;
  }

  const addressLine = [listing.address?.street, listing.address?.city].filter(Boolean).join(', ');
  await createActivity(actor, leadId, {
    type: 'whatsapp_sent',
    content: `Sent property details via WhatsApp: ${addressLine} (PKR ${listing.price?.toLocaleString()})`,
  });

  return { sent: true, listingId: listing._id, to };
}
