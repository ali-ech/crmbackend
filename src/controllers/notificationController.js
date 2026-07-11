import { param, validationResult } from 'express-validator';
import * as notificationService from '../services/notificationService.js';
import { subscribeNotifications } from '../services/notificationHub.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const list = asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  const notifications = await notificationService.listNotifications(req.user._id, { unreadOnly, limit });
  res.json(notifications);
});

export const latest = asyncHandler(async (req, res) => {
  const notification = await notificationService.getLatestNotification(req.user._id);
  res.json(notification || null);
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.user._id);
  res.json({ count });
});

export const markRead = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const notification = await notificationService.markRead(req.user._id, req.params.id);
  res.json(notification);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.user._id);
  res.json(result);
});

export const markSectionRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markSectionRead(req.user._id, req.params.section);
  res.json(result);
});

export const markReadValidators = [param('id').isMongoId()];

export const stream = asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ event: 'connected' })}\n\n`);

  const cleanup = subscribeNotifications(req.user._id, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      cleanup();
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanup();
  });
});
