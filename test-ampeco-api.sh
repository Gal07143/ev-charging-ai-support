#!/bin/bash
# Test Ampeco API Integration
# This script tests all 6 Ampeco API tools

echo "=== Testing Ampeco API Integration ==="
echo ""

# Check environment variables
echo "📋 Step 1: Check Environment Variables"
echo "AMPECO_API_KEY: ${AMPECO_API_KEY:0:20}..."
echo "AMPECO_TENANT_URL: $AMPECO_TENANT_URL"
echo ""

# Test 1: Station Status
echo "🔍 Test 1: Station Status Tool"
curl -s -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Check status of station 12345"}],
    "threadId": "test-ampeco-status"
  }' | python3 -m json.tool | head -30
echo ""

# Test 2: Active Session
echo "📊 Test 2: Active Session Tool"
curl -s -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Show active charging session for station ST-001"}],
    "threadId": "test-ampeco-session"
  }' | python3 -m json.tool | head -30
echo ""

# Test 3: Session History
echo "📜 Test 3: Session History Tool"
curl -s -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Show charging history for user USER123"}],
    "threadId": "test-ampeco-history"
  }' | python3 -m json.tool | head -30
echo ""

# Test 4: Tariff Information
echo "💰 Test 4: Tariff Tool"
curl -s -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is the pricing for station 12345?"}],
    "threadId": "test-ampeco-tariff"
  }' | python3 -m json.tool | head -30
echo ""

# Test 5: Reset Station
echo "🔄 Test 5: Reset Station Tool"
curl -s -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Reset station 12345 (soft reset)"}],
    "threadId": "test-ampeco-reset"
  }' | python3 -m json.tool | head -30
echo ""

# Test 6: Unlock Connector
echo "🔓 Test 6: Unlock Connector Tool"
curl -s -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Unlock connector on station 12345"}],
    "threadId": "test-ampeco-unlock"
  }' | python3 -m json.tool | head -30
echo ""

echo "=== Ampeco API Testing Complete ==="
echo ""
echo "Summary:"
echo "✅ Tested 6 Ampeco tools"
echo "📊 Check results above for success/failure"
echo ""
echo "Next steps:"
echo "1. Review API responses"
echo "2. Check for authentication errors"
echo "3. Verify Ampeco API credentials in .env"
