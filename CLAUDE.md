# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NMS.TXT** is a text-based space exploration game inspired by No Man's Sky, powered by the Claude API. Players crash-land on an alien planet and must repair their ship, explore procedurally generated worlds, and journey toward the galaxy's center through narrative gameplay and D&D-style dice mechanics.

The project is designed for e-ink devices (Boox Palma) and mobile phones with a minimal, high-contrast aesthetic optimized for readability and minimal screen refreshes.

## Architecture

**Tech Stack:**
- Single-file HTML architecture (index.html contains all HTML, CSS, and JavaScript)
- Node.js/Express proxy server (server.js) to bypass CORS restrictions for Claude API
- Claude Messages API for game narration and procedural generation
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
Located at ~line 737 in `index.html`. This is the core "game engine" - it defines:
- Response format: `[STATE UPDATE]` and `[OPTIONS]` sections
- Dice roll mechanics (Easy DC 8, Medium DC 12, Hard DC 16, Very Hard DC 20)
- Procedural generation rules
- Tone and pacing guidelines
- Game rules (no progression skipping, resource requirements, death mechanics)

**Modifying game behavior requires updating the SYSTEM_PROMPT constant.**

### 4. Response Parsing Architecture
Claude responses follow a structured format parsed by `parseGameMasterResponse()` (~line 1053):

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
`gameState` object (~line 786) contains:
- **currentLocation**: Planet name, type, system, distance from center
- **ship**: Health percentage, fuel amount
- **inventory**: Key-value pairs of resources (iron, carbon, plutonium, etc.)
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

### 7. E-ink Optimization Strategy
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

# Start the server (runs on port 3000)
npm start

# Access the game
# Desktop: http://localhost:3000
# Mobile/E-ink: http://<YOUR_LOCAL_IP>:3000
```

**Find your local IP:**
```bash
ifconfig | grep "inet "
```

### Testing on E-ink Devices
The Boox Palma (or other e-ink readers) can access the game over local network:
1. Ensure device and computer are on same WiFi
2. Find your computer's local IP address
3. On e-ink device, navigate to `http://<YOUR_IP>:3000`
4. Enter Claude API key when prompted
5. API key persists in device localStorage

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
1. Check `parseGameMasterResponse()` function (~line 1053)
2. Verify regex patterns match Claude's actual output
3. Console.log the raw response to see format deviations

### Dice Roll System
Rolls happen client-side in `performSkillCheck()` (~line 960):
- D20 roll (1-20)
- Compared against difficulty class (DC)
- Results: "critical success" (20), "success" (≥ DC), "failure" (< DC), "critical failure" (1)
- Result passed to Claude in user message for narrative integration

### Inventory Update Logic
`applyStateUpdates()` function (~line 1093) handles state changes:
- Dynamically creates new inventory items if they don't exist
- Uses `Math.max(0, value)` to prevent negative values
- Updates stats counters (resourcesGathered, planetsVisited, etc.)

**Common bug:** Forgetting to initialize new item types will cause items to disappear. Always check that `gameState.inventory[item] === undefined` before setting initial value.

### Markdown Rendering
Uses marked.js library (loaded from CDN) configured at ~line 1580:
```javascript
marked.setOptions({
    breaks: true,        // Convert \n to <br>
    gfm: true,          // GitHub Flavored Markdown
    headerIds: false    // Don't generate header IDs
});
```

Narrative is rendered with `marked.parse()` at line ~1265.

### Conversation History Pruning
`pruneConversationHistory()` (~line 1034) keeps only last 20 messages to prevent token limit issues:
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
Edit configuration at ~line 705:
```javascript
const CLAUDE_CONFIG = {
    apiEndpoint: '/api/chat',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.8,
    apiVersion: '2023-06-01'
};
```

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

### Changing E-ink Optimization Level
To prioritize responsiveness over e-ink optimization, edit CSS at ~line 40:
```css
* {
    transition: none !important;  /* Remove this line to enable transitions */
    animation: none !important;   /* Remove this line to enable animations */
}
```

## Server Configuration

The proxy server (`server.js`) is minimal by design:
- Port 3000 (hardcoded)
- 10MB JSON body limit for large conversation histories
- CORS enabled for all origins
- Single endpoint: `POST /api/chat`

**Why the proxy exists:** Claude API doesn't allow direct browser requests due to CORS policy. The proxy forwards requests server-side.

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
- If larger, pruning function isn't working - check `pruneConversationHistory()` at ~line 1034

### Markdown Not Rendering
- Verify marked.js loaded: check browser console for 404 errors on CDN script
- Check markdown parsing: `marked.parse('**test**')` in console
- Verify narrative element updates in `updateGameUI()` at ~line 1265

## Browser Compatibility

- Chrome, Firefox, Safari (desktop)
- iOS Safari, Android Chrome (mobile with touch support)
- E-ink browsers (tested on Boox Palma)
- Requires Web Storage API (localStorage)
- Requires modern JavaScript (ES6+: arrow functions, template literals, async/await)
