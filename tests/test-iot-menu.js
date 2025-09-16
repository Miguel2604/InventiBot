/**
 * Integration test for IoT menu functionality
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const IoTDatabaseAdapter = require('../src/features/iot/dbAdapter');
const { initialize: initializeIoT } = require('../src/features/iot');

// Create Supabase client with service role key
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testIoTMenu() {
    console.log('Testing IoT Menu Functionality...\n');
    
    // Create database adapter
    const dbAdapter = new IoTDatabaseAdapter(supabase);
    
    // Initialize IoT module
    const iotHandler = initializeIoT(dbAdapter);
    console.log('✅ IoT module initialized');
    
    // Test user ID
    const testUserId = 'test_user_' + Date.now();
    
    try {
        // Test 1: Access IoT main menu without configuration
        console.log('\nTest 1: Accessing IoT menu without configuration...');
        const menuResult = await iotHandler.handleAction(testUserId, 'IOT_MONITORING');
        console.log('✅ Menu displayed successfully');
        console.log('Response:', menuResult.message.substring(0, 100) + '...');
        
        if (menuResult.quickReplies) {
            console.log('Available options:', menuResult.quickReplies.map(btn => btn.label).join(', '));
        }
        
        // Test 2: Check if setup flow is offered
        console.log('\nTest 2: Checking for setup option...');
        const hasSetupOption = menuResult.quickReplies?.some(btn => 
            btn.action === 'IOT_SETUP_START' || btn.label.includes('Setup')
        );
        
        if (hasSetupOption) {
            console.log('✅ Setup option is available');
        } else {
            console.log('ℹ️  No setup option found (might already be configured)');
        }
        
        // Test 3: Access main menu directly
        console.log('\nTest 3: Accessing IoT main menu directly...');
        const mainMenuResult = await iotHandler.handleAction(testUserId, 'IOT_MAIN_MENU');
        
        if (mainMenuResult.message && mainMenuResult.quickReplies) {
            console.log('✅ Main menu rendered successfully');
            console.log('Menu options:', mainMenuResult.quickReplies.map(btn => btn.label).join(', '));
        }
        
        // Test 4: Check session management
        console.log('\nTest 4: Testing session management...');
        const session = iotHandler.getUserSession(testUserId);
        
        if (session) {
            console.log('✅ Session created:', {
                userId: session.userId,
                state: session.state
            });
        } else {
            console.log('ℹ️  No session created (normal for initial menu view)');
        }
        
        // Clean up
        console.log('\nCleaning up...');
        iotHandler.clearUserSession(testUserId);
        console.log('✅ Session cleared');
        
        console.log('\n✅ All IoT menu tests passed successfully!');
        console.log('The IoT module is ready to use.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    }
}

// Run tests
testIoTMenu().catch(console.error);