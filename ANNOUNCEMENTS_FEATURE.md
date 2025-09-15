# Adding Announcements Feature to InventiBot

## Overview
Add an "Announcements" button to the main menu that allows tenants to view building announcements through the Facebook Messenger chatbot.

## Feature Requirements

### 1. Main Menu Update
Add "📢 Announcements" button alongside existing menu options:
- Main Menu
- Building Info  
- Report Issue
- Book Amenity
- **📢 Announcements** (NEW)

### 2. Announcements Display Flow

#### When user clicks "Announcements":
1. Fetch announcements from Supabase based on:
   - User's building_id (from their profile)
   - Published status (is_published = true)
   - Not expired (expires_at > NOW() or NULL)
   - Targeted to their unit or all units

2. Display announcements in chat:
   - Show by priority (urgent → high → normal → low)
   - Format each announcement as a card/message
   - Include: Title, Content, Category, Priority indicator
   - Show "No announcements" if none exist

### 3. Database Query

```sql
-- Fetch announcements for a tenant
SELECT 
    title,
    content,
    category,
    priority,
    published_at,
    expires_at
FROM announcements
WHERE building_id = $1  -- tenant's building_id
    AND is_published = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
        target_units IS NULL 
        OR $2 = ANY(target_units)  -- tenant's unit_id
    )
ORDER BY 
    CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
    END,
    published_at DESC
LIMIT 10;  -- Show latest 10 announcements
```

### 4. Message Formatting

#### For each announcement:
```
🔴 URGENT: [Title]
━━━━━━━━━━━━━━━
[Content]

Category: [Category]
Posted: [Date]
```

Priority indicators:
- 🔴 URGENT (red)
- 🟠 HIGH (orange)  
- 🔵 NORMAL (blue)
- ⚪ LOW (gray)

### 5. Implementation Steps

1. **Update Menu Handler**
   - Add new button to main menu array
   - Add case for "announcements" action

2. **Create Announcements Handler**
   - Query Supabase for announcements
   - Format messages based on priority
   - Handle empty results

3. **Add Helper Functions**
   - `fetchUserAnnouncements(userId)`
   - `formatAnnouncementMessage(announcement)`
   - `getPriorityEmoji(priority)`

## Real-Time Notification Feature (Advanced)

### Question: Can the bot notify tenants when new announcements are published?

**Yes, this is possible!** Here are three approaches:

### Option 1: Supabase Realtime + Webhook (Recommended)
```
Admin publishes → Supabase trigger → Webhook → Bot server → Send messages
```

**Pros:**
- Real-time notifications
- Reliable delivery
- Can batch notifications

**Cons:**
- Requires webhook endpoint
- Need to store Messenger PSIDs

### Option 2: Database Triggers with Edge Functions
```
Admin publishes → Database trigger → Edge Function → Facebook Send API
```

**Pros:**
- Serverless approach
- Direct from Supabase

**Cons:**
- Requires Supabase Edge Functions
- API rate limits

### Option 3: Scheduled Polling
```
Cron job → Check new announcements → Send to affected tenants
```

**Pros:**
- Simple implementation
- No webhooks needed

**Cons:**
- Not real-time (delay based on polling interval)
- More database queries

## Recommended Architecture for Notifications

### 1. Database Setup
```sql
-- Add table to track notification status
CREATE TABLE announcement_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    announcement_id UUID REFERENCES announcements(id),
    tenant_id UUID REFERENCES profiles(id),
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Webhook Implementation
```javascript
// When announcement is created/published
app.post('/webhook/announcement', async (req, res) => {
    const { announcement, building_id, target_units } = req.body;
    
    // Get affected tenants
    const tenants = await getTenantsByBuildingAndUnits(building_id, target_units);
    
    // Send notifications
    for (const tenant of tenants) {
        if (tenant.chat_platform_id) {  // Has Messenger PSID
            await sendMessengerNotification(
                tenant.chat_platform_id,
                formatAnnouncementNotification(announcement)
            );
        }
    }
});
```

### 3. Messenger Notification Format
```
🔔 New Announcement!

[Priority Emoji] [Title]

[First 100 chars of content]...

Type "announcements" to read more.
```

## Security Considerations

1. **Verify tenant belongs to building** before showing announcements
2. **Check unit targeting** if announcement is unit-specific
3. **Rate limit** notification sending to avoid spam
4. **Store consent** for push notifications per user

## Database Prerequisites

Ensure these exist:
- `profiles.chat_platform_id` (Facebook PSID)
- `profiles.building_id` 
- `profiles.unit_id`
- Proper RLS policies for tenant access

## Testing Checklist

- [ ] Menu shows Announcements button
- [ ] Clicking button fetches correct announcements
- [ ] Priority sorting works correctly
- [ ] Expired announcements don't show
- [ ] Unit-targeted announcements work
- [ ] Empty state shows appropriate message
- [ ] Notification webhook receives events (if implemented)
- [ ] Tenants receive notifications (if implemented)

## Future Enhancements

1. **Mark as Read** - Track which announcements user has seen
2. **Categories Filter** - Let users filter by category
3. **Notification Preferences** - Users choose notification types
4. **Rich Media** - Support images in announcements
5. **Quick Actions** - Add buttons for common responses
6. **Language Support** - Multi-language announcements

## Notes

- Consider notification fatigue - don't over-notify
- Urgent announcements could bypass user preferences
- Store notification delivery status for analytics
- Consider time zones for notification timing
- Test with various announcement priorities and targets