/**
 * Afghan Solar Hijri (Jalali) Calendar Utilities
 * Covers accurate solar conversion and Dari / Pashto month naming:
 * حمل (Hamal), ثور (Sawr), جوزا (Jawza), سرطان (Saratan), اسد (Asad), سنبله (Sonbola),
 * میزان (Mizan), عقرب (Aqrab), قوس (Qaws), جدی (Jadi), دلو (Dalw), حوت (Hoot)
 */

export const AFGHAN_MONTHS = [
  'حمل',
  'ثور',
  'جوزا',
  'سرطان',
  'اسد',
  'سنبله',
  'میزان',
  'عقرب',
  'قوس',
  'جدی',
  'دلو',
  'حوت',
];

export const AFGHAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه',
];

/**
 * Converts a Gregorian Date to Jalali (Solar Hijri) Year, Month (1-12), Day (1-31)
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

/**
 * Formats a JavaScript Date to Full Afghan Jalali String
 * Example: "چهارشنبه ۱۲ سنبله ۱۴۰۵"
 */
export function formatAfghanJalaliDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

  const monthName = AFGHAN_MONTHS[jm - 1] || '';
  const weekdayName = AFGHAN_WEEKDAYS[d.getDay()] || '';

  return `${weekdayName} ${jd} ${monthName} ${jy}`;
}

/**
 * Short Afghan Jalali format
 * Example: "۱۲ سنبله ۱۴۰۵"
 */
export function formatAfghanShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

  const monthName = AFGHAN_MONTHS[jm - 1] || '';
  return `${jd} ${monthName} ${jy}`;
}

/**
 * Generates the past 30 days list for the dropdown filter
 */
export interface JalaliDayOption {
  value: string; // YYYY-MM-DD in Gregorian
  label: string; // e.g. "امروز (چهارشنبه ۱۲ سنبله)" or "دیروز (سه‌شنبه ۱۱ سنبله)"
  date: Date;
}

export function getPast30DaysOptions(): JalaliDayOption[] {
  const options: JalaliDayOption[] = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = target.toISOString().split('T')[0];
    const jalaliFormatted = formatAfghanJalaliDate(target);

    let prefix = '';
    if (i === 0) prefix = 'امروز - ';
    else if (i === 1) prefix = 'دیروز - ';
    else if (i === 2) prefix = 'پریروز - ';

    options.push({
      value: dateStr,
      label: `${prefix}${jalaliFormatted}`,
      date: target,
    });
  }

  return options;
}
