import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Testimonial } from '../models/Testimonial.js';
import { env } from '../config/env.js';

const PUBLIC_LISTING_STATUSES = ['active', 'coming_soon'];
const AGENT_POPULATE = { path: 'assignedAgentId', select: 'profile.name slug profile.headshotUrl profile.title profile.publicPhone profile.phone' };

function formatAddress(address) {
  if (!address) return '';
  return [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
}

function sanitizeAgent(agent) {
  if (!agent) return null;
  return {
    _id: agent._id,
    slug: agent.slug,
    profile: {
      name: agent.profile?.name,
      title: agent.profile?.title,
      bio: agent.profile?.bio,
      headshotUrl: agent.profile?.headshotUrl,
      publicEmail: agent.profile?.publicEmail,
      publicPhone: agent.profile?.publicPhone,
      yearsExperience: agent.profile?.yearsExperience,
      specialtyTags: agent.profile?.specialtyTags || [],
      socialLinks: agent.profile?.socialLinks || {},
    },
  };
}

function sanitizeListing(listing) {
  const agent = listing.assignedAgentId;
  return {
    _id: listing._id,
    slug: listing.slug,
    address: listing.address,
    addressFormatted: formatAddress(listing.address),
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqft: listing.sqft,
    propertyType: listing.propertyType,
    description: listing.description,
    photos: listing.photos || [],
    status: listing.status,
    createdAt: listing.createdAt,
    agent: agent ? {
      slug: agent.slug,
      name: agent.profile?.name,
      title: agent.profile?.title,
      headshotUrl: agent.profile?.headshotUrl,
      publicPhone: agent.profile?.publicPhone || agent.profile?.phone,
    } : null,
  };
}

export function getSiteConfig() {
  return {
    name: env.brokerageName,
    tagline: env.brokerageTagline,
    phone: env.brokeragePhone,
    email: env.brokerageEmail,
    address: env.brokerageAddress,
    hours: env.brokerageHours,
    about: env.brokerageAbout,
    socialLinks: {
      instagram: env.brokerageInstagram,
      facebook: env.brokerageFacebook,
      linkedin: env.brokerageLinkedin,
    },
  };
}

export async function listPublicListings({
  search,
  city,
  minPrice,
  maxPrice,
  bedrooms,
  propertyType,
  sort = 'newest',
  page = 1,
  limit = 12,
} = {}) {
  const query = { status: { $in: PUBLIC_LISTING_STATUSES } };
  const and = [];

  if (search) {
    and.push({
      $or: [
        { 'address.street': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ],
    });
  }
  if (city) and.push({ 'address.city': { $regex: city, $options: 'i' } });
  if (minPrice) and.push({ price: { $gte: Number(minPrice) } });
  if (maxPrice) and.push({ price: { $lte: Number(maxPrice) } });
  if (bedrooms) and.push({ bedrooms: { $gte: Number(bedrooms) } });
  if (propertyType) and.push({ propertyType });
  if (and.length) query.$and = and;

  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };

  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    Listing.find(query)
      .populate(AGENT_POPULATE)
      .sort(sortMap[sort] || sortMap.newest)
      .skip(skip)
      .limit(limit),
    Listing.countDocuments(query),
  ]);

  return {
    listings: items.map(sanitizeListing),
    total,
    page: Number(page),
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getFeaturedListings(limit = 6) {
  const items = await Listing.find({ status: { $in: PUBLIC_LISTING_STATUSES } })
    .populate(AGENT_POPULATE)
    .sort({ createdAt: -1 })
    .limit(limit);
  return items.map(sanitizeListing);
}

export async function getPublicListing(slugOrId) {
  const isObjectId = /^[a-f\d]{24}$/i.test(slugOrId);
  const query = isObjectId ? { _id: slugOrId } : { slug: slugOrId };

  const listing = await Listing.findOne({ ...query, status: { $in: [...PUBLIC_LISTING_STATUSES, 'pending', 'under_contract'] } })
    .populate(AGENT_POPULATE);

  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const similar = await Listing.find({
    _id: { $ne: listing._id },
    status: { $in: PUBLIC_LISTING_STATUSES },
    'address.city': listing.address.city,
  })
    .populate(AGENT_POPULATE)
    .sort({ createdAt: -1 })
    .limit(3);

  return {
    listing: sanitizeListing(listing),
    similar: similar.map(sanitizeListing),
  };
}

export async function listPublicAgents({ search, tag } = {}) {
  const query = { role: 'agent', status: 'active', slug: { $exists: true, $ne: null } };
  const and = [];

  if (search) {
    and.push({
      $or: [
        { 'profile.name': { $regex: search, $options: 'i' } },
        { 'profile.title': { $regex: search, $options: 'i' } },
      ],
    });
  }
  if (tag) and.push({ 'profile.specialtyTags': { $regex: tag, $options: 'i' } });
  if (and.length) query.$and = and;

  const agents = await User.find(query)
    .select('slug profile.name profile.title profile.headshotUrl profile.bio profile.specialtyTags profile.yearsExperience')
    .sort({ 'profile.name': 1 });

  return agents.map(sanitizeAgent);
}

export async function getPublicAgent(slug) {
  const agent = await User.findOne({ slug, role: 'agent', status: 'active' })
    .select('-passwordHash -email -whatsappConfig -createdByUserId');

  if (!agent) {
    const err = new Error('Agent not found');
    err.status = 404;
    throw err;
  }

  const [activeListings, soldListings, testimonials] = await Promise.all([
    Listing.find({
      assignedAgentId: agent._id,
      status: { $in: PUBLIC_LISTING_STATUSES },
    }).sort({ createdAt: -1 }),
    Listing.find({
      assignedAgentId: agent._id,
      status: 'sold',
    }).sort({ updatedAt: -1 }).limit(6),
    Testimonial.find({ agentId: agent._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('authorName content rating createdAt'),
  ]);

  const publicPhone = agent.profile?.publicPhone || agent.profile?.phone;
  const whatsappDigits = publicPhone?.replace(/[^\d]/g, '');

  return {
    agent: sanitizeAgent(agent),
    listings: activeListings.map((l) => sanitizeListing({ ...l.toObject(), assignedAgentId: agent })),
    soldListings: soldListings.map((l) => sanitizeListing({ ...l.toObject(), assignedAgentId: agent })),
    testimonials,
    whatsappUrl: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
  };
}

export async function getFeaturedTestimonials(limit = 6) {
  return Testimonial.find({ status: 'approved' })
    .populate({ path: 'agentId', select: 'slug profile.name profile.headshotUrl' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function resolveAgentSlug(slug) {
  const agent = await User.findOne({
    $or: [{ slug }, { previousSlugs: slug }],
    role: 'agent',
    status: 'active',
  }).select('slug');

  if (!agent) {
    const err = new Error('Agent not found');
    err.status = 404;
    throw err;
  }

  return agent.slug;
}
