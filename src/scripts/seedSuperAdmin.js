import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

async function seedSuperAdmin() {
  await connectDB();

  const existing = await User.findOne({ role: 'superadmin' });
  if (existing) {
    console.log(`SuperAdmin already exists: ${existing.email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(env.superadminPassword, 12);
  const superadmin = await User.create({
    role: 'superadmin',
    email: env.superadminEmail.toLowerCase(),
    passwordHash,
    profile: { name: env.superadminName },
  });

  console.log('SuperAdmin created successfully');
  console.log(`  Email: ${superadmin.email}`);
  console.log(`  Name:  ${superadmin.profile.name}`);
  process.exit(0);
}

seedSuperAdmin().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
