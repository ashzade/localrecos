/**
 * Parses a Google Places weekday_text hours string and returns whether the place is open now.
 * Format: "Monday: 9:00 AM – 10:00 PM | Tuesday: Closed | ..."
 * Returns null if hours cannot be parsed.
 */
export function isOpenNow(hours: string): boolean | null {
  try {
    const now = new Date();
    // getDay(): 0=Sun, 1=Mon ... 6=Sat
    // Google Places weekday_text: 0=Mon ... 5=Sat, 6=Sun
    const jsDay = now.getDay();
    const placesDay = jsDay === 0 ? 6 : jsDay - 1;

    const segments = hours.split(' | ');
    const todaySegment = segments[placesDay];
    if (!todaySegment) return null;

    // Strip the day name prefix ("Monday: " etc.)
    const timesPart = todaySegment.replace(/^[^:]+:\s*/, '').trim();
    if (!timesPart) return null;
    if (timesPart.toLowerCase() === 'closed') return false;
    if (timesPart.toLowerCase().includes('24 hours')) return true;

    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Match any dash-like separator (hyphen, en-dash, em-dash, figure dash)
    const dash = '[-\u002D\u2013\u2014\u2012\u2010]';

    // 12-hour format: "9:00 AM – 10:00 PM"
    const re12 = new RegExp(
      `(\\d{1,2}:\\d{2}\\s*[AP]M)\\s*${dash}\\s*(\\d{1,2}:\\d{2}\\s*[AP]M)`,
      'i'
    );
    const m12 = timesPart.match(re12);
    if (m12) {
      const openMin = parse12(m12[1]);
      const closeMin = parse12(m12[2]);
      if (openMin === null || closeMin === null) return null;
      if (closeMin < openMin) return nowMin >= openMin || nowMin < closeMin;
      return nowMin >= openMin && nowMin < closeMin;
    }

    // 24-hour format: "09:00 – 22:00"
    const re24 = new RegExp(`(\\d{1,2}:\\d{2})\\s*${dash}\\s*(\\d{1,2}:\\d{2})`);
    const m24 = timesPart.match(re24);
    if (m24) {
      const [openH, openM] = m24[1].split(':').map(Number);
      const [closeH, closeM] = m24[2].split(':').map(Number);
      const openMin = openH * 60 + openM;
      const closeMin = closeH * 60 + closeM;
      if (closeMin < openMin) return nowMin >= openMin || nowMin < closeMin;
      return nowMin >= openMin && nowMin < closeMin;
    }

    return null;
  } catch {
    return null;
  }
}

function parse12(t: string): number | null {
  const m = t.trim().match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}
