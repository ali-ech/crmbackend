import mongoose from 'mongoose';

const NOTIFICATION_TYPES = [
  'task_reminder',
  'task_missed',
  'task_escalation',
  'new_lead',
  'speed_to_lead',
  'lead_assigned',
  'listing_assigned',
  'whatsapp_disconnected',
  'cold_lead',
  'deal_closed',
  'daily_digest',
];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    relatedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const NOTIFICATION_TYPES_LIST = NOTIFICATION_TYPES;
export const Notification = mongoose.model('Notification', notificationSchema);
