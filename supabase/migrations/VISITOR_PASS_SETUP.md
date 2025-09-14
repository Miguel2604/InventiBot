# Visitor Pass Migration Setup

## Running the Migration

To add the visitor pass functionality to your Supabase database, follow these steps:

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `004_visitor_passes.sql`
4. Paste and run the SQL

### Option 2: Via Supabase CLI
```bash
# First, link your project if not already linked
npx supabase link --project-ref YOUR_PROJECT_REF

# Then push the migration
npx supabase db push
```

## After Running the Migration

### 1. Generate TypeScript Types
Run this command to update your TypeScript types:
```bash
npm run generate:types
```

If you don't have this script, add it to your package.json:
```json
"scripts": {
  "generate:types": "npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts"
}
```

### 2. Test the Migration
You can test if the migration worked by running this query in Supabase SQL Editor:
```sql
-- Check if table exists
SELECT * FROM visitor_passes LIMIT 1;

-- Test the pass code generation
SELECT generate_visitor_pass_code();

-- Check the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'visitor_passes';
```

## What This Migration Adds

### New Table: `visitor_passes`
- Stores visitor access passes created by tenants
- Includes visitor details, validity period, and usage tracking
- Automatically expires old passes
- Tracks admin review and revocation

### Key Features:
- **Unique pass codes**: Format `VPXXXXXX` (e.g., VP3A2B1C)
- **Time-based validity**: Passes have start and end times
- **Single-use option**: Passes can be marked for one-time use
- **Auto-expiration**: Status automatically updates when passes expire
- **Admin oversight**: Tracks when admins review or revoke passes

### Security:
- Row Level Security (RLS) enabled
- Tenants can only see/manage their own passes
- Admins can see all passes in their building
- Service role (bot) has full access for validation

## For the Admin Dashboard Team

The admin dashboard can now:

1. **Query visitor passes**:
```typescript
const { data: passes } = await supabase
  .from('visitor_passes')
  .select('*')
  .eq('building_id', buildingId)
  .order('created_at', { ascending: false });
```

2. **Get real-time updates**:
```typescript
// Subscribe to new visitor passes
const subscription = supabase
  .channel('visitor-passes')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'visitor_passes',
      filter: `building_id=eq.${buildingId}`
    }, 
    (payload) => {
      console.log('New visitor pass created:', payload.new);
      // Show notification to admin
    }
  )
  .subscribe();
```

3. **Revoke a pass**:
```typescript
const { error } = await supabase
  .from('visitor_passes')
  .update({ 
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    revoked_by: adminProfileId,
    revoke_reason: 'Security concern'
  })
  .eq('id', passId);
```

4. **Get statistics**:
```typescript
// Today's visitor passes
const today = new Date().toISOString().split('T')[0];
const { data: todaysPasses } = await supabase
  .from('visitor_passes')
  .select('*')
  .eq('building_id', buildingId)
  .gte('created_at', today);

// Active passes right now
const { data: activePasses } = await supabase
  .from('visitor_passes')
  .select('*')
  .eq('building_id', buildingId)
  .eq('status', 'active')
  .gte('valid_until', new Date().toISOString())
  .lte('valid_from', new Date().toISOString());
```

## Next Steps

After the migration is complete, the chatbot will be updated to:
1. Allow tenants to create visitor passes
2. Allow visitors to validate their passes
3. Track pass usage

The admin dashboard should be updated to:
1. Show visitor pass notifications
2. Display visitor pass list/table
3. Allow admins to revoke passes if needed
4. Show visitor analytics
