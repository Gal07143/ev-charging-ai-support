#!/usr/bin/env tsx
/**
 * Direct Ampeco API Test
 * Tests the Ampeco API connection without going through the agent
 */

import 'dotenv/config';

const AMPECO_API_KEY = process.env.AMPECO_API_KEY || '';
const AMPECO_TENANT_URL = process.env.AMPECO_TENANT_URL || '';

console.log('🔧 Ampeco API Configuration Test\n');
console.log('================================================');
console.log(`Tenant URL: ${AMPECO_TENANT_URL}`);
console.log(`API Key: ${AMPECO_API_KEY.substring(0, 20)}...`);
console.log('================================================\n');

async function testAmpecoAPI() {
  const endpoints = [
    '/api/v1/stations',
    '/api/stations',
    '/api/v1/auth',
    '/api/v1/chargepoints',
  ];

  for (const endpoint of endpoints) {
    const url = `${AMPECO_TENANT_URL}${endpoint}`;
    console.log(`\n🧪 Testing: ${url}`);
    console.log('---');

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AMPECO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Headers:`, Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ SUCCESS`);
        console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 500));
      } else {
        const text = await response.text();
        console.log(`❌ FAILED`);
        console.log(`Response:`, text.substring(0, 300));
      }
    } catch (error) {
      console.log(`❌ ERROR:`, error instanceof Error ? error.message : String(error));
    }
  }
}

// Run tests
testAmpecoAPI().then(() => {
  console.log('\n\n================================================');
  console.log('✅ Ampeco API Test Complete');
  console.log('================================================\n');
}).catch(error => {
  console.error('\n\n❌ Test failed:', error);
  process.exit(1);
});
