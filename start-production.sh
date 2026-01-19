#!/bin/bash

# ============================================
# Edge Control - Quick Production Setup
# ============================================

clear
echo "🚀 Edge Control - Production Setup"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" == "your-api-key-here" ]; then
    echo -e "${YELLOW}⚠️  OpenAI API Key not configured${NC}"
    echo ""
    echo "To enable real AI responses:"
    echo ""
    echo -e "${BLUE}1. Get API key from: https://platform.openai.com/api-keys${NC}"
    echo -e "${BLUE}2. Run: export OPENAI_API_KEY=\"sk-your-key\"${NC}"
    echo -e "${BLUE}3. Run this script again${NC}"
    echo ""
    echo -e "${YELLOW}For now, system will show setup instructions in responses.${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ OpenAI API Key configured${NC}"
fi

# Check database
if [ -f ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/edge-control-db.sqlite" ]; then
    echo -e "${GREEN}✅ Database found${NC}"
else
    echo -e "${YELLOW}⚠️  Database not found, initializing...${NC}"
    npm run db:init
    npm run db:seed
fi

echo ""
echo -e "${BLUE}📊 Checking dependencies...${NC}"

# Install dependencies if needed
if [ ! -d "node_modules/openai" ]; then
    echo "Installing OpenAI SDK..."
    npm install openai better-sqlite3 --save --legacy-peer-deps
fi

echo ""
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Kill any existing process on port 3000
echo -e "${BLUE}🔧 Cleaning port 3000...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

echo ""
echo -e "${GREEN}🚀 Starting production server...${NC}"
echo ""

# Start server
npx tsx production-server.ts
