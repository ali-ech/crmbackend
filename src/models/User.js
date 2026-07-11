import mongoose from 'mongoose';

const ROLES = ['superadmin', 'manager', 'agent'];
const USER_STATUSES = ['active', 'inactive'];

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    profile: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, default: null },
      notificationPhone: { type: String, default: null },
      publicEmail: { type: String, default: null },
      publicPhone: { type: String, default: null },
      title: { type: String, default: null },
      bio: { type: String, default: null },
      headshotUrl: { type: String, default: null },
      yearsExperience: { type: Number, default: null },
      specialtyTags: [{ type: String }],
      socialLinks: {
        instagram: { type: String, default: null },
        facebook: { type: String, default: null },
        linkedin: { type: String, default: null },
      },
    },
    whatsappConfig: {
      provider: { type: String, enum: ['ultramsg', 'wasender'], default: null },
      instanceId: { type: String, default: null },
      token: { type: String, default: null },
      connected: { type: Boolean, default: false },
    },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousSlugs: [{ type: String }],
  },
  { timestamps: true }
);

userSchema.index({ createdByUserId: 1, role: 1, status: 1 });

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export const ROLES_LIST = ROLES;
export const USER_STATUSES_LIST = USER_STATUSES;
export const User = mongoose.model('User', userSchema);
