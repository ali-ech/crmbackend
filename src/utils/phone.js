const DEFAULT_COUNTRY_CODE = process.env.PHONE_COUNTRY_CODE || '92';

/**
 * Normalize a phone number for WhatsApp / E.164 delivery.
 * Handles local PK format (0325...) → +92325...
 */
export function normalizePhoneForWhatsApp(phone, countryCode = DEFAULT_COUNTRY_CODE) {
  if (!phone?.trim()) return '';

  const trimmed = phone.trim();
  let digits = trimmed.replace(/[^\d]/g, '');

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith(countryCode)) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return `+${countryCode}${digits}`;
}
