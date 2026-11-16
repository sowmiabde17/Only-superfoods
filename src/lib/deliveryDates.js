/**
 * deliveryDates.js — Hyperlocal Morning Delivery Date Engine
 *
 * Rules:
 * 1. Users can NEVER select today after 7:00 AM.
 * 2. If before 7:00 AM, today can be selected (or next 7 days).
 * 3. Only allows selecting up to next 7 days in advance.
 * 4. Never allows selecting previous days.
 * 5. The next available day is ALWAYS labeled "Tomorrow" instead of the date.
 * 6. Supports multi-date selection, which multiplies cart items by the number of selected drop dates.
 */

/**
 * Generates the array of available delivery dates based on current time.
 * @param {Date} [referenceDate] - Optional date for testing (defaults to now)
 * @returns {Array<{
 *   id: string,
 *   displayLabel: string,
 *   subLabel: string,
 *   fullLabel: string,
 *   isTomorrow: boolean,
 *   isToday: boolean,
 *   date: Date
 * }>}
 */
export function getAvailableDeliveryDates(referenceDate) {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  const currentHour = now.getHours();

  // Cutoff rule: users can never select today after 7:00 AM
  const isPastMorningCutoff = currentHour >= 7;
  const startOffset = isPastMorningCutoff ? 1 : 0;

  const dates = [];

  for (let i = 0; i < 7; i++) {
    const offset = startOffset + i;
    const d = new Date(now);
    d.setDate(now.getDate() + offset);

    // Date formatting in IST locale
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
    
    // ISO string for unique key: YYYY-MM-DD
    const year = d.getFullYear();
    const monthPadded = String(d.getMonth() + 1).padStart(2, '0');
    const dayPadded = String(dayNum).padStart(2, '0');
    const id = `${year}-${monthPadded}-${dayPadded}`;

    const isToday = offset === 0;
    const isTomorrow = offset === 1;

    let displayLabel = dayOfWeek;
    if (isToday) {
      displayLabel = 'Today';
    } else if (isTomorrow) {
      displayLabel = 'Tomorrow';
    }

    const subLabel = `${dayNum} ${monthStr}`;
    const fullLabel = isTomorrow
      ? `Tomorrow (${dayOfWeek}, ${dayNum} ${monthStr})`
      : isToday
        ? `Today (${dayOfWeek}, ${dayNum} ${monthStr})`
        : `${dayOfWeek}, ${dayNum} ${monthStr}`;

    dates.push({
      id,
      displayLabel,
      subLabel,
      fullLabel,
      isTomorrow,
      isToday,
      date: d,
    });
  }

  return dates;
}

/**
 * Formats an array of selected date IDs into human-readable label list.
 * @param {string[]} selectedIds
 * @param {Array<any>} availableDates
 * @returns {string}
 */
export function formatSelectedDeliveryDates(selectedIds, availableDates) {
  if (!selectedIds || selectedIds.length === 0) return 'Tomorrow';
  const labels = selectedIds.map((id) => {
    const found = availableDates.find((d) => d.id === id);
    return found ? found.fullLabel : id;
  });
  return labels.join('; ');
}
