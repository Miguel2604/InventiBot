/**
 * Simple test for IoT module functionality
 * Run with: node tests/iot-test.js
 */

const iotModule = require('../src/features/iot');

// Mock database for testing
const mockDb = {
    query: async (query, params) => {
        console.log('DB Query:', query.substring(0, 50) + '...');
        console.log('Params:', params);
        
        // Mock responses for different queries
        if (query.includes('SELECT * FROM user_ha_config')) {
            return { rows: [] }; // No config exists
        }
        
        if (query.includes('INSERT INTO user_ha_config')) {
            return { rows: [{ id: 1 }] };
        }
        
        return { rows: [] };
    }
};

async function testIoT() {
    console.log('\n=== IoT Module Test ===\n');
    
    // Initialize IoT module
    const iot = iotModule.initialize(mockDb);
    console.log('✓ IoT module initialized');
    
    // Test module info
    const moduleInfo = iotModule.getModuleInfo();
    console.log('\n✓ Module Info:');
    console.log('  Name:', moduleInfo.name);
    console.log('  Version:', moduleInfo.version);
    console.log('  Features:', moduleInfo.features.length);
    
    // Test menu button
    const menuButton = iotModule.getMenuButton();
    console.log('\n✓ Menu Button:');
    console.log('  Label:', menuButton.label);
    console.log('  Action:', menuButton.action);
    
    // Test IoT action check
    console.log('\n✓ Action Detection:');
    console.log('  IOT_MONITORING:', iot.isIoTAction('IOT_MONITORING'));
    console.log('  IOT_CONTROL:light:on:', iot.isIoTAction('IOT_CONTROL:light:on'));
    console.log('  FAQ_MAIN:', iot.isIoTAction('FAQ_MAIN'));
    
    // Test initial setup flow
    const testUserId = 'test_user_123';
    console.log('\n✓ Testing Setup Flow:');
    
    try {
        // Simulate user clicking IoT button
        const response1 = await iot.handleAction(testUserId, 'IOT_MONITORING');
        console.log('\n  1. Initial Response:');
        console.log('    Message preview:', response1.message.substring(0, 100) + '...');
        console.log('    Quick replies:', response1.quickReplies?.length || 0);
        
        // Simulate user clicking "Start Setup"
        const response2 = await iot.handleAction(testUserId, 'IOT_SETUP_START');
        console.log('\n  2. Setup Start:');
        console.log('    Message preview:', response2.message.substring(0, 100) + '...');
        console.log('    Expecting input:', response2.expectingInput);
        
        // Test session management
        const session = iot.getUserSession(testUserId);
        console.log('\n  3. Session State:');
        console.log('    User ID:', session?.userId);
        console.log('    State:', session?.state);
        
        // Simulate entering URL
        const response3 = await iot.handleTextInput(testUserId, 'http://192.168.1.100:8123');
        console.log('\n  4. URL Input Response:');
        console.log('    Message preview:', response3.message.substring(0, 100) + '...');
        
        // Test cancellation
        const response4 = await iot.handleAction(testUserId, 'IOT_SETUP_CANCEL');
        console.log('\n  5. Cancellation:');
        console.log('    Message:', response4.message);
        
        // Verify session was cleared
        const clearedSession = iot.getUserSession(testUserId);
        console.log('    Session cleared:', clearedSession === null);
        
    } catch (error) {
        console.error('  Error during test:', error.message);
    }
    
    console.log('\n=== Test Complete ===\n');
}

// Run the test
testIoT().catch(console.error);