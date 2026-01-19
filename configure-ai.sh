#!/bin/bash

# ============================================
# Edge Control - Configure AI Provider
# ============================================

clear
echo "🤖 Edge Control - AI Provider Setup"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "Choose your AI provider:"
echo ""
echo "1) OpenAI (GPT-4) - Requires billing, ~\$0.002/message"
echo "2) Groq (Llama 3) - FREE, very fast"
echo "3) Together AI - FREE tier available"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}OpenAI Setup${NC}"
        echo "Get your key from: https://platform.openai.com/api-keys"
        echo ""
        read -p "Enter OpenAI API key (sk-...): " api_key
        
        if [[ ! $api_key =~ ^sk- ]]; then
            echo -e "${RED}Invalid key format!${NC}"
            exit 1
        fi
        
        cat > .env << EOF
# OpenAI Configuration
OPENAI_API_KEY=$api_key

# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF
        echo -e "${GREEN}✅ OpenAI configured!${NC}"
        ;;
        
    2)
        echo ""
        echo -e "${BLUE}Groq Setup (FREE)${NC}"
        echo "Get your key from: https://console.groq.com"
        echo ""
        read -p "Enter Groq API key (gsk_...): " api_key
        
        if [[ ! $api_key =~ ^gsk_ ]]; then
            echo -e "${RED}Invalid key format! Groq keys start with gsk_${NC}"
            exit 1
        fi
        
        cat > .env << EOF
# Groq Configuration (FREE)
OPENAI_API_KEY=$api_key
OPENAI_API_BASE_URL=https://api.groq.com/openai/v1

# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF
        echo -e "${GREEN}✅ Groq configured!${NC}"
        echo -e "${YELLOW}💡 Using Llama 3 model (free & fast)${NC}"
        ;;
        
    3)
        echo ""
        echo -e "${BLUE}Together AI Setup${NC}"
        echo "Get your key from: https://api.together.xyz"
        echo ""
        read -p "Enter Together AI key: " api_key
        
        cat > .env << EOF
# Together AI Configuration
OPENAI_API_KEY=$api_key
OPENAI_API_BASE_URL=https://api.together.xyz/v1

# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF
        echo -e "${GREEN}✅ Together AI configured!${NC}"
        ;;
        
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

# Update .gitignore
if ! grep -q "^.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
fi

echo ""
echo -e "${GREEN}🎉 Configuration complete!${NC}"
echo ""
echo "Next steps:"
echo -e "${BLUE}1. Restart server: ./start-production.sh${NC}"
echo -e "${BLUE}2. Test: curl http://localhost:3000/api/chat ...${NC}"
echo -e "${BLUE}3. Or visit: http://localhost:3000${NC}"
echo ""
