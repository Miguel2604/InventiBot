/**
 * Timezone utilities for Philippine Standard Time (PST = UTC+8)
 */

export const PHILIPPINES_TIMEZONE_OFFSET = 8; // UTC+8 hours

/**
 * Convert a Date object to Philippine Standard Time
 */
export function toPhilippineTime(date: Date): Date {
  const utcTime = date.getTime();
  const philippineTime = new Date(utcTime + (PHILIPPINES_TIMEZONE_OFFSET * 60 * 60 * 1000));
  return philippineTime;
}

/**
 * Convert a Date object from Philippine time to UTC
 */
export function fromPhilippineTimeToUTC(date: Date): Date {
  const localTime = date.getTime();
  const utcTime = new Date(localTime - (PHILIPPINES_TIMEZONE_OFFSET * 60 * 60 * 1000));
  return utcTime;
}

/**
 * Get current time in Philippine timezone
 */
export function nowInPhilippineTime(): Date {
  return toPhilippineTime(new Date());
}

/**
 * Create a Date object for a specific time today in Philippine timezone
 * @param hours Hour in 24-hour format (0-23)
 * @param minutes Minutes (0-59)
 * @param date Optional date, defaults to today
 * @returns Date object in UTC that represents the Philippine time
 */
export function createPhilippineTime(hours: number, minutes: number = 0, date?: Date): Date {
  const targetDate = date || new Date();
  
  // Get the date components in UTC
  const year = targetDate.getUTCFullYear();
  const month = targetDate.getUTCMonth();
  const day = targetDate.getUTCDate();
  
  // Create a UTC date with the Philippine local time
  // Philippine time is UTC+8, so subtract 8 hours to get UTC
  const utcDateTime = new Date(Date.UTC(year, month, day, hours - PHILIPPINES_TIMEZONE_OFFSET, minutes, 0, 0));
  
  return utcDateTime;
}

/**
 * Format a date for display in Philippine time
 */
export function formatPhilippineTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return date.toLocaleString('en-PH', { ...defaultOptions, ...options });
}

/**
 * Get the start of day in Philippine time (converted to UTC)
 */
export function getPhilippineStartOfDay(date?: Date): Date {
  const targetDate = date || new Date();
  return createPhilippineTime(0, 0, targetDate);
}

/**
 * Get the end of day in Philippine time (converted to UTC) 
 */
export function getPhilippineEndOfDay(date?: Date): Date {
  const targetDate = date || new Date();
  return createPhilippineTime(23, 59, targetDate);
}

/**
 * Check if a date is in the past relative to Philippine time
 */
export function isInPastPhilippineTime(date: Date): boolean {
  const nowPH = nowInPhilippineTime();
  const datePH = toPhilippineTime(date);
  return datePH < nowPH;
}

/**
 * Add hours to a date while maintaining timezone awareness
 */
export function addHoursInPhilippineTime(date: Date, hours: number): Date {
  return new Date(date.getTime() + (hours * 60 * 60 * 1000));
}

/**
 * Convert time selections to proper UTC timestamps
 */
export function convertTimeSelectionToUTC(visitDate: string, startTime: string): Date {
  const today = new Date();
  let visitDateObj = new Date(visitDate);
  
  // Ensure we're working with the correct date
  visitDateObj = new Date(visitDateObj.getFullYear(), visitDateObj.getMonth(), visitDateObj.getDate());
  
  let hours = 9; // Default to 9 AM
  let minutes = 0;
  
  switch (startTime) {
    case 'now':
      // For "now", use current Philippine time rounded up to next 15 minutes
      const nowPH = nowInPhilippineTime();
      const currentMinutes = nowPH.getMinutes();
      const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
      
      if (roundedMinutes >= 60) {
        hours = nowPH.getHours() + 1;
        minutes = 0;
      } else {
        hours = nowPH.getHours();
        minutes = roundedMinutes;
      }
      
      // Use today's date for "now"
      visitDateObj = new Date();
      break;
    case 'morning':
      hours = 9; // 9 AM Philippine time
      break;
    case 'afternoon':
      hours = 14; // 2 PM Philippine time
      break;
    case 'evening':
      hours = 18; // 6 PM Philippine time
      break;
  }
  
  return createPhilippineTime(hours, minutes, visitDateObj);
}