const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateInviteCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

async function checkAndCreateInvite() {
  try {
    console.log('🔍 Checking buildings...');
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('*')
      .limit(1);
    
    if (buildingError) {
      console.error('❌ Error fetching buildings:', buildingError);
      return;
    }
    
    if (!buildings || buildings.length === 0) {
      console.error('❌ No buildings found. Please run the seed data first.');
      return;
    }
    
    const building = buildings[0];
    console.log(`✅ Found building: ${building.name}`);
    
    // Check for vacant units
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .eq('building_id', building.id)
      .eq('is_occupied', false)
      .limit(1);
    
    if (unitsError) {
      console.error('❌ Error fetching units:', unitsError);
      return;
    }
    
    let unit;
    if (!units || units.length === 0) {
      // Use any unit if no vacant ones
      const { data: anyUnits } = await supabase
        .from('units')
        .select('*')
        .eq('building_id', building.id)
        .limit(1);
      unit = anyUnits[0];
      console.log(`📍 Using unit: ${unit.unit_number} (occupied)`);
    } else {
      unit = units[0];
      console.log(`📍 Using vacant unit: ${unit.unit_number}`);
    }
    
    // Check for existing invites
    const { data: existingInvites } = await supabase
      .from('invites')
      .select('*')
      .eq('email', 'user@user.com')
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
    
    // Check if code exists
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
        building_id: building.id,
        unit_id: unit.id,
        full_name: 'Test User',
        email: 'user@user.com',
        login_code: inviteCode,
        status: 'pending',
        created_by: '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();
    
    if (inviteError) {
      console.error('❌ Error creating invite:', inviteError);
      return;
    }
    
    console.log('\n✅ Invite created successfully!');
    console.log('==========================================');
    console.log(`📧 Email: ${invite.email}`);
    console.log(`👤 Name: ${invite.full_name}`);
    console.log(`🏢 Building: ${building.name}`);
    console.log(`🏠 Unit: ${unit.unit_number}`);
    console.log(`🔑 ACCESS CODE: ${invite.login_code}`);
    console.log(`⏰ Expires: ${new Date(invite.expires_at).toLocaleString()}`);
    console.log('==========================================');
    console.log('\n📱 Use this code in the Facebook Messenger chatbot to authenticate!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndCreateInvite();
