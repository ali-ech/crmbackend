import mongoose from 'mongoose';

const LEAD_TYPES = ['buyer', 'seller', 'renter', 'landlord'];
const LEAD_SOURCES = [
  'website_listing',
  'website_general',
  'website_agent_page',
  'facebook_ad',
  'tiktok_ad',
  'manual',
  'referral',
  'bulk_import',
];

const BUYER_STATUSES = [
  'new',
  'attempted_contact',
  'contacted',
  'qualified',
  'showing_scheduled',
  'showing_completed',
  'offer_submitted',
  'under_contract',
  'closed_won',
  'closed_lost',
  'nurture',
];

const SELLER_STATUSES = [
  'new',
  'consultation_scheduled',
  'agreement_signed',
  'live_on_market',
  'offer_received',
  'under_contract',
  'closed_won',
  'closed_lost',
  'nurture',
];

const ALL_STATUSES = [...new Set([...BUYER_STATUSES, ...SELLER_STATUSES])];

const LOST_REASONS = [
  'not_interested',
  'went_with_competitor',
  'budget',
  'timing',
  'unresponsive',
  'other',
];

const leadSchema = new mongoose.Schema(
  {
    assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: LEAD_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    relatedListingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null },
    status: { type: String, enum: ALL_STATUSES, default: 'new' },
    lostReason: { type: String, enum: LOST_REASONS, default: null },
    duplicateOfLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    notes: { type: String, default: null },
    propertyInterest: { type: String, default: null, trim: true },
    propertyType: { type: String, enum: ['house', 'apartment', 'plot', 'commercial'], default: null },
    sourceDetail: { type: String, default: null, trim: true },
    closedPrice: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1 });
leadSchema.index({ assignedAgentId: 1, status: 1 });

export const LEAD_TYPES_LIST = LEAD_TYPES;
export const LEAD_SOURCES_LIST = LEAD_SOURCES;
export const BUYER_STATUSES_LIST = BUYER_STATUSES;
export const SELLER_STATUSES_LIST = SELLER_STATUSES;
export const LOST_REASONS_LIST = LOST_REASONS;
export const CLOSED_STATUSES = ['closed_won', 'closed_lost'];
export const Lead = mongoose.model('Lead', leadSchema);
