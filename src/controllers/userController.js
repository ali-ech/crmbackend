import { body, param, validationResult } from 'express-validator';
import * as userService from '../services/userService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { User, ROLES_LIST } from '../models/User.js';

export const createUserValidators = [
  body('role').isIn(ROLES_LIST.filter((r) => r !== 'superadmin')),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('profile.name').trim().notEmpty(),
];

export const deactivateValidators = [
  param('id').isMongoId(),
  body('leadTargetAgentId').optional().isMongoId(),
  body('listingTargetAgentId').optional().isMongoId(),
  body('agentTargetManagerId').optional().isMongoId(),
];

export const list = asyncHandler(async (req, res) => {
  const { role, status, search } = req.query;
  const users = await userService.listUsers(req.user, { role, status, search });
  res.json(users);
});

export const create = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const user = await userService.createUser(req.user, req.body);
  res.status(201).json(user);
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.user, req.params.id, req.body);
  res.json(user);
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!userService.canViewUser(req.user, user)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  res.json(user);
});

export const deactivationPreview = asyncHandler(async (req, res) => {
  const preview = await userService.getDeactivationPreview(req.user, req.params.id);
  res.json(preview);
});

export const deactivate = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const user = await userService.deactivateUser(req.user, req.params.id, req.body);
  res.json(user);
});

export const reactivate = asyncHandler(async (req, res) => {
  const user = await userService.reactivateUser(req.user, req.params.id);
  res.json(user);
});

export const activeAgents = asyncHandler(async (req, res) => {
  const agents = await userService.listActiveAgents(req.user, req.query.exclude);
  res.json(agents);
});

export const activeManagers = asyncHandler(async (req, res) => {
  const managers = await userService.listActiveManagers(req.query.exclude);
  res.json(managers);
});
