import mongoose from 'mongoose';

const LISTING_STATUSES = [
  'coming_soon',
  'active',
  'pending',
  'under_contract',
  'sold',
  'withdrawn',
];
const PROPERTY_TYPES = ['house', 'apartment', 'plot', 'commercial'];

const listingSchema = new mongoose.Schema(
  {
    assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, default: null },
      zip: { type: String, default: null },
      country: { type: String, default: null },
    },
    price: { type: Number, required: true },
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    sqft: { type: Number, default: null },
    propertyType: { type: String, enum: PROPERTY_TYPES, default: 'house' },
    description: { type: String, default: null },
    photos: [{ type: String }],
    status: { type: String, enum: LISTING_STATUSES, default: 'active' },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

listingSchema.index({ assignedAgentId: 1, status: 1 });

export const LISTING_STATUSES_LIST = LISTING_STATUSES;
export const PROPERTY_TYPES_LIST = PROPERTY_TYPES;
export const ACTIVE_LISTING_STATUSES = ['coming_soon', 'active', 'pending', 'under_contract'];
export const Listing = mongoose.model('Listing', listingSchema);
