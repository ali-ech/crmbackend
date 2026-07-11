import { Task } from '../models/Task.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { getLead, canAccessLead } from './leadService.js';
import { scheduleTaskJobs, cancelTaskJobs } from '../queues/jobQueue.js';
import { dispatchNotification } from './notificationService.js';
import { Activity } from '../models/Activity.js';
import { buildDateRangeFilter } from '../utils/dateRange.js';

async function getManagerAgentIds(managerId) {
  const agents = await User.find({ role: 'agent', createdByUserId: managerId }).select('_id');
  return agents.map((a) => a._id);
}

function populateOptions() {
  return [
    { path: 'leadId', select: 'name phone status type' },
    { path: 'assignedUserId', select: 'profile.name role' },
  ];
}

export async function listTasks(actor, { status, leadId, dateFrom, dateTo, type } = {}) {
  const query = {};

  if (actor.role === 'agent') {
    query.assignedUserId = actor._id;
  } else if (actor.role === 'manager') {
    const agentIds = await getManagerAgentIds(actor._id);
    query.assignedUserId = { $in: [...agentIds, actor._id] };
  }

  if (status) query.status = status;
  if (leadId) query.leadId = leadId;
  if (type) query.type = type;

  if (dateFrom || dateTo) {
    const dueRange = buildDateRangeFilter(dateFrom, dateTo);
    if (dueRange) query.dueAt = dueRange;
  }

  return Task.find(query).populate(populateOptions()).sort({ dueAt: 1 });
}

export async function createTask(actor, { leadId, assignedUserId, type, dueAt, notes }) {
  if (actor.role !== 'agent') {
    const err = new Error('Only agents can schedule tasks');
    err.status = 403;
    throw err;
  }

  await getLead(actor, leadId);

  if (new Date(dueAt) <= new Date()) {
    const err = new Error('Due date must be in the future');
    err.status = 400;
    throw err;
  }

  if (actor.role === 'agent') {
    assignedUserId = actor._id.toString();
  }

  const assignee = await User.findOne({ _id: assignedUserId, status: 'active' });
  if (!assignee) {
    const err = new Error('Invalid assignee');
    err.status = 400;
    throw err;
  }

  if (actor.role === 'manager' && assignee.role === 'agent' && assignee.createdByUserId?.toString() !== actor._id.toString()) {
    const err = new Error('Cannot assign task to an agent outside your team');
    err.status = 403;
    throw err;
  }

  const task = await Task.create({
    leadId,
    assignedUserId,
    type,
    dueAt: new Date(dueAt),
    notes: notes || null,
  });

  await scheduleTaskJobs(task);
  return task.populate(populateOptions());
}

export async function updateTask(actor, taskId, updates) {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.status = 404;
    throw err;
  }

  const lead = await Lead.findById(task.leadId);
  const agentIds = actor.role === 'manager' ? await getManagerAgentIds(actor._id) : [];
  if (!canAccessLead(actor, lead, agentIds) && task.assignedUserId.toString() !== actor._id.toString()) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  if (updates.status === 'completed' && (task.status === 'pending' || task.status === 'missed')) {
    task.status = 'completed';
    await cancelTaskJobs(task._id);
  }

  if (updates.dueAt) {
    const newDue = new Date(updates.dueAt);
    if (newDue <= new Date()) {
      const err = new Error('Due date must be in the future');
      err.status = 400;
      throw err;
    }
    task.dueAt = newDue;
    if (task.status === 'pending') await scheduleTaskJobs(task);
  }

  if (updates.notes !== undefined) task.notes = updates.notes;

  await task.save();
  return task.populate(populateOptions());
}

export async function completeTask(actor, taskId) {
  return updateTask(actor, taskId, { status: 'completed' });
}

export async function nudgeTask(actor, taskId) {
  const task = await Task.findById(taskId).populate('leadId', 'name');
  if (!task) {
    const err = new Error('Task not found');
    err.status = 404;
    throw err;
  }

  if (task.status !== 'missed') {
    const err = new Error('Only overdue tasks can be nudged');
    err.status = 400;
    throw err;
  }

  const agent = await User.findById(task.assignedUserId);
  if (actor.role !== 'manager' || agent?.createdByUserId?.toString() !== actor._id.toString()) {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }

  const overdueMin = Math.max(1, Math.round((Date.now() - new Date(task.dueAt).getTime()) / 60000));
  await dispatchNotification({
    userId: task.assignedUserId,
    type: 'task_missed',
    title: 'Overdue task reminder',
    message: `${task.type.replace(/_/g, ' ')} for ${task.leadId?.name || 'lead'} is overdue (${overdueMin} min)`,
    relatedLeadId: task.leadId?._id || task.leadId,
    relatedTaskId: task._id,
  });

  await Activity.create({
    leadId: task.leadId._id || task.leadId,
    userId: actor._id,
    type: 'note',
    content: 'Manager nudged agent on overdue task',
  });

  return task.populate(populateOptions());
}
