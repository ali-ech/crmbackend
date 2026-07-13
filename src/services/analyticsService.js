import { User } from '../models/User.js';
import { Lead, CLOSED_STATUSES } from '../models/Lead.js';
import { Task } from '../models/Task.js';
import { Activity } from '../models/Activity.js';
import { env } from '../config/env.js';

const ENGAGED_STATUSES = [
  'qualified', 'showing_scheduled', 'showing_completed',
  'under_contract',
  // legacy
  'contacted', 'offer_submitted', 'consultation_scheduled', 'agreement_signed', 'live_on_market', 'offer_received',
];

const REACHED_CONTACT_STATUSES = [
  ...ENGAGED_STATUSES,
  'nurture', 'closed_won', 'closed_lost', 'disqualified',
];

const TZ = env.brokerageTimezone || '+05:00';

function brokerageTzId() {
  if (TZ === '+05:00') return 'Asia/Karachi';
  return 'UTC';
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthStart() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: brokerageTzId(),
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return new Date(`${year}-${month}-01T00:00:00.000${TZ}`);
}

function getMonthLabel() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: brokerageTzId(),
  }).format(new Date());
}

function getMonthRange(monthsAgo = 0) {
  const ref = new Date();
  const cal = new Date(ref.getFullYear(), ref.getMonth() - monthsAgo, 1);
  const year = cal.getFullYear();
  const month = String(cal.getMonth() + 1).padStart(2, '0');
  const start = new Date(`${year}-${month}-01T00:00:00.000${TZ}`);
  const nextCal = new Date(cal.getFullYear(), cal.getMonth() + 1, 1);
  const nextYear = nextCal.getFullYear();
  const nextMonth = String(nextCal.getMonth() + 1).padStart(2, '0');
  const end = new Date(`${nextYear}-${nextMonth}-01T00:00:00.000${TZ}`);
  end.setMilliseconds(end.getMilliseconds() - 1);
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: brokerageTzId(),
  }).format(cal);
  return { start, end, label, key: `${year}-${month}` };
}

function monthBounds(year, month) {
  const m = String(month).padStart(2, '0');
  const start = new Date(`${year}-${m}-01T00:00:00.000${TZ}`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nm = String(nextMonth).padStart(2, '0');
  const end = new Date(`${nextYear}-${nm}-01T00:00:00.000${TZ}`);
  end.setMilliseconds(end.getMilliseconds() - 1);
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: brokerageTzId(),
  }).format(start);
  return { start, end, label, key: `${year}-${m}` };
}

function yearBounds(year) {
  const start = new Date(`${year}-01-01T00:00:00.000${TZ}`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000${TZ}`);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start, end, label: String(year), key: String(year) };
}

export function parseAnalyticsFilter(query = {}) {
  const scope = query.scope || 'month';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (scope === 'overall') {
    return { scope: 'overall', label: 'All time', dateRange: null };
  }

  const year = parseInt(query.year, 10) || currentYear;

  if (scope === 'year') {
    const range = yearBounds(year);
    return { scope: 'year', year, label: range.label, dateRange: { start: range.start, end: range.end } };
  }

  const month = parseInt(query.month, 10) || currentMonth;
  const range = monthBounds(year, month);
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: brokerageTzId(),
  }).format(range.start);

  return {
    scope: 'month',
    year,
    month,
    label,
    dateRange: { start: range.start, end: range.end },
  };
}

function contactRate(reachedContact, newLeads) {
  return newLeads > 0 ? Math.round((reachedContact / newLeads) * 100) : 0;
}

function conversionRate(closedWon, reachedContact) {
  return reachedContact > 0 ? Math.round((closedWon / reachedContact) * 100) : 0;
}

async function sumClosedRevenue(match) {
  const rows = await Lead.aggregate([
    { $match: { ...match, status: 'closed_won' } },
    { $group: { _id: null, revenue: { $sum: { $ifNull: ['$closedPrice', 0] } } } },
  ]);
  return rows[0]?.revenue || 0;
}

async function getScopedAgentIds(actor) {
  if (actor.role === 'agent') return [actor._id];
  if (actor.role === 'manager') {
    const agents = await User.find({ role: 'agent', createdByUserId: actor._id, status: 'active' }).select('_id');
    return agents.map((a) => a._id);
  }
  const agents = await User.find({ role: 'agent', status: 'active' }).select('_id');
  return agents.map((a) => a._id);
}

async function computeFunnel(agentIds, { dateRange } = {}) {
  if (!agentIds.length) {
    return { new: 0, contacted: 0, reachedContact: 0, closedWon: 0, closedLost: 0, active: 0, revenue: 0 };
  }

  const match = { assignedAgentId: { $in: agentIds } };

  if (dateRange?.start && dateRange?.end) {
    const { start, end } = dateRange;
    const periodMatch = { ...match, createdAt: { $gte: start, $lte: end } };
    const [newCount, contactedCount, reachedContact, closedWon, closedLost, activeInPeriod, revenue] = await Promise.all([
      Lead.countDocuments(periodMatch),
      Lead.countDocuments({ ...periodMatch, status: { $in: ENGAGED_STATUSES } }),
      Lead.countDocuments({ ...periodMatch, status: { $in: REACHED_CONTACT_STATUSES } }),
      Lead.countDocuments({ ...match, status: 'closed_won', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...match, status: 'closed_lost', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...periodMatch, status: { $nin: CLOSED_STATUSES } }),
      sumClosedRevenue({ ...match, updatedAt: { $gte: start, $lte: end } }),
    ]);
    return { new: newCount, contacted: contactedCount, reachedContact, closedWon, closedLost, active: activeInPeriod, revenue };
  }

  const rows = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
        contacted: { $sum: { $cond: [{ $in: ['$status', ENGAGED_STATUSES] }, 1, 0] } },
        reachedContact: { $sum: { $cond: [{ $in: ['$status', REACHED_CONTACT_STATUSES] }, 1, 0] } },
        closedWon: { $sum: { $cond: [{ $eq: ['$status', 'closed_won'] }, 1, 0] } },
        closedLost: { $sum: { $cond: [{ $eq: ['$status', 'closed_lost'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $not: { $in: ['$status', CLOSED_STATUSES] } }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'closed_won'] }, { $ifNull: ['$closedPrice', 0] }, 0] } },
      },
    },
  ]);

  return rows[0] || { new: 0, contacted: 0, reachedContact: 0, closedWon: 0, closedLost: 0, active: 0, revenue: 0 };
}

function trendMonthSpecs(filter = {}) {
  if (filter.scope === 'year' && filter.year) {
    return Array.from({ length: 12 }, (_, i) => monthBounds(filter.year, i + 1));
  }
  if (filter.scope === 'month' && filter.year && filter.month) {
    const specs = [];
    let y = filter.year;
    let m = filter.month;
    for (let i = 5; i >= 0; i -= 1) {
      let month = m - i;
      let year = y;
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      specs.push(monthBounds(year, month));
    }
    return specs;
  }
  return Array.from({ length: 12 }, (_, i) => getMonthRange(11 - i));
}

async function computeTrends(agentIds, filter = {}) {
  if (!agentIds.length) return [];

  const match = { assignedAgentId: { $in: agentIds } };
  const specs = trendMonthSpecs(filter);
  const points = [];

  for (const spec of specs) {
    const { start, end, label, key } = spec;
    const [newLeads, closedWon, closedLost, contacted] = await Promise.all([
      Lead.countDocuments({ ...match, createdAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...match, status: 'closed_won', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...match, status: 'closed_lost', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({
        ...match,
        createdAt: { $gte: start, $lte: end },
        status: { $in: ENGAGED_STATUSES },
      }),
    ]);
    points.push({ key, label, newLeads, closedWon, closedLost, contacted });
  }

  return points;
}

async function computePipelineBreakdown(agentIds) {
  if (!agentIds.length) return [];

  const rows = await Lead.aggregate([
    { $match: { assignedAgentId: { $in: agentIds }, status: { $nin: CLOSED_STATUSES } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r) => ({ status: r._id, count: r.count }));
}

async function computeSourceBreakdown(agentIds, { dateRange } = {}) {
  if (!agentIds.length) return [];

  const match = { assignedAgentId: { $in: agentIds } };
  if (dateRange?.start && dateRange?.end) {
    match.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }

  const rows = await Lead.aggregate([
    { $match: match },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r) => ({ source: r._id, count: r.count }));
}

async function computeOutcomeSplit(agentIds, { dateRange } = {}) {
  if (!agentIds.length) return { active: 0, closedWon: 0, closedLost: 0 };

  const match = { assignedAgentId: { $in: agentIds } };

  if (dateRange?.start && dateRange?.end) {
    const { start, end } = dateRange;
    const [closedWon, closedLost, active] = await Promise.all([
      Lead.countDocuments({ ...match, status: 'closed_won', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...match, status: 'closed_lost', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...match, createdAt: { $gte: start, $lte: end }, status: { $nin: CLOSED_STATUSES } }),
    ]);
    return { active, closedWon, closedLost };
  }

  const [active, closedWon, closedLost] = await Promise.all([
    Lead.countDocuments({ ...match, status: { $nin: CLOSED_STATUSES } }),
    Lead.countDocuments({ ...match, status: 'closed_won' }),
    Lead.countDocuments({ ...match, status: 'closed_lost' }),
  ]);

  return { active, closedWon, closedLost };
}

async function attachChartMetrics(agentIds, { dateRange, filter } = {}) {
  const [trends, pipelineBreakdown, sourceBreakdown, outcomeSplit] = await Promise.all([
    computeTrends(agentIds, filter),
    computePipelineBreakdown(agentIds),
    computeSourceBreakdown(agentIds, { dateRange }),
    computeOutcomeSplit(agentIds, { dateRange }),
  ]);

  return {
    trends,
    pipelineBreakdown,
    sourceBreakdown,
    outcomeSplit,
  };
}

async function computeSpeedToLead(agentIds, days = 30) {
  if (!agentIds.length) return { avgMinutes: null, sampleSize: 0 };

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await Activity.aggregate([
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$leadId', firstActivityAt: { $first: '$createdAt' } } },
    {
      $lookup: {
        from: 'leads',
        localField: '_id',
        foreignField: '_id',
        as: 'lead',
      },
    },
    { $unwind: '$lead' },
    {
      $match: {
        'lead.assignedAgentId': { $in: agentIds },
        'lead.createdAt': { $gte: since },
      },
    },
    {
      $project: {
        minutes: {
          $divide: [{ $subtract: ['$firstActivityAt', '$lead.createdAt'] }, 60000],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgMinutes: { $avg: '$minutes' },
        sampleSize: { $sum: 1 },
      },
    },
  ]);

  if (!result.length) return { avgMinutes: null, sampleSize: 0 };
  return {
    avgMinutes: Math.round(result[0].avgMinutes),
    sampleSize: result[0].sampleSize,
  };
}

async function computeAgentMetrics(agent, { dateRange } = {}) {
  const agentId = agent._id;

  async function metricsForRange(range) {
    const baseMatch = { assignedAgentId: agentId };

    if (!range) {
      const [activeLeads, newLeads, contacted, reachedContact, closedWon, closedLost, revenue] = await Promise.all([
        Lead.countDocuments({ ...baseMatch, status: { $nin: CLOSED_STATUSES } }),
        Lead.countDocuments({ ...baseMatch, status: 'new' }),
        Lead.countDocuments({ ...baseMatch, status: { $in: ENGAGED_STATUSES } }),
        Lead.countDocuments({ ...baseMatch, status: { $in: REACHED_CONTACT_STATUSES } }),
        Lead.countDocuments({ ...baseMatch, status: 'closed_won' }),
        Lead.countDocuments({ ...baseMatch, status: 'closed_lost' }),
        sumClosedRevenue(baseMatch),
      ]);
      const totalNew = activeLeads + closedWon + closedLost;
      return {
        activeLeads,
        newLeads,
        contacted,
        reachedContact,
        closedWon,
        closedLost,
        revenue,
        contactRate: contactRate(reachedContact, totalNew),
        conversionRate: conversionRate(closedWon, reachedContact),
      };
    }

    const { start, end } = range;
    const periodMatch = { ...baseMatch, createdAt: { $gte: start, $lte: end } };
    const [newLeads, contacted, reachedContact, closedWon, closedLost, activeLeads, revenue] = await Promise.all([
      Lead.countDocuments(periodMatch),
      Lead.countDocuments({ ...periodMatch, status: { $in: ENGAGED_STATUSES } }),
      Lead.countDocuments({ ...periodMatch, status: { $in: REACHED_CONTACT_STATUSES } }),
      Lead.countDocuments({ ...baseMatch, status: 'closed_won', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...baseMatch, status: 'closed_lost', updatedAt: { $gte: start, $lte: end } }),
      Lead.countDocuments({ ...periodMatch, status: { $nin: CLOSED_STATUSES } }),
      sumClosedRevenue({ ...baseMatch, updatedAt: { $gte: start, $lte: end } }),
    ]);
    return {
      activeLeads,
      newLeads,
      contacted,
      reachedContact,
      closedWon,
      closedLost,
      revenue,
      contactRate: contactRate(reachedContact, newLeads),
      conversionRate: conversionRate(closedWon, reachedContact),
    };
  }

  const [overall, periodStats] = await Promise.all([
    metricsForRange(null),
    dateRange ? metricsForRange(dateRange) : metricsForRange(null),
  ]);

  return {
    agentId,
    name: agent.profile?.name,
    slug: agent.slug,
    status: agent.status,
    overall,
    stats: dateRange ? periodStats : overall,
  };
}

function rollupMetrics(agentMetrics) {
  const rolled = agentMetrics.reduce(
    (acc, a) => {
      const m = a.stats;
      if (!m) return acc;
      acc.activeLeads += m.activeLeads || 0;
      acc.newLeads += m.newLeads || 0;
      acc.contacted += m.contacted || 0;
      acc.reachedContact += m.reachedContact || 0;
      acc.closedWon += m.closedWon || 0;
      acc.closedLost += m.closedLost || 0;
      acc.revenue += m.revenue || 0;
      return acc;
    },
    { activeLeads: 0, newLeads: 0, contacted: 0, reachedContact: 0, closedWon: 0, closedLost: 0, revenue: 0 }
  );
  rolled.contactRate = contactRate(rolled.reachedContact, rolled.newLeads);
  rolled.conversionRate = conversionRate(rolled.closedWon, rolled.reachedContact);
  return rolled;
}

async function buildTeamHierarchy({ dateRange, statusFilter = 'active' } = {}) {
  const managerQuery = { role: 'manager' };
  if (statusFilter) managerQuery.status = statusFilter;

  const managers = await User.find(managerQuery)
    .select('profile.name email status createdAt')
    .sort({ 'profile.name': 1 });

  const agentQuery = { role: 'agent' };
  if (statusFilter) agentQuery.status = statusFilter;
  const allAgents = await User.find(agentQuery)
    .select('profile.name email slug status createdByUserId')
    .sort({ 'profile.name': 1 });

  const agentsByManager = new Map();
  const orphanAgents = [];

  for (const agent of allAgents) {
    const managerId = agent.createdByUserId?.toString();
    if (managerId && managers.some((m) => m._id.toString() === managerId)) {
      if (!agentsByManager.has(managerId)) agentsByManager.set(managerId, []);
      agentsByManager.get(managerId).push(agent);
    } else {
      orphanAgents.push(agent);
    }
  }

  const teams = await Promise.all(
    managers.map(async (manager) => {
      const agents = agentsByManager.get(manager._id.toString()) || [];
      const agentMetrics = await Promise.all(
        agents.map((agent) => computeAgentMetrics(agent, { dateRange }))
      );
      return {
        managerId: manager._id,
        managerName: manager.profile?.name,
        managerEmail: manager.email,
        managerStatus: manager.status,
        agentCount: agents.length,
        agents: agentMetrics.sort((a, b) => (b.stats?.closedWon || 0) - (a.stats?.closedWon || 0)),
        stats: rollupMetrics(agentMetrics),
      };
    })
  );

  let orphanTeam = null;
  if (orphanAgents.length) {
    const agentMetrics = await Promise.all(
      orphanAgents.map((agent) => computeAgentMetrics(agent, { dateRange }))
    );
    orphanTeam = {
      managerId: null,
      managerName: 'Unassigned agents',
      managerEmail: null,
      managerStatus: 'active',
      agentCount: orphanAgents.length,
      agents: agentMetrics,
      stats: rollupMetrics(agentMetrics),
    };
  }

  return orphanTeam ? [...teams, orphanTeam] : teams;
}

async function getAgentDashboard(actor, filter) {
  const { end: endOfToday } = todayBounds();
  const dateRange = filter.dateRange;

  const [openTasksToday, newLeads, pipelineRows, overallFunnel, periodFunnel, charts] = await Promise.all([
    Task.countDocuments({
      assignedUserId: actor._id,
      status: 'pending',
      dueAt: { $lte: endOfToday },
    }),
    Lead.countDocuments({ assignedAgentId: actor._id, status: 'new' }),
    Lead.aggregate([
      { $match: { assignedAgentId: actor._id, status: { $nin: CLOSED_STATUSES } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    computeFunnel([actor._id]),
    computeFunnel([actor._id], { dateRange }),
    attachChartMetrics([actor._id], { dateRange, filter }),
  ]);

  return {
    role: 'agent',
    filter,
    period: {
      label: filter.label,
      funnel: dateRange ? periodFunnel : overallFunnel,
    },
    overall: {
      label: 'All time',
      funnel: overallFunnel,
    },
    openTasksToday,
    newLeads,
    pipeline: pipelineRows.map((r) => ({ status: r._id, count: r.count })),
    charts,
  };
}

async function getManagerDashboard(actor, filter) {
  const agentIds = await getScopedAgentIds(actor);
  const agents = await User.find({ _id: { $in: agentIds } })
    .select('profile.name slug status')
    .sort({ 'profile.name': 1 });

  const dateRange = filter.dateRange;
  const [overallFunnel, periodFunnel, speedToLead, agentMetrics, charts] = await Promise.all([
    computeFunnel(agentIds),
    computeFunnel(agentIds, { dateRange }),
    computeSpeedToLead(agentIds),
    Promise.all(agents.map((agent) => computeAgentMetrics(agent, { dateRange }))),
    attachChartMetrics(agentIds, { dateRange, filter }),
  ]);

  const mapAgents = agentMetrics
    .map((a) => ({
      agentId: a.agentId,
      name: a.name,
      slug: a.slug,
      stats: a.stats,
      ...a.stats,
    }))
    .sort((a, b) => (b.activeLeads || 0) - (a.activeLeads || 0));

  const topPerformers = [...mapAgents]
    .sort((a, b) => (b.stats?.revenue || 0) - (a.stats?.revenue || 0) || (b.stats?.closedWon || 0) - (a.stats?.closedWon || 0))
    .slice(0, 5)
    .map((a, i) => ({
      rank: i + 1,
      agentId: a.agentId,
      name: a.name,
      slug: a.slug,
      stats: a.stats,
    }));

  const agentComparison = mapAgents;

  return {
    role: 'manager',
    filter,
    org: {
      activeLeads: overallFunnel.active,
    },
    period: {
      label: filter.label,
      funnel: dateRange ? periodFunnel : overallFunnel,
      agents: mapAgents,
    },
    overall: {
      label: 'All time',
      funnel: overallFunnel,
    },
    speedToLead,
    topPerformers,
    agentComparison,
    charts,
  };
}

async function getSuperadminDashboard(filter) {
  const dateRange = filter.dateRange;
  const agentIds = await getScopedAgentIds({ role: 'superadmin' });

  const [managers, agents, teams, overallFunnel, periodFunnel, speedToLead, charts] = await Promise.all([
    User.countDocuments({ role: 'manager', status: 'active' }),
    User.countDocuments({ role: 'agent', status: 'active' }),
    buildTeamHierarchy({ dateRange }),
    computeFunnel(agentIds),
    computeFunnel(agentIds, { dateRange }),
    computeSpeedToLead(agentIds),
    attachChartMetrics(agentIds, { dateRange, filter }),
  ]);

  const teamChartData = teams
    .filter((t) => t.managerId)
    .map((t) => ({
      managerId: t.managerId,
      name: t.managerName,
      agents: t.agentCount,
      newLeads: t.stats?.newLeads || 0,
      closedWon: t.stats?.closedWon || 0,
      revenue: t.stats?.revenue || 0,
      contactRate: t.stats?.contactRate || 0,
      conversionRate: t.stats?.conversionRate || 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.closedWon - a.closedWon);

  const flatAgents = teams.flatMap((t) => t.agents);
  const topPerformers = [...flatAgents]
    .sort((a, b) => (b.stats?.revenue || 0) - (a.stats?.revenue || 0) || (b.stats?.closedWon || 0) - (a.stats?.closedWon || 0))
    .slice(0, 5)
    .map((a, i) => ({ rank: i + 1, ...a }));

  const agentComparison = flatAgents
    .map((a) => ({
      agentId: a.agentId,
      name: a.name,
      slug: a.slug,
      managerName: teams.find((t) => t.agents.some((ag) => ag.agentId.toString() === a.agentId.toString()))?.managerName,
      ...a.stats,
    }))
    .sort((a, b) => b.activeLeads - a.activeLeads);

  return {
    role: 'superadmin',
    filter,
    org: {
      managers,
      agents,
      activeLeads: overallFunnel.active,
    },
    period: {
      label: filter.label,
      funnel: dateRange ? periodFunnel : overallFunnel,
      totalRevenue: (dateRange ? periodFunnel : overallFunnel)?.revenue || 0,
      teams: teams.map((t) => ({
        ...t,
        agents: t.agents.map((a) => ({ ...a, stats: a.stats })),
      })),
    },
    overall: {
      label: 'All time',
      funnel: overallFunnel,
    },
    speedToLead,
    topPerformers,
    agentComparison,
    teams,
    charts: {
      ...charts,
      teamComparison: teamChartData,
    },
  };
}

async function getTeamDashboard(actor, filter) {
  if (actor.role === 'superadmin') return getSuperadminDashboard(filter);
  return getManagerDashboard(actor, filter);
}

export async function getDashboardAnalytics(actor, query = {}) {
  const filter = parseAnalyticsFilter(query);
  if (actor.role === 'agent') return getAgentDashboard(actor, filter);
  return getTeamDashboard(actor, filter);
}

export async function getTeamHierarchy(actor, query = {}) {
  if (actor.role !== 'superadmin') {
    const err = new Error('Insufficient permissions');
    err.status = 403;
    throw err;
  }
  const filter = parseAnalyticsFilter(query);
  return {
    filter,
    teams: await buildTeamHierarchy({ dateRange: filter.dateRange, statusFilter: null }),
  };
}

export async function getChartAnalytics(actor, query = {}) {
  const filter = parseAnalyticsFilter(query);
  const chart = query.chart;
  const agentIds = await getScopedAgentIds(actor);
  const dateRange = filter.dateRange;

  switch (chart) {
    case 'trend':
      return { filter, data: { trends: await computeTrends(agentIds, filter) } };
    case 'sources':
      return { filter, data: { sourceBreakdown: await computeSourceBreakdown(agentIds, { dateRange }) } };
    case 'outcomes':
      return { filter, data: { outcomeSplit: await computeOutcomeSplit(agentIds, { dateRange }) } };
    case 'kpi':
      return { filter, data: { funnel: await computeFunnel(agentIds, { dateRange }) } };
    default: {
      const err = new Error('Unknown chart type');
      err.status = 400;
      throw err;
    }
  }
}
