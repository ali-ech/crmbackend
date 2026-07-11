import { body, param, validationResult } from 'express-validator';
import * as whatsappService from '../services/whatsappService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const connectValidators = [
  body('instanceId').trim().notEmpty(),
  body('token').trim().notEmpty(),
  body('provider').optional().isIn(['ultramsg', 'wasender']),
];

export const sendValidators = [
  param('leadId').isMongoId(),
  body('listingId').isMongoId(),
];

export const status = asyncHandler(async (req, res) => {
  const result = await whatsappService.getWhatsAppStatus(req.user);
  res.json(result);
});

export const connect = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await whatsappService.connectWhatsApp(req.user, req.body);
  res.json(result);
});

export const qr = asyncHandler(async (req, res) => {
  const result = await whatsappService.getWhatsAppQR(req.user);
  res.json(result);
});

export const disconnect = asyncHandler(async (req, res) => {
  const result = await whatsappService.disconnectWhatsApp(req.user);
  res.json(result);
});

export const sendableListings = asyncHandler(async (req, res) => {
  const listings = await whatsappService.listSendableListings(req.user, req.params.leadId);
  res.json(listings);
});

export const sendProperty = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await whatsappService.sendPropertyViaWhatsApp(
    req.user,
    req.params.leadId,
    req.body.listingId
  );
  res.json(result);
});
