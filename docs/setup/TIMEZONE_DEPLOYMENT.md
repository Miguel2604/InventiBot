# Philippine Timezone Deployment Instructions

## Overview
This update fixes the timezone handling in the InventiBot visitor pass system to properly work with Philippine Standard Time (PST = UTC+8).

## What Was Changed

### 1. New Timezone Utilities (`src/utils/timezone.ts`)
- Added functions to handle Philippine timezone conversions
- Converts user-selected times to proper UTC for database storage
- Formats times in Philippine time for user display

### 2. Updated Visitor Pass Handler (`src/handlers/visitor-pass.handler.ts`)
- Modified to use Philippine timezone utilities
- All user interactions now show Philippine time
- Database operations still use UTC for consistency

### 3. Database Function Update (`supabase/migrations/005_visitor_passes_timezone_fix.sql`)
- Updated `use_visitor_pass` function to show Philippine time in error messages
- All time comparisons remain in UTC for accuracy

## Deployment Steps

### Step 1: Apply Database Migration
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/005_visitor_passes_timezone_fix.sql`
4. Paste and execute the SQL

### Step 2: Deploy Application Code
1. Deploy the updated code to your server (Render, Heroku, etc.)
2. The new timezone utilities will be included automatically

### Step 3: Test the System
1. Create a new visitor pass through the chatbot
2. Select "Morning (9 AM)" - this should now be 9 AM Philippine time
3. Verify the confirmation message shows Philippine time
4. Test visitor check-in with a valid pass

## Expected Behavior After Deployment

### For Tenants Creating Passes:
- **9 AM Morning** = 9:00 AM Philippine Time (stored as 01:00 UTC)
- **2 PM Afternoon** = 2:00 PM Philippine Time (stored as 06:00 UTC) 
- **6 PM Evening** = 6:00 PM Philippine Time (stored as 10:00 UTC)
- **All times display with "(Philippine Time)" label**

### For Visitors Using Passes:
- Pass validation now works with Philippine business hours
- Error messages show Philippine time for clarity
- Welcome messages display expiry in Philippine time

### Database Storage:
- All times are still stored in UTC for consistency
- Only the user interface shows Philippine time
- No data migration needed for existing passes

## Verification

Run the test script to verify timezone utilities:
```bash
npx tsx scripts/test-timezone.ts
```

This should show:
- Current Philippine time is +8 hours from UTC
- Morning, afternoon, evening times are correctly converted
- All time displays show Philippine time format

## Troubleshooting

### If passes still show wrong times:
1. Ensure the database migration was applied successfully
2. Check that the application was redeployed with the new code
3. Clear any cached sessions in the chatbot

### If visitors get "not valid yet" errors:
1. Check the visitor pass `valid_from` time in the database
2. Ensure it's properly converted to UTC
3. The error message should now show Philippine time

## Technical Details

- **Philippine Standard Time**: UTC+8 (no daylight saving)
- **Database**: All timestamps stored in UTC
- **User Interface**: All times displayed in Philippine time
- **Conversion**: Automatic conversion between UTC and Philippine time
- **Validation**: UTC-based for accuracy, Philippine time for user messages

The system now properly handles the 8-hour offset that was causing confusion when users selected times thinking in Philippine time but the system stored them as local machine time.