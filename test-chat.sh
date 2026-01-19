#!/bin/bash

echo "🧪 Testing Edge Control Chat System"
echo "========================================"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Endpoint..."
curl -s http://localhost:3000/api/health | python3 -m json.tool
echo ""
echo ""

# Test 2: English Chat
echo "2️⃣  Testing English Chat..."
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "My charging station is not working"}],
    "threadId": "test-'$(date +%s)'",
    "language": "en"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 3: Hebrew Chat
echo "3️⃣  Testing Hebrew Chat..."
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "יש לי בעיה עם עמדת טעינה"}],
    "threadId": "test-he-'$(date +%s)'",
    "language": "he"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 4: Conversation Context
echo "4️⃣  Testing Conversation Memory..."
THREAD_ID="test-memory-$(date +%s)"
echo "Thread ID: $THREAD_ID"
echo ""

echo "First message:"
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "I have an ABB Terra 54 charger"}],
    "threadId": "'$THREAD_ID'",
    "language": "en"
  }' | python3 -m json.tool | grep -A 3 "text"
echo ""

sleep 2

echo "Second message (should remember the charger):"
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I have an ABB Terra 54 charger"},
      {"role": "assistant", "content": "I can help you with your ABB Terra 54 charger. What issue are you experiencing?"},
      {"role": "user", "content": "It shows error E42"}
    ],
    "threadId": "'$THREAD_ID'",
    "language": "en"
  }' | python3 -m json.tool | grep -A 3 "text"
echo ""
echo ""

# Test 5: Analytics
echo "5️⃣  Testing Analytics Endpoint..."
curl -s http://localhost:3000/api/analytics/stats | python3 -m json.tool
echo ""

echo ""
echo "✅ Testing Complete!"
