import { body, param, query, validationResult } from 'express-validator';
import * as leadService from '../services/leadService.js';
import * as publicService from '../services/publicService.js';
import { LEAD_TYPES_LIST } from '../models/Lead.js';
import { PROPERTY_TYPES_LIST } from '../models/Listing.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const inquiryValidators = [
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('type').optional().isIn(LEAD_TYPES_LIST),
  body('listingId').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('agentSlug').optional({ nullable: true, checkFalsy: true }).trim(),
  body('message').optional({ nullable: true }).trim(),
];

export const listListingsValidators = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sort').optional().isIn(['newest', 'price_asc', 'price_desc']),
  query('propertyType').optional({ checkFalsy: true }).isIn(PROPERTY_TYPES_LIST),
];

export const submitInquiry = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  await leadService.createPublicInquiry(req.body);
  res.status(201).json({ submitted: true });
});

export const getSite = asyncHandler(async (_req, res) => {
  res.json(publicService.getSiteConfig());
});

export const getFeatured = asyncHandler(async (_req, res) => {
  const listings = await publicService.getFeaturedListings();
  res.json(listings);
});

export const getTestimonials = asyncHandler(async (_req, res) => {
  const testimonials = await publicService.getFeaturedTestimonials();
  res.json(testimonials);
});

export const listListings = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const result = await publicService.listPublicListings(req.query);
  res.json(result);
});

export const getListing = asyncHandler(async (req, res) => {
  const result = await publicService.getPublicListing(req.params.slug);
  res.json(result);
});

export const listAgents = asyncHandler(async (req, res) => {
  const agents = await publicService.listPublicAgents(req.query);
  res.json(agents);
});

export const getAgent = asyncHandler(async (req, res) => {
  const slug = await publicService.resolveAgentSlug(req.params.slug);
  const result = await publicService.getPublicAgent(slug);
  res.json(result);
});
