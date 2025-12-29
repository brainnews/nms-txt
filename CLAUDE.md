# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NMS.TXT** is a text-based space exploration game inspired by No Man's Sky, powered by the Claude API. Players crash-land on an alien planet and must repair their ship, explore procedurally generated worlds, and journey toward the galaxy's center through narrative gameplay and D&D-style dice mechanics.

The project is designed for e-ink devices (Boox Palma) and mobile phones with a minimal, high-contrast aesthetic optimized for readability and minimal screen refreshes.

## Architecture

**Tech Stack:**
- Single-file HTML architecture (index.html contains all HTML, CSS, and JavaScript)
- Node.js/Express proxy server (server.js) for local development, Cloudflare Functions for production
- Dual AI backend: Claude Messages API (premium) or WebLLM with Llama 3.2 (free, browser-based)
- marked.js for markdown rendering
- No build process or bundler

**Key Architectural Patterns:**

### 1. Single-File Design
All frontend code lives in `index.html` (~1500+ lines):
- Lines 1-500: HTML structure, CSS styles, e-ink optimizations
- Lines 500-700: Configuration constants (CLAUDE_CONFIG, STORAGE_KEYS, GAME_CONSTANTS, DIFFICULTY_DC, SYSTEM_PROMPT)
- Lines 700-850: Game state initialization and management
- Lines 850-1050: API communication and localStorage helpers
- Lines 1050-1175: Response parsing and state update logic
- Lines 1175-1500: Game loop, UI updates, event handlers
- Lines 1500+: Initialization and modal management

### 2. Claude API Integration via Proxy
- **Frontend** (`index.html`): Calls `/api/chat` endpoint
- **Proxy Server** (`server.js`): Forwards requests to `https://api.anthropic.com/v1/messages`
- API key stored in localStorage (base64 encoded for obfuscation, not security)
- Conversation history managed client-side with sliding window (last 20 messages)

### 3. Game Master System Prompt
Located in `getSystemPrompt()` function (~line 823) in `index.html`. This is the core "game engine" - it defines:
- Response format: `[STATE UPDATE]` and `[OPTIONS]` sections
- Dice roll mechanics (Easy DC 8, Medium DC 12, Hard DC 16, Very Hard DC 20)
- Skill system acknowledgment (Claude sees skill usage in roll results)
- Procedural generation rules
- Tone and pacing guidelines
- Game rules (no progression skipping, resource requirements, death mechanics)

**Modifying game behavior requires updating the system prompt string in `getSystemPrompt()`.**

### 4. Response Parsing Architecture
Claude responses follow a structured format parsed by `parseGameMasterResponse()` (~line 1508):

```
[Narrative text with markdown formatting]

[STATE UPDATE]
Ship: +5% | Fuel: +10 | Inventory: +Iron x5

[OPTIONS]
1. Explore the crash site (Easy)
2. Search for water (Medium)
3. Climb the nearby cliff (Hard)
```

Parser extracts:
- `parsed.narrative` - Main story text (rendered as markdown)
- `parsed.stateUpdate` - Changes to ship health, fuel, inventory
- `parsed.options` - Player action choices with difficulty levels

### 5. Game State Structure
`gameState` object (~line 894) contains:
- **currentLocation**: Planet name, type, system, distance from center
- **ship**: Health percentage, fuel amount
- **inventory**: Key-value pairs of resources (iron, carbon, plutonium, etc.)
- **skills**: Four skills (survival, technology, exploration, combat) with point totals
- **conversationHistory**: Array of Claude API messages (pruned to last 20)
- **actionHistory**: Player action log (last 50 actions)
- **stats**: Planets visited, aliens encountered, resources gathered, distance traveled
- **currentNarrative**: Current story text
- **currentOptions**: Available player actions

### 6. Save System
- **5 manual save slots** (localStorage keys: `nmstxt_save_1` through `nmstxt_save_5`)
- **1 auto-save slot** (localStorage key: `nmstxt_save_0`)
- Auto-save triggers every 30 seconds (debounced) and on window close
- Each save includes full game state + metadata (location, stats, timestamp)
- 4.5MB size limit enforced

### 7. WebLLM Integration (Dual AI Mode)
The game supports two AI backends, selectable in settings:

**Claude API Mode (Premium):**
- Best narrative quality using Claude Haiku 3.5 (cost-optimized for concise mode)
- Requires API key from console.anthropic.com
- Proxied through `/api/chat` endpoint (Express locally, Cloudflare Functions in production)
- API key stored in localStorage (base64 encoded)
- Current model: `claude-3-5-haiku-20241022` (67% cheaper than Sonnet, perfect for short narratives)

**WebLLM Mode (Free):**
- Runs Llama 3.2 3B entirely in the browser using WebAssembly
- ~2GB model download on first use (cached afterward)
- No API costs, works offline after initial download
- Slightly simpler narratives but fully functional

**Implementation Details:**
- WebLLM module loaded dynamically via ES module import (~line 1010)
- `callAI()` function (~line 1389) routes to appropriate backend based on `settings.aiModel`
- Model initialization handled in `initializeWebLLM()` (~line 1010)
- Progress tracking displayed during model download
- Both modes use the same game master system prompt for consistency

**Key Functions:**
- `initializeWebLLM()` - Loads WebLLM library and downloads model
- `callWebLLM()` - Sends messages to browser-based LLM
- `callClaudeBackend()` - Sends messages to Claude API via proxy
- `callAI()` - Main entry point that routes to correct backend

### 8. Skill System
Players develop 4 skills through successful actions:

**Skills:**
- **Survival** (🛡️) - Gathering resources, hazard resistance, health management
- **Technology** (🔧) - Repairs, crafting, hacking, ship systems
- **Exploration** (🔭) - Navigation, discovery, investigation, scouting
- **Combat** (⚔️) - Fighting, defense, weapon use

**Mechanics:**
1. **Skill Detection:** `detectSkillFromAction()` (~line 1299) uses keyword matching to determine which skill applies to an action
2. **Point Spending:** Before rolling, players can spend 1-5 skill points for +1 to +5 bonus to their roll
3. **Point Earning:** On success, players earn points based on **margin of success** (total roll - DC, minimum 1)
   - Example: DC 12, roll 15 → earn 3 points
   - Example: DC 8, roll 10 → earn 2 points
4. **Modal Flow:** When an action has difficulty, the skill spending modal appears before the roll

**Key Functions:**
- `detectSkillFromAction(actionText)` - Analyzes action text to determine which skill applies
- `awardSkillPoints(skillName, diceRollResult)` - Awards points based on margin of success (~line 1365)
- `showSkillSpendModal()` - Displays UI for spending points before rolling (~line 1943)
- `calculateSkillBonus(skillName)` - Returns current skill level bonus (unused in new points system) (~line 1356)

**State Structure:**
```javascript
skills: {
    survival: { level: 1, xp: 0, points: 0 },
    technology: { level: 1, xp: 0, points: 0 },
    exploration: { level: 2, xp: 0, points: 0 },
    combat: { level: 1, xp: 0, points: 0 }
}
```

Note: `level` and `xp` are legacy fields kept for save compatibility. The active system uses `points` only.

### 9. E-ink Optimization Strategy
CSS optimizations for e-ink displays:
- High contrast: `#FEFEF8` background, `#1A1A1A` text
- Serif font (Georgia) at 20px with 1.8 line height
- **Zero animations or transitions** (prevents ghosting)
- Static layout with batched DOM updates
- 48px minimum touch targets
- Generous spacing throughout

## Development Workflow

### Running the Application Locally

```bash
# Install dependencies (first time only)
npm install

# Start the server (auto-finds available port, defaults to 3000)
npm start

# Access the game
# Desktop: http://localhost:3000
# Mobile/E-ink: http://<YOUR_LOCAL_IP>:3000
```

**Find your local IP:**
```bash
ifconfig | grep "inet "
```

**Server Features:**
- Automatically finds available port if 3000 is in use
- Logs all API requests for debugging
- Handles CORS for local development

### Testing on E-ink Devices
The Boox Palma (or other e-ink readers) can access the game over local network:
1. Ensure device and computer are on same WiFi
2. Find your computer's local IP address
3. On e-ink device, navigate to `http://<YOUR_IP>:3000`
4. Enter Claude API key when prompted
5. API key persists in device localStorage

### Deployment to Production

The game is deployed to Cloudflare Pages with Cloudflare Functions:

**Live URL:** https://nms.milesgilbert.xyz

**Deployment Process:**
1. Push changes to GitHub (main branch)
2. Cloudflare Pages automatically deploys
3. No build process required (static files served as-is)
4. `/functions/api/chat.js` becomes serverless endpoint at `/api/chat`

**Cloudflare Function:**
- Handles API proxy in production (replaces local Express server)
- Supports CORS preflight (OPTIONS requests)
- Same functionality as `server.js` but serverless
- Location: `functions/api/chat.js`

## Important Implementation Details

### Claude API Response Format Requirements
The SYSTEM_PROMPT expects Claude to return responses in this exact format:

```
[Narrative text]

[STATE UPDATE]
Ship: +5% | Fuel: +10 | Inventory: +Iron x5, +Carbon x3

[OPTIONS]
1. Action text (Difficulty)
2. Action text (Difficulty)
```

**If Claude doesn't follow this format, the parser will fail.** When debugging response parsing issues:
1. Check `parseGameMasterResponse()` function (~line 1508)
2. Verify regex patterns match Claude's actual output
3. Console.log the raw response to see format deviations

### Dice Roll System
Rolls happen client-side in `performSkillCheck()` (~line 1250):
- D20 roll (1-20)
- Player can spend skill points before rolling for bonuses (+1 to +5)
- Total = roll + bonus (from spent points)
- Compared against difficulty class (DC)
- Results: "critical success" (natural 20), "success" (total ≥ DC), "failure" (total < DC), "critical failure" (natural 1)
- Result passed to Claude in user message for narrative integration
- On success, skill points awarded based on margin of success (total - DC, minimum 1)

**Dice Animation Flow:**
1. Player submits action → `animateDiceRoll()` shows random numbers for 1.1 seconds (~line 1280)
2. Animation ends → displays actual roll result
3. After 0.5s delay → skill points earned appear (if successful)
4. All animation happens asynchronously while AI generates story

### Inventory Update Logic
`applyStateUpdates()` function (~line 1693) handles state changes:
- Dynamically creates new inventory items if they don't exist
- Uses `Math.max(0, value)` to prevent negative values
- Updates stats counters (resourcesGathered, planetsVisited, etc.)

**Common bug:** Forgetting to initialize new item types will cause items to disappear. Always check that `gameState.inventory[item] === undefined` before setting initial value.

### Markdown Rendering
Uses marked.js library (loaded from CDN) configured at ~line 785:
```javascript
marked.setOptions({
    breaks: true,        // Convert \n to <br>
    gfm: true,          // GitHub Flavored Markdown
    headerIds: false    // Don't generate header IDs
});
```

Narrative is rendered with `marked.parse()` in `updateGameUI()` at ~line 1849.

### Conversation History Pruning
`pruneConversationHistory()` (~line 1686) keeps only last 20 messages to prevent token limit issues:
- System prompt always included (not counted in 20)
- Older messages removed from gameState.conversationHistory
- Full history still saved in save files for reference

## File Structure

```
nms-txt/
├── index.html          # Complete frontend (HTML + CSS + JS in one file)
├── server.js           # Express proxy server for Claude API
├── package.json        # Node.js dependencies (express, cors)
└── package-lock.json   # Dependency lock file
```

## Common Modifications

### Changing Game Difficulty
Edit difficulty constants at ~line 729:
```javascript
const DIFFICULTY_DC = {
    easy: 8,      // 65% success rate
    medium: 12,   // 45% success rate
    hard: 16,     // 25% success rate
    'very hard': 20  // 5% success rate (natural 20 only)
};
```

### Adjusting Claude Model or Settings
Edit configuration at ~line 804:
```javascript
const CLAUDE_CONFIG = {
    apiEndpoint: '/api/chat',
    model: 'claude-3-5-haiku-20241022',  // Current: Haiku 3.5 (cost-optimized)
    maxTokens: 1024,                     // Reduced from 2048 for concise mode
    temperature: 0.8,
    apiVersion: '2023-06-01'
};
```

**Available Models:**
- `claude-3-5-haiku-20241022` - Fastest, cheapest, perfect for concise narratives (current)
- `claude-sonnet-4-5-20250929` - Better quality, 67% more expensive
- `claude-opus-4-5-20251101` - Best quality, 5x more expensive

**Note:** Model ID must be exact. Check [Anthropic docs](https://docs.anthropic.com/en/docs/about-claude/models) for current model names.

### Modifying Save Behavior
Edit constants at ~line 722:
```javascript
const GAME_CONSTANTS = {
    maxConversationHistory: 20,     // Messages kept in memory
    maxActionHistory: 50,           // Actions logged
    autoSaveDelay: 30000,           // 30 seconds
    maxSaveSize: 4.5 * 1024 * 1024  // 4.5MB localStorage limit
};
```

### Adding New Inventory Items
No code changes needed - items are dynamically created when Claude mentions them in `[STATE UPDATE]` sections. The parser will automatically add new items to `gameState.inventory` object.

### Modifying Skill System Behavior

**Change skill point earning rate:**
Edit `awardSkillPoints()` function (~line 1365):
```javascript
// Current: margin-based (roll - DC, minimum 1)
const pointsEarned = Math.max(1, marginOfSuccess);

// Faster progression: double the margin
const pointsEarned = Math.max(1, marginOfSuccess * 2);

// Fixed rate: always 2 points
const pointsEarned = 2;
```

**Adjust maximum spendable points:**
Edit skill spending modal setup (~line 1951):
```javascript
slider.max = Math.min(5, available); // Current: max 5
slider.max = Math.min(10, available); // Allow spending up to 10
```

**Add or modify skill keywords:**
Edit `detectSkillFromAction()` (~line 1299) keyword arrays:
```javascript
const combatKeywords = [
    'attack', 'fight', 'shoot', // ... add new keywords here
];
```

**Change starting skill points:**
Edit `createInitialGameState()` (~line 894):
```javascript
skills: {
    survival: { level: 1, xp: 0, points: 5 },  // Start with 5 points
    technology: { level: 1, xp: 0, points: 5 },
    exploration: { level: 2, xp: 0, points: 10 }, // Give exploration more
    combat: { level: 1, xp: 0, points: 5 }
}
```

### Switching AI Backends

**Default to WebLLM mode:**
Edit `getSettings()` default (~line 974):
```javascript
const defaults = {
    fontSize: 20,
    autoSave: true,
    narrativeLength: 'regular',
    aiModel: 'webllm' // Changed from 'claude'
};
```

**Use different WebLLM model:**
Edit `initializeWebLLM()` (~line 1037):
```javascript
// Current model:
webllmEngine = await webllmModule.CreateMLCEngine(
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    // ...
);

// Other options (check WebLLM docs for available models):
// "Llama-3.2-1B-Instruct-q4f16_1-MLC" (smaller, faster)
// "Phi-3.5-mini-instruct-q4f16_1-MLC" (alternative small model)
```

### Changing E-ink Optimization Level
To prioritize responsiveness over e-ink optimization, edit CSS at ~line 40:
```css
* {
    transition: none !important;  /* Remove this line to enable transitions */
    animation: none !important;   /* Remove this line to enable animations */
}
```

## Server Configuration

### Local Development Server (`server.js`)
The Express proxy server is minimal by design:
- Auto-finds available port (defaults to 3000, tries 3001, 3002, etc. if occupied)
- 10MB JSON body limit for large conversation histories
- CORS enabled for all origins
- Single endpoint: `POST /api/chat`
- Debug logging for requests and errors

**Why the proxy exists:** Claude API doesn't allow direct browser requests due to CORS policy. The proxy forwards requests server-side.

### Production Server (`functions/api/chat.js`)
Cloudflare Function handles API proxy in production:
- Serverless, auto-scales
- Same functionality as local Express server
- Handles CORS preflight (OPTIONS requests)
- Available at `/api/chat` on deployed site

## Debugging Tips

### API Key Issues
- Check localStorage: `localStorage.getItem('nmstxt_api_key')`
- Key is base64 encoded: `atob(encodedKey)` to decode
- Clear key: `localStorage.removeItem('nmstxt_api_key')`

### State Corruption
- Save files can become corrupted if localStorage quota exceeded
- Check save size: `JSON.stringify(gameState).length`
- Maximum safe size: 4.5MB
- Clear corrupted save: `localStorage.removeItem('nmstxt_save_0')`

### Conversation History Too Large
- Check message count: `gameState.conversationHistory.length`
- Should never exceed 20 (plus system prompt)
- If larger, pruning function isn't working - check `pruneConversationHistory()` at ~line 1686

### Markdown Not Rendering
- Verify marked.js loaded: check browser console for 404 errors on CDN script
- Check markdown parsing: `marked.parse('**test**')` in console
- Verify narrative element updates in `updateGameUI()` at ~line 1849

### Skill System Issues
- **Points not awarded:** Check console for skill progress logs (`✨ [Skill] earned X point(s)`)
- **Wrong skill detected:** Console shows which skill was applied in dice roll display
- **Inspect current points:** `gameState.skills` in console shows all skill point totals
- **Modal not appearing:** Check that action has a difficulty assigned (Easy/Medium/Hard/Very Hard)
- **Can't spend points:** Verify `gameState.skills[skillName].points > 0` in console

### WebLLM Issues
- **Model won't load:** Check browser console for WebLLM errors
- **Slow first load:** Model download is ~2GB, can take 5-10 minutes on slow connections
- **Out of memory:** WebLLM requires ~4GB RAM available, won't work on low-end devices
- **Check initialization:** `isWebLLMInitialized` variable should be `true` after first use
- **Switch back to Claude:** Change AI model in settings if WebLLM fails
- **Browser compatibility:** WebLLM requires WebAssembly and WebGPU support (Chrome/Edge work best)

## Browser Compatibility

- Chrome, Firefox, Safari (desktop)
- iOS Safari, Android Chrome (mobile with touch support)
- E-ink browsers (tested on Boox Palma)
- Requires Web Storage API (localStorage)
- Requires modern JavaScript (ES6+: arrow functions, template literals, async/await)
