# Edge Control Discord AI Support Agent

🚗⚡ **Production-ready AI customer support agent for Edge Control EV charging network**

A Discord bot that provides instant, empathetic customer support for electric vehicle charging stations. Built with Mastra framework, powered by GPT-4, and integrated with Ampeco API for real-time station management.

## ✨ Features

### 🌍 Multi-language Support
- **Hebrew** (primary language)
- English, Russian, Arabic
- Automatic language detection

### 🤖 Intelligent Conversation
- **Empathy-first approach** - Shows understanding before asking technical questions
- **Conversation memory** - Remembers context across messages
- **Proactive suggestions** - Offers solutions automatically
- **Human-like responses** - Natural, not robotic

### 🔧 Real-time Station Management
- ✅ Check station status
- 🔄 Remote reset (soft/hard)
- 🔓 Unlock stuck connectors
- ⚡ View active charging sessions
- 📊 Access session history
- 💰 Get tariff information
- 📸 Analyze station images

### 🛡️ Production Features
- **Rate limiting** - 20 messages/minute per user
- **Duplicate prevention** - Prevents message processing loops
- **Interactive buttons** - Rating, human agent transfer, end chat
- **Typing indicators** - Shows bot is working
- **Error handling** - Graceful failures with user-friendly messages

## 🚀 Improvement Plans

### ✅ Phase 1: Foundation (COMPLETE)
- 15 critical fixes implemented ([IMPROVEMENTS_COMPLETE.md](./IMPROVEMENTS_COMPLETE.md))
- HTTP server, Inngest webhooks, connection pooling, structured logging
- Message queue, metrics, error boundaries, multi-channel support

### 📋 Phase 2: Production-Grade Intelligence (PLANNED)
- **15 additional critical improvements** ([CRITICAL_IMPROVEMENTS_PHASE_2.md](./CRITICAL_IMPROVEMENTS_PHASE_2.md))
- **Quick Reference**: [PHASE_2_SUMMARY.md](./PHASE_2_SUMMARY.md)

**Key improvements**:
- 🔴 **P0 Critical** (Weeks 1-4): Real-time monitoring, RAG knowledge base, multi-language, diagnostic flows, charger database
- 🟡 **P1 High** (Weeks 5-8): Smart escalation, quality scoring, predictive analytics, rich media (OCR/voice), analytics dashboard
- 🟢 **P2 Advanced** (Weeks 9-12): Vehicle compatibility, dynamic API tools, sentiment analysis, offline mode, auto KB updates

**Expected impact**:
- Resolution rate: 65% → 90%
- Conversation time: 12 → 6 messages
- Escalation rate: 35% → 10%
- User satisfaction: 3.8 → 4.6/5
- Knowledge coverage: 40% → 95%

### 🎯 25-Stage Master Plan
Complete roadmap for becoming an industry-leading EV charging support system ([EV_AGENT_IMPROVEMENT_PLAN.md](./EV_AGENT_IMPROVEMENT_PLAN.md))

## 🏗️ Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌───────────────────┐
│   Discord    │────▶│  Discord Trigger │────▶│   Inngest Queue   │
│   (Users)    │     │  (discordTriggers)│    │  (Durable Tasks)  │
└──────────────┘     └─────────────────┘     └───────────────────┘
                                                      │
                                                      ▼
┌──────────────┐     ┌─────────────────┐     ┌───────────────────┐
│   Ampeco     │◀────│   Mastra Tools   │◀────│ Edge Control      │
│   API        │     │  (Station mgmt)  │     │ Workflow          │
└──────────────┘     └─────────────────┘     └───────────────────┘
                                                      │
                                                      ▼
                     ┌─────────────────┐     ┌───────────────────┐
                     │   PostgreSQL    │◀────│ Edge Control      │
                     │   (Memory)      │     │ Agent (GPT-4)     │
                     └─────────────────┘     └───────────────────┘
```

### Key Components

1. **Discord Trigger** (`src/triggers/discordTriggers.ts`)
   - Receives messages from Discord
   - Handles button interactions
   - Manages rate limiting
   - Shows typing indicators

2. **Edge Control Workflow** (`src/mastra/workflows/edgeControlWorkflow.ts`)
   - Two-step workflow (Mastra constraint)
   - Step 1: Agent generates response
   - Step 2: Send to Discord with buttons

3. **Edge Control Agent** (`src/mastra/agents/edgeControlAgent.ts`)
   - GPT-4 powered AI agent
   - 1500+ lines Hebrew knowledge base
   - Memory-enabled conversations
   - Access to 8 tools

4. **Ampeco Tools** (`src/mastra/tools/`)
   - Station status checker
   - Remote reset
   - Connector unlock
   - Session management
   - Tariff information
   - Image analysis

## 📋 Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** database
- **Discord Bot** token
- **Ampeco API** key and tenant URL
- **OpenAI API** key (for GPT-4)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd webapp
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Discord
DISCORD_BOT_TOKEN=your_discord_bot_token

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/edge_control

# Ampeco API
AMPECO_API_KEY=your_ampeco_api_key
AMPECO_TENANT_URL=https://your-tenant.ampeco.tech

# OpenAI API
OPENAI_API_KEY=your_openai_api_key
```

### 3. Set Up PostgreSQL Database

```bash
# Create database
createdb edge_control

# Database schema is auto-created on first run
```

### 4. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Bot tab → Add Bot
4. Copy token to `.env`
5. Enable these intents:
   - Server Members Intent
   - Message Content Intent
6. OAuth2 → URL Generator:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Messages`, `Use Slash Commands`
7. Invite bot to your server

### 5. Start the Bot

#### Development (with PM2)

```bash
npm run dev:pm2
```

#### Check Status

```bash
pm2 list
npm run logs
npm test  # Health check
```

#### Stop

```bash
npm run stop
```

#### Restart

```bash
npm run restart
```

### 6. Test the Bot

In your Discord server, send a message:

```
@EdgeControlBot היי
```

The bot should respond in Hebrew!

## 🛠️ Development

### Project Structure

```
webapp/
├── src/
│   ├── index.tsx                   # Main Hono app
│   ├── mastra/
│   │   ├── index.ts                # Mastra initialization
│   │   ├── storage.ts              # PostgreSQL connection
│   │   ├── inngest.ts              # Inngest configuration
│   │   ├── agents/
│   │   │   └── edgeControlAgent.ts # AI agent with knowledge base
│   │   ├── workflows/
│   │   │   └── edgeControlWorkflow.ts  # 2-step workflow
│   │   ├── tools/                  # Ampeco API tools (8 tools)
│   │   └── utils/
│   │       └── ampecoUtils.ts      # API helpers, rate limiting
│   └── triggers/
│       └── discordTriggers.ts      # Discord bot connection
├── logs/                           # PM2 logs directory
├── ecosystem.config.cjs            # PM2 configuration
├── .env                            # Environment variables
└── package.json
```

### Available Scripts

```bash
# Development
npm run dev          # Start with vite-node
npm run dev:pm2      # Start with PM2 (recommended)

# Testing
npm test             # Health check endpoint
npm run logs         # View PM2 logs

# Management
npm run stop         # Stop PM2 process
npm run restart      # Clean restart
npm run clean-port   # Kill process on port 3000
```

### Testing the Agent API

```bash
curl -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "היי"}]}'
```

## 🔧 Configuration

### Rate Limiting

Edit `src/mastra/utils/ampecoUtils.ts`:

```typescript
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;   // 20 messages
```

### Cache Settings

```typescript
const cache = new NodeCache({ 
  stdTTL: 300,      // 5 minutes
  checkperiod: 60   // Check every 60 seconds
});
```

### Agent Model

Edit `src/mastra/agents/edgeControlAgent.ts`:

```typescript
model: {
  provider: 'openai',
  name: 'gpt-4o',  // Change to gpt-4-turbo, gpt-3.5-turbo, etc.
  toolChoice: 'auto',
}
```

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
pm2 logs edge-control-bot

# Non-blocking logs (safer)
npm run logs

# Log files
tail -f logs/out.log   # Standard output
tail -f logs/error.log # Errors
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "ok",
  "service": "Edge Control Support Bot",
  "initialized": true,
  "timestamp": "2024-01-18T12:00:00.000Z"
}
```

## 🐛 Troubleshooting

### Bot not responding

1. **Check if bot is running:**
   ```bash
   pm2 list
   ```

2. **Check logs:**
   ```bash
   npm run logs
   ```

3. **Verify Discord token:**
   ```bash
   echo $DISCORD_BOT_TOKEN
   ```

4. **Test database connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

### Database errors

```bash
# Recreate database schema
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restart bot (schema auto-created)
npm run restart
```

### Port already in use

```bash
npm run clean-port
npm run dev:pm2
```

### Agent not using tools

Check OpenAI API key and credits:

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

## 🚀 Production Deployment

### Environment Setup

```env
NODE_ENV=production
DATABASE_URL=<production-database-url>
DISCORD_BOT_TOKEN=<production-bot-token>
```

### Using PM2 Ecosystem

```bash
# Start in production mode
NODE_ENV=production pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

### Database Migration

```bash
# Backup production database
pg_dump $DATABASE_URL > backup.sql

# Apply schema updates (if any)
psql $DATABASE_URL < migrations.sql
```

## 📝 Extending the System

### Adding New Tools

1. Create tool file in `src/mastra/tools/`:

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const myNewTool = createTool({
  id: 'my-new-tool',
  description: 'Description of what this tool does',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async ({ context }) => {
    // Tool logic here
    return { success: true, data: {} };
  },
});
```

2. Register in agent (`src/mastra/agents/edgeControlAgent.ts`):

```typescript
import { myNewTool } from '../tools/myNewTool';

tools: {
  // ... existing tools
  myNewTool,
}
```

### Updating Knowledge Base

Edit `src/mastra/agents/edgeControlAgent.ts`:

```typescript
const KNOWLEDGE_BASE = `
# Your updated knowledge here
...
`;
```

### Adding New Languages

Edit agent instructions to include new language phrases and detection in `detectLanguage()` function.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is proprietary software for Edge Control.

## 🆘 Support

For issues and questions:
- **Technical Issues**: Open GitHub issue
- **Business Inquiries**: contact@edgecontrol.com

---

Built with ❤️ using [Mastra](https://mastra.ai), [Hono](https://hono.dev), and [Discord.js](https://discord.js.org)
