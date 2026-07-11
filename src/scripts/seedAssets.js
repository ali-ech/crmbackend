export const DEMO_EMAIL_DOMAIN = 'premierdemo.pk';
export const DEMO_PASSWORD = 'password123';

export const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80';

export const HEADSHOT_POOL = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=400&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80',
];

export const LISTING_PHOTO_POOL = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600573472555-3570b0c2a0a0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1564013789929-256f721655a8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1605276374101-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556909212-d5b604d0fda2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb4577ad?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566752355-3570b0c2a0a0?auto=format&fit=crop&w=1200&q=80',
];

export function pickPhotos(seed, count = 5) {
  const photos = [];
  for (let i = 0; i < count; i += 1) {
    photos.push(LISTING_PHOTO_POOL[(seed + i) % LISTING_PHOTO_POOL.length]);
  }
  return photos;
}

export const MANAGERS = [
  { name: 'Imran Shah', title: 'Sales Manager', email: 'imran.shah' },
  { name: 'Sana Afridi', title: 'Operations Manager', email: 'sana.afridi' },
  { name: 'Hamza Qureshi', title: 'Branch Manager', email: 'hamza.qureshi' },
];

export const AGENTS = [
  { name: 'Ayesha Khan', title: 'Senior Sales Agent', manager: 0, tags: ['Hayatabad', 'Family Homes'], bio: 'Specializes in Hayatabad family homes and gated communities. Known for fast response times and transparent negotiations for first-time buyers.' },
  { name: 'Bilal Hussain', title: 'Property Consultant', manager: 0, tags: ['DHA Peshawar', 'Luxury'], bio: 'Focuses on premium listings in DHA Peshawar and University Town. Helps clients compare investment potential across Peshawar’s top neighborhoods.' },
  { name: 'Maria Gul', title: 'Sales Agent', manager: 0, tags: ['Apartments', 'Rentals'], bio: 'Works closely with renters and young professionals looking for modern apartments near Ring Road and University Town.' },
  { name: 'Omar Farooq', title: 'Senior Sales Agent', manager: 1, tags: ['Plots', 'Investors'], bio: 'Advises investors on residential plots and commercial corners across Hayatabad and Regi Model Town with clear title guidance.' },
  { name: 'Hina Raza', title: 'Property Consultant', manager: 1, tags: ['Gulbahar', 'Commercial'], bio: 'Helps business owners find commercial shops and offices in Gulbahar and Saddar while coordinating smooth handovers.' },
  { name: 'Usman Ali', title: 'Sales Agent', manager: 1, tags: ['University Town', 'Family Homes'], bio: 'Guides families through larger homes near schools and hospitals in University Town with honest pricing advice.' },
  { name: 'Fatima Noor', title: 'Senior Sales Agent', manager: 2, tags: ['DHA Peshawar', 'Villas'], bio: 'Represents high-end villas and corner plots in DHA Peshawar for buyers who want security, space, and long-term value.' },
  { name: 'Zain Abbas', title: 'Property Consultant', manager: 2, tags: ['Hayatabad', 'Quick Sales'], bio: 'Known for pricing homes accurately and moving listings quickly in Hayatabad Phase 1–6 without cutting corners on disclosure.' },
  { name: 'Rabia Mehmood', title: 'Sales Agent', manager: 2, tags: ['Apartments', 'First-time Buyers'], bio: 'Supports first-time buyers with financing questions, site visits, and patient follow-up across Peshawar’s mid-range apartment market.' },
];

export const LISTING_TEMPLATES = [
  { street: 'Phase 6 Street 12', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 28500000, beds: 5, baths: 4, sqft: 3200, status: 'active' },
  { street: 'Sector A Lane 4', city: 'DHA Peshawar', area: 'DHA Peshawar', propertyType: 'house', price: 62000000, beds: 6, baths: 5, sqft: 4500, status: 'active' },
  { street: 'University Road Block C', city: 'University Town', area: 'University Town', propertyType: 'apartment', price: 14500000, beds: 3, baths: 2, sqft: 1450, status: 'active' },
  { street: 'Gulbahar Main Boulevard', city: 'Gulbahar', area: 'Gulbahar', propertyType: 'commercial', price: 38000000, beds: null, baths: 2, sqft: 2200, status: 'active' },
  { street: 'Regi Model Town Plot 88', city: 'Regi Model Town', area: 'Regi Model Town', propertyType: 'plot', price: 9200000, beds: null, baths: null, sqft: 2400, status: 'coming_soon' },
  { street: 'Phase 3 Street 8', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 22500000, beds: 4, baths: 3, sqft: 2600, status: 'active' },
  { street: 'Sector E Street 2', city: 'DHA Peshawar', area: 'DHA Peshawar', propertyType: 'house', price: 78000000, beds: 7, baths: 6, sqft: 5200, status: 'pending' },
  { street: 'Ring Road Residency Tower B', city: 'University Town', area: 'University Town', propertyType: 'apartment', price: 11800000, beds: 2, baths: 2, sqft: 1100, status: 'active' },
  { street: 'Saddar Trade Center Unit 14', city: 'Saddar', area: 'Saddar', propertyType: 'commercial', price: 29500000, beds: null, baths: 1, sqft: 1800, status: 'active' },
  { street: 'Phase 1 Street 19', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 19800000, beds: 4, baths: 3, sqft: 2300, status: 'sold' },
  { street: 'Sector B Lane 9', city: 'DHA Peshawar', area: 'DHA Peshawar', propertyType: 'plot', price: 16500000, beds: null, baths: null, sqft: 3000, status: 'active' },
  { street: 'Board Road Apartment 5A', city: 'University Town', area: 'University Town', propertyType: 'apartment', price: 9800000, beds: 2, baths: 1, sqft: 950, status: 'active' },
  { street: 'Phase 5 Street 3', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 31200000, beds: 5, baths: 4, sqft: 3400, status: 'under_contract' },
  { street: 'Gulbahar Street 21', city: 'Gulbahar', area: 'Gulbahar', propertyType: 'house', price: 17600000, beds: 3, baths: 2, sqft: 1800, status: 'active' },
  { street: 'Sector D Street 6', city: 'DHA Peshawar', area: 'DHA Peshawar', propertyType: 'house', price: 54000000, beds: 5, baths: 5, sqft: 4100, status: 'active' },
  { street: 'Regi Model Town Plot 41', city: 'Regi Model Town', area: 'Regi Model Town', propertyType: 'plot', price: 7400000, beds: null, baths: null, sqft: 2000, status: 'coming_soon' },
  { street: 'Phase 2 Street 7', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 24100000, beds: 4, baths: 3, sqft: 2550, status: 'active' },
  { street: 'University Town Heights 8F', city: 'University Town', area: 'University Town', propertyType: 'apartment', price: 16200000, beds: 3, baths: 3, sqft: 1600, status: 'active' },
  { street: 'Saddar Plaza Shop 3', city: 'Saddar', area: 'Saddar', propertyType: 'commercial', price: 33500000, beds: null, baths: 1, sqft: 2100, status: 'pending' },
  { street: 'Sector C Street 11', city: 'DHA Peshawar', area: 'DHA Peshawar', propertyType: 'house', price: 69000000, beds: 6, baths: 5, sqft: 4800, status: 'sold' },
  { street: 'Phase 4 Street 15', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 26800000, beds: 4, baths: 4, sqft: 2900, status: 'active' },
  { street: 'Gulbahar Lane 2', city: 'Gulbahar', area: 'Gulbahar', propertyType: 'apartment', price: 8900000, beds: 2, baths: 2, sqft: 980, status: 'active' },
  { street: 'Regi Model Town Plot 19', city: 'Regi Model Town', area: 'Regi Model Town', propertyType: 'plot', price: 6800000, beds: null, baths: null, sqft: 1800, status: 'active' },
  { street: 'Board Road Apartment 12C', city: 'University Town', area: 'University Town', propertyType: 'apartment', price: 13200000, beds: 3, baths: 2, sqft: 1300, status: 'active' },
  { street: 'Phase 6 Street 4', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 29900000, beds: 5, baths: 4, sqft: 3300, status: 'active' },
  { street: 'Sector F Street 1', city: 'DHA Peshawar', area: 'DHA Peshawar', propertyType: 'house', price: 84500000, beds: 7, baths: 6, sqft: 5600, status: 'active' },
  { street: 'Saddar Office Suite 6', city: 'Saddar', area: 'Saddar', propertyType: 'commercial', price: 41000000, beds: null, baths: 2, sqft: 2600, status: 'active' },
  { street: 'Phase 1 Street 2', city: 'Hayatabad', area: 'Hayatabad', propertyType: 'house', price: 20500000, beds: 4, baths: 3, sqft: 2400, status: 'sold' },
];

export const LEAD_FIRST_NAMES = [
  'Ahmed', 'Sara', 'Hassan', 'Nadia', 'Kamran', 'Amna', 'Faisal', 'Sana', 'Tariq', 'Laiba',
  'Waqas', 'Hira', 'Adnan', 'Mehwish', 'Shahid', 'Rabia', 'Junaid', 'Mahnoor', 'Saad', 'Areeba',
  'Bilal', 'Zoya', 'Imran', 'Farah', 'Kashif', 'Noor', 'Asim', 'Huma', 'Yasir', 'Mariam',
  'Danish', 'Saima', 'Rehan', 'Anum', 'Naveed', 'Iqra', 'Salman', 'Uzma', 'Arsalan', 'Kiran',
  'Hamza', 'Sidra', 'Talha', 'Nida', 'Rizwan', 'Samina',
];

export const LEAD_LAST_NAMES = [
  'Khan', 'Shah', 'Malik', 'Afridi', 'Qureshi', 'Yousafzai', 'Khattak', 'Iqbal', 'Raza', 'Hussain',
  'Abbasi', 'Mehmood', 'Butt', 'Aziz', 'Gul', 'Noor', 'Siddiqui', 'Javed', 'Anwar', 'Bashir',
];

export const TESTIMONIAL_QUOTES = [
  { author: 'Mr. & Mrs. Saeed', content: 'Ayesha helped us find the right home in Hayatabad within two weeks. Clear communication and no pressure throughout.' },
  { author: 'Dr. Kamal', content: 'Professional from first call to handover. Bilal understood exactly what we wanted in DHA Peshawar.' },
  { author: 'Hina W.', content: 'Maria made renting near University Town simple. She answered every question quickly on WhatsApp.' },
  { author: 'Investor Group Peshawar', content: 'Omar gave us honest plot comparisons in Regi Model Town instead of pushing the most expensive option.' },
  { author: 'Shop Owner Saddar', content: 'Hina found a commercial unit that matched our budget and foot-traffic needs perfectly.' },
  { author: 'Family of 5', content: 'Usman coordinated multiple viewings around our schedule and helped us negotiate a fair price.' },
  { author: 'Col. (Retd) Farooq', content: 'Fatima handled our villa purchase in DHA with complete transparency on paperwork and timelines.' },
  { author: 'First-time Buyer', content: 'Zain walked us through every step of buying in Hayatabad Phase 3. We felt supported, not rushed.' },
  { author: 'Amina K.', content: 'Rabia was patient with our financing questions and kept us updated until closing.' },
  { author: 'Mr. Haroon', content: 'The team responded faster than any other brokerage we contacted in Peshawar.' },
  { author: 'Mrs. Parveen', content: 'We sold our family home quickly and at a fair market price thanks to consistent follow-up.' },
  { author: 'Young Professional', content: 'Great experience renting an apartment near Ring Road. Smooth process start to finish.' },
];
