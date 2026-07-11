import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Lead } from '../models/Lead.js';
import { Activity } from '../models/Activity.js';
import { Task } from '../models/Task.js';
import { Notification } from '../models/Notification.js';
import { Testimonial } from '../models/Testimonial.js';
import { generateUniqueSlug, generateUniqueListingSlug } from '../utils/slug.js';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  HEADSHOT_POOL,
  MANAGERS,
  AGENTS,
  LISTING_TEMPLATES,
  LEAD_FIRST_NAMES,
  LEAD_LAST_NAMES,
  TESTIMONIAL_QUOTES,
  pickPhotos,
} from './seedAssets.js';

const force = process.argv.includes('--force');
const demoEmailPattern = new RegExp(`@${DEMO_EMAIL_DOMAIN.replace('.', '\\.')}$`, 'i');

function demoEmail(localPart) {
  return `${localPart}@${DEMO_EMAIL_DOMAIN}`.toLowerCase();
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function hoursFromNow(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

function phoneForIndex(index) {
  const prefix = 300 + (index % 10);
  const suffix = String(1000000 + index * 1379).slice(-7);
  return `03${prefix}-${suffix.slice(0, 3)}${suffix.slice(3)}`;
}

function leadEmail(index) {
  const first = LEAD_FIRST_NAMES[index % LEAD_FIRST_NAMES.length].toLowerCase();
  const last = LEAD_LAST_NAMES[index % LEAD_LAST_NAMES.length].toLowerCase();
  return `${first}.${last}${index}@example.com`;
}

async function clearAllSeedCollections() {
  await Promise.all([
    Notification.deleteMany({}),
    Activity.deleteMany({}),
    Task.deleteMany({}),
    Testimonial.deleteMany({}),
    Lead.deleteMany({}),
    Listing.deleteMany({}),
    User.deleteMany({}),
  ]);
}

async function clearDemoData() {
  const demoUsers = await User.find({ email: demoEmailPattern }).select('_id');
  const demoUserIds = demoUsers.map((u) => u._id);

  if (demoUserIds.length === 0) return;

  const demoListings = await Listing.find({
    $or: [
      { createdByUserId: { $in: demoUserIds } },
      { assignedAgentId: { $in: demoUserIds } },
    ],
  }).select('_id');
  const demoListingIds = demoListings.map((l) => l._id);

  const demoLeads = await Lead.find({
    $or: [
      { assignedAgentId: { $in: demoUserIds } },
      { relatedListingId: { $in: demoListingIds } },
    ],
  }).select('_id');
  const demoLeadIds = demoLeads.map((l) => l._id);

  await Promise.all([
    Notification.deleteMany({
      $or: [
        { userId: { $in: demoUserIds } },
        { relatedLeadId: { $in: demoLeadIds } },
      ],
    }),
    Activity.deleteMany({ leadId: { $in: demoLeadIds } }),
    Task.deleteMany({
      $or: [
        { leadId: { $in: demoLeadIds } },
        { assignedUserId: { $in: demoUserIds } },
      ],
    }),
    Testimonial.deleteMany({ agentId: { $in: demoUserIds } }),
    Lead.deleteMany({ _id: { $in: demoLeadIds } }),
    Listing.deleteMany({ _id: { $in: demoListingIds } }),
    User.deleteMany({ _id: { $in: demoUserIds } }),
  ]);
}

async function ensureSafeToSeed() {
  const demoExists = await User.exists({ email: demoEmailPattern });
  const [userCount, listingCount, leadCount] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Lead.countDocuments(),
  ]);
  const hasOtherData = userCount > 0 || listingCount > 0 || leadCount > 0;

  if (force) {
    await clearAllSeedCollections();
    return;
  }

  if (demoExists) {
    console.log('Demo data already exists. Re-run with --force to replace demo seed data.');
    process.exit(0);
  }

  if (hasOtherData) {
    console.log('Database is not empty. Pass --force to seed demo data anyway.');
    console.log(`Current counts: users=${userCount}, listings=${listingCount}, leads=${leadCount}`);
    process.exit(1);
  }
}

async function seedDemo() {
  await connectDB();
  await ensureSafeToSeed();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const superadmin = await User.create({
    role: 'superadmin',
    email: demoEmail('fahad.malik'),
    passwordHash,
    profile: {
      name: 'Fahad Malik',
      phone: '0300-5550100',
      title: 'Brokerage Owner',
      bio: 'Founder of Premier Realty Peshawar with over 15 years of experience in residential and commercial sales across Khyber Pakhtunkhwa.',
    },
  });

  const managers = [];
  for (const manager of MANAGERS) {
    const doc = await User.create({
      role: 'manager',
      email: demoEmail(manager.email),
      passwordHash,
      createdByUserId: superadmin._id,
      profile: {
        name: manager.name,
        phone: phoneForIndex(managers.length + 10),
        title: manager.title,
      },
    });
    managers.push(doc);
  }

  const agents = [];
  for (let i = 0; i < AGENTS.length; i += 1) {
    const agentDef = AGENTS[i];
    const manager = managers[agentDef.manager];
    const slug = await generateUniqueSlug(User, agentDef.name);
    const doc = await User.create({
      role: 'agent',
      email: demoEmail(agentDef.name.toLowerCase().replace(/\s+/g, '.')),
      passwordHash,
      createdByUserId: manager._id,
      slug,
      profile: {
        name: agentDef.name,
        phone: phoneForIndex(i + 20),
        publicPhone: phoneForIndex(i + 20),
        publicEmail: demoEmail(agentDef.name.toLowerCase().replace(/\s+/g, '.')),
        title: agentDef.title,
        bio: agentDef.bio,
        headshotUrl: HEADSHOT_POOL[i % HEADSHOT_POOL.length],
        yearsExperience: 3 + (i % 8),
        specialtyTags: agentDef.tags,
        socialLinks: {
          instagram: 'https://instagram.com/',
          facebook: 'https://facebook.com/',
          linkedin: 'https://linkedin.com/',
        },
      },
    });
    agents.push(doc);
  }

  const listingDistribution = [4, 4, 3, 4, 3, 3, 4, 3, 4];
  const listings = [];
  let listingIndex = 0;

  for (let agentIdx = 0; agentIdx < agents.length; agentIdx += 1) {
    const agent = agents[agentIdx];
    const manager = managers[AGENTS[agentIdx].manager];
    const count = listingDistribution[agentIdx];

    for (let j = 0; j < count && listingIndex < LISTING_TEMPLATES.length; j += 1) {
      const template = LISTING_TEMPLATES[listingIndex];
      const slug = await generateUniqueListingSlug(Listing, `${template.street} ${template.city}`);
      const listing = await Listing.create({
        createdByUserId: manager._id,
        assignedAgentId: agent._id,
        address: {
          street: template.street,
          city: template.city,
          state: 'KPK',
          zip: '25000',
          country: 'Pakistan',
        },
        price: template.price,
        bedrooms: template.beds,
        bathrooms: template.baths,
        sqft: template.sqft,
        propertyType: template.propertyType,
        description: `${template.propertyType.replace('_', ' ')} in ${template.area} with strong demand from local buyers. Ideal for ${template.propertyType === 'plot' ? 'investment or custom construction' : 'families seeking a well-located home in Peshawar'}.`,
        photos: pickPhotos(listingIndex, 4 + (listingIndex % 3)),
        status: template.status,
        slug,
        createdAt: daysAgo(45 - listingIndex),
        updatedAt: daysAgo(Math.max(1, 20 - listingIndex)),
      });
      listings.push(listing);
      listingIndex += 1;
    }
  }

  const leadStatusesByType = {
    buyer: ['new', 'attempted_contact', 'contacted', 'qualified', 'showing_scheduled', 'showing_completed', 'offer_submitted', 'under_contract', 'closed_won', 'closed_lost', 'nurture'],
    seller: ['new', 'consultation_scheduled', 'agreement_signed', 'live_on_market', 'offer_received', 'under_contract', 'closed_won', 'closed_lost', 'nurture'],
    renter: ['new', 'contacted', 'qualified', 'showing_scheduled', 'under_contract', 'closed_won', 'closed_lost'],
    landlord: ['new', 'consultation_scheduled', 'agreement_signed', 'live_on_market', 'closed_won', 'closed_lost'],
  };

  const leadTypes = ['buyer', 'buyer', 'buyer', 'seller', 'seller', 'renter', 'landlord'];
  const leadSources = ['website_listing', 'website_general', 'website_agent_page', 'facebook_ad', 'manual', 'referral'];
  const lostReasons = ['not_interested', 'went_with_competitor', 'budget', 'timing', 'unresponsive', 'other'];

  const leads = [];
  for (let i = 0; i < 45; i += 1) {
    const type = leadTypes[i % leadTypes.length];
    const statusOptions = leadStatusesByType[type];
    const status = statusOptions[i % statusOptions.length];
    const agent = i % 7 === 0 ? null : agents[i % agents.length];
    const listing = i % 3 === 0 ? listings[i % listings.length] : null;
    const createdAt = daysAgo(30 - (i % 25));

    const lead = await Lead.create({
      type,
      name: `${LEAD_FIRST_NAMES[i % LEAD_FIRST_NAMES.length]} ${LEAD_LAST_NAMES[i % LEAD_LAST_NAMES.length]}`,
      phone: phoneForIndex(100 + i),
      email: leadEmail(i),
      source: leadSources[i % leadSources.length],
      assignedAgentId: agent?._id || null,
      relatedListingId: listing?._id || null,
      status,
      lostReason: status === 'closed_lost' ? lostReasons[i % lostReasons.length] : null,
      notes: `Interested in ${type} options around ${listing?.address?.city || 'Peshawar'}.`,
      createdAt,
      updatedAt: daysAgo(Math.max(0, 15 - (i % 10))),
    });
    leads.push(lead);
  }

  leads[5].duplicateOfLeadId = leads[0]._id;
  leads[12].duplicateOfLeadId = leads[3]._id;
  await Lead.updateOne({ _id: leads[5]._id }, { $set: { duplicateOfLeadId: leads[0]._id } });
  await Lead.updateOne({ _id: leads[12]._id }, { $set: { duplicateOfLeadId: leads[3]._id } });

  let activityCount = 0;
  for (let i = 0; i < leads.length; i += 1) {
    const lead = leads[i];
    if (lead.status === 'new') continue;

    const actor = lead.assignedAgentId
      ? agents.find((a) => a._id.equals(lead.assignedAgentId)) || managers[0]
      : managers[i % managers.length];

    await Activity.create({
      leadId: lead._id,
      userId: actor._id,
      type: 'note',
      content: `Initial outreach completed for ${lead.name}.`,
      createdAt: daysAgo(10 - (i % 8)),
    });
    activityCount += 1;

    if (['contacted', 'qualified', 'showing_scheduled', 'under_contract', 'closed_won', 'closed_lost', 'consultation_scheduled', 'agreement_signed'].includes(lead.status)) {
      await Activity.create({
        leadId: lead._id,
        userId: actor._id,
        type: 'status_change',
        content: `Status updated to ${lead.status.replace(/_/g, ' ')}.`,
        createdAt: daysAgo(8 - (i % 6)),
      });
      activityCount += 1;
    }
  }

  const taskTypes = ['call', 'followup_text', 'showing', 'document_deadline'];
  const taskStatuses = ['pending', 'pending', 'pending', 'completed', 'completed', 'missed'];
  let taskCount = 0;

  for (let i = 0; i < 18; i += 1) {
    const lead = leads[i * 2];
    const agent = agents[i % agents.length];
    const status = taskStatuses[i % taskStatuses.length];
    const dueAt = i < 4
      ? daysAgo(2 + i)
      : i < 10
        ? hoursFromNow((i - 4) * 3)
        : daysFromNow(i - 9);

    await Task.create({
      leadId: lead._id,
      assignedUserId: agent._id,
      type: taskTypes[i % taskTypes.length],
      dueAt,
      status,
      escalatedAt: status === 'missed' ? daysAgo(1) : null,
      notes: status === 'missed' ? 'Follow-up overdue — client waiting for callback.' : 'Scheduled follow-up from CRM pipeline.',
      createdAt: daysAgo(5 + (i % 4)),
    });
    taskCount += 1;
  }

  let testimonialCount = 0;
  for (let agentIdx = 0; agentIdx < agents.length; agentIdx += 1) {
    const perAgent = 2 + (agentIdx % 2);
    for (let t = 0; t < perAgent; t += 1) {
      const quote = TESTIMONIAL_QUOTES[(agentIdx * 2 + t) % TESTIMONIAL_QUOTES.length];
      await Testimonial.create({
        agentId: agents[agentIdx]._id,
        authorName: quote.author,
        content: quote.content,
        rating: 4 + (t % 2),
        status: 'approved',
        createdAt: daysAgo(20 - agentIdx - t),
      });
      testimonialCount += 1;
    }
  }

  console.log('Demo seed completed successfully.');
  console.log(`  SuperAdmin: 1 (${superadmin.email})`);
  console.log(`  Managers: ${managers.length}`);
  console.log(`  Agents: ${agents.length}`);
  console.log(`  Listings: ${listings.length}`);
  console.log(`  Leads: ${leads.length}`);
  console.log(`  Activities: ${activityCount}`);
  console.log(`  Tasks: ${taskCount}`);
  console.log(`  Testimonials: ${testimonialCount}`);
  console.log(`  Demo login password for all users: ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedDemo().catch(async (err) => {
  console.error('Demo seed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
