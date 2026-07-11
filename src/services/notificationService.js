import { Notification } from '../models/Notification.js';
import { deliverWhatsAppPush } from './notification/whatsappPushChannel.js';
import { publishNotification } from './notificationHub.js';

export async function dispatchNotification({
  userId,
  type,
  title,
  message,
  relatedLeadId = null,
  relatedTaskId = null,
  whatsapp,
}) {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    relatedLeadId,
    relatedTaskId,
  });

  const payload = notification.toObject();
  publishNotification(userId, { event: 'notification', notification: payload });

  await deliverWhatsAppPush(userId, { type, title, message, whatsapp });

  return notification;
}

export async function listNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const query = { userId };
  if (unreadOnly) query.read = false;
  return Notification.find(query).sort({ createdAt: -1 }).limit(limit);
}

export async function markRead(userId, notificationId) {
  const n = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );
  if (!n) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  return n;
}

export async function markAllRead(userId) {
  await Notification.updateMany({ userId, read: false }, { read: true });
  return { success: true };
}

const SECTION_TYPES = {
  leads: ['new_lead', 'speed_to_lead', 'lead_assigned', 'deal_closed', 'cold_lead'],
  tasks: ['task_reminder', 'task_missed', 'task_escalation', 'daily_digest'],
  listings: ['listing_assigned'],
};

export async function markSectionRead(userId, section) {
  const types = SECTION_TYPES[section];
  if (!types) {
    const err = new Error('Invalid notification section');
    err.status = 400;
    throw err;
  }
  const result = await Notification.updateMany(
    { userId, read: false, type: { $in: types } },
    { read: true }
  );
  return { updated: result.modifiedCount };
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ userId, read: false });
}

export async function getLatestNotification(userId) {
  return Notification.findOne({ userId }).sort({ createdAt: -1 });
}
