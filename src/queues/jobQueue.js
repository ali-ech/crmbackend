import { Queue, Worker } from 'bullmq';
import { getRedisConnection, isRedisConfigured } from '../config/redis.js';
import { env } from '../config/env.js';
import { Task } from '../models/Task.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { Activity } from '../models/Activity.js';
import { dispatchNotification } from '../services/notificationService.js';
import { getOwningManager } from '../services/userService.js';
import {
  resolveUnassignedLeadManagers,
  notifyDealClosed,
} from '../services/notificationTriggers.js';

const QUEUE_NAME = 'crm-jobs';
let queue = null;
let worker = null;

const TASK_JOB_SUFFIXES = ['reminder', 'miss-check', 'escalation'];
const LEGACY_TASK_JOB_SUFFIXES = ['reminder-1h', 'reminder-15m', 'overdue'];

function connection() {
  return getRedisConnection();
}

export function getQueue() {
  if (!isRedisConfigured()) return null;
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: connection() });
  return queue;
}

function taskJobId(taskId, suffix) {
  return `${taskId}-${suffix}`;
}

export async function cancelTaskJobs(taskId) {
  const q = getQueue();
  if (!q) return;
  const id = taskId.toString();
  for (const suffix of [...TASK_JOB_SUFFIXES, ...LEGACY_TASK_JOB_SUFFIXES, 'overdue']) {
    for (const jobId of [taskJobId(id, suffix), `task:${id}:${suffix}`]) {
      const job = await q.getJob(jobId);
      if (job) await job.remove();
    }
  }
}

export async function scheduleTaskJobs(task) {
  const q = getQueue();
  if (!q || task.status !== 'pending') return;

  await cancelTaskJobs(task._id);

  const due = new Date(task.dueAt).getTime();
  const now = Date.now();
  const id = task._id.toString();

  const jobs = [
    { suffix: 'reminder', name: 'task-reminder', delay: due - now - 30 * 60 * 1000 },
    { suffix: 'miss-check', name: 'task-overdue', delay: due - now },
    { suffix: 'escalation', name: 'task-escalation', delay: due - now + 2 * 60 * 60 * 1000 },
  ];

  for (const job of jobs) {
    if (job.delay > 0) {
      await q.add(job.name, { taskId: id }, {
        jobId: taskJobId(id, job.suffix),
        delay: job.delay,
      });
    }
  }
}

export async function scheduleSpeedToLeadJob(leadId) {
  const q = getQueue();
  if (!q) return;

  const delay = env.speedToLeadMinutes * 60 * 1000;
  const jobId = `lead:${leadId}:speed-to-lead`;

  const existing = await q.getJob(jobId);
  if (existing) await existing.remove();

  await q.add('speed-to-lead', { leadId: leadId.toString() }, { jobId, delay });
}

export async function cancelSpeedToLeadJob(leadId) {
  const q = getQueue();
  if (!q) return;
  const job = await q.getJob(`lead:${leadId}:speed-to-lead`);
  if (job) await job.remove();
}

function formatTaskType(type) {
  return type.replace(/_/g, ' ');
}

function formatDueTime(dueAt) {
  return new Date(dueAt).toLocaleString();
}

async function handleTaskReminder(taskId) {
  const task = await Task.findById(taskId).populate('leadId', 'name');
  if (!task || task.status !== 'pending') return;

  await dispatchNotification({
    userId: task.assignedUserId,
    type: 'task_reminder',
    title: 'Task due in 30 minutes',
    message: `${formatTaskType(task.type)} for ${task.leadId?.name || 'lead'} due at ${formatDueTime(task.dueAt)}`,
    relatedLeadId: task.leadId?._id || task.leadId,
    relatedTaskId: task._id,
  });
}

async function handleTaskOverdue(taskId) {
  const task = await Task.findById(taskId).populate('leadId', 'name');
  if (!task || task.status !== 'pending') return;

  task.status = 'missed';
  await task.save();

  await dispatchNotification({
    userId: task.assignedUserId,
    type: 'task_missed',
    title: 'Task overdue',
    message: `${formatTaskType(task.type)} for ${task.leadId?.name || 'lead'} is now overdue (was due ${formatDueTime(task.dueAt)})`,
    relatedLeadId: task.leadId?._id || task.leadId,
    relatedTaskId: task._id,
  });
}

async function handleTaskEscalation(taskId) {
  const task = await Task.findById(taskId).populate('leadId', 'name');
  if (!task || task.status !== 'missed') return;

  task.escalatedAt = new Date();
  await task.save();

  const agent = await User.findById(task.assignedUserId);
  const manager = await getOwningManager(task.assignedUserId);
  if (!manager) return;

  const overdueMs = Date.now() - new Date(task.dueAt).getTime();
  const overdueHours = Math.max(1, Math.round(overdueMs / (60 * 60 * 1000)));

  await dispatchNotification({
    userId: manager._id,
    type: 'task_escalation',
    title: 'Overdue task escalation',
    message: `${agent?.profile?.name || 'Agent'} missed ${formatTaskType(task.type)} for ${task.leadId?.name || 'lead'} — ${overdueHours}h overdue`,
    relatedLeadId: task.leadId?._id || task.leadId,
    relatedTaskId: task._id,
    whatsapp: false,
  });

  if (env.notifySuperadminOnEscalation) {
    const superadmins = await User.find({ role: 'superadmin', status: 'active' });
    for (const admin of superadmins) {
      await dispatchNotification({
        userId: admin._id,
        type: 'task_escalation',
        title: 'Overdue task escalation',
        message: `${agent?.profile?.name || 'Agent'} missed ${formatTaskType(task.type)} for ${task.leadId?.name || 'lead'}`,
        relatedLeadId: task.leadId?._id || task.leadId,
        relatedTaskId: task._id,
        whatsapp: false,
      });
    }
  }
}

async function getManagerAgentIds(managerId) {
  const agents = await User.find({ role: 'agent', createdByUserId: managerId }).select('_id');
  return agents.map((a) => a._id);
}

async function handleSpeedToLead(leadId) {
  const lead = await Lead.findById(leadId);
  if (!lead || lead.status !== 'new') return;

  const activityCount = await Activity.countDocuments({ leadId });
  if (activityCount > 0) return;

  const managers = lead.assignedAgentId
    ? [await getOwningManager(lead.assignedAgentId)].filter(Boolean)
    : await resolveUnassignedLeadManagers(lead);

  for (const manager of managers) {
    await dispatchNotification({
      userId: manager._id,
      type: 'speed_to_lead',
      title: 'Speed-to-lead alert',
      message: `No contact activity on new lead ${lead.name} (${lead.phone}) after ${env.speedToLeadMinutes} minutes`,
      relatedLeadId: lead._id,
      whatsapp: false,
    });
  }
}

export async function notifyNewLead(lead) {
  if (lead.assignedAgentId) {
    await dispatchNotification({
      userId: lead.assignedAgentId,
      type: 'new_lead',
      title: 'New lead',
      message: `${lead.name} (${lead.phone}) — ${lead.source.replace(/_/g, ' ')}`,
      relatedLeadId: lead._id,
    });
    return;
  }

  const managers = await resolveUnassignedLeadManagers(lead);
  for (const manager of managers) {
    await dispatchNotification({
      userId: manager._id,
      type: 'new_lead',
      title: 'New unassigned lead',
      message: `${lead.name} (${lead.phone}) — ${lead.source.replace(/_/g, ' ')}`,
      relatedLeadId: lead._id,
      whatsapp: false,
    });
  }
}

const STALE_EXCLUDE = ['nurture', 'closed_won', 'closed_lost', 'disqualified'];

async function handleColdLeadScan() {
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const leads = await Lead.find({
    assignedAgentId: { $ne: null },
    status: { $nin: STALE_EXCLUDE },
  }).select('_id name status assignedAgentId updatedAt createdAt');

  for (const lead of leads) {
    const lastActivity = await Activity.findOne({ leadId: lead._id })
      .sort({ createdAt: -1 })
      .select('createdAt');
    const lastTouch = lastActivity?.createdAt || lead.updatedAt || lead.createdAt;
    if (lastTouch >= cutoff) continue;

    const days = Math.floor((Date.now() - lastTouch.getTime()) / (24 * 60 * 60 * 1000));
    await dispatchNotification({
      userId: lead.assignedAgentId,
      type: 'cold_lead',
      title: 'Stale lead follow-up',
      message: `Lead ${lead.name} has been in '${lead.status.replace(/_/g, ' ')}' for ${days} days — might be worth a follow-up.`,
      relatedLeadId: lead._id,
      whatsapp: false,
    });
  }
}

async function handleDailyDigest() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const agents = await User.find({ role: 'agent', status: 'active' });
  for (const agent of agents) {
    const [dueToday, overdue, needsContact] = await Promise.all([
      Task.countDocuments({
        assignedUserId: agent._id,
        status: 'pending',
        dueAt: { $gte: startOfDay, $lte: endOfDay },
      }),
      Task.countDocuments({ assignedUserId: agent._id, status: 'missed' }),
      Lead.countDocuments({ assignedAgentId: agent._id, status: 'new' }),
    ]);

    await dispatchNotification({
      userId: agent._id,
      type: 'daily_digest',
      title: 'Your day ahead',
      message: `Today: ${dueToday} tasks, ${overdue} overdue, ${needsContact} leads need first contact.`,
      whatsapp: false,
    });
  }

  const managers = await User.find({ role: 'manager', status: 'active' });
  for (const manager of managers) {
    const agentIds = await getManagerAgentIds(manager._id);
    const [openTasks, overdue, newLeads] = await Promise.all([
      Task.countDocuments({ assignedUserId: { $in: agentIds }, status: 'pending' }),
      Task.countDocuments({ assignedUserId: { $in: agentIds }, status: 'missed' }),
      Lead.countDocuments({ assignedAgentId: null, createdAt: { $gte: yesterday } }),
    ]);

    await dispatchNotification({
      userId: manager._id,
      type: 'daily_digest',
      title: 'Team summary',
      message: `Team: ${openTasks} open tasks, ${overdue} overdue, ${newLeads} new unassigned leads in the last 24h.`,
      whatsapp: false,
    });
  }
}

async function handlePurgeDisqualified() {
  const { purgeDisqualifiedLeads } = await import('../services/leadService.js');
  const result = await purgeDisqualifiedLeads();
  if (result.deleted > 0) {
    console.log(`Purged ${result.deleted} disqualified lead(s) older than ${result.purgeDays} days`);
  }
}

async function registerRepeatableJobs() {
  const q = getQueue();
  if (!q) return;

  const cron = env.dailyDigestCron || '0 3 * * *';

  await q.add('daily-digest', {}, {
    repeat: { pattern: cron },
    jobId: 'repeat:daily-digest',
  });

  await q.add('cold-lead-scan', {}, {
    repeat: { pattern: cron },
    jobId: 'repeat:cold-lead-scan',
  });

  await q.add('purge-disqualified', {}, {
    repeat: { pattern: cron },
    jobId: 'repeat:purge-disqualified',
  });
}

export function startJobWorker() {
  if (!isRedisConfigured() || worker) return;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'task-reminder':
          await handleTaskReminder(job.data.taskId);
          break;
        case 'task-overdue':
          await handleTaskOverdue(job.data.taskId);
          break;
        case 'task-escalation':
          await handleTaskEscalation(job.data.taskId);
          break;
        case 'speed-to-lead':
          await handleSpeedToLead(job.data.leadId);
          break;
        case 'cold-lead-scan':
          await handleColdLeadScan();
          break;
        case 'purge-disqualified':
          await handlePurgeDisqualified();
          break;
        case 'daily-digest':
          await handleDailyDigest();
          break;
        default:
          break;
      }
    },
    { connection: connection() }
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.name} failed:`, err.message);
  });

  registerRepeatableJobs().catch((err) => {
    console.error('Failed to register repeatable jobs:', err.message);
  });

  console.log('BullMQ worker started');
}
