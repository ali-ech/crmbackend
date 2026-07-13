import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../../../test-data/leads-list-2.pdf');

const leads = [
  {
    name: 'Tariq Mehmood',
    phone: '03001001001',
    email: 'tariq.m@test.com',
    source: 'Facebook Ad',
    sourceDetail: 'FB Lead Form - Hayatabad Phase 6',
    property: 'Phase 6 Street 12 Hayatabad',
    propertyType: 'House',
    type: 'Buyer',
    note: 'Budget 2.5 crore, needs 5 bed',
  },
  {
    name: 'Rubina Akhtar',
    phone: '03002002002',
    email: 'rubina.a@test.com',
    source: 'TikTok Ad',
    sourceDetail: 'TikTok - DHA Villa Campaign',
    property: 'Sector A Lane 4 DHA Peshawar',
    propertyType: 'House',
    type: 'Buyer',
    note: 'Corner plot preferred, family of 6',
  },
  {
    name: 'Junaid Iqbal',
    phone: '03003003003',
    email: 'junaid.i@test.com',
    source: 'Referral',
    sourceDetail: 'University Town referral',
    property: 'University Road Block C University Town',
    propertyType: 'Apartment',
    type: 'Renter',
    note: '2 bed, 1 year lease, near campus',
  },
  {
    name: 'Samina Parvez',
    phone: '03004004004',
    email: 'samina.p@test.com',
    source: 'Facebook Ad',
    sourceDetail: 'Instagram Reels - Phase 7 Apt',
    property: 'Hayatabad Phase 7 Apartment Block B',
    propertyType: 'Apartment',
    type: 'Buyer',
    note: 'Ready to book this week',
  },
  {
    name: 'Adnan Waseem',
    phone: '03005005005',
    email: 'adnan.w@test.com',
    source: 'TikTok Ad',
    sourceDetail: 'TikTok - Saddar Commercial',
    property: 'Commercial Plaza Saddar Road',
    propertyType: 'Commercial',
    type: 'Buyer',
    note: 'Shop + office, ground floor only',
  },
  {
    name: 'Farhan Gul',
    phone: '03006006006',
    email: 'farhan.g@test.com',
    source: 'Bulk Import',
    sourceDetail: 'Expo batch July 2026',
    property: 'Ring Road Commercial Malakand',
    propertyType: 'Plot',
    type: 'Buyer',
    note: 'No matching listing — expect smart-forward fail',
  },
  {
    name: 'Hina Batool',
    phone: '03007007007',
    email: 'hina.b@test.com',
    source: 'Facebook Ad',
    sourceDetail: 'FB Retargeting - Hayatabad',
    property: 'Phase 6 Street 12 Hayatabad',
    propertyType: 'House',
    type: 'Buyer',
    note: 'Second inquiry for Phase 6 property',
  },
  {
    name: 'Kashif Alam',
    phone: '03008008008',
    email: 'kashif.a@test.com',
    source: 'Referral',
    sourceDetail: 'DHA open house visitor',
    property: 'Sector A Lane 4 DHA Peshawar',
    propertyType: 'House',
    type: 'Buyer',
    note: 'Relocating from Lahore, cash buyer',
  },
];

const doc = new PDFDocument({ margin: 50, size: 'A4' });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

doc.fontSize(18).font('Helvetica-Bold').text('Premier Realty — Lead List 2 (L2)', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor('#555555').text('Batch import file · July 2026 · Peshawar market leads', { align: 'center' });
doc.moveDown(1.5);
doc.fillColor('#000000');

leads.forEach((lead, index) => {
  if (index > 0) doc.moveDown(0.8);
  doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${lead.name}`);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Phone: ${lead.phone}`);
  doc.text(`Email: ${lead.email}`);
  doc.text(`Source: ${lead.source} — ${lead.sourceDetail}`);
  doc.text(`Property interest: ${lead.property} (${lead.propertyType})`);
  doc.text(`Lead type: ${lead.type}`);
  doc.text(`Notes: ${lead.note}`);
  doc.moveDown(0.3);
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
