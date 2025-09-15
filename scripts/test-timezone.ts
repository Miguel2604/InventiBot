#!/usr/bin/env tsx

import { 
  convertTimeSelectionToUTC, 
  addHoursInPhilippineTime, 
  formatPhilippineTime,
  createPhilippineTime,
  nowInPhilippineTime,
  toPhilippineTime
} from '../src/utils/timezone';

console.log('🕐 Testing Philippine Timezone Utilities');
console.log('==========================================');

// Test current time
const nowUTC = new Date();
const nowPH = nowInPhilippineTime();

console.log(`Current UTC time: ${nowUTC.toISOString()}`);
console.log(`Current Philippine time: ${formatPhilippineTime(nowPH)}`);
console.log(`Difference (should be +8 hours): ${(nowPH.getTime() - nowUTC.getTime()) / (1000 * 60 * 60)} hours`);
console.log();

// Test time selections for today
const today = new Date().toISOString().split('T')[0];
console.log(`Testing time selections for ${today}:`);

const morningTime = convertTimeSelectionToUTC(today, 'morning');
const afternoonTime = convertTimeSelectionToUTC(today, 'afternoon');
const eveningTime = convertTimeSelectionToUTC(today, 'evening');

console.log(`Morning (9 AM PH): ${morningTime.toISOString()} UTC = ${formatPhilippineTime(morningTime)}`);
console.log(`Afternoon (2 PM PH): ${afternoonTime.toISOString()} UTC = ${formatPhilippineTime(afternoonTime)}`);
console.log(`Evening (6 PM PH): ${eveningTime.toISOString()} UTC = ${formatPhilippineTime(eveningTime)}`);
console.log();

// Test duration calculations
console.log('Testing duration calculations:');
const baseTime = createPhilippineTime(14, 0); // 2 PM Philippine time
const plus2Hours = addHoursInPhilippineTime(baseTime, 2);
const plus4Hours = addHoursInPhilippineTime(baseTime, 4);

console.log(`Base time (2 PM PH): ${formatPhilippineTime(baseTime)}`);
console.log(`Plus 2 hours: ${formatPhilippineTime(plus2Hours)}`);
console.log(`Plus 4 hours: ${formatPhilippineTime(plus4Hours)}`);
console.log();

// Test "now" selection
const nowTime = convertTimeSelectionToUTC(today, 'now');
console.log(`"Now" time: ${formatPhilippineTime(nowTime)}`);
console.log();

// Test all-day pass
const visitDate = new Date('2025-09-15');
const allDayStart = createPhilippineTime(7, 0, visitDate);
const allDayEnd = createPhilippineTime(23, 0, visitDate);

console.log('Testing all-day pass:');
console.log(`All day start (7 AM PH): ${allDayStart.toISOString()} UTC = ${formatPhilippineTime(allDayStart)}`);
console.log(`All day end (11 PM PH): ${allDayEnd.toISOString()} UTC = ${formatPhilippineTime(allDayEnd)}`);
console.log();

console.log('✅ Philippine timezone utilities test completed!');
console.log('If the times look correct, the timezone handling should work properly.');