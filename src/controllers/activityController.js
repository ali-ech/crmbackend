import { body, param, validationResult } from 'express-validator';
import * as activityService from '../services/activityService.js';
import { ACTIVITY_TYPES_LIST } from '../models/Activity.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createValidators = [
  param('leadId').isMongoId(),
  body('type').isIn(ACTIVITY_TYPES_LIST),
  body('content').trim().notEmpty(),
];

export const list = asyncHandler(async (req, res) => {
  const activities = await activityService.listActivities(req.user, req.params.leadId);
  res.json(activities);
});

export const create = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const activity = await activityService.createActivity(req.user, req.params.leadId, req.body);
  res.status(201).json(activity);
});
