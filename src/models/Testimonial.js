import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    status: { type: String, enum: ['pending', 'approved'], default: 'approved' },
  },
  { timestamps: true }
);

testimonialSchema.index({ agentId: 1, status: 1, createdAt: -1 });

export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
