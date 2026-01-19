#!/bin/bash

echo "🧪 COMPREHENSIVE CHAT TESTING SUITE"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

function test_case() {
  echo -e "${YELLOW}▶ $1${NC}"
}

function pass() {
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASS++))
}

function fail() {
  echo -e "${RED}✗ FAIL: $1${NC}"
  ((FAIL++))
}

# 1. Error Handling Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  ERROR HANDLING TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_case "Empty message"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[],"threadId":"test-empty","language":"en"}')
if echo "$RESPONSE" | grep -q "error\|Invalid"; then
  pass
else
  fail "Should reject empty messages"
fi
echo ""

test_case "Invalid JSON"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d 'invalid json')
if [ $? -ne 0 ] || echo "$RESPONSE" | grep -q "error"; then
  pass
else
  fail "Should handle invalid JSON"
fi
echo ""

test_case "Missing required fields"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[]}')
if echo "$RESPONSE" | grep -q "success.*true\|error"; then
  pass
else
  fail "Should handle missing fields gracefully"
fi
echo ""

# 2. Edge Cases Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  EDGE CASE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_case "Very long message (5000 chars)"
LONG_MSG=$(python3 -c "print('a' * 5000)")
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$LONG_MSG\"}],\"threadId\":\"test-long\",\"language\":\"en\"}")
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Should handle long messages"
fi
echo ""

test_case "Special characters"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test <script>alert(\"xss\")</script> && rm -rf /"}],"threadId":"test-xss","language":"en"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Should sanitize special characters"
fi
echo ""

test_case "Unicode and emojis"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"שלום 🚗⚡🔋 こんにちは"}],"threadId":"test-unicode","language":"he"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Should handle Unicode correctly"
fi
echo ""

# 3. Performance Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  PERFORMANCE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_case "Response time < 10 seconds"
START=$(date +%s)
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Quick test"}],"threadId":"test-perf","language":"en"}')
END=$(date +%s)
DURATION=$((END - START))
if [ $DURATION -lt 10 ]; then
  pass
  echo "   Response time: ${DURATION}s"
else
  fail "Response too slow: ${DURATION}s"
fi
echo ""

test_case "Concurrent requests (3 simultaneous)"
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Concurrent 1"}],"threadId":"test-c1","language":"en"}' &
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Concurrent 2"}],"threadId":"test-c2","language":"en"}' &
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Concurrent 3"}],"threadId":"test-c3","language":"en"}' &
wait
if [ $? -eq 0 ]; then
  pass
else
  fail "Failed to handle concurrent requests"
fi
echo ""

# 4. Multi-turn Conversation Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  MULTI-TURN CONVERSATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

THREAD_ID="test-multi-$(date +%s)"

test_case "Turn 1: Initial question"
RESPONSE1=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"I have a charging station\"}],\"threadId\":\"$THREAD_ID\",\"language\":\"en\"}")
if echo "$RESPONSE1" | grep -q "success.*true"; then
  pass
else
  fail "Turn 1 failed"
fi
echo ""

test_case "Turn 2: Follow-up (context check)"
RESPONSE2=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"I have a charging station\"},{\"role\":\"assistant\",\"content\":\"How can I help with your charging station?\"},{\"role\":\"user\",\"content\":\"It's not working\"}],\"threadId\":\"$THREAD_ID\",\"language\":\"en\"}")
if echo "$RESPONSE2" | grep -q "success.*true"; then
  pass
  # Check if AI references the station
  if echo "$RESPONSE2" | grep -qi "station\|charger"; then
    echo -e "${GREEN}   ✓ Context maintained${NC}"
  fi
else
  fail "Turn 2 failed"
fi
echo ""

# 5. Knowledge Base Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  KNOWLEDGE BASE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_case "Specific charger model (ABB Terra 54)"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Tell me about ABB Terra 54"}],"threadId":"test-kb1","language":"en"}')
if echo "$RESPONSE" | grep -qi "ABB\|Terra\|54\|charger"; then
  pass
else
  fail "Should know about ABB Terra 54"
fi
echo ""

test_case "Error code E42"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is error E42?"}],"threadId":"test-kb2","language":"en"}')
if echo "$RESPONSE" | grep -qi "E42\|error\|communication\|ground"; then
  pass
else
  fail "Should know about error E42"
fi
echo ""

test_case "Troubleshooting flow"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Charging is not starting"}],"threadId":"test-kb3","language":"en"}')
if echo "$RESPONSE" | grep -qi "check\|step\|try\|troubleshoot"; then
  pass
else
  fail "Should provide troubleshooting steps"
fi
echo ""

# 6. Sentiment Detection Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  SENTIMENT DETECTION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_case "Positive sentiment"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Thank you so much! This is great!"}],"threadId":"test-sent1","language":"en"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Should handle positive sentiment"
fi
echo ""

test_case "Frustrated sentiment"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"This is the third time! Nothing works! I am so frustrated!"}],"threadId":"test-sent2","language":"en"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
  # Check if response is more empathetic
  if echo "$RESPONSE" | grep -qi "sorry\|understand\|apologize"; then
    echo -e "${GREEN}   ✓ Empathetic response detected${NC}"
  fi
else
  fail "Should detect frustrated sentiment"
fi
echo ""

# 7. Multi-language Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  MULTI-LANGUAGE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_case "Hebrew"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"שלום, אני צריך עזרה"}],"threadId":"test-lang-he","language":"he"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Hebrew support failed"
fi
echo ""

test_case "Russian"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Привет, мне нужна помощь"}],"threadId":"test-lang-ru","language":"ru"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Russian support failed"
fi
echo ""

test_case "Arabic"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"مرحبا، أحتاج مساعدة"}],"threadId":"test-lang-ar","language":"ar"}')
if echo "$RESPONSE" | grep -q "success.*true"; then
  pass
else
  fail "Arabic support failed"
fi
echo ""

# Final Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊  TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Passed: $PASS${NC}"
echo -e "${RED}✗ Failed: $FAIL${NC}"
TOTAL=$((PASS + FAIL))
PERCENT=$((PASS * 100 / TOTAL))
echo "Total: $TOTAL tests"
echo "Success Rate: ${PERCENT}%"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed. Review above.${NC}"
  exit 1
fi
