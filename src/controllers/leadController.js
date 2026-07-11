import { body, param, query, validationResult } from 'express-validator';
import * as leadService from '../services/leadService.js';
import * as leadImportService from '../services/leadImportService.js';
import {
  LEAD_TYPES_LIST,
  LEAD_SOURCES_LIST,
  BUYER_STATUSES_LIST,
  SELLER_STATUSES_LIST,
  LOST_REASONS_LIST,
} from '../models/Lead.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const ALL_STATUSES = [...new Set([...BUYER_STATUSES_LIST, ...SELLER_STATUSES_LIST])];

export const createValidators = [
  body('type').isIn(LEAD_TYPES_LIST),
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('source').optional().isIn(LEAD_SOURCES_LIST),
  body('assignedAgentId').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('relatedListingId').optional({ nullable: true, checkFalsy: true }).isMongoId(),
];

export const updateValidators = [
  param('id').isMongoId(),
  body('status').optional().isIn(ALL_STATUSES),
  body('lostReason').optional({ nullable: true }).isIn(LOST_REASONS_LIST),
  body('type').optional().isIn(LEAD_TYPES_LIST),
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('assignedAgentId').optional({ nullable: true }).custom((v) => v === null || /^[a-f\d]{24}$/i.test(v)),
  body('relatedListingId').optional({ nullable: true }).custom((v) => v === null || /^[a-f\d]{24}$/i.test(v)),
];

export const listValidators = [
  query('status').optional().isIn(ALL_STATUSES),
  query('type').optional().isIn(LEAD_TYPES_LIST),
  query('source').optional().isIn(LEAD_SOURCES_LIST),
  query('agentId').optional().isMongoId(),
  query('dateFrom').optional({ checkFalsy: true }).isString(),
  query('dateTo').optional({ checkFalsy: true }).isString(),
];

export const list = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const leads = await leadService.listLeads(req.user, req.query);
  res.json(leads);
});

export const getOne = asyncHandler(async (req, res) => {
  const lead = await leadService.getLead(req.user, req.params.id);
  res.json(lead);
});

export const create = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const allowDuplicate = req.body.allowDuplicate === true;
  try {
    const lead = await leadService.createLead(req.user, req.body, { allowDuplicate });
    res.status(201).json(lead);
  } catch (err) {
    if (err.status === 409 && err.duplicate) {
      return res.status(409).json({ error: err.message, duplicate: err.duplicate });
    }
    throw err;
  }
});

export const update = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const lead = await leadService.updateLead(req.user, req.params.id, req.body);
  res.json(lead);
});

export const merge = asyncHandler(async (req, res) => {
  const original = await leadService.mergeLead(req.user, req.params.id);
  res.json({ merged: true, original });
});

export const importParseValidators = [
  body('text').trim().notEmpty().withMessage('Text is required'),
];

export const importConfirmValidators = [
  body('leads').isArray({ min: 1 }).withMessage('At least one lead is required'),
  body('leads.*.name').trim().notEmpty(),
  body('leads.*.phone').trim().notEmpty(),
  body('leads.*.type').optional().isIn(LEAD_TYPES_LIST),
  body('leads.*.email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('leads.*.note').optional({ nullable: true }).isString(),
  body('leads.*.source').optional().isIn(['facebook_ad', 'tiktok_ad', 'referral', 'bulk_import', 'manual']),
  body('leads.*.sourceDetail').optional({ nullable: true }).isString(),
  body('leads.*.propertyInterest').optional({ nullable: true }).isString(),
  body('leads.*.propertyType').optional({ nullable: true }).isIn(['house', 'apartment', 'plot', 'commercial']),
  body('leads.*.importDuplicate').optional().isBoolean(),
];

export const importParse = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await leadImportService.parseImport(req.user, req.body.text);
  res.json(result);
});

export const importParseFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const result = await leadImportService.parseImportFromFile(req.user, req.file);
  res.json(result);
});

export const importConfirm = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await leadImportService.confirmImport(req.user, req.body.leads);
  res.status(201).json(result);
});

export const bulkAssignValidators = [
  body('leadIds').isArray({ min: 1 }),
  body('leadIds.*').isMongoId(),
  body('agentId').isMongoId(),
];

export const bulkAssign = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await leadService.bulkAssignLeads(req.user, req.body);
  res.json(result);
});

export const smartForwardValidators = [
  body('leadIds').optional().isArray(),
  body('leadIds.*').optional().isMongoId(),
];

export const smartForward = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await leadService.smartForward(req.user, req.body);
  res.json(result);
});

export const meta = asyncHandler(async (_req, res) => {
  res.json({
    types: LEAD_TYPES_LIST,
    sources: LEAD_SOURCES_LIST,
    buyerStatuses: BUYER_STATUSES_LIST,
    sellerStatuses: SELLER_STATUSES_LIST,
    lostReasons: LOST_REASONS_LIST,
  });
});
