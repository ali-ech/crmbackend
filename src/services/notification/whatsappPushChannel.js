import { User } from '../../models/User.js';
import { getWhatsAppProvider } from '../whatsapp/WhatsAppProvider.js';
import { env } from '../../config/env.js';
import { notifyWhatsAppDisconnected } from '../notificationTriggers.js';
import { normalizePhoneForWhatsApp } from '../../utils/phone.js';

const PUSH_TYPES = new Set([
  'task_reminder',
  'task_missed',
  'task_escalation',
  'new_lead',
  'speed_to_lead',
  'lead_assigned',
]);

const DISCONNECT_PATTERNS = [
  /not authenticated/i,
  /disconnected/i,
  /session expired/i,
  /instance not found/i,
  /invalid token/i,
  /unauthorized/i,
  /authentication/i,
  /not connected/i,
];

export function isWhatsAppDisconnectError(err) {
  const msg = `${err?.message || ''} ${err?.status || ''}`;
  return DISCONNECT_PATTERNS.some((pattern) => pattern.test(msg));
}

export async function sendWhatsAppPush(user, { title, message }) {
  if (!env.notifyWhatsappPush) return { sent: false, reason: 'disabled' };

  const config = user.whatsappConfig;
  if (!config?.connected || !config.instanceId || !config.token) {
    return { sent: false, reason: 'not_connected' };
  }

  const phone = user.profile?.notificationPhone || user.profile?.phone;
  if (!phone) return { sent: false, reason: 'no_notification_phone' };

  const provider = await getWhatsAppProvider(config.provider);
  const body = `*${title}*\n${message}`;

  await provider.sendMessage(config.instanceId, config.token, normalizePhoneForWhatsApp(phone), body);
  return { sent: true };
}

export async function deliverWhatsAppPush(userId, payload) {
  if (payload.whatsapp === false) return { sent: false, reason: 'in_app_only' };
  if (!PUSH_TYPES.has(payload.type)) return { sent: false, reason: 'not_push_type' };

  const user = await User.findById(userId);
  if (!user) return { sent: false, reason: 'user_not_found' };

  try {
    return await sendWhatsAppPush(user, payload);
  } catch (err) {
    console.error(`WhatsApp push failed for user ${userId}:`, err.message);
    if (isWhatsAppDisconnectError(err)) {
      await notifyWhatsAppDisconnected(user);
    }
    return { sent: false, reason: err.message };
  }
}
