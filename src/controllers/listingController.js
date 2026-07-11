import { body, param, query, validationResult } from 'express-validator';
import * as listingService from '../services/listingService.js';
import { LISTING_STATUSES_LIST, PROPERTY_TYPES_LIST } from '../models/Listing.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createValidators = [
  body('address.street').trim().notEmpty(),
  body('address.city').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('status').optional().isIn(LISTING_STATUSES_LIST),
  body('assignedAgentId').optional({ nullable: true }).isMongoId(),
  body('bedrooms').optional({ nullable: true }).isInt({ min: 0 }),
  body('bathrooms').optional({ nullable: true }).isFloat({ min: 0 }),
  body('sqft').optional({ nullable: true }).isInt({ min: 0 }),
  body('propertyType').optional().isIn(PROPERTY_TYPES_LIST),
  body('photos').optional().isArray(),
];

export const updateValidators = [
  param('id').isMongoId(),
  body('address.street').optional().trim().notEmpty(),
  body('address.city').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(LISTING_STATUSES_LIST),
  body('assignedAgentId').optional({ nullable: true }).isMongoId(),
  body('bedrooms').optional({ nullable: true }).isInt({ min: 0 }),
  body('bathrooms').optional({ nullable: true }).isFloat({ min: 0 }),
  body('sqft').optional({ nullable: true }).isInt({ min: 0 }),
  body('propertyType').optional().isIn(PROPERTY_TYPES_LIST),
  body('photos').optional().isArray(),
];

export const listValidators = [
  query('status').optional().isIn(LISTING_STATUSES_LIST),
  query('agentId').optional().isMongoId(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
];

export const list = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { status, agentId, search, dateFrom, dateTo } = req.query;
  const listings = await listingService.listListings(req.user, { status, agentId, search, dateFrom, dateTo });
  res.json(listings);
});

export const getOne = asyncHandler(async (req, res) => {
  const listing = await listingService.getListing(req.user, req.params.id);
  res.json(listing);
});

export const create = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const listing = await listingService.createListing(req.user, req.body);
  res.status(201).json(listing);
});

export const update = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const listing = await listingService.updateListing(req.user, req.params.id, req.body);
  res.json(listing);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await listingService.deleteListing(req.user, req.params.id);
  res.json(result);
});

export const statuses = asyncHandler(async (_req, res) => {
  res.json(LISTING_STATUSES_LIST);
});

export const bulkAssignValidators = [
  body('listingIds').isArray({ min: 1 }),
  body('listingIds.*').isMongoId(),
  body('agentId').isMongoId(),
];

export const bulkAssign = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await listingService.bulkAssignListings(req.user, req.body);
  res.json(result);
});
