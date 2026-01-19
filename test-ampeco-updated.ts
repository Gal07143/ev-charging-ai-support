#!/usr/bin/env tsx
/**
 * Test Updated Ampeco API Integration
 */

import 'dotenv/config';
import { 
  findStationBySocketNumber,
  getStationStatus,
  getActiveSession,
  getSessionHistory,
  getTariffInfo
} from './src/mastra/utils/ampecoUtils';

console.log('🧪 Testing Updated Ampeco API Integration\n');
console.log('================================================');

async function runTests() {
  // Test 1: List charge points (via find function)
  console.log('\n📋 Test 1: List All Charge Points');
  console.log('---');
  try {
    const result = await findStationBySocketNumber('EA_PT_Haharash_01_01');
    if (result.success) {
      console.log('✅ SUCCESS - Found charge point:');
      console.log(`  ID: ${result.station.id}`);
      console.log(`  Name: ${result.station.name}`);
      console.log(`  Network ID: ${result.station.networkId}`);
      console.log(`  Status: ${result.station.status}`);
      console.log(`  Network Status: ${result.station.networkStatus}`);
      if (result.evse) {
        console.log(`  EVSE ID: ${result.evse.id}`);
        console.log(`  Max Power: ${result.evse.maxPower}W`);
        console.log(`  Hardware Status: ${result.evse.hardwareStatus}`);
      }
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error);
  }

  // Test 2: Get specific charge point status
  console.log('\n\n🔍 Test 2: Get Charge Point Status by ID');
  console.log('---');
  try {
    const result = await getStationStatus('35');
    if (result.success) {
      console.log('✅ SUCCESS - Charge point details retrieved');
      console.log('  Response structure:', Object.keys(result.data || {}).join(', '));
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error);
  }

  // Test 3: Get active sessions
  console.log('\n\n⚡ Test 3: Get Active Charging Sessions');
  console.log('---');
  try {
    const result = await getActiveSession();
    if (result.success) {
      const sessions = result.data?.data || [];
      console.log(`✅ SUCCESS - Found ${sessions.length} active sessions`);
      if (sessions.length > 0) {
        console.log('  First session:', {
          id: sessions[0].id,
          chargePointId: sessions[0].chargePointId,
          status: sessions[0].status
        });
      }
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error);
  }

  // Test 4: Get session history
  console.log('\n\n📜 Test 4: Get Session History');
  console.log('---');
  try {
    const result = await getSessionHistory(undefined, 5);
    if (result.success) {
      const sessions = result.data?.data || [];
      console.log(`✅ SUCCESS - Found ${sessions.length} sessions`);
      if (sessions.length > 0) {
        console.log('  Latest session:', {
          id: sessions[0].id,
          startedAt: sessions[0].startedAt,
          status: sessions[0].status
        });
      }
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error);
  }

  // Test 5: Get tariffs
  console.log('\n\n💰 Test 5: Get Tariff Information');
  console.log('---');
  try {
    const result = await getTariffInfo();
    if (result.success) {
      const tariffs = result.data?.data || [];
      console.log(`✅ SUCCESS - Found ${tariffs.length} tariffs`);
      if (tariffs.length > 0) {
        console.log('  First tariff:', {
          id: tariffs[0].id,
          name: tariffs[0].name
        });
      }
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error);
  }
}

runTests().then(() => {
  console.log('\n\n================================================');
  console.log('✅ Ampeco API Integration Tests Complete');
  console.log('================================================\n');
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
