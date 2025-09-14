# Visitor Management System - Design Document

## Initial Proposal

### User's Original Idea
The chatbot will differentiate between tenants and visitors in the initial flow:
1. Bot asks if user is a tenant or visitor (invited by tenant)
2. Visitors enter a unique code requested by the tenant from admin
3. Tenant fills visitor details in the chatbot
4. Admin verifies/accepts in the admin dashboard
5. Three user types: visitors, tenants, and admin

## Current System Analysis

### Existing Database Structure
- No current visitor management functionality in the database schema
- System has tables for: buildings, units, profiles, maintenance_requests, bookings, invites (for tenant onboarding)
- Authentication currently uses invite codes for tenant onboarding only

## Design Discussion & Refinements

### Strengths of the Proposed Approach
1. **Security-first**: Tenants request visitor codes, maintaining control
2. **Accountability**: Tenants are responsible for their guests
3. **Admin oversight**: Admin verification adds security layer
4. **Clear user distinction**: Separating visitors from tenants makes sense

### Visitor Types to Consider
- **One-time visitors**: Delivery, maintenance from outside vendors
- **Recurring visitors**: Cleaners, caregivers
- **Extended stay visitors**: Family staying multiple days
- **Event visitors**: Multiple guests for a party

### Enhanced Flow Proposals

#### For Tenants Creating Visitor Passes:
1. Tenant initiates visitor request in bot
2. Bot asks for visitor details (name, phone, visit date/time)
3. Bot generates unique code immediately OR sends to admin for approval (based on building settings)
4. Tenant shares code with visitor

#### For Visitors Arriving:
1. Bot asks: "Are you a resident or visitor?"
2. If visitor → "Please enter your visitor code"
3. Bot validates code and checks if within valid time window
4. Bot logs check-in time
5. Optional: Bot notifies tenant of visitor arrival

### Security Considerations
- **Time-bound codes**: Codes only work during specified visit windows
- **One-time vs multi-use**: Some codes for single-entry, others for multiple
- **QR codes**: Consider QR codes for easier entry
- **Automatic expiration**: Codes expire after visit window ends

## Hackathon MVP Implementation (1 Week Timeline)

### Simplest Viable Solution: "Instant Visitor Pass"
**No pre-registration, no admin approval initially, just real-time visitor validation**

### The Simplified Flow

#### For Visitors:
1. Visitor messages bot: "Hi"
2. Bot: "Welcome! Are you a resident or visitor?"
3. Visitor: Selects "Visitor"
4. Bot: "Who are you visiting? Please enter the unit number:"
5. Visitor: "101"
6. Bot: "What's your name?"
7. Visitor: "John Smith"
8. Bot sends notification to tenant: "John Smith is at the entrance. Allow access?"
9. Tenant clicks: "✅ Yes" or "❌ No"
10. If approved → Bot: "Access granted! The resident has been notified."
11. If denied → Bot: "Sorry, access was not granted."

### Minimal Database Changes

```sql
CREATE TABLE visitor_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    visitor_name VARCHAR(255) NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(id),
    tenant_id UUID REFERENCES profiles(id),  -- who approved
    status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, denied
    check_in_time TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Why This Works for a Hackathon
1. **Immediately Demonstrable**: Judges see it work in real-time
2. **Solves Real Problem**: Security without complexity
3. **Uses Existing Infrastructure**: Leverages current bot/database
4. **No Additional Services**: No QR codes, no external APIs
5. **Clear Value Prop**: "Instant visitor verification via chat"
6. **Minimal Code**: ~200 lines of new code max
7. **Easy to Test**: Just need two phones/accounts

## Technical Considerations

### Facebook Messenger Notification Limitations

#### CAN Message If:
1. **Tenant messaged bot within last 24 hours** (24-hour messaging window)
2. **Tenant is subscribed to recurring notifications** (requires opt-in)
3. **Using Message Tags** (limited use cases like CONFIRMED_EVENT_UPDATE)

#### CANNOT Message If:
- Tenant hasn't interacted with bot in 24+ hours AND hasn't opted in
- This is Facebook's anti-spam policy

### Notification Implementation Strategy

```typescript
async notifyTenant(tenantMessengerId: string, visitorName: string, visitorId: string) {
    try {
        // This works if tenant messaged bot in last 24 hours
        await facebookService.sendMessage(tenantMessengerId, {
            text: `🔔 Visitor Alert!\n${visitorName} is at the entrance.`,
            quick_replies: [
                { content_type: 'text', title: '✅ Allow Entry', payload: `APPROVE_VISITOR_${visitorId}` },
                { content_type: 'text', title: '❌ Deny Entry', payload: `DENY_VISITOR_${visitorId}` }
            ]
        });
        return true;
    } catch (error) {
        // Outside 24-hour window
        console.log('Could not notify tenant - outside messaging window');
        return false;
    }
}
```

### Demo Day Strategy
1. **Pre-Demo Setup** (5 minutes before):
   - Have tenant account message the bot
   - This opens the 24-hour window
2. **During Demo**: Visitor flow works seamlessly
3. **Backup Plan**: If notification fails, show "pending visitor" when tenant opens bot

## Security Enhancements

### Configurable Security Levels

```typescript
building_settings: {
  visitor_policy: 'NOTIFY_ADMIN' | 'REQUIRE_ADMIN' | 'TENANT_ONLY'
}
```

### Option 1: "NOTIFY_ADMIN" (Recommended)
- Tenant approves, admin is notified
- Balance of convenience and security
- Good audit trail

### Option 2: "REQUIRE_ADMIN" (High Security)
- Admin must approve all visitors
- Slower but more secure

### Option 3: "TENANT_ONLY" with Restrictions
- Tenant can approve with limits
- Time restrictions, visitor count limits

### Smart Security Based on Context

```typescript
async determineApprovalRequired(visitorType: string, tenantId: string) {
    // Delivery/Food: Tenant only (low risk, short duration)
    if (visitorType === 'delivery') {
        return { requiresAdmin: false, maxDuration: 0.5 }; // 30 mins
    }
    
    // Personal guest: Tenant approves, admin notified
    if (visitorType === 'guest') {
        return { requiresAdmin: false, notifyAdmin: true, maxDuration: 4 };
    }
    
    // Contractor/Maintenance: Requires admin
    if (visitorType === 'contractor') {
        return { requiresAdmin: true };
    }
    
    // Check for suspicious patterns
    const recentVisitors = await this.getRecentVisitorCount(tenantId, 7);
    if (recentVisitors > 10) {
        return { requiresAdmin: true, reason: 'Unusual visitor frequency' };
    }
    
    return { requiresAdmin: false, notifyAdmin: true };
}
```

### Enhanced Database Schema

```sql
-- Enhanced visitor_logs table
CREATE TABLE visitor_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_type VARCHAR(50) DEFAULT 'guest', -- guest, delivery, contractor
    unit_id UUID NOT NULL REFERENCES units(id),
    tenant_id UUID REFERENCES profiles(id),
    status VARCHAR(50) DEFAULT 'pending',
    admin_notified BOOLEAN DEFAULT FALSE,
    admin_approved BOOLEAN,
    expires_at TIMESTAMPTZ,
    check_in_time TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Timeline

### Day 1-2: Core Infrastructure
- Add visitor_logs table to database
- Create visitor.handler.ts
- Update auth flow to include visitor option

### Day 3-4: Notification System
- Implement tenant notification via Messenger
- Add approval/denial flow
- Handle edge cases (outside 24-hour window)

### Day 5: Security & Polish
- Add visitor types (delivery, guest, contractor)
- Implement admin notifications
- Add basic validation

### Day 6-7: Demo Preparation
- Test complete flow
- Prepare demo accounts
- Add one bonus feature if time permits:
  - Visitor history in admin dashboard
  - Auto-expiring visitor passes
  - Suspicious pattern detection

## Demo Pitch

*"Most property management systems require complex visitor pre-registration. We've reimagined visitor management for the messaging age - instant, secure, and simple. A visitor arrives, messages the bot, and the tenant approves in real-time. No apps to download, no codes to remember, just natural conversation."*

### Demo Scenarios

1. **Delivery Person** (Quick approval)
   - Shows convenience for low-risk visitors
   - Tenant quickly approves via bot

2. **Friend Visiting** (Tenant approves, admin notified)
   - Shows balance of convenience and security
   - Admin dashboard shows visitor log

3. **Contractor** (Requires admin approval)
   - Shows security for high-risk visitors
   - Demonstrates flexible security policies

## Key Technical Decisions

### Why No Pre-Registration for MVP
- Simpler to implement in one week
- Better demo experience (real-time is impressive)
- Reduces database complexity
- Still solves the core problem

### Why Facebook Messenger Notifications Work
- Most tenants interact with bot regularly (within 24-hour window)
- Fallback mechanism for edge cases
- Can prep demo to ensure success

### Why Configurable Security Levels
- Shows maturity of thinking
- Appeals to different building types
- Demonstrates scalability
- Addresses judge concerns about security

## Code Implementation Examples

### Update Initial Authentication Flow

```typescript
// In auth.handler.ts
if (!session) {
    await facebookService.sendMessage(senderId, {
        text: "Welcome! Please select:",
        quick_replies: [
            { content_type: 'text', title: '🏠 I\'m a Resident', payload: 'RESIDENT_LOGIN' },
            { content_type: 'text', title: '👋 I\'m a Visitor', payload: 'VISITOR_ENTRY' }
        ]
    });
}
```

### Basic Visitor Handler Structure

```typescript
// visitor.handler.ts
export class VisitorHandler {
    async handleVisitorEntry(senderId: string, message: any) {
        // Get visitor type
        const visitorType = await this.getVisitorType(senderId);
        
        // Get unit number
        const unitNumber = await this.getUnitNumber(senderId);
        
        // Get visitor name
        const visitorName = await this.getVisitorName(senderId);
        
        // Find tenant in unit
        const tenant = await this.findTenantByUnit(unitNumber);
        
        // Determine approval requirements
        const approval = await this.determineApprovalRequired(visitorType, tenant.id);
        
        // Send approval request
        if (approval.requiresAdmin) {
            await this.notifyAdmin(visitorDetails);
        } else {
            await this.notifyTenant(tenant.messenger_id, visitorName, visitorId);
        }
        
        // Log the visit
        await this.logVisitorRequest(visitorDetails);
    }
}
```

### Admin Dashboard View

```
Today's Visitors:
┌────────────┬──────────┬────────┬──────────┬────────────┬────────┐
│ Time       │ Visitor  │ Type   │ Unit     │ Status     │ Action │
├────────────┼──────────┼────────┼──────────┼────────────┼────────┤
│ 10:30 AM   │ J. Smith │ Guest  │ 101      │ ✅ Approved │ [Log]  │
│ 11:15 AM   │ Amazon   │ Delivery│ 205     │ ✅ Approved │ [Log]  │
│ 02:00 PM   │ HVAC Co. │ Contract│ 301     │ ⏳ Pending  │ [✓][✗] │
└────────────┴──────────┴────────┴──────────┴────────────┴────────┘

⚠️ Alert: Unit 101 has had 5 visitors today [View Details]
```

## Security Considerations Summary

### Risks Without Admin Involvement
1. Unauthorized access (ex-partners, unwanted guests)
2. Subletting/AirBnB abuse
3. Security bypassing through tenant pressure
4. No audit trail for management
5. Liability issues
6. Emergency evacuation concerns

### Mitigation Strategies
1. Admin notification for all visitors
2. Visitor type classification
3. Time limits on visitor passes
4. Suspicious pattern detection
5. Complete audit logging
6. Building-configurable policies

## Conclusion

The visitor management system is a valuable addition that:
- Solves a real problem (unexpected/unverified visitors)
- Is achievable in one week
- Demonstrates technical skills (bot, database, real-time notifications)
- Shows product thinking (security vs convenience balance)
- Has clear demo value (real-time approval is impressive)

The key is to start simple (instant visitor validation) and add security layers as time permits. The Facebook Messenger 24-hour window limitation can be worked around with proper demo preparation and fallback mechanisms.
