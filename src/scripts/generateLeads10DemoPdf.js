import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../../../test-data/bulk-leads-10-demo.pdf');

const leads = [
  { name: 'Arslan Haider', phone: '03010010001', email: 'arslan.h@test.com', source: 'Facebook Ad', sourceDetail: 'FB Lead Form - Hayatabad March', property: 'Phase 6 Street 12 Hayatabad', propertyType: 'House', type: 'Buyer', note: 'Budget 2.8 crore, needs parking for 2 cars' },
  { name: 'Mehwish Khan', phone: '03010020002', email: 'mehwish.k@test.com', source: 'TikTok Ad', sourceDetail: 'TikTok - DHA Villas', property: 'Sector A Lane 4 DHA Peshawar', propertyType: 'House', type: 'Buyer', note: 'Family of 7, wants corner plot' },
  { name: 'Danish Ali', phone: '03010030003', email: 'danish.a@test.com', source: 'Referral', sourceDetail: 'University Town walk-in', property: 'University Road Block C University Town', propertyType: 'Apartment', type: 'Renter', note: '2 bed furnished, 12 month lease' },
  { name: 'Sanaullah Afridi', phone: '03010040004', email: 'sanaullah.a@test.com', source: 'Facebook Ad', sourceDetail: 'Instagram Reels - Phase 7', property: 'Hayatabad Phase 7 Apartment Block B', propertyType: 'Apartment', type: 'Buyer', note: 'Ready to visit this weekend' },
  { name: 'Bilal Mehmood', phone: '03010050005', email: 'bilal.m@test.com', source: 'TikTok Ad', sourceDetail: 'TikTok - Saddar Commercial', property: 'Commercial Plaza Saddar Road', propertyType: 'Commercial', type: 'Buyer', note: 'Ground floor shop plus office upstairs' },
  { name: 'Fiza Batool', phone: '03010060006', email: 'fiza.b@test.com', source: 'Facebook Ad', sourceDetail: 'FB Retargeting - Hayatabad', property: 'Phase 6 Street 12 Hayatabad', propertyType: 'House', type: 'Buyer', note: 'Second inquiry for Phase 6 listing' },
  { name: 'Shahzaib Khan', phone: '03010070007', email: 'shahzaib.k@test.com', source: 'Referral', sourceDetail: 'DHA open house March', property: 'Sector A Lane 4 DHA Peshawar', propertyType: 'House', type: 'Buyer', note: 'Cash buyer relocating from Islamabad' },
  { name: 'Amina Yusuf', phone: '03010080008', email: 'amina.y@test.com', source: 'TikTok Ad', sourceDetail: 'TikTok - University Town', property: 'University Road Block C University Town', propertyType: 'Apartment', type: 'Buyer', note: 'Investment unit near university' },
  { name: 'Hamza Siddiqui', phone: '03010090009', email: 'hamza.s@test.com', source: 'Bulk Import', sourceDetail: 'Expo flyer batch April', property: 'Hayatabad Phase 7 Apartment Block B', propertyType: 'Apartment', type: 'Renter', note: '6 month lease, near Ring Road' },
  { name: 'Rashid Mahmood', phone: '03010100010', email: 'rashid.m@test.com', source: 'Referral', sourceDetail: 'Walk-in Saddar office', property: 'Commercial Plaza Saddar Road', propertyType: 'Commercial', type: 'Buyer', note: 'Retail space with storage room' },
];

const doc = new PDFDocument({ margin: 50, size: 'A4' });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

doc.fontSize(18).font('Helvetica-Bold').text('Real Estate Lead Sheet — 10 Leads', { align: 'center' });
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

doc.end();

stream.on('finish', () => {
  console.log(`Created ${outPath}`);
});
