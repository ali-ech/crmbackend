import * as analyticsService from '../services/analyticsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const dashboard = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDashboardAnalytics(req.user, req.query);
  res.json(data);
});

export const teamHierarchy = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTeamHierarchy(req.user, req.query);
  res.json(data);
});

export const chart = asyncHandler(async (req, res) => {
  const data = await analyticsService.getChartAnalytics(req.user, req.query);
  res.json(data);
});
