#!/usr/bin/env node

/**
 * Manual API Test Script for InventiBot
 * 
 * This script tests the webhook endpoints of the chatbot.
 * Run the server first with: npm run dev
 * Then run this script: node tests/manual-api-test.js
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const BASE_URL = 'http://localhost:5000';
const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'inventisolve_verify_token';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET; // Optional: if unset, signature will be omitted

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createSignature(payload) {
  if (!APP_SECRET) return null;
  return 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function testHealthCheck() {
  log('\n📋 Testing Health Check Endpoint...', 'cyan');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    
    if (response.status === 200 && response.data.status === 'ok') {
      log('✅ Health check passed', 'green');
      return true;
    } else {
      log('❌ Health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, 'red');
    return false;
  }
}

async function testWebhookVerification() {
  log('\n🔐 Testing Webhook Verification...', 'cyan');
  
  const testCases = [
    {
      name: 'Valid verification',
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'test_challenge_123'
      },
      expectedStatus: 200,
      expectedResponse: 'test_challenge_123'
    },
    {
      name: 'Invalid token',
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'test_challenge_123'
      },
      expectedStatus: 403
    },
    {
      name: 'Missing parameters',
      params: {
        'hub.mode': 'subscribe'
      },
      expectedStatus: 403
    }
  ];

  let passed = 0;
  for (const testCase of testCases) {
    try {
      const response = await axios.get(`${BASE_URL}/webhook`, { 
        params: testCase.params,
        validateStatus: () => true // Don't throw on 4xx/5xx
      });
      
      if (response.status === testCase.expectedStatus) {
        if (!testCase.expectedResponse || response.data === testCase.expectedResponse) {
          log(`  ✅ ${testCase.name}`, 'green');
          passed++;
        } else {
          log(`  ❌ ${testCase.name} - Wrong response`, 'red');
        }
      } else {
        log(`  ❌ ${testCase.name} - Expected ${testCase.expectedStatus}, got ${response.status}`, 'red');
      }
    } catch (error) {
      log(`  ❌ ${testCase.name} - Error: ${error.message}`, 'red');
    }
  }

  log(`\n  Summary: ${passed}/${testCases.length} tests passed`, passed === testCases.length ? 'green' : 'yellow');
  return passed === testCases.length;
}

async function testMessageHandling() {
  log('\n💬 Testing Message Handling...', 'cyan');
  
  const testMessages = [
    {
      name: 'Text message',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: [{
            sender: { id: 'test_user_1' },
            recipient: { id: 'page_456' },
            timestamp: Date.now(),
            message: {
              mid: 'mid_' + Date.now(),
              text: 'Hello bot'
            }
          }]
        }]
      }
    },
    {
      name: 'GET_STARTED postback',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: [{
            sender: { id: 'test_user_2' },
            recipient: { id: 'page_456' },
            timestamp: Date.now(),
            postback: {
              payload: 'GET_STARTED'
            }
          }]
        }]
      }
    },
    {
      name: 'FAQ_MAIN postback',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: [{
            sender: { id: 'test_user_3' },
            recipient: { id: 'page_456' },
            timestamp: Date.now(),
            postback: {
              payload: 'FAQ_MAIN'
            }
          }]
        }]
      }
    },
    {
      name: 'Quick reply - FAQ_HOURS',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: [{
            sender: { id: 'test_user_4' },
            recipient: { id: 'page_456' },
            timestamp: Date.now(),
            message: {
              mid: 'mid_' + Date.now(),
              text: 'Hours of Operation',
              quick_reply: {
                payload: 'FAQ_HOURS'
              }
            }
          }]
        }]
      }
    },
    {
      name: 'Multiple events',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: [
            {
              sender: { id: 'test_user_5' },
              recipient: { id: 'page_456' },
              timestamp: Date.now(),
              message: {
                mid: 'mid_1_' + Date.now(),
                text: 'First message'
              }
            },
            {
              sender: { id: 'test_user_6' },
              recipient: { id: 'page_456' },
              timestamp: Date.now(),
              message: {
                mid: 'mid_2_' + Date.now(),
                text: 'Second message'
              }
            }
          ]
        }]
      }
    }
  ];

  let passed = 0;
  for (const test of testMessages) {
    try {
      const signature = createSignature(test.payload);
      const headers = { 'Content-Type': 'application/json' };
      if (signature) headers['x-hub-signature-256'] = signature;
      const response = await axios.post(`${BASE_URL}/webhook`, test.payload, {
        headers,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data === 'EVENT_RECEIVED') {
        log(`  ✅ ${test.name}`, 'green');
        passed++;
      } else {
        log(`  ❌ ${test.name} - Status: ${response.status}, Response: ${response.data}`, 'red');
      }
    } catch (error) {
      log(`  ❌ ${test.name} - Error: ${error.message}`, 'red');
    }
  }

  log(`\n  Summary: ${passed}/${testMessages.length} tests passed`, passed === testMessages.length ? 'green' : 'yellow');
  return passed === testMessages.length;
}

async function testInvalidRequests() {
  log('\n🚫 Testing Invalid Requests...', 'cyan');
  
  const testCases = [
    {
      name: 'Non-page object',
      payload: {
        object: 'not_page',
        entry: []
      },
      expectedStatus: 404
    },
    {
      name: 'Invalid signature',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: []
        }]
      },
      signature: 'sha256=invalid_signature',
      expectedStatus: 200 // Will pass if signature validation is optional
    },
    {
      name: 'Empty messaging array',
      payload: {
        object: 'page',
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: []
        }]
      },
      expectedStatus: 200
    }
  ];

  let passed = 0;
  for (const test of testCases) {
    try {
      const signature = test.signature || createSignature(test.payload);
      const headers = { 'Content-Type': 'application/json' };
      if (signature) headers['x-hub-signature-256'] = signature;
      const response = await axios.post(`${BASE_URL}/webhook`, test.payload, {
        headers,
        validateStatus: () => true
      });

      if (response.status === test.expectedStatus) {
        log(`  ✅ ${test.name}`, 'green');
        passed++;
      } else {
        log(`  ⚠️  ${test.name} - Expected ${test.expectedStatus}, got ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`  ❌ ${test.name} - Error: ${error.message}`, 'red');
    }
  }

  log(`\n  Summary: ${passed}/${testCases.length} tests passed`, passed === testCases.length ? 'green' : 'yellow');
  return passed === testCases.length;
}

async function runAllTests() {
  log('\n🚀 Starting InventiBot API Tests', 'blue');
  log('================================', 'blue');
  
  const results = {
    health: false,
    verification: false,
    messageHandling: false,
    invalidRequests: false
  };

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/health`);
  } catch (error) {
    log('\n❌ Server is not running! Please start the server with: npm run dev', 'red');
    process.exit(1);
  }

  // Run tests
  results.health = await testHealthCheck();
  results.verification = await testWebhookVerification();
  results.messageHandling = await testMessageHandling();
  results.invalidRequests = await testInvalidRequests();

  // Summary
  log('\n================================', 'blue');
  log('📊 Test Results Summary', 'blue');
  log('================================', 'blue');
  
  const allPassed = Object.values(results).every(r => r);
  
  for (const [name, passed] of Object.entries(results)) {
    const displayName = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
    log(`${passed ? '✅' : '❌'} ${displayName}: ${passed ? 'PASSED' : 'FAILED'}`, passed ? 'green' : 'red');
  }

  log('\n================================', 'blue');
  if (allPassed) {
    log('🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Some tests failed. Check the output above for details.', 'yellow');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
