import { body, param, query, validationResult } from 'express-validator';
import * as taskService from '../services/taskService.js';
import { TASK_TYPES_LIST, TASK_STATUSES_LIST } from '../models/Task.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createValidators = [
  body('leadId').isMongoId(),
  body('assignedUserId').isMongoId(),
  body('type').isIn(TASK_TYPES_LIST),
  body('dueAt').isISO8601(),
  body('notes').optional({ nullable: true }).trim(),
];

export const updateValidators = [
  param('id').isMongoId(),
  body('status').optional().isIn(TASK_STATUSES_LIST),
  body('dueAt').optional().isISO8601(),
  body('notes').optional({ nullable: true }).trim(),
];

export const list = asyncHandler(async (req, res) => {
  const tasks = await taskService.listTasks(req.user, req.query);
  res.json(tasks);
});

export const create = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = await taskService.createTask(req.user, req.body);
  res.status(201).json(task);
});

export const update = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = await taskService.updateTask(req.user, req.params.id, req.body);
  res.json(task);
});

export const complete = asyncHandler(async (req, res) => {
  const task = await taskService.completeTask(req.user, req.params.id);
  res.json(task);
});

export const nudge = asyncHandler(async (req, res) => {
  const task = await taskService.nudgeTask(req.user, req.params.id);
  res.json(task);
});
