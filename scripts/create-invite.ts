#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Try to use service role key for admin operations, fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateInviteCode(): Promise<string> {
  // Generate a random 8-character alphanumeric code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

async function createInvite() {
  try {
    console.log('🔍 Looking for existing data...');
    
    // The tenant ID you provided - we'll use this as the creator_id
    const creatorId = '0bb3a1a6-5f90-4d0f-ac2f-931537245261';
    
    // Note: The user profile with this ID needs to exist in the database
    // It should have been created when you signed up through Supabase Auth
    console.log(`📝 Using creator ID: ${creatorId}`);
    console.log('   (This should be your Supabase Auth user ID)')
    
    // Check for existing pending invites for this email
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
    
    // Get a sample building and unit (using the seed data)
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('*')
      .limit(1);
    
    if (buildingError || !buildings || buildings.length === 0) {
      console.error('❌ No buildings found. Please run the seed data first.');
      return;
    }
    
    const building = buildings[0];
    console.log(`📍 Using building: ${building.name}`);
    
    // Get a vacant unit from this building
    const { data: units } = await supabase
      .from('units')
      .select('*')
      .eq('building_id', building.id)
      .eq('is_occupied', false)
      .limit(1);
    
    let unit;
    if (!units || units.length === 0) {
      // If no vacant units, just use any unit
      const { data: anyUnits } = await supabase
        .from('units')
        .select('*')
        .eq('building_id', building.id)
        .limit(1);
      
      if (!anyUnits || anyUnits.length === 0) {
        console.error('❌ No units found in the building.');
        return;
      }
      unit = anyUnits[0];
      console.log(`📍 Using unit: ${unit.unit_number} (currently occupied, but will assign anyway)`);
    } else {
      unit = units[0];
      console.log(`📍 Using vacant unit: ${unit.unit_number}`);
    }
    
    // Generate a unique invite code
    let inviteCode = await generateInviteCode();
    
    // Check if code already exists
    let codeExists = true;
    let attempts = 0;
    while (codeExists && attempts < 10) {
      const { data: existingCode } = await supabase
        .from('invites')
        .select('id')
        .eq('login_code', inviteCode)
        .single();
      
      if (!existingCode) {
        codeExists = false;
      } else {
        inviteCode = await generateInviteCode();
        attempts++;
      }
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
        created_by: creatorId, // Using the tenant ID as creator for now
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      })
      .select()
      .single();
    
    if (inviteError) {
      console.error('❌ Error creating invite:', inviteError);
      return;
    }
    
    console.log('\\n✅ Invite created successfully!');
    console.log('==========================================');
    console.log(`📧 Email: ${invite.email}`);
    console.log(`👤 Name: ${invite.full_name}`);
    console.log(`🏢 Building: ${building.name}`);
    console.log(`🏠 Unit: ${unit.unit_number}`);
    console.log(`🔑 ACCESS CODE: ${invite.login_code}`);
    console.log(`⏰ Expires: ${new Date(invite.expires_at).toLocaleString()}`);
    console.log('==========================================');
    console.log('\\n📱 Use this code in the Facebook Messenger chatbot to authenticate!');
    
    // Also create some alternative test codes for easy testing
    const testCodes = ['DEMO2024', 'TEST123', 'WELCOME1'];
    
    console.log('\\n📝 Creating additional test codes...');
    for (const code of testCodes) {
      // Check if this test code already exists
      const { data: existing } = await supabase
        .from('invites')
        .select('id')
        .eq('login_code', code)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('invites')
          .insert({
            building_id: building.id,
            unit_id: unit.id,
            full_name: `Test User (${code})`,
            email: `test-${code.toLowerCase()}@example.com`,
            login_code: code,
            status: 'pending',
            created_by: creatorId,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
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

// Run the script
createInvite();
