export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function generateUniqueSlug(User, baseName, excludeUserId = null) {
  let slug = slugify(baseName);
  if (!slug) slug = 'agent';

  let candidate = slug;
  let counter = 2;

  while (true) {
    const query = { slug: candidate };
    if (excludeUserId) query._id = { $ne: excludeUserId };

    const existing = await User.findOne(query).select('_id');
    if (!existing) return candidate;

    candidate = `${slug}-${counter}`;
    counter++;
  }
}

export async function generateUniqueListingSlug(Listing, baseText, excludeListingId = null) {
  let slug = slugify(baseText);
  if (!slug) slug = 'listing';

  let candidate = slug;
  let counter = 2;

  while (true) {
    const query = { slug: candidate };
    if (excludeListingId) query._id = { $ne: excludeListingId };

    const existing = await Listing.findOne(query).select('_id');
    if (!existing) return candidate;

    candidate = `${slug}-${counter}`;
    counter++;
  }
}
