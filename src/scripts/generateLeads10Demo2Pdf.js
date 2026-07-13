import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../../../test-data/bulk-leads-10-demo-2.pdf');

const leads = [
  { name: 'Usman Tariq', phone: '03010201001', email: 'usman.t@test.com', source: 'Facebook Ad', sourceDetail: 'FB Lead Form - Hayatabad April', property: 'Phase 6 Street 12 Hayatabad', propertyType: 'House', type: 'Buyer', note: 'Wants 5 bed with servant quarter, budget 3 crore' },
  { name: 'Hira Bibi', phone: '03010202002', email: 'hira.b@test.com', source: 'TikTok Ad', sourceDetail: 'TikTok - DHA Luxury Homes', property: 'Sector A Lane 4 DHA Peshawar', propertyType: 'House', type: 'Buyer', note: 'Prefers gated community, moving from Rawalpindi' },
  { name: 'Kamran Hussain', phone: '03010203003', email: 'kamran.h@test.com', source: 'Referral', sourceDetail: 'Client referral - university area', property: 'University Road Block C University Town', propertyType: 'Apartment', type: 'Renter', note: '3 bed semi-furnished, 6 month lease' },
  { name: 'Sadia Noor', phone: '03010204004', email: 'sadia.n@test.com', source: 'Facebook Ad', sourceDetail: 'Instagram Story - Phase 7', property: 'Hayatabad Phase 7 Apartment Block B', propertyType: 'Apartment', type: 'Buyer', note: 'First-time buyer, needs bank financing guidance' },
  { name: 'Zeeshan Malik', phone: '03010205005', email: 'zeeshan.m@test.com', source: 'TikTok Ad', sourceDetail: 'TikTok - Saddar Retail', property: 'Commercial Plaza Saddar Road', propertyType: 'Commercial', type: 'Buyer', note: 'Restaurant space, minimum 1500 sqft ground floor' },
  { name: 'Nida Farooq', phone: '03010206006', email: 'nida.f@test.com', source: 'Facebook Ad', sourceDetail: 'FB Carousel - Hayatabad Family Homes', property: 'Phase 6 Street 12 Hayatabad', propertyType: 'House', type: 'Buyer', note: 'School nearby is priority, 4+ bedrooms' },
  { name: 'Asim Raza', phone: '03010207007', email: 'asim.r@test.com', source: 'Referral', sourceDetail: 'DHA property expo visitor', property: 'Sector A Lane 4 DHA Peshawar', propertyType: 'House', type: 'Buyer', note: 'Cash ready, wants viewing within 48 hours' },
  { name: 'Mahnoor Shah', phone: '03010208008', email: 'mahnoor.s@test.com', source: 'TikTok Ad', sourceDetail: 'TikTok - University Town Investment', property: 'University Road Block C University Town', propertyType: 'Apartment', type: 'Buyer', note: 'Buying for rental income, near campus' },
  { name: 'Fahad Iqbal', phone: '03010209009', email: 'fahad.i@test.com', source: 'Bulk Import', sourceDetail: 'Property expo sign-up sheet', property: 'Hayatabad Phase 7 Apartment Block B', propertyType: 'Apartment', type: 'Renter', note: 'Young professional, 1 year lease preferred' },
  { name: 'Rabia Ansari', phone: '03010210010', email: 'rabia.a@test.com', source: 'Referral', sourceDetail: 'Walk-in Saddar branch', property: 'Commercial Plaza Saddar Road', propertyType: 'Commercial', type: 'Buyer', note: 'Medical clinic setup, needs parking access' },
];

const doc = new PDFDocument({ margin: 50, size: 'A4' });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

doc.fontSize(18).font('Helvetica-Bold').text('Real Estate Lead Sheet — 10 Leads (Batch 2)', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor('#555555').text('Demo import file · Premier Realty · April 2026', { align: 'center' });
doc.moveDown(1.5);
doc.fillColor('#000000');

leads.forEach((lead, index) => {
  if (index > 0) doc.moveDown(0.6);
  doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${lead.name}`);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Phone: ${lead.phone}`);
  doc.text(`Email: ${lead.email}`);
  doc.text(`Source: ${lead.source} — ${lead.sourceDetail}`);
  doc.text(`Property interest: ${lead.property} (${lead.propertyType})`);
  doc.text(`Lead type: ${lead.type}`);
  doc.text(`Notes: ${lead.note}`);
  doc.moveDown(0.2);
  doc.strokeColor('#dddddd').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
});

doc.moveDown(1);
doc.fontSize(9).fillColor('#666666').text(
  'Import via CRM → Leads → Import leads → Upload PDF. Property names must match active listings for smart-forward.',
  { align: 'left' },
);

doc.end();

stream.on('finish', () => {
  console.log(`Created ${outPath}`);
});
