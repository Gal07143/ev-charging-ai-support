# 🚗⚡ EV Charging Agent - Complete Knowledge & 25-Stage Improvement Plan

## Table of Contents
1. [Domain Analysis](#domain-analysis)
2. [Knowledge Requirements](#knowledge-requirements)
3. [Customer Issue Categories](#customer-issue-categories)
4. [25-Stage Improvement Plan](#25-stage-improvement-plan)
5. [Knowledge Database Structure](#knowledge-database-structure)
6. [Implementation Roadmap](#implementation-roadmap)

---

# Domain Analysis

## What an EV Charging Agent Needs to Know

### 1. **Technical Knowledge**
- **Charging Standards**: CCS, CHAdeMO, Type 2, Type 1, Tesla Supercharger
- **Power Levels**: Level 1 (1.4-1.9 kW), Level 2 (3.7-22 kW), Level 3/DC Fast (50-350 kW)
- **Electrical Concepts**: kW vs kWh, AC vs DC, voltage, amperage, three-phase power
- **Connector Types**: Physical differences, compatibility, adapters
- **Communication Protocols**: OCPP, ISO 15118, Plug & Charge

### 2. **Vehicle Knowledge**
- **150+ EV Models**: Tesla, Nissan, BMW, Hyundai, Kia, VW, Mercedes, Audi, etc.
- **Charging Capabilities**: Max AC/DC charging speeds per model
- **Battery Sizes**: Range implications, charging time calculations
- **Onboard Chargers**: Single-phase vs three-phase, power limitations
- **Charging Curves**: How charging speed decreases as battery fills

### 3. **Charger Equipment**
- **30+ Manufacturers**: ABB, Delta, Kempower, Tritium, ChargePoint, etc.
- **Station Models**: Specific error codes, reset procedures
- **Hardware Components**: Cable management, payment terminals, displays
- **Maintenance**: Common failures, diagnostic procedures

### 4. **Business Operations**
- **Pricing Models**: kWh-based, time-based, session fees, parking fees
- **Payment Methods**: Credit cards, mobile apps, RFID, roaming networks
- **Roaming Agreements**: Interoperability between networks
- **Subscription Plans**: Monthly memberships, discount programs

### 5. **Software & Apps**
- **Mobile App Features**: Account management, payment, navigation
- **Station Locators**: Real-time availability, filtering, routing
- **Remote Management**: Start/stop sessions, unlock connectors
- **User Account Issues**: Registration, verification, password resets

---

# Customer Issue Categories

## 1. **The Complete Beginner** (20% of users)
**Profile**: First-time EV owner, never used public charging

**Questions:**
- "How do I charge my car?" (literally doesn't know to plug it in)
- "Which cable do I need?"
- "Do I need to download an app?"
- "Is it safe to charge in the rain?"
- "Can I leave my car while charging?"
- "How long will it take?"

**Agent Approach:**
- Ultra patient, no assumptions
- Step-by-step visual instructions
- Explain everything simply
- Encourage questions

---

## 2. **Technical Issues** (30% of users)

### **2.1 Charging Won't Start**
- Station not recognizing car
- App says "authorized" but nothing happens
- Cable locked but no power flowing
- Error message on screen
- Car shows "charging error"

### **2.2 Charging Stops Unexpectedly**
- Mid-session disconnection
- Car reached charge limit
- Payment authorization failed
- Station overheating protection
- Grid power issues

### **2.3 Cable Stuck/Won't Release**
- Mechanical lock engaged
- Car-side lock active
- Emergency release needed
- Safety interlock

### **2.4 Slow Charging Speed**
- Expected 50kW, getting 7kW
- Battery already 80% (curve throttling)
- Hot battery/cold battery
- Station sharing power with another car
- Vehicle limited to AC speeds

---

## 3. **Payment & Billing Issues** (25% of users)

### **3.1 Payment Declined**
- Card declined by bank
- Insufficient pre-authorization amount
- Foreign card issues
- 3D Secure verification failed

### **3.2 Billing Disputes**
- "I was charged but didn't charge"
- "Charged too much"
- "Double charged"
- "Session never ended, still being charged"
- "I unplugged but session still active"

### **3.3 Account Issues**
- Can't register
- Email not verified
- RFID card not working
- Subscription not active
- Roaming partner issues

---

## 4. **Car-Specific Issues** (15% of users)

### **4.1 Compatibility Questions**
- "Will this station work with my Tesla Model 3?"
- "I have a Nissan Leaf, can I use CCS?"
- "My car only has Type 2, will it work?"
- "Do I need an adapter?"

### **4.2 Charging Speed Questions**
- "Why is my Hyundai Kona only charging at 7kW?"
- "My car says 22kW capable but only getting 11kW"
- "How long to charge from 20% to 80%?"

### **4.3 Battery Health**
- "Should I charge to 100% every time?"
- "Is DC fast charging bad for my battery?"
- "Optimal charging habits"

---

## 5. **Navigation & Availability** (5% of users)
- Can't find stations
- Station shows available but it's occupied
- How to filter by connector type
- Route planning for long trips
- Real-time availability accuracy

---

## 6. **Emergency Situations** (3% of users)
- Car won't turn on after charging
- Burning smell from charger
- Electrical shock/tingling
- Cable damaged/exposed wires
- Station sparking

---

## 7. **"Stupid" But Real Questions** (2% of users)
- "Do I need to turn off my car?" (YES!)
- "Can I charge while driving?" (No...)
- "Will it shock me?" (No, it's safe)
- "Do I need gas too?" (No, it's electric)
- "Can I use an extension cord?" (NO! Dangerous!)
- "Can I charge in car wash?" (Not recommended)
- "My car won't start after charging" (It's fully electric, press start button)

---

# EV Charger Manufacturers & Models (To Know)

## **Major Charger Brands**

### **1. ABB**
- Terra 54/124/184/360
- Common in Europe
- Error codes: E01-E99
- Reset: Power cycle + app reset

### **2. Delta Electronics**
- DC City 25/50/100
- Common worldwide
- Known issue: Display freezing
- Reset: Button hold 10 seconds

### **3. Kempower**
- Satellite system (modular)
- Dynamic power sharing
- Very reliable, fewer issues

### **4. Tritium**
- RTM, PKM, PK series
- Australia-based, global presence
- Common issue: Payment terminal errors

### **5. ChargePoint**
- CPF25/50, Express Plus
- North America focused
- App-dependent issues

### **6. EVBox**
- Troniq Modular
- Europe dominant
- Requires EVBox app

### **7. Alpitronic (Hypercharger)**
- HYC150/300
- Ultra-fast (350kW capable)
- Premium European locations

### **8. Efacec**
- QC45/QC120
- Portugal-based
- Common in southern Europe

### **9. IONITY**
- 350kW stations
- Premium European highway network
- Requires IONITY membership for best rates

### **10. Tesla Supercharger**
- V2 (150kW), V3 (250kW), V4 (350kW)
- Tesla only (some open to other EVs now)
- Most reliable network globally

---

# EV Car Models (Complete Database Needed)

## **By Charging Capability**

### **Ultra-Fast DC Charging (150kW+)**
- Porsche Taycan (270kW)
- Hyundai Ioniq 5/6 (240kW)
- Kia EV6 (240kW)
- Genesis GV60 (240kW)
- Mercedes EQS (200kW)
- BMW i4/iX (200kW)
- Audi e-tron GT (270kW)

### **Fast DC Charging (50-150kW)**
- Tesla Model 3/Y (250kW)
- VW ID.3/ID.4 (125kW)
- Nissan Ariya (130kW)
- Ford Mustang Mach-E (150kW)
- Polestar 2 (150kW)
- Volvo XC40 Recharge (150kW)

### **Moderate DC Charging (30-50kW)**
- Nissan Leaf (50kW)
- Renault Zoe (50kW DC optional, many AC only)
- Mini Cooper SE (50kW)
- MG ZS EV (76kW)

### **AC Only (No DC Fast Charging)**
- Renault Zoe (22kW AC)
- Smart EQ ForTwo (22kW AC)
- BMW i3 (older models, 50kW DC optional)

### **Unique Cases**
- Tesla: Proprietary connector in US, CCS in EU
- Nissan Leaf: CHAdeMO only (dying standard)
- Outlander PHEV: Not pure EV, different needs

---

# 25-Stage Improvement Plan

## **Phase 1: Foundation & Knowledge Base (Stages 1-5)**

### **Stage 1: Build Comprehensive Vehicle Database**
**Duration**: 2 weeks

**Deliverables:**
- Database table: `ev_vehicles`
- Fields:
  - `make`, `model`, `year`, `variant`
  - `battery_size_kwh`
  - `max_ac_charging_kw` (single-phase, three-phase)
  - `max_dc_charging_kw`
  - `connector_types` (JSON array)
  - `onboard_charger_type`
  - `charging_curve_data` (JSON)
  - `real_world_range_km`
  - `common_issues` (TEXT)
  - `owner_manual_url`

**Data Sources:**
- Manufacturer websites
- ev-database.org
- insideevs.com
- Real-world user data

**Implementation:**
```sql
CREATE TABLE ev_vehicles (
  id SERIAL PRIMARY KEY,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  variant VARCHAR(100),
  battery_size_kwh DECIMAL(6,2),
  max_ac_charging_single_phase_kw DECIMAL(5,2),
  max_ac_charging_three_phase_kw DECIMAL(5,2),
  max_dc_charging_kw DECIMAL(6,2),
  connector_types JSONB, -- ["CCS", "Type2"]
  charging_curve JSONB, -- {0: 150, 20: 150, 50: 120, 80: 50}
  range_wltp_km INTEGER,
  range_real_world_km INTEGER,
  common_issues TEXT,
  owner_manual_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ev_make_model ON ev_vehicles(make, model);
```

---

### **Stage 2: Build Charger Equipment Database**
**Duration**: 2 weeks

**Deliverables:**
- Database table: `charger_models`
- Charger specs, error codes, troubleshooting guides
- Reset procedures per model
- Known issues and solutions

**Implementation:**
```sql
CREATE TABLE charger_models (
  id SERIAL PRIMARY KEY,
  manufacturer VARCHAR(100) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  power_output_kw DECIMAL(6,2),
  connector_types JSONB,
  error_codes JSONB, -- {"E01": "Communication error", ...}
  reset_procedures JSONB,
  troubleshooting_guide TEXT,
  maintenance_manual_url TEXT,
  warranty_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_charger_manufacturer ON charger_models(manufacturer);
```

---

### **Stage 3: Create Compatibility Matrix Tool**
**Duration**: 1 week

**Purpose**: Instantly answer "Will this car work with this charger?"

**Tool:**
```typescript
export const vehicleChargerCompatibilityTool = createTool({
  id: 'check-vehicle-charger-compatibility',
  description: 'Check if a specific EV model can charge at a specific charger type',
  inputSchema: z.object({
    vehicleMake: z.string(),
    vehicleModel: z.string(),
    chargerType: z.string(), // "CCS", "CHAdeMO", "Type2"
    chargerPowerKw: z.number(),
  }),
  execute: async ({ context }) => {
    // Query database
    // Return: compatible, max_charging_speed, requires_adapter, notes
  },
});
```

---

### **Stage 4: Build Charging Time Calculator**
**Duration**: 1 week

**Purpose**: Answer "How long will it take to charge?"

**Inputs:**
- Vehicle model
- Current battery %
- Target battery %
- Charger power output
- Temperature (affects speed)

**Calculation:**
- Consider charging curve (speed drops after 80%)
- Factor in efficiency losses (10-15%)
- Adjust for temperature
- Give realistic estimate, not theoretical

**Tool:**
```typescript
export const chargingTimeCalculatorTool = createTool({
  id: 'calculate-charging-time',
  description: 'Calculate realistic charging time for an EV',
  inputSchema: z.object({
    vehicleId: z.number(),
    currentBatteryPercent: z.number(),
    targetBatteryPercent: z.number(),
    chargerPowerKw: z.number(),
    ambientTemperature: z.number().optional(),
  }),
  execute: async ({ context }) => {
    // Complex calculation with charging curves
    // Return: estimated_minutes, cost_estimate, breakdown
  },
});
```

---

### **Stage 5: Create Troubleshooting Decision Tree Database**
**Duration**: 2 weeks

**Purpose**: Systematic problem diagnosis

**Structure:**
```json
{
  "issue": "charging_wont_start",
  "questions": [
    {
      "id": 1,
      "question": "Is the cable locked into the car?",
      "yes": {"next": 2},
      "no": {"solution": "Check cable connection, ensure it clicks into place"}
    },
    {
      "id": 2,
      "question": "Does the station screen show any error?",
      "yes": {"next": 3},
      "no": {"next": 4}
    }
  ],
  "solutions": [...]
}
```

---

## **Phase 2: Enhanced Agent Intelligence (Stages 6-10)**

### **Stage 6: Implement Visual Recognition Tool**
**Duration**: 2 weeks

**Purpose**: Agent can identify charger type, error screens, connector types from photos

**Implementation:**
- Use GPT-4 Vision
- Train on dataset of:
  - Charger manufacturers (recognize logo/model)
  - Error screens (read error code)
  - Connector types (identify physical connector)
  - Damage assessment (detect visible issues)

**Tool:**
```typescript
export const identifyChargerFromImageTool = createTool({
  id: 'identify-charger-from-image',
  description: 'Identify charger manufacturer, model, and any visible issues from a photo',
  inputSchema: z.object({
    imageUrl: z.string(),
  }),
  execute: async ({ context }) => {
    const analysis = await analyzeImage(context.imageUrl, `
      Identify:
      1. Charger manufacturer and model (look for logos, model numbers)
      2. Connector types visible
      3. Any error messages on screen
      4. Visible damage or issues
      5. Power output rating (if visible)
    `);
    
    // Match against charger database
    // Return: manufacturer, model, identified_issues, recommendations
  },
});
```

---

### **Stage 7: Add Proactive Issue Detection**
**Duration**: 1 week

**Purpose**: Agent predicts issues before user asks

**Examples:**
- User says "charging is slow" → Check battery %, if >80% explain charging curve
- User mentions "Nissan Leaf" → Proactively mention CHAdeMO is needed
- User says "payment declined" → Immediately offer troubleshooting steps

**Implementation:**
```typescript
// In agent instructions
`
PROACTIVE DETECTION RULES:

1. If user mentions slow charging:
   - Ask current battery %
   - If >75%, explain: "This is normal! Charging slows down after 80% to protect battery"
   
2. If user has Nissan Leaf:
   - Alert: "Your Leaf uses CHAdeMO connector. Make sure the station has CHAdeMO (not just CCS)"
   
3. If user mentions "stuck cable":
   - Immediately offer: "I can unlock it remotely. What's the station number?"
   
4. If payment failed:
   - Don't just say "try again", ask: "Is this a foreign card? Some cards need 3D Secure verification"
`
```

---

### **Stage 8: Multi-Step Problem Solving**
**Duration**: 2 weeks

**Purpose**: Agent guides through complex issues systematically

**Example Flow:**
```
User: "My car won't charge"

Agent Step 1: Empathy + Initial Assessment
"I understand this is frustrating! Let's figure this out together. 
What's your car model and the station number?"

Agent Step 2: Gather Context
[Gets: Tesla Model 3, Station 12345]
[Checks station status: Available, CCS]
[Checks compatibility: ✓ Compatible]

Agent Step 3: Systematic Diagnosis
"Okay, your Model 3 should work fine here. Let's check a few things:
1. Is the cable firmly connected to your car?"

User: "Yes"

Agent Step 4: Narrow Down
"Good. Does your car screen show any message?"

User: "It says 'Unable to charge'"

Agent Step 5: Solution
"This usually means the station hasn't authorized yet. 
Did you start the session in the app?"

User: "Oh! No I didn't!"

Agent Step 6: Guide + Verify
"No problem! Open the app, select station 12345, and tap 'Start Charging'.
Let me know if it works!"
```

**Implementation:**
- Agent maintains conversation state
- Uses memory to track diagnostic progress
- Doesn't repeat questions
- Adapts based on user responses

---

### **Stage 9: Implement "Explain Like I'm 5" Mode**
**Duration**: 1 week

**Purpose**: Auto-detect when user needs ultra-simple explanations

**Triggers:**
- User asks basic questions like "which cable?"
- User says "I'm new to this"
- User asks multiple basic questions in a row

**Behavior:**
- Switch to ELI5 mode
- Use analogies (kW = water flow speed, kWh = bucket size)
- Provide step-by-step photos/diagrams
- Never assume knowledge
- Celebrate small wins ("Great job! You're doing it right!")

**Example:**
```
User: "I don't know which cable to use"

Agent (detects beginner):
"Welcome to EV charging! It's actually super simple - you don't need to choose a cable!

The cable is already attached to the charging station (it's the big thick cable hanging there).

Just:
1. Open the charging port on your car (usually a button or flap)
2. Grab the cable from the station
3. Plug it into your car (it only fits one way)
4. You'll hear a 'click' when it's in properly

Think of it like a gas pump - the 'hose' is already there!

Want me to walk you through it step by step? 😊"
```

---

### **Stage 10: Add Regional/Language Support**
**Duration**: 2 weeks

**Current**: Hebrew, English, Russian, Arabic
**Add**: 
- French (France, Belgium)
- German (Germany, Austria)
- Dutch (Netherlands)
- Italian (Italy)
- Spanish (Spain)
- Norwegian (Norway - highest EV adoption!)
- Swedish (Sweden)
- Danish (Denmark)

**Also**:
- Regional pricing info
- Local payment methods
- Country-specific regulations
- Regional charging networks (Ionity in EU, Electrify America in US)

---

## **Phase 3: Advanced Features (Stages 11-15)**

### **Stage 11: Build Cost Calculator & Optimizer**
**Duration**: 1 week

**Features:**
- "How much will this charge cost?"
- "Cheaper station nearby?"
- "Best time to charge?" (time-of-day pricing)
- "Monthly charging cost estimate"

**Tool:**
```typescript
export const costCalculatorTool = createTool({
  id: 'calculate-charging-cost',
  description: 'Calculate cost of charging session',
  inputSchema: z.object({
    stationId: z.string(),
    vehicleId: z.number(),
    targetBatteryPercent: z.number(),
  }),
  execute: async ({ context }) => {
    // Get station tariff
    // Calculate kWh needed
    // Factor in parking fees, session fees
    // Compare with nearby alternatives
    // Return: total_cost, breakdown, cheaper_alternatives
  },
});
```

---

### **Stage 12: Implement Predictive Maintenance**
**Duration**: 2 weeks

**Purpose**: Warn users about station issues before they arrive

**Data Sources:**
- Historical station reliability
- Recent error reports
- User feedback
- Station uptime data

**Agent Behavior:**
```
User: "I'm going to station 456"

Agent (checks data, sees 3 failures in last 2 days):
"⚠️ Heads up! Station 456 has had some issues lately (3 failures in 2 days).

I found a more reliable station just 200m away:
📍 Station 789 - 98% uptime this week, available now

Want directions to that one instead?"
```

---

### **Stage 13: Add Route Planning Tool**
**Duration**: 2 weeks

**Purpose**: Plan long trips with charging stops

**Features:**
- Calculate charging stops needed
- Recommend stations along route
- Factor in charging time (80% rule)
- Alternative routes if stations unavailable
- Real-time availability updates

**Tool:**
```typescript
export const routePlannerTool = createTool({
  id: 'plan-charging-route',
  description: 'Plan optimal charging stops for a long trip',
  inputSchema: z.object({
    vehicleId: z.number(),
    startLocation: z.string(),
    endLocation: z.string(),
    currentBatteryPercent: z.number(),
  }),
  execute: async ({ context }) => {
    // Calculate range
    // Find stations along route
    // Optimize: fewest stops, fastest charging
    // Return: route_plan with charging_stops[]
  },
});
```

---

### **Stage 14: Create "Learn Mode" for New EV Owners**
**Duration**: 1 week

**Purpose**: Proactive education for first-time users

**Features:**
- Detect first-time users
- Offer guided tutorial
- Explain concepts proactively
- Build confidence

**Example:**
```
Agent (detects new user):
"I see you just registered! Welcome to the EV charging community! 🎉

Would you like a quick 2-minute introduction to public charging? I'll explain:
- How to find and use charging stations
- Understanding charging speeds (AC vs DC)
- Best practices for your battery health
- How billing works

It'll save you time and confusion later. Interested?"
```

---

### **Stage 15: Implement Smart Notification System**
**Duration**: 1 week

**Purpose**: Proactive updates during charging

**Notifications:**
- "Your car is at 80%, perfect time to unplug and avoid parking fees!"
- "Charging complete! (45 min, 38 kWh, €15.20)"
- "Your session has been running for 3 hours. Did you forget to unplug?"
- "Lower rates start in 15 minutes (€0.25/kWh → €0.18/kWh). Want to wait?"

---

## **Phase 4: Enterprise Features (Stages 16-20)**

### **Stage 16: Build Analytics Dashboard**
**Duration**: 2 weeks

**Purpose**: Track agent performance and user patterns

**Metrics:**
- Common issues by frequency
- Resolution success rate
- Average conversation length
- User satisfaction ratings
- Peak usage times
- Station reliability scores

**Visualizations:**
- Issue type pie chart
- Resolution funnel
- User sentiment over time
- Station performance heatmap

---

### **Stage 17: Implement A/B Testing Framework**
**Duration**: 1 week

**Purpose**: Continuously improve agent responses

**Test:**
- Different greeting styles
- Technical vs simple language
- Proactive vs reactive approach
- Response length

**Measure:**
- Resolution rate
- User satisfaction
- Conversation length
- Escalation to human rate

---

### **Stage 18: Add Feedback Loop System**
**Duration**: 1 week

**Purpose**: Learn from every conversation

**Features:**
- After each conversation: "Was this helpful? Yes/No"
- If No: "What could I have done better?"
- Track which responses work best
- Flag conversations for review
- Update knowledge base based on feedback

---

### **Stage 19: Build Staff Training Mode**
**Duration**: 1 week

**Purpose**: Train human agents using AI insights

**Features:**
- AI suggests best responses to human agents
- Real-time guidance during complex issues
- Knowledge base search for agents
- Escalation handling

---

### **Stage 20: Implement Fraud Detection**
**Duration**: 2 weeks

**Purpose**: Detect and prevent abuse

**Patterns:**
- Multiple failed payment attempts
- Abnormally long sessions
- Account sharing
- Stolen RFID cards
- Unusual charging patterns

**Action:**
- Flag suspicious activity
- Require verification
- Temporary account lock
- Alert security team

---

## **Phase 5: Advanced Intelligence (Stages 21-25)**

### **Stage 21: Add Predictive Analytics**
**Duration**: 2 weeks

**Purpose**: Predict user needs before they ask

**Examples:**
- "Based on your charging pattern, you'll need a charge by tomorrow afternoon"
- "Your battery health seems lower than expected for a 2021 model. Want tips?"
- "You usually charge on Mondays. Station XYZ is under maintenance today, try ABC instead"

**Implementation:**
- Machine learning on user behavior
- Predictive modeling
- Proactive suggestions

---

### **Stage 22: Implement Multi-Modal Support**
**Duration**: 2 weeks

**Purpose**: Support images, voice, video

**Features:**
- Voice commands: "Start charging at station 123"
- Image analysis: Send photo of error screen
- Video guides: "Show me how to plug in"
- AR overlays: Point camera at charger, see instructions

---

### **Stage 23: Build Community Knowledge Base**
**Duration**: 2 weeks

**Purpose**: Learn from community

**Features:**
- User-submitted tips
- "This worked for me" solutions
- Station reviews and photos
- Real-world charging speeds
- Verified user contributions

**Moderation:**
- AI pre-screening
- Upvote/downvote system
- Human verification for critical info

---

### **Stage 24: Add Integration with Car APIs**
**Duration**: 3 weeks

**Purpose**: Direct access to vehicle data

**Integrations:**
- Tesla API
- BMW ConnectedDrive
- Mercedes me
- VW We Connect
- Ford FordPass

**Data Access:**
- Current battery level
- Charging status
- Location
- Optimal charge time (battery temperature)

**Privacy:**
- User consent required
- Data encryption
- Minimal data retention
- Clear privacy policy

---

### **Stage 25: Implement Autonomous Agent Actions**
**Duration**: 2 weeks

**Purpose**: Agent can take actions without user confirmation

**Actions** (with user permission):
- Auto-start charging when plugged in
- Auto-stop at optimal battery % (80%)
- Switch to cheaper station if available
- Pre-heat/cool battery before DC fast charge
- Reserve station before arrival
- Automatic payment

**Safety:**
- User sets preferences
- Spending limits
- Action confirmations
- Audit trail
- Easy disable

---

# Knowledge Database Structure

## **Comprehensive Schema**

```sql
-- ============================================
-- VEHICLES DATABASE
-- ============================================

CREATE TABLE ev_makes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  country VARCHAR(50),
  website_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ev_models (
  id SERIAL PRIMARY KEY,
  make_id INTEGER REFERENCES ev_makes(id),
  model_name VARCHAR(100) NOT NULL,
  year_from INTEGER,
  year_to INTEGER,
  body_type VARCHAR(50), -- Sedan, SUV, Hatchback, etc.
  is_phev BOOLEAN DEFAULT false, -- Plug-in Hybrid
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(make_id, model_name, year_from)
);

CREATE TABLE ev_variants (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES ev_models(id),
  variant_name VARCHAR(100), -- Long Range, Performance, etc.
  battery_size_kwh DECIMAL(6,2),
  usable_battery_kwh DECIMAL(6,2),
  range_wltp_km INTEGER,
  range_epa_km INTEGER,
  range_real_world_km INTEGER,
  
  -- AC Charging
  max_ac_1phase_kw DECIMAL(5,2),
  max_ac_3phase_kw DECIMAL(5,2),
  onboard_charger_type VARCHAR(50),
  ac_connector_type VARCHAR(20), -- Type2, Type1
  
  -- DC Charging
  max_dc_charging_kw DECIMAL(6,2),
  dc_connector_type VARCHAR(20), -- CCS, CHAdeMO
  charging_curve JSONB, -- {0: 150, 10: 150, 50: 120, 80: 50, 90: 30}
  
  -- Other specs
  efficiency_wh_per_km DECIMAL(6,2),
  typical_charging_0_to_80_minutes INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicle_common_issues (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER REFERENCES ev_variants(id),
  issue_category VARCHAR(100), -- charging, battery, software, etc.
  issue_description TEXT,
  symptoms TEXT,
  solution TEXT,
  severity VARCHAR(20), -- low, medium, high, critical
  frequency VARCHAR(20), -- rare, occasional, common
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CHARGERS DATABASE
-- ============================================

CREATE TABLE charger_manufacturers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  country VARCHAR(50),
  website_url TEXT,
  support_phone VARCHAR(50),
  support_email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE charger_models (
  id SERIAL PRIMARY KEY,
  manufacturer_id INTEGER REFERENCES charger_manufacturers(id),
  model_name VARCHAR(100) NOT NULL,
  model_code VARCHAR(50),
  
  -- Technical specs
  max_power_output_kw DECIMAL(6,2),
  connector_types JSONB, -- ["CCS", "CHAdeMO", "Type2"]
  simultaneous_charging BOOLEAN,
  dynamic_power_sharing BOOLEAN,
  
  -- Documentation
  installation_manual_url TEXT,
  user_manual_url TEXT,
  maintenance_guide_url TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(manufacturer_id, model_name)
);

CREATE TABLE charger_error_codes (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES charger_models(id),
  error_code VARCHAR(20) NOT NULL,
  error_description TEXT,
  possible_causes TEXT,
  troubleshooting_steps TEXT,
  requires_technician BOOLEAN DEFAULT false,
  severity VARCHAR(20), -- info, warning, error, critical
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE charger_reset_procedures (
  id SERIAL PRIMARY KEY,
  model_id INTEGER REFERENCES charger_models(id),
  reset_type VARCHAR(50), -- soft, hard, emergency, factory
  procedure_steps TEXT,
  estimated_duration_seconds INTEGER,
  requires_physical_access BOOLEAN,
  success_indicators TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STATIONS DATABASE (Your existing + enhanced)
-- ============================================

CREATE TABLE stations (
  id SERIAL PRIMARY KEY,
  station_code VARCHAR(50) UNIQUE NOT NULL,
  location_name VARCHAR(200),
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  charger_model_id INTEGER REFERENCES charger_models(id),
  installation_date DATE,
  last_maintenance DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE station_reliability_log (
  id SERIAL PRIMARY KEY,
  station_id INTEGER REFERENCES stations(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20), -- operational, faulted, maintenance, offline
  error_code VARCHAR(20),
  resolved_at TIMESTAMP,
  resolution_notes TEXT
);

-- ============================================
-- KNOWLEDGE BASE
-- ============================================

CREATE TABLE knowledge_articles (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100), -- getting-started, troubleshooting, battery-care, etc.
  title VARCHAR(200) NOT NULL,
  content TEXT,
  language VARCHAR(10) DEFAULT 'en',
  
  -- Rich content
  images JSONB, -- [{"url": "...", "caption": "..."}]
  videos JSONB,
  diagrams JSONB,
  
  -- SEO
  search_keywords TEXT[],
  related_articles INTEGER[], -- Article IDs
  
  -- Metadata
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE faq (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  language VARCHAR(10) DEFAULT 'en',
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE troubleshooting_flows (
  id SERIAL PRIMARY KEY,
  issue_name VARCHAR(200) NOT NULL,
  starting_symptoms TEXT,
  decision_tree JSONB, -- Complex JSON structure
  success_rate DECIMAL(5,2),
  avg_resolution_time_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- COMPATIBILITY MATRIX
-- ============================================

CREATE TABLE vehicle_charger_compatibility (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER REFERENCES ev_variants(id),
  charger_model_id INTEGER REFERENCES charger_models(id),
  is_compatible BOOLEAN,
  max_charging_speed_kw DECIMAL(6,2),
  requires_adapter BOOLEAN,
  adapter_type VARCHAR(100),
  notes TEXT,
  verified_by VARCHAR(100), -- community, manufacturer, tested
  verified_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(variant_id, charger_model_id)
);

-- ============================================
-- USER FEEDBACK & LEARNING
-- ============================================

CREATE TABLE conversation_feedback (
  id SERIAL PRIMARY KEY,
  thread_id VARCHAR(255) REFERENCES mastra_memory(thread_id),
  user_id VARCHAR(255),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  was_helpful BOOLEAN,
  feedback_text TEXT,
  issue_resolved BOOLEAN,
  resolution_time_minutes INTEGER,
  escalated_to_human BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE common_issues_tracker (
  id SERIAL PRIMARY KEY,
  issue_keyword VARCHAR(200),
  occurrence_count INTEGER DEFAULT 1,
  successful_resolution_count INTEGER DEFAULT 0,
  avg_resolution_time_minutes INTEGER,
  most_effective_solution TEXT,
  last_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_ev_models_make ON ev_models(make_id);
CREATE INDEX idx_ev_variants_model ON ev_variants(model_id);
CREATE INDEX idx_charger_models_manufacturer ON charger_models(manufacturer_id);
CREATE INDEX idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX idx_knowledge_language ON knowledge_articles(language);
CREATE INDEX idx_knowledge_search ON knowledge_articles USING GIN(search_keywords);
CREATE INDEX idx_station_location ON stations(latitude, longitude);
CREATE INDEX idx_compatibility_vehicle ON vehicle_charger_compatibility(variant_id);
CREATE INDEX idx_compatibility_charger ON vehicle_charger_compatibility(charger_model_id);
```

---

# Implementation Roadmap

## **Timeline Overview**

| Phase | Stages | Duration | Priority |
|-------|--------|----------|----------|
| Phase 1: Foundation | 1-5 | 8 weeks | 🔴 Critical |
| Phase 2: Intelligence | 6-10 | 8 weeks | 🟡 High |
| Phase 3: Advanced | 11-15 | 7 weeks | 🟢 Medium |
| Phase 4: Enterprise | 16-20 | 8 weeks | 🟢 Medium |
| Phase 5: AI Magic | 21-25 | 11 weeks | 🔵 Low |
| **Total** | **25 stages** | **~10 months** | |

---

## **Quick Wins (First 2 Months)**

Focus on these high-impact, achievable improvements:

1. ✅ **Vehicle Database** (Stage 1) - Most requested feature
2. ✅ **Charger Database** (Stage 2) - Critical for troubleshooting  
3. ✅ **Compatibility Tool** (Stage 3) - Answers 30% of questions instantly
4. ✅ **Charging Time Calculator** (Stage 4) - High engagement
5. ✅ **Visual Recognition** (Stage 6) - Wow factor + useful

---

## **Success Metrics**

Track these KPIs:

1. **Resolution Rate**: % of issues resolved without human escalation
   - Current: ~60%
   - Target after Stage 10: >85%
   - Target after Stage 25: >95%

2. **User Satisfaction**: Average rating after conversation
   - Current: 3.8/5
   - Target: 4.5/5

3. **Response Accuracy**: % of responses that are factually correct
   - Current: ~80%
   - Target: >95%

4. **Average Conversation Length**: Messages per resolution
   - Current: ~12 messages
   - Target: <8 messages

5. **Repeat Contact Rate**: Users coming back with same issue
   - Current: ~15%
   - Target: <5%

---

# Data Collection Strategy

## **Initial Data Seeding**

### **Priority 1: Top 50 EV Models** (Cover 80% of users)
- Tesla Model 3, Model Y, Model S, Model X
- Hyundai Ioniq 5, Ioniq 6, Kona Electric
- Kia EV6, EV9, Niro EV
- VW ID.3, ID.4, ID.5, ID.Buzz
- Nissan Leaf, Ariya
- BMW i4, iX, i3
- Mercedes EQA, EQB, EQC, EQE, EQS
- Audi e-tron, Q4 e-tron
- Polestar 2
- Volvo XC40 Recharge
- Ford Mustang Mach-E
- Porsche Taycan
- MG4, MG ZS EV
- Renault Zoe, Megane E-Tech
- Fiat 500e
- Mini Cooper SE
- Skoda Enyaq
- Cupra Born
- ... (35 more)

### **Priority 2: Top 20 Charger Models** (Cover 90% of your network)
- ABB Terra 54, Terra 124, Terra 184
- Delta DC City 25, DC City 50
- Kempower Satellite
- Tritium RTM, PKM50
- ChargePoint Express Plus
- EVBox Troniq Modular
- Alpitronic HYC150
- (Your specific deployed models)

### **Priority 3: Common Issues** (Top 100)
- Charging won't start (20 variations)
- Cable stuck (10 variations)
- Payment declined (15 variations)
- Slow charging (12 variations)
- App issues (10 variations)
- Station not found (5 variations)
- Error codes (28 most common codes)

---

# Maintenance Plan

## **Weekly Tasks**
- Review failed conversations
- Update knowledge base with new issues
- Add new EV models released
- Update charging speeds (real-world data)

## **Monthly Tasks**
- Analyze conversation metrics
- A/B test results review
- Update troubleshooting flows
- Add new charger models

## **Quarterly Tasks**
- Comprehensive knowledge base audit
- Agent personality/tone refinement
- Major feature releases
- User satisfaction survey

---

# Conclusion

This 25-stage plan will transform your agent from a basic support bot into the **most knowledgeable EV charging expert in the industry**.

**Key Success Factors:**
1. **Data Quality**: Accurate, comprehensive database
2. **Continuous Learning**: Feedback loops and updates
3. **User-Centric**: Solve real problems, not just answer questions
4. **Proactive**: Anticipate needs, don't just react
5. **Measurable**: Track metrics, iterate constantly

**Expected Outcomes:**
- 95%+ resolution rate
- <5 minute average resolution time
- 4.7/5 user satisfaction
- 80% reduction in human agent load
- Industry-leading customer experience

---

**Ready to build the smartest EV charging agent in the world?** 🚗⚡

Let's start with Phase 1!
