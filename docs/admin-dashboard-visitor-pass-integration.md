# Admin Dashboard - Visitor Pass Integration Guide

## Overview
The chatbot now supports visitor pass management. Tenants can create time-limited access passes for their visitors through the chatbot, and admins receive notifications about these passes through the dashboard.

## Database Changes

A new table `visitor_passes` has been added to the Supabase database. Since both the chatbot and admin dashboard share the same Supabase instance, you can directly query this table.

### Table Structure: `visitor_passes`

```typescript
interface VisitorPass {
  id: string;                    // UUID
  pass_code: string;             // Unique code (format: VPXXXXXX)
  visitor_name: string;          // Visitor's full name
  visitor_phone?: string;        // Optional phone number
  visitor_type: 'guest' | 'delivery' | 'contractor' | 'service' | 'other';
  purpose?: string;              // Purpose of visit
  
  // Tenant & Location
  created_by_tenant_id: string;  // Profile ID of tenant who created
  unit_id: string;               // Unit being visited
  building_id: string;           // Building ID
  
  // Validity
  valid_from: string;            // ISO timestamp
  valid_until: string;           // ISO timestamp
  single_use: boolean;           // If true, expires after one use
  
  // Usage
  status: 'active' | 'used' | 'expired' | 'cancelled' | 'revoked';
  used_at?: string;              // When first used
  used_count: number;            // Number of times used
  
  // Admin tracking
  admin_notified_at: string;     // When admin was notified (defaults to creation time)
  admin_reviewed_at?: string;    // When admin reviewed
  admin_reviewed_by?: string;    // Admin profile ID who reviewed
  admin_notes?: string;          // Admin notes
  revoked_at?: string;           // If revoked by admin
  revoked_by?: string;           // Admin who revoked
  revoke_reason?: string;        // Reason for revocation
  
  // Timestamps
  created_at: string;
  updated_at: string;
}
```

## Required Features for Admin Dashboard

### 1. Real-time Notifications

Subscribe to new visitor passes in real-time:

```typescript
// Subscribe to new visitor passes for your building
const channel = supabase
  .channel('visitor-passes-admin')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'visitor_passes',
      filter: `building_id=eq.${buildingId}`
    }, 
    (payload) => {
      const newPass = payload.new as VisitorPass;
      // Show notification to admin
      showNotification({
        title: 'New Visitor Pass Created',
        message: `${newPass.visitor_name} visiting Unit ${getUnitNumber(newPass.unit_id)}`,
        type: 'info',
        action: () => navigateToVisitorPass(newPass.id)
      });
    }
  )
  .subscribe();
```

### 2. Visitor Pass List/Table View

Create a dedicated section for visitor passes with filters:

```typescript
// Fetch visitor passes with tenant and unit information
const { data: passes } = await supabase
  .from('visitor_passes')
  .select(`
    *,
    tenant:profiles!created_by_tenant_id(full_name, phone),
    unit:units!unit_id(unit_number)
  `)
  .eq('building_id', buildingId)
  .order('created_at', { ascending: false });
```

#### Recommended Filters:
- **Status**: Active, Used, Expired, Cancelled, Revoked
- **Date Range**: Today, This Week, This Month, Custom
- **Visitor Type**: Guest, Delivery, Contractor, Service, Other
- **Unit**: Dropdown of all units
- **Search**: By visitor name or pass code

#### Table Columns:
1. Pass Code
2. Visitor Name
3. Type
4. Unit
5. Created By (Tenant)
6. Valid Period (From - Until)
7. Status
8. Used Count
9. Actions (View, Revoke, Add Notes)

### 3. Dashboard Widget

Add a widget to the main dashboard showing:

```typescript
// Today's visitor statistics
const today = new Date().toISOString().split('T')[0];

const { data: todayStats } = await supabase
  .from('visitor_passes')
  .select('status, visitor_type')
  .eq('building_id', buildingId)
  .gte('created_at', today + 'T00:00:00')
  .lte('created_at', today + 'T23:59:59');

// Currently active passes
const { data: activeNow } = await supabase
  .from('visitor_passes')
  .select('*')
  .eq('building_id', buildingId)
  .eq('status', 'active')
  .lte('valid_from', new Date().toISOString())
  .gte('valid_until', new Date().toISOString());
```

Display:
- Total passes created today
- Currently on-site visitors (active passes within valid time)
- Breakdown by type (pie chart)
- Recent visitor activity (last 5 entries)

### 4. Visitor Pass Detail View

When clicking on a visitor pass:

```typescript
// Get full details of a visitor pass
const { data: pass } = await supabase
  .from('visitor_passes')
  .select(`
    *,
    tenant:profiles!created_by_tenant_id(
      full_name, 
      phone, 
      email,
      unit:units!unit_id(unit_number)
    ),
    unit:units!unit_id(unit_number, floor),
    building:buildings!building_id(name)
  `)
  .eq('id', passId)
  .single();
```

Show:
- All visitor details
- Tenant who created the pass
- Timeline of pass usage
- Admin actions (review, add notes, revoke)

### 5. Admin Actions

#### Mark as Reviewed:
```typescript
const { error } = await supabase
  .from('visitor_passes')
  .update({ 
    admin_reviewed_at: new Date().toISOString(),
    admin_reviewed_by: adminProfileId
  })
  .eq('id', passId);
```

#### Add Admin Notes:
```typescript
const { error } = await supabase
  .from('visitor_passes')
  .update({ 
    admin_notes: notes,
    admin_reviewed_at: new Date().toISOString(),
    admin_reviewed_by: adminProfileId
  })
  .eq('id', passId);
```

#### Revoke a Pass:
```typescript
const { error } = await supabase
  .from('visitor_passes')
  .update({ 
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    revoked_by: adminProfileId,
    revoke_reason: reason
  })
  .eq('id', passId);

// Optionally notify the tenant
notifyTenant(pass.created_by_tenant_id, `Your visitor pass for ${pass.visitor_name} has been revoked.`);
```

### 6. Reports & Analytics

Create a visitor analytics page showing:

```typescript
// Monthly visitor statistics
const { data: monthlyStats } = await supabase
  .rpc('get_visitor_statistics', {
    p_building_id: buildingId,
    p_start_date: startOfMonth,
    p_end_date: endOfMonth
  });
```

Charts to include:
- Visitors per day (line chart)
- Visitor types distribution (pie chart)
- Peak visitor hours (bar chart)
- Most active units (table)
- Average visit duration by type

## UI/UX Recommendations

### 1. Navigation
Add "Visitor Management" to the main navigation menu, with sub-items:
- Active Passes
- All Passes
- Analytics
- Settings

### 2. Status Indicators
Use color coding for pass status:
- 🟢 Green: Active
- 🔵 Blue: Used
- 🟡 Yellow: Expiring soon (within 1 hour)
- ⚫ Gray: Expired
- 🔴 Red: Revoked

### 3. Quick Actions
From the list view, admins should be able to:
- Quick revoke with confirmation modal
- View tenant contact info
- Copy pass code
- Export to CSV

### 4. Mobile Responsiveness
Ensure the visitor pass section works on mobile devices for admins checking on-the-go.

## Integration Timeline

### Phase 1 (MVP for Hackathon)
1. Basic list view with filters
2. Real-time notifications for new passes
3. Ability to revoke passes
4. Simple dashboard widget

### Phase 2 (Post-Hackathon)
1. Detailed analytics
2. Bulk actions
3. Email/SMS notifications to admins
4. Visitor check-in/out logs
5. Integration with access control systems

## Testing

### Test Scenarios
1. Create a visitor pass via chatbot, verify it appears in dashboard
2. Revoke a pass in dashboard, verify visitor cannot use it
3. Check real-time updates work across multiple admin sessions
4. Verify filtering and search functionality
5. Test permission controls (admins can only see their building's passes)

### Sample Test Data
You can create test visitor passes directly in Supabase:

```sql
INSERT INTO visitor_passes (
  pass_code, visitor_name, visitor_type, purpose,
  created_by_tenant_id, unit_id, building_id,
  valid_from, valid_until
) VALUES (
  'VP' || substr(md5(random()::text), 1, 6),
  'Test Visitor',
  'guest',
  'Testing dashboard integration',
  (SELECT id FROM profiles WHERE role = 'tenant' LIMIT 1),
  (SELECT id FROM units LIMIT 1),
  'YOUR_BUILDING_ID',
  NOW(),
  NOW() + INTERVAL '4 hours'
);
```

## Security Considerations

1. **RLS Policies**: The table has Row Level Security enabled. Admins can only see passes for their building.
2. **Audit Trail**: All admin actions are logged with timestamps and admin IDs.
3. **No Direct Deletion**: Passes are never deleted, only marked as revoked/cancelled.
4. **Time Validation**: Passes automatically expire based on `valid_until` timestamp.

## Support & Questions

For questions about the visitor pass system:
1. Check the migration file: `/supabase/migrations/004_visitor_passes.sql`
2. Review the chatbot handler: `/src/handlers/visitor-pass.handler.ts`
3. Test the flow in the chatbot first to understand the user experience

## Next Steps

1. Run the migration on your Supabase instance (if not already done)
2. Update your TypeScript types to include the visitor_passes table
3. Implement the basic list view and notifications
4. Test the integration with the chatbot
5. Add analytics and reporting features
