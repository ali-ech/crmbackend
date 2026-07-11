import { env } from '../config/env.js';

export function getPublicSiteBaseUrl() {
  return (env.publicSiteUrl || 'http://localhost:5173').replace(/\/$/, '');
}

export function agentPortfolioUrl(agent) {
  const slug = agent?.slug;
  if (!slug) return null;
  return `${getPublicSiteBaseUrl()}/agents/${slug}`;
}

export function listingDetailUrl(listing) {
  const segment = listing?.slug || listing?._id?.toString();
  if (!segment) return null;
  return `${getPublicSiteBaseUrl()}/listings/${segment}`;
}
