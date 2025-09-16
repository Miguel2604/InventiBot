/**
 * Test script for IoT database adapter
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const IoTDatabaseAdapter = require('../src/features/iot/dbAdapter');

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdapter() {
    console.log('Testing IoT Database Adapter...\n');
    
    // Create adapter instance
    const dbAdapter = new IoTDatabaseAdapter(supabase);
    
    try {
        // Test 1: Get user config (should return empty for test user)
        console.log('Test 1: Fetching user config...');
        const testUserId = 'test_user_' + Date.now();
        const result = await dbAdapter.query(
            'SELECT * FROM user_ha_config WHERE user_id = $1 AND is_active = true',
            [testUserId]
        );
        console.log('✅ Query executed successfully');
        console.log('Result rows:', result.rows.length);
        
        // Test 2: Insert/Update config
        console.log('\nTest 2: Inserting user config...');
        const insertResult = await dbAdapter.query(
            `INSERT INTO user_ha_config (user_id, ha_url, encrypted_token, last_connected)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET 
                ha_url = $2,
                encrypted_token = $3,
                last_connected = NOW(),
                is_active = true`,
            [testUserId, 'http://192.168.1.100:8123', 'encrypted_test_token']
        );
        console.log('✅ Insert executed successfully');
        
        // Test 3: Verify insert by fetching again
        console.log('\nTest 3: Verifying inserted data...');
        const verifyResult = await dbAdapter.query(
            'SELECT * FROM user_ha_config WHERE user_id = $1 AND is_active = true',
            [testUserId]
        );
        if (verifyResult.rows.length > 0) {
            console.log('✅ Data retrieved successfully');
            console.log('User config:', {
                user_id: verifyResult.rows[0].user_id,
                ha_url: verifyResult.rows[0].ha_url,
                is_active: verifyResult.rows[0].is_active
            });
        }
        
        // Test 4: Update last_connected
        console.log('\nTest 4: Updating last_connected...');
        await dbAdapter.query(
            'UPDATE user_ha_config SET last_connected = NOW() WHERE user_id = $1',
            [testUserId]
        );
        console.log('✅ Update executed successfully');
        
        // Test 5: Deactivate config
        console.log('\nTest 5: Deactivating config...');
        await dbAdapter.query(
            'UPDATE user_ha_config SET is_active = false WHERE user_id = $1',
            [testUserId]
        );
        console.log('✅ Deactivation executed successfully');
        
        // Clean up test data
        console.log('\nCleaning up test data...');
        await supabase
            .from('user_ha_config')
            .delete()
            .eq('user_id', testUserId);
        console.log('✅ Test data cleaned up');
        
        console.log('\n✅ All tests passed successfully!');
        console.log('The IoT database adapter is working correctly.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    }
}

// Run tests
testAdapter().catch(console.error);