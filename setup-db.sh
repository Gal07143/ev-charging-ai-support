#!/bin/bash

# ============================================
# Edge Control Support Bot - Database Setup
# ============================================

echo "🚀 Edge Control Support Bot - Database Setup"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Create D1 Database (local for development)
echo -e "${BLUE}📊 Step 1: Setting up local D1 database...${NC}"
echo "Note: This creates a local SQLite database for development"
echo "For production, create via Cloudflare Dashboard"
echo ""

# Step 2: Initialize schema
echo -e "${BLUE}📝 Step 2: Initializing database schema...${NC}"
if [ -f "init-db.sql" ]; then
    echo "Running init-db.sql..."
    npx wrangler d1 execute edge-control-db --local --file=./init-db.sql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Schema initialized successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to initialize schema${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ init-db.sql not found!${NC}"
    exit 1
fi

echo ""

# Step 3: Load seed data
echo -e "${BLUE}🌱 Step 3: Loading seed data...${NC}"
if [ -f "seed.sql" ]; then
    echo "Running seed.sql..."
    npx wrangler d1 execute edge-control-db --local --file=./seed.sql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Seed data loaded successfully!${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Some seed data may have failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  seed.sql not found, skipping...${NC}"
fi

echo ""

# Step 4: Verify database
echo -e "${BLUE}🔍 Step 4: Verifying database...${NC}"
echo "SELECT count(*) FROM sqlite_master WHERE type='table';" | \
    npx wrangler d1 execute edge-control-db --local --command="SELECT count(*) FROM sqlite_master WHERE type='table';"

echo ""

# Step 5: Build the project
echo -e "${BLUE}🔨 Step 5: Building project...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""

# Summary
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Start development server:"
echo "   npm run dev"
echo ""
echo "2. Or use PM2:"
echo "   pm2 start ecosystem.config.cjs"
echo ""
echo "3. Open in browser:"
echo "   http://localhost:3000"
echo ""
echo "4. For production deployment:"
echo "   - Create D1 database in Cloudflare Dashboard"
echo "   - Update wrangler.jsonc with database_id"
echo "   - Run: npm run deploy"
echo ""
echo -e "${BLUE}Happy coding! 🎉${NC}"
