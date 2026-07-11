import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Lead } from '../models/Lead.js';
import { Task } from '../models/Task.js';
import { Testimonial } from '../models/Testimonial.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const [users, listings, leads, tasks, testimonials] = await Promise.all([
  User.countDocuments(),
  Listing.countDocuments(),
  Lead.countDocuments(),
  Task.countDocuments(),
  Testimonial.countDocuments(),
]);

const sampleListing = await Listing.findOne({ photos: { $exists: true, $ne: [] } }).lean();
const sampleAgent = await User.findOne({ role: 'agent', 'profile.headshotUrl': { $exists: true, $ne: null } }).lean();

console.log({
  users,
  listings,
  leads,
  tasks,
  testimonials,
  sampleListingPhotos: sampleListing?.photos?.length,
  sampleAgentHeadshot: !!sampleAgent?.profile?.headshotUrl,
});

await mongoose.disconnect();
