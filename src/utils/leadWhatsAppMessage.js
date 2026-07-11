import { env } from '../config/env.js';
import { agentPortfolioUrl, listingDetailUrl } from './publicUrls.js';

function firstName(fullName) {
  const name = (fullName || '').trim().split(/\s+/)[0];
  return name || 'there';
}

function formatPropertyType(type) {
  const labels = {
    house: 'House',
    apartment: 'Apartment',
    plot: 'Plot',
    commercial: 'Commercial property',
  };
  return labels[type] || 'Property';
}

function formatAddress(listing) {
  const addr = listing?.address;
  return [addr?.street, addr?.city, addr?.state].filter(Boolean).join(', ');
}

function formatSpecs(listing) {
  return [
    listing.bedrooms != null && `${listing.bedrooms} bed`,
    listing.bathrooms != null && `${listing.bathrooms} bath`,
    listing.sqft != null && `${listing.sqft.toLocaleString()} sq ft`,
  ].filter(Boolean).join(' · ');
}

export function buildLeadPropertyWhatsAppMessage(lead, listing, agent) {
  const leadName = firstName(lead?.name);
  const agentName = agent?.profile?.name || 'Your property consultant';
  const agentTitle = agent?.profile?.title || 'Property Consultant';
  const brokerage = env.brokerageName || 'Our brokerage';
  const addressLine = formatAddress(listing);
  const specs = formatSpecs(listing);
  const propertyType = formatPropertyType(listing.propertyType);
  const propertyUrl = listingDetailUrl(listing);
  const portfolioUrl = agentPortfolioUrl(agent);
  const agentPhone = agent?.profile?.publicPhone || agent?.profile?.phone || '';
  const price = listing.price != null ? `PKR ${listing.price.toLocaleString()}` : null;

  const lines = [
    `Assalam-o-Alaikum ${leadName},`,
    '',
    `I hope you are doing well. My name is *${agentName}* from *${brokerage}*. Thank you for your interest — I would be happy to assist you with this ${propertyType.toLowerCase()}.`,
    '',
    `*Property overview*`,
    `📍 ${addressLine}`,
  ];

  if (price) lines.push(`💰 ${price}`);
  if (specs) lines.push(specs);

  if (listing.description) {
    const excerpt = listing.description.length > 220
      ? `${listing.description.slice(0, 217).trim()}…`
      : listing.description;
    lines.push('', excerpt);
  }

  lines.push('');

  if (propertyUrl) {
    lines.push('View full details, photos & location on our website:', propertyUrl, '');
  }

  if (portfolioUrl) {
    lines.push('Browse my portfolio and other available listings:', portfolioUrl, '');
  }

  lines.push(
    'Please reply here or feel free to call me if you would like to schedule a viewing or discuss your requirements.',
  );

  if (agentPhone) {
    lines.push(`📞 ${agentPhone}`);
  }

  lines.push('', 'Best regards,', `*${agentName}*`, agentTitle, brokerage);

  return lines.join('\n');
}
