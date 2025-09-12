const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('✅ Using service role key for admin operations');
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateInviteCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

async function createInviteWithProfile() {
  try {
    const tenantId = '0bb3a1a6-5f90-4d0f-ac2f-931537245261';
    const email = 'user@user.com';
    
    console.log('🔍 Checking database access...');
    
    // First, check if we can access buildings
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('*')
      .limit(1);
    
    if (buildingError) {
      console.error('❌ Error accessing buildings:', buildingError);
      return;
    }
    
    if (!buildings || buildings.length === 0) {
      console.error('❌ No buildings found. Seed data may not be loaded.');
      return;
    }
    
    console.log(`✅ Found building: ${buildings[0].name}`);
    
    // Get a vacant unit
    const { data: units } = await supabase
      .from('units')
      .select('*')
      .eq('building_id', buildings[0].id)
      .eq('is_occupied', false)
      .limit(1);
    
    let unit = units?.[0];
    if (!unit) {
      // Use any unit if no vacant ones
      const { data: anyUnits } = await supabase
        .from('units')
        .select('*')
        .eq('building_id', buildings[0].id)
        .limit(1);
      unit = anyUnits?.[0];
    }
    
    if (!unit) {
      console.error('❌ No units found');
      return;
    }
    
    console.log(`✅ Using unit: ${unit.unit_number}`);
    
    // Check if user profile exists
    console.log('🔍 Checking for existing user profile...');
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', tenantId)
      .single();
    
    if (!existingProfile) {
      console.log('📝 Creating user profile...');
      // Create the user profile first
      const { data: newProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: tenantId,
          email: email,
          full_name: 'Test User',
          role: 'tenant',
          building_id: buildings[0].id,
          unit_id: unit.id,
          is_active: true
        })
        .select()
        .single();
      
      if (profileError) {
        console.error('❌ Error creating user profile:', profileError);
        return;
      }
      console.log('✅ User profile created successfully');
    } else {
      console.log('✅ User profile already exists');
    }
    
    // Check for existing invites
    const { data: existingInvites } = await supabase
      .from('invites')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending');
    
    if (existingInvites && existingInvites.length > 0) {
      console.log('📋 Found existing invite(s):');
      existingInvites.forEach(invite => {
        console.log(`  - Code: ${invite.login_code}`);
        console.log(`    Status: ${invite.status}`);
        console.log(`    Expires: ${new Date(invite.expires_at).toLocaleString()}`);
      });
      return;
    }
    
    // Generate invite code
    let inviteCode = await generateInviteCode();
    
    // Check for collisions
    let attempts = 0;
    while (attempts < 10) {
      const { data: existingCode } = await supabase
        .from('invites')
        .select('id')
        .eq('login_code', inviteCode)
        .single();
      
      if (!existingCode) break;
      inviteCode = await generateInviteCode();
      attempts++;
    }
    
    console.log(`🔑 Generated invite code: ${inviteCode}`);
    
    // Create the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        building_id: buildings[0].id,
        unit_id: unit.id,
        full_name: 'Test User',
        email: email,
        login_code: inviteCode,
        status: 'pending',
        created_by: tenantId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();
    
    if (inviteError) {
      console.error('❌ Error creating invite:', inviteError);
      return;
    }
    
    console.log('\n✅ SUCCESS! Invite created successfully!');
    console.log('==========================================');
    console.log(`📧 Email: ${invite.email}`);
    console.log(`👤 Name: ${invite.full_name}`);
    console.log(`🏢 Building: ${buildings[0].name}`);
    console.log(`🏠 Unit: ${unit.unit_number}`);
    console.log(`🔑 ACCESS CODE: ${invite.login_code}`);
    console.log(`⏰ Expires: ${new Date(invite.expires_at).toLocaleString()}`);
    console.log('==========================================');
    console.log('\n📱 Use this code in the Facebook Messenger chatbot to authenticate!');
    
    // Create some test codes too
    console.log('\n📝 Creating additional test codes...');
    const testCodes = ['DEMO2024', 'TEST123'];
    
    for (const code of testCodes) {
      const { data: existing } = await supabase
        .from('invites')
        .select('id')
        .eq('login_code', code)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('invites')
          .insert({
            building_id: buildings[0].id,
            unit_id: unit.id,
            full_name: `Test User (${code})`,
            email: `test-${code.toLowerCase()}@example.com`,
            login_code: code,
            status: 'pending',
            created_by: tenantId,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
        
        if (!error) {
          console.log(`  ✅ Created test code: ${code}`);
        }
      } else {
        console.log(`  ⏭️ Test code already exists: ${code}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createInviteWithProfile();
