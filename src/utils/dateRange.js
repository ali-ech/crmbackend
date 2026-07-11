import { env } from '../config/env.js';

const TZ = env.brokerageTimezone || '+05:00';

function normalizeDateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Build an inclusive createdAt/dueAt range from YYYY-MM-DD (or ISO) strings.
 * Uses brokerage timezone so "today" matches the user's calendar day.
 */
export function buildDateRangeFilter(dateFrom, dateTo) {
  const range = {};
  const fromDay = normalizeDateOnly(dateFrom);
  const toDay = normalizeDateOnly(dateTo);

  if (fromDay) {
    range.$gte = new Date(`${fromDay}T00:00:00.000${TZ}`);
  }
  if (toDay) {
    range.$lte = new Date(`${toDay}T23:59:59.999${TZ}`);
  }

  return Object.keys(range).length ? range : null;
}
