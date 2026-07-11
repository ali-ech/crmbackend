import { parseLeadsFromText, parseLeadsFromFile } from './geminiService.js';
import { createLead, findDuplicateByPhone, normalizePhone } from './leadService.js';

const VALID_SOURCES = ['facebook_ad', 'tiktok_ad', 'referral', 'bulk_import', 'manual'];
const VALID_PROPERTY_TYPES = ['house', 'apartment', 'plot', 'commercial'];

function parseStructuredLines(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const header = lines[0].toLowerCase();
  const isStructured = header.includes('name') && header.includes('phone');
  if (!isStructured) return null;

  const cols = lines[0].split('|').map((c) => c.trim().toLowerCase());
  const idx = (name) => cols.indexOf(name);

  const leads = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('|').map((p) => p.trim());
    if (parts.length < 2) continue;

    const get = (col) => {
      const j = idx(col);
      return j >= 0 ? parts[j] || null : null;
    };

    leads.push({
      name: get('name'),
      phone: get('phone'),
      email: get('email'),
      note: get('note'),
      source: VALID_SOURCES.includes(get('source')) ? get('source') : 'bulk_import',
      sourceDetail: get('sourcedetail') || get('source_detail') || null,
      propertyInterest: get('property') || get('propertyinterest') || get('property_interest') || null,
      propertyType: VALID_PROPERTY_TYPES.includes(get('propertytype') || get('property_type'))
        ? (get('propertytype') || get('property_type'))
        : null,
      type: get('type') || 'buyer',
    });
  }

  return leads.length ? leads : null;
}

async function enrichParsedLeads(parsed) {
  const leads = await Promise.all(
    parsed.map(async (lead, index) => {
      let duplicate = null;
      if (lead.phone) {
        duplicate = await findDuplicateByPhone(normalizePhone(lead.phone));
      }
      return {
        id: `row-${index}`,
        ...lead,
        type: lead.type || 'buyer',
        duplicate: duplicate
          ? { _id: duplicate._id, name: duplicate.name, phone: duplicate.phone, status: duplicate.status }
          : null,
      };
    })
  );

  return { leads, count: leads.length };
}

export async function parseImport(_actor, text) {
  const structured = parseStructuredLines(text);
  if (structured) return enrichParsedLeads(structured);

  const parsed = await parseLeadsFromText(text);
  return enrichParsedLeads(parsed);
}

export async function parseImportFromFile(_actor, file) {
  const text = file.buffer?.toString('utf8') || '';
  const structured = parseStructuredLines(text);
  if (structured) return enrichParsedLeads(structured);

  const parsed = await parseLeadsFromFile(file.buffer, file.mimetype);
  return enrichParsedLeads(parsed);
}

export async function confirmImport(actor, rows, { allowDuplicates = false } = {}) {
  const results = { created: [], skipped: [], duplicates: [], errors: [] };

  for (const row of rows) {
    if (!row.name?.trim() || !row.phone?.trim()) {
      results.skipped.push({ row, reason: 'Name and phone are required' });
      continue;
    }

    try {
      const lead = await createLead(
        actor,
        {
          type: row.type || 'buyer',
          name: row.name.trim(),
          phone: row.phone.trim(),
          email: row.email || null,
          notes: row.note || null,
          source: VALID_SOURCES.includes(row.source) ? row.source : 'bulk_import',
          sourceDetail: row.sourceDetail || null,
          propertyInterest: row.propertyInterest || null,
          propertyType: VALID_PROPERTY_TYPES.includes(row.propertyType) ? row.propertyType : null,
        },
        { allowDuplicate: allowDuplicates || row.importDuplicate === true }
      );

      if (lead.duplicateOfLeadId) {
        results.duplicates.push({ row, lead });
      } else {
        results.created.push({ row, lead });
      }
    } catch (err) {
      if (err.status === 409 && err.duplicate) {
        results.errors.push({ row, duplicate: err.duplicate, reason: err.message });
      } else {
        results.errors.push({ row, reason: err.message });
      }
    }
  }

  return results;
}
