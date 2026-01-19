#!/bin/bash

# ============================================
# Edge Control - Configure OpenAI API Key
# ============================================

clear
echo "🔑 Edge Control - OpenAI API Key Setup"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}This script will configure your OpenAI API key.${NC}"
echo ""

# Prompt for API key
echo -e "${YELLOW}Enter your OpenAI API key (starts with sk-):${NC}"
read -p "API Key: " api_key

# Validate format
if [[ ! $api_key =~ ^sk- ]]; then
    echo ""
    echo -e "${RED}❌ Invalid API key format!${NC}"
    echo "OpenAI keys should start with 'sk-'"
    echo ""
    echo "Please get your key from: https://platform.openai.com/api-keys"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ API key format looks good!${NC}"
echo ""

# Create .env file
echo "Creating .env file..."
cat > .env << EOF
# OpenAI Configuration
OPENAI_API_KEY=$api_key

# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF

echo -e "${GREEN}✅ .env file created${NC}"
echo ""

# Update .gitignore to exclude .env
if ! grep -q "^.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    echo -e "${GREEN}✅ Added .env to .gitignore${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Testing API key...${NC}"
echo ""

# Export for current session
export OPENAI_API_KEY=$api_key

# Test the API key
echo "Making test request to OpenAI..."
response=$(curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $api_key" \
  -H "Content-Type: application/json")

if echo "$response" | grep -q "gpt-4"; then
    echo ""
    echo -e "${GREEN}✅ API key is VALID!${NC}"
    echo -e "${GREEN}✅ OpenAI connection successful!${NC}"
    echo ""
    
    echo -e "${BLUE}📊 Available models:${NC}"
    echo "$response" | grep -o '"id":"gpt-[^"]*"' | head -5 | sed 's/"id":"//;s/"//'
    echo ""
    
    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo -e "${BLUE}1. Restart the server: ./start-production.sh${NC}"
    echo -e "${BLUE}2. Test chat: curl -X POST http://localhost:3000/api/chat ...${NC}"
    echo -e "${BLUE}3. Or visit: http://localhost:3000${NC}"
    echo ""
    echo -e "${YELLOW}💡 The .env file contains your API key. Keep it secure!${NC}"
    
else
    echo ""
    echo -e "${RED}❌ API key validation failed!${NC}"
    echo ""
    echo "Possible issues:"
    echo "1. Key is incorrect or expired"
    echo "2. No payment method added to OpenAI account"
    echo "3. Network connection issue"
    echo ""
    echo "Please:"
    echo "- Check your key at: https://platform.openai.com/api-keys"
    echo "- Ensure billing is set up: https://platform.openai.com/account/billing"
    echo "- Try running this script again"
    echo ""
    echo -e "${YELLOW}Response from OpenAI:${NC}"
    echo "$response"
fi

echo ""
