# Inventi Chatbot Implementation Plan

## Overview
This document outlines the implementation plan for the Inventi property management chatbot, designed to integrate seamlessly with the existing Supabase backend and admin dashboard. The chatbot will serve as the primary tenant interface via Facebook Messenger, using a button-driven approach for all interactions.

## Architecture Overview

### Technology Stack
- **Platform**: Facebook Messenger
- **Backend**: Node.js (Express/Fastify)
- **Database**: Supabase (PostgreSQL with existing schema)
- **Authentication**: Supabase Auth with invite code system
- **Real-time**: Supabase Realtime subscriptions
- **Hosting**: Vercel/Railway/Heroku (serverless preferred)

### Integration Architecture
```
Facebook Messenger
    ↓ (Webhook)
Node.js Chatbot Server
    ↓ (Supabase JS Client)
Supabase Backend (Already Setup)
    ↓ (RLS Policies)
PostgreSQL Database (Existing Schema)
```

## Phase 1: Core Setup & Authentication (Week 1)

### 1.1 Project Initialization
- Initialize Node.js project with TypeScript
- Install dependencies:
  - `@supabase/supabase-js` - Database client
  - `express` or `fastify` - Web server
  - `axios` - Facebook API calls
  - `dotenv` - Environment management
  - `node-cache` - Session management

### 1.2 Facebook Messenger Setup
- Create Facebook App & Page
- Configure webhooks for messages and postbacks
- Set up persistent menu with main options
- Configure welcome message

### 1.3 Tenant Authentication System
**Leveraging Existing Schema**: Use the `invites` table and `claim_invite()` function

**First-Time User Flow**:
1. User messages the bot
2. Bot checks `user_profiles` for Facebook ID mapping
3. If not found, bot asks: "Welcome! Do you have an invite code?"
4. User provides invite code (from admin dashboard)
5. Bot validates against `invites` table:
   ```javascript
   // Pseudo-code
   const { data } = await supabase.rpc('claim_invite', {
     p_invite_code: userInput,
     p_user_id: supabaseUserId
   });
   ```
6. Store Facebook ID → Supabase user_id mapping
7. User is now authenticated for all future interactions

**Session Management**:
- Cache user sessions (Facebook ID → user_profiles.id)
- Include building_id and unit_id in session for context
- Auto-refresh from database every 24 hours

## Phase 2: FAQ System (Week 1-2)

### 2.1 Database Integration
**Leveraging Existing Schema**: `faqs` table with categories and keywords

### 2.2 Chatbot Implementation
**Menu Structure**:
```
Main Menu → "ℹ️ Building Info"
├── "🏢 Building Policies"
├── "🕒 Hours & Access"
├── "🗑️ Waste & Recycling"
├── "🔧 Maintenance Info"
├── "💰 Rent & Payments"
└── "📞 Emergency Contacts"
```

**Dynamic FAQ Loading**:
```javascript
// Load FAQs for user's building
const { data: faqs } = await supabase
  .from('faqs')
  .select('*')
  .eq('building_id', userSession.building_id)
  .eq('is_published', true)
  .order('priority', { ascending: false });

// Group by category for menu generation
const categorizedFAQs = groupBy(faqs, 'category');
```

**Quick Reply Generation**:
- Maximum 11 quick replies per Facebook limitation
- Implement pagination for long lists
- Track views via `views_count` increment

## Phase 3: Maintenance Request System (Week 2-3)

### 3.1 Database Integration
**Leveraging Existing Tables**:
- `maintenance_requests` - Store requests
- `maintenance_categories` - Dynamic categories per building
- `user_profiles` - Tenant information
- `units` - Unit association

### 3.2 Request Creation Flow

**Step 1: Category Selection**
```javascript
// Fetch categories for user's building
const { data: categories } = await supabase
  .from('maintenance_categories')
  .select('*')
  .eq('building_id', userSession.building_id)
  .eq('is_active', true);

// Present as quick replies
const quickReplies = categories.map(cat => ({
  content_type: 'text',
  title: cat.name,
  payload: `MAINT_CAT_${cat.id}`
}));
```

**Step 2: Issue Description**
- Provide common issue templates based on category
- Allow "Other" option for free text input

**Step 3: Urgency Level**
```javascript
// Use existing enum: 'low', 'medium', 'high', 'emergency'
const urgencyButtons = [
  { title: "🟢 Low - Can wait", payload: "URGENCY_low" },
  { title: "🟡 Medium - Soon please", payload: "URGENCY_medium" },
  { title: "🔴 High - Today needed", payload: "URGENCY_high" },
  { title: "🚨 Emergency - Now!", payload: "URGENCY_emergency" }
];
```

**Step 4: Media Upload**
```javascript
// Handle Facebook attachment
if (message.attachments) {
  const imageUrl = message.attachments[0].payload.url;
  // Upload to Supabase Storage
  const { data: upload } = await supabase.storage
    .from('maintenance-media')
    .upload(`${requestId}/${timestamp}.jpg`, imageBuffer);
  
  // Store URL in media_urls JSONB field
  mediaUrls.push(upload.publicUrl);
}
```

**Step 5: Confirmation & Submission**
```javascript
// Create maintenance request
const { data: request } = await supabase
  .from('maintenance_requests')
  .insert({
    building_id: userSession.building_id,
    unit_id: userSession.unit_id,
    tenant_id: userSession.user_id,
    category_id: selectedCategory,
    title: issueTitle,
    description: issueDescription,
    urgency: selectedUrgency,
    status: 'submitted',
    media_urls: mediaUrls
  })
  .select()
  .single();

// Send confirmation with ticket number
sendMessage(userId, `✅ Request #${request.id.slice(0,8)} created!`);
```

### 3.3 Status Updates via Real-time Subscriptions
```javascript
// Subscribe to changes for user's requests
supabase
  .channel('maintenance-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'maintenance_requests',
    filter: `tenant_id=eq.${userSession.user_id}`
  }, (payload) => {
    // Send Facebook message about status change
    notifyStatusChange(payload.new);
  })
  .subscribe();
```

## Phase 4: Amenity Booking System (Week 3-4)

### 4.1 Database Integration
**Leveraging Existing Tables**:
- `amenities` - Available facilities
- `bookings` - Reservation records
- `check_booking_conflict()` - Conflict validation

### 4.2 Booking Flow

**Step 1: Amenity Selection**
```javascript
// Fetch available amenities
const { data: amenities } = await supabase
  .from('amenities')
  .select('*')
  .eq('building_id', userSession.building_id)
  .eq('is_bookable', true)
  .eq('is_active', true);

// Present as carousel cards with images
const cards = amenities.map(amenity => ({
  title: amenity.name,
  subtitle: amenity.description,
  image_url: amenity.images[0],
  buttons: [{
    type: 'postback',
    title: 'Book This',
    payload: `BOOK_AMENITY_${amenity.id}`
  }]
}));
```

**Step 2: Date Selection**
- Present next 7 days as quick replies
- Check amenity-specific booking rules from `booking_rules` JSONB

**Step 3: Time Slot Availability**
```javascript
// Check for conflicts using database function
const { data: isAvailable } = await supabase.rpc('check_booking_conflict', {
  p_amenity_id: amenityId,
  p_start_time: startTime,
  p_end_time: endTime
});

// Generate available slots
const availableSlots = generateTimeSlots(amenity, date)
  .filter(slot => !hasConflict(slot));
```

**Step 4: Booking Confirmation**
```javascript
// Create booking
const { data: booking } = await supabase
  .from('bookings')
  .insert({
    building_id: userSession.building_id,
    amenity_id: selectedAmenity,
    tenant_id: userSession.user_id,
    start_time: startTime,
    end_time: endTime,
    status: 'confirmed',
    total_cost: calculateCost(amenity, duration)
  })
  .select()
  .single();
```

### 4.3 Booking Management
**"My Bookings" Feature**:
- List active bookings
- Cancel booking option (update status to 'cancelled')
- Set `cancellation_reason` and `cancelled_at`

## Phase 5: Announcements & Notifications (Week 4)

### 5.1 Announcement Delivery
**Leveraging `announcements` table**:
```javascript
// Poll for new announcements
const { data: announcements } = await supabase
  .from('announcements')
  .select('*')
  .eq('building_id', userSession.building_id)
  .eq('is_published', true)
  .gte('published_at', lastChecked)
  .or(`target_units.is.null,target_units.cs.{${userSession.unit_id}}`);

// Send high-priority announcements immediately
announcements
  .filter(a => a.priority === 'urgent')
  .forEach(announcement => {
    sendUrgentNotification(userId, announcement);
  });
```

### 5.2 Package & Visitor Notifications
**Extended Feature** (requires schema addition):
- Add `visitor_logs` table for guest management
- Add `package_deliveries` table for package tracking
- Send automated notifications via chatbot

## Phase 6: Advanced Features (Week 5-6)

### 6.1 Human Handoff System
**Implementation Strategy**:
1. Add "Talk to Manager" button in every menu
2. Create `support_tickets` table (or use maintenance_requests)
3. Set special flag for human intervention needed
4. Notify admin dashboard of pending conversations
5. Pause bot responses until resolved

### 6.2 Conversation Logging
**Leveraging `chatbot_conversations` table**:
```javascript
// Log every interaction
await supabase
  .from('chatbot_conversations')
  .insert({
    tenant_id: userSession.user_id,
    session_id: sessionId,
    messages: {
      user: userMessage,
      bot: botResponse,
      timestamp: new Date().toISOString()
    }
  });
```

### 6.3 Multi-language Support
**Implementation**:
- Store language preference in `user_profiles.preferences` JSONB
- Implement i18n for all bot responses
- Quick reply for language selection on first use

## Security Considerations

### Authentication & Authorization
1. **Never expose Supabase service key** - Use in server only
2. **Validate invite codes** strictly through RPC function
3. **Session validation** - Verify user_id matches Facebook ID
4. **Rate limiting** - Prevent spam/abuse

### Data Protection
1. **PII handling** - Never log sensitive data
2. **Media uploads** - Validate file types and sizes
3. **RLS policies** - Rely on existing database security

## Deployment Strategy

### Environment Variables
```env
# Supabase
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_KEY=your-service-key

# Facebook
FB_PAGE_ACCESS_TOKEN=your-page-token
FB_APP_SECRET=your-app-secret
FB_VERIFY_TOKEN=your-verify-token

# Server
PORT=3000
NODE_ENV=production
```

### Hosting Options
1. **Vercel** - Serverless functions
2. **Railway** - Container deployment
3. **Heroku** - Traditional Node.js app

### Monitoring & Logging
- Implement error tracking (Sentry)
- Log all database operations
- Monitor webhook response times
- Track user engagement metrics

## Testing Strategy

### Unit Testing
- Database operations
- Message parsing
- Session management

### Integration Testing
- Facebook webhook handling
- Supabase RPC calls
- Real-time subscriptions

### User Acceptance Testing
- Test with real tenants
- Multiple building scenarios
- Edge cases (expired invites, double bookings)

## Timeline Summary

| Week | Focus Area | Deliverables |
|------|-----------|--------------|
| 1 | Core Setup | Authentication, Session Management |
| 1-2 | FAQ System | Dynamic menus, FAQ delivery |
| 2-3 | Maintenance | Request creation, Status updates |
| 3-4 | Bookings | Amenity booking, Conflict checking |
| 4 | Notifications | Announcements, Real-time alerts |
| 5-6 | Advanced | Human handoff, Analytics |

## Success Metrics

### Technical KPIs
- Response time < 2 seconds
- 99.9% uptime
- Zero data breaches

### User Experience KPIs
- 80% task completion rate
- < 3 clicks to complete any task
- 90% user satisfaction score

### Business KPIs
- 50% reduction in phone calls
- 70% of requests handled automatically
- 24/7 availability achieved

## Next Steps

1. **Set up development environment**
2. **Create Facebook App and configure Messenger**
3. **Initialize Node.js project with TypeScript**
4. **Implement Phase 1 authentication flow**
5. **Deploy MVP for testing with single building**

## Notes on Database Alignment

The chatbot leverages the existing database schema without modifications:
- Uses `invites` table for onboarding
- Integrates with `maintenance_requests` workflow
- Respects RLS policies for data access
- Utilizes existing helper functions (`claim_invite`, `check_booking_conflict`)
- Logs conversations in `chatbot_conversations`

This ensures perfect synchronization between the admin dashboard and chatbot, with both systems working from the same data source.
