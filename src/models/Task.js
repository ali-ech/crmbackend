import mongoose from 'mongoose';

const TASK_TYPES = ['call', 'followup_text', 'showing', 'document_deadline', 'contract_deadline'];
const TASK_STATUSES = ['pending', 'completed', 'missed'];

const taskSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TASK_TYPES, required: true },
    dueAt: { type: Date, required: true },
    status: { type: String, enum: TASK_STATUSES, default: 'pending' },
    escalatedAt: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ assignedUserId: 1, status: 1, dueAt: 1 });

export const TASK_TYPES_LIST = TASK_TYPES;
export const TASK_STATUSES_LIST = TASK_STATUSES;
export const Task = mongoose.model('Task', taskSchema);
