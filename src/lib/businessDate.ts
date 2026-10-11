export const BUSINESS_TIME_ZONE = "America/Bahia";

/**
 * Returns the calendar date in the business time zone, not UTC.
 * Keep the time zone explicit so browsers and Edge Functions agree.
 */
export function getBusinessDate(date: Date = new Date(), timeZone = BUSINESS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
