/**
 * Wipe all CRM data except the SuperAdmin account.
 * Use before entering your own managers, agents, listings, and leads.
 *
 * Usage: npm run reset:clean
 */
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Lead } from '../models/Lead.js';
import { Activity } from '../models/Activity.js';
import { Task } from '../models/Task.js';
import { Notification } from '../models/Notification.js';
import { Testimonial } from '../models/Testimonial.js';

async function ensureSuperAdmin() {
  let superadmin = await User.findOne({ role: 'superadmin' });

  if (!superadmin) {
    const passwordHash = await bcrypt.hash(env.superadminPassword, 12);
    superadmin = await User.create({
      role: 'superadmin',
      email: env.superadminEmail.toLowerCase(),
      passwordHash,
      profile: { name: env.superadminName },
      status: 'active',
    });
    console.log(`Created SuperAdmin: ${superadmin.email}`);
  } else {
    console.log(`Keeping SuperAdmin: ${superadmin.email}`);
  }

  return superadmin;
}

async function resetToSuperAdminOnly() {
  await connectDB();

  const counts = {
    notifications: await Notification.countDocuments(),
    activities: await Activity.countDocuments(),
    tasks: await Task.countDocuments(),
    testimonials: await Testimonial.countDocuments(),
    leads: await Lead.countDocuments(),
    listings: await Listing.countDocuments(),
    users: await User.countDocuments(),
  };

  await Promise.all([
    Notification.deleteMany({}),
    Activity.deleteMany({}),
    Task.deleteMany({}),
    Testimonial.deleteMany({}),
    Lead.deleteMany({}),
    Listing.deleteMany({}),
    User.deleteMany({ role: { $ne: 'superadmin' } }),
  ]);

  const superadmin = await ensureSuperAdmin();

  console.log('\nReset complete — only SuperAdmin remains.\n');
  console.log('Removed:');
  console.log(`  ${counts.users - 1} users (managers + agents)`);
  console.log(`  ${counts.listings} listings`);
  console.log(`  ${counts.leads} leads`);
  console.log(`  ${counts.tasks} tasks`);
  console.log(`  ${counts.activities} activities`);
  console.log(`  ${counts.notifications} notifications`);
  console.log(`  ${counts.testimonials} testimonials`);
  console.log('\nSuperAdmin login:');
  console.log(`  Email:    ${superadmin.email}`);
  console.log(`  Password: ${env.superadminPassword}`);
  console.log('\nRestart the backend so BullMQ clears stale scheduled jobs.\n');

  process.exit(0);
}

resetToSuperAdminOnly().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
