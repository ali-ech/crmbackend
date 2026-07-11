import mongoose from 'mongoose';

const ACTIVITY_TYPES = ['note', 'call', 'whatsapp_sent', 'status_change', 'email', 'assignment'];

const activitySchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const ACTIVITY_TYPES_LIST = ACTIVITY_TYPES;
export const Activity = mongoose.model('Activity', activitySchema);
