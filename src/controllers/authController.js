import { body, validationResult } from 'express-validator';
import * as authService from '../services/authService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const loginValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await authService.login(req.body);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.json(user);
});
