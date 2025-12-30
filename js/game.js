// ===== MARKDOWN CONFIGURATION =====
// Configure marked.js for clean, e-ink friendly rendering
marked.setOptions({
    breaks: true,        // Convert \n to <br>
    gfm: true,           // GitHub Flavored Markdown
    headerIds: false,    // Don't add IDs to headers (cleaner HTML)
    mangle: false        // Don't escape email addresses
});

// ===== CONFIGURATION CONSTANTS =====
const CLAUDE_CONFIG = {
    apiEndpoint: '/api/chat', // Proxy endpoint
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 1024,
    temperature: 0.8,
    apiVersion: '2023-06-01'
};

const STORAGE_KEYS = {
    apiKey: 'nmstxt_api_key',
    settings: 'nmstxt_settings',
    autoSave: 'nmstxt_save_0',
    savePrefix: 'nmstxt_save_'
};

const GAME_CONSTANTS = {
    maxConversationHistory: 20,
    maxActionHistory: 50,
    autoSaveDelay: 30000, // 30 seconds
    maxSaveSize: 4.5 * 1024 * 1024 // 4.5MB
};

const DIFFICULTY_DC = {
    easy: 6,        // ~75% success (was 8, 65%)
    medium: 9,      // ~60% success (was 12, 45%)
    hard: 13,       // ~40% success (was 16, 25%)
    'very hard': 17 // ~20% success (was 20, 5%)
};

const STARTING_SCENARIOS = [
    {
        id: 'crash_landing',
        name: 'Crash Landing',
        shipHealth: 15,
        fuel: 0,
        inventory: {},
        prompt: 'Begin the game. The player wakes up disoriented inside their crashed ship on a strange alien planet. The hull is breached, alarms are blaring, and acrid smoke fills the cockpit. Describe their immediate surroundings as they stumble out of the wreckage.',
        systemContext: 'Crashed on random planet, ship 15% functional, no fuel'
    },
    {
        id: 'adrift_space',
        name: 'Adrift in Space',
        shipHealth: 40,
        fuel: 5,
        inventory: { plutonium: 3, carbon: 2 },
        prompt: 'Begin the game. The player awakens from cryosleep aboard their drifting ship. Life support is failing, the engines are offline, and they are floating in space near an unknown planet. Describe the eerie silence of the ship and the strange world visible through the viewport.',
        systemContext: 'Adrift in space near planet, ship 40% functional, minimal fuel'
    },
    {
        id: 'underwater_pod',
        name: 'Underwater Escape Pod',
        shipHealth: 5,
        fuel: 0,
        inventory: { oxygen: 50 },
        prompt: 'Begin the game. The player is trapped in an emergency escape pod that has crashed into an alien ocean. Water is slowly leaking in, emergency lights are flickering red, and through the small window they can see bizarre aquatic life forms circling. They must reach the surface and find land. Describe this desperate situation.',
        systemContext: 'Trapped in escape pod in alien ocean, ship 5% functional, critical oxygen supply'
    },
    {
        id: 'derelict_freighter',
        name: 'Derelict Freighter',
        shipHealth: 30,
        fuel: 15,
        inventory: { iron: 10, zinc: 5 },
        prompt: 'Begin the game. The player wakes up in the cargo bay of an abandoned freighter orbiting a dead planet. Their small ship is docked nearby but damaged. The freighter is dark, filled with debris, and something is making scratching sounds in the corridors. Describe this ominous awakening.',
        systemContext: 'Aboard derelict freighter, ship 30% functional, limited fuel'
    },
    {
        id: 'alien_study',
        name: 'Alien Research Facility',
        shipHealth: 50,
        fuel: 20,
        inventory: { nanites: 5 },
        prompt: 'Begin the game. The player regains consciousness on a cold metallic table in a sterile alien laboratory. Strange beings with too many eyes are observing them, taking notes in an incomprehensible language. Medical instruments hover nearby. Through a translucent wall, they can see their ship intact in a containment field. Describe this unsettling moment of awakening.',
        systemContext: 'Being studied by aliens in clinical facility, ship 50% functional and intact'
    },
    {
        id: 'frozen_tundra',
        name: 'Frozen Wasteland',
        shipHealth: 25,
        fuel: 8,
        inventory: { heridium: 7, titanium: 3 },
        prompt: 'Begin the game. The player awakens to freezing cold inside their ship on an ice world. Frost covers every surface, the heating system is failing, and howling winds batter the hull. Through the viewport, they see strange ice formations and what might be caves. Describe this frozen nightmare.',
        systemContext: 'Crashed on ice world, ship 25% functional, heating failing'
    }
];

// ===== SYSTEM PROMPT =====
function getSystemPrompt() {
    const settings = getSettings();
    const narrativeInstructions = {
        concise: 'MAXIMUM 300 characters total (approximately 3-4 sentences). Be extremely brief and direct. This is a hard limit.',
        regular: 'EXACTLY 1-2 paragraphs. Be concise but vivid. Do NOT exceed 2 paragraphs.'
    };

    const instruction = narrativeInstructions[settings.narrativeLength] || narrativeInstructions.regular;

    console.log('📝 Narrative Length Setting:', settings.narrativeLength);
    console.log('📝 Instruction Being Sent:', instruction);

    return `You are the Game Master for NMS.TXT, a text-based space exploration game inspired by No Man's Sky.

CORE RULES:
1. Players CANNOT skip progression - they must overcome challenges
2. Starting conditions vary (crash landing, space drift, underwater pod, derelict freighter, alien study, frozen wasteland)
3. Ultimate goal: Repair ship → explore galaxy → reach center
4. Procedural generation: Every planet, alien, event is unique
5. Death is possible - actions have consequences

GAME MECHANICS YOU MUST ENFORCE:
- Dice rolls for difficulty: Easy (DC 6), Medium (DC 9), Hard (DC 13), Very Hard (DC 17)
- When player takes action that requires skill check, the roll result will be provided
- Resources required for repairs: specific amounts needed
- Fuel consumption: warp jumps require plutonium
- Alien encounters: varied species with unique languages/behaviors
- Hazards: toxic atmosphere, extreme heat/cold, radiation, hostile fauna

SKILL SYSTEM:
- Players have 4 skills: Survival, Technology, Exploration, Combat
- Skills provide bonuses to dice rolls (+1 to +10)
- Skills improve through successful use (shown in roll results)
- When you see "[Exploration +3]" in dice results, acknowledge the player's growing expertise

RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:
1. Narrative description (${instruction})
2. If dice roll result was provided, narrate the outcome (success/failure/critical)
3. [STATE UPDATE] section with changes (if any)
   Format: "Ship: +5% | Fuel: +10 | Inventory: +Iron x5"
4. [OPTIONS] section with 3-4 numbered choices
   Format: "1. [Action text] (Difficulty)"

EXAMPLE RESPONSE:
You wake up disoriented, your ship's emergency systems blaring. The crash site is surrounded by strange purple vegetation.

[STATE UPDATE]
Ship: +0% | Fuel: +0 | Inventory: +0

[OPTIONS]
1. Search the wreckage for salvageable parts (Easy)
2. Explore the nearby alien structures (Medium)
3. Attempt to repair the ship's communications array (Hard)
4. Hunt for food and water (Easy)

CRITICAL: Always end with [OPTIONS] section. Always include difficulty in parentheses.

TONE: Atmospheric, mysterious, sometimes humorous, always engaging
PACING: Progressive difficulty, early game easier, late game challenging
VARIETY: Mix combat, exploration, puzzles, diplomacy, survival

Current game state will be provided in each message.`;
}

// ===== STATE VARIABLES =====
let gameState = null;
let autoSaveTimeout = null;
let isProcessingAction = false;
let pendingAction = null; // Stores action info while skill spending modal is open
let logCounter = 0; // Track narrative log number
let webllmEngine = null;
let webllmModule = null;
let isWebLLMInitialized = false;

// ===== GAME STATE INITIALIZATION =====
function createInitialGameState() {
    return {
        version: '1.0.0',
        saveSlot: 0,
        lastSaved: Date.now(),

        currentLocation: {
            planetName: 'Unknown',
            planetType: 'unknown',
            systemName: 'Unknown',
            distanceFromCenter: 715342
        },

        ship: {
            health: 15,
            fuel: 0,
            warpCapable: false,
            launchCapable: false
        },

        inventory: {
            carbon: 0,
            iron: 0,
            plutonium: 0,
            heridium: 0,
            zinc: 0,
            titanium: 0
        },

        conversationHistory: [],

        currentNarrative: '',
        currentOptions: [],

        stats: {
            planetsVisited: 1,
            aliensEncountered: 0,
            resourcesGathered: 0,
            jumpsCompleted: 0,
            deathCount: 0,
            actionsToken: 0
        },

        skills: {
            survival: { level: 1, xp: 0, points: 0 },
            technology: { level: 1, xp: 0, points: 0 },
            exploration: { level: 2, xp: 0, points: 0 },
            combat: { level: 1, xp: 0, points: 0 }
        },

        actionHistory: []
    };
}

// ===== STORAGE & API KEY MANAGEMENT =====
function getApiKey() {
    const encoded = localStorage.getItem(STORAGE_KEYS.apiKey);
    if (!encoded) return null;
    try {
        return atob(encoded);
    } catch (e) {
        return null;
    }
}

function saveApiKey(key) {
    const encoded = btoa(key);
    localStorage.setItem(STORAGE_KEYS.apiKey, encoded);
}

function clearApiKey() {
    localStorage.removeItem(STORAGE_KEYS.apiKey);
}

function importApiKeyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const keyParam = urlParams.get('key');

    if (keyParam && keyParam.trim()) {
        // Validate key format (basic check for Anthropic key)
        if (keyParam.startsWith('sk-ant-')) {
            saveApiKey(keyParam.trim());

            // Remove parameter from URL without page reload
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            console.log('✓ API key imported from URL and saved to localStorage');
            return true;
        } else {
            console.warn('⚠ Invalid API key format in URL parameter');
            return false;
        }
    }

    return false;
}

// ===== SETTINGS MANAGEMENT =====
function getSettings() {
    const defaults = {
        fontSize: 20,
        autoSave: true,
        narrativeLength: 'concise',
        aiModel: 'claude', // 'claude' or 'webllm'
        einkMode: false
    };

    const stored = localStorage.getItem(STORAGE_KEYS.settings);
    if (!stored) return defaults;

    try {
        const settings = { ...defaults, ...JSON.parse(stored) };

        // Migrate old narrative length settings
        if (settings.narrativeLength === 'brief') {
            settings.narrativeLength = 'regular';
        } else if (settings.narrativeLength === 'standard' || settings.narrativeLength === 'detailed') {
            settings.narrativeLength = 'regular';
        }

        return settings;
    } catch (e) {
        return defaults;
    }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    applySettings(settings);
}

function applySettings(settings) {
    document.body.style.fontSize = settings.fontSize + 'px';

    // Apply or remove e-ink mode
    if (settings.einkMode) {
        document.body.classList.add('eink-mode');
    } else {
        document.body.classList.remove('eink-mode');
    }
}

// ===== WEBLLM INTEGRATION =====
async function initializeWebLLM() {
    if (isWebLLMInitialized && webllmEngine) {
        return true;
    }

    try {
        console.log('🤖 Initializing WebLLM...');
        showModelLoading('Loading WebLLM library...');

        // Dynamically import WebLLM module
        if (!webllmModule) {
            console.log('📦 Importing WebLLM module from CDN...');
            webllmModule = await import('https://esm.run/@mlc-ai/web-llm');
            console.log('✅ WebLLM module loaded:', Object.keys(webllmModule));
        }

        showModelLoading('Initializing AI model...');

        const initProgressCallback = (progress) => {
            console.log('📥 Model loading progress:', progress);
            if (progress.text) {
                updateModelLoadingProgress(progress.text);
            }
        };

        // Create engine with Llama model (better for narrative generation)
        console.log('🔧 Creating MLC Engine...');
        webllmEngine = await webllmModule.CreateMLCEngine(
            "Llama-3.2-3B-Instruct-q4f16_1-MLC",
            {
                initProgressCallback: initProgressCallback,
                logLevel: "INFO"
            }
        );

        isWebLLMInitialized = true;
        hideModelLoading();
        console.log('✅ WebLLM initialized successfully');
        return true;

    } catch (error) {
        console.error('❌ WebLLM initialization failed:', error);
        console.error('Error stack:', error.stack);
        hideModelLoading();
        showError('Failed to initialize WebLLM: ' + error.message + '. Check console for details.');
        return false;
    }
}

async function callWebLLM(messages, systemPrompt) {
    if (!isWebLLMInitialized) {
        const success = await initializeWebLLM();
        if (!success) {
            throw new Error('WebLLM initialization failed');
        }
    }

    try {
        console.log('🤖 Calling WebLLM...');

        // Format messages for WebLLM (it expects standard chat format)
        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        const completion = await webllmEngine.chat.completions.create({
            messages: formattedMessages,
            temperature: 0.8,
            max_tokens: 2048,
        });

        const response = completion.choices[0].message.content;
        console.log('✅ WebLLM response received');
        return response;

    } catch (error) {
        console.error('❌ WebLLM call failed:', error);
        throw error;
    }
}

function showModelLoading(text) {
    const el = document.getElementById('model-loading');
    const textEl = document.getElementById('model-loading-text');
    textEl.textContent = text;
    el.classList.remove('hidden');
}

function updateModelLoadingProgress(progressText) {
    const progressEl = document.getElementById('model-loading-progress');
    progressEl.textContent = progressText;
}

function hideModelLoading() {
    const el = document.getElementById('model-loading');
    el.classList.add('hidden');
}

// ===== SAVE/LOAD SYSTEM =====
function saveGame(slotNumber) {
    if (!gameState) {
        showError('No game to save');
        return false;
    }

    const saveData = {
        id: slotNumber,
        timestamp: Date.now(),
        gameState: JSON.parse(JSON.stringify(gameState)),
        thumbnail: {
            location: gameState.currentLocation.planetName,
            stats: `${gameState.stats.planetsVisited} planets`,
            lastAction: gameState.actionHistory[0]?.action || 'New Game'
        }
    };

    try {
        const saveString = JSON.stringify(saveData);
        if (saveString.length > GAME_CONSTANTS.maxSaveSize) {
            throw new Error('Save file too large');
        }

        const key = STORAGE_KEYS.savePrefix + slotNumber;
        localStorage.setItem(key, saveString);
        return true;
    } catch (error) {
        console.error('Save failed:', error);
        showError('Failed to save: ' + error.message);
        return false;
    }
}

function loadGame(slotNumber) {
    const key = STORAGE_KEYS.savePrefix + slotNumber;
    const saveString = localStorage.getItem(key);

    if (!saveString) {
        showError('No save found in slot ' + slotNumber);
        return false;
    }

    try {
        const saveData = JSON.parse(saveString);
        gameState = saveData.gameState;

        // Migrate old saves without skills
        if (!gameState.skills) {
            console.log('🔄 Migrating old save to include skills system');
            gameState.skills = {
                survival: { level: 1, xp: 0, points: 0 },
                technology: { level: 1, xp: 0, points: 0 },
                exploration: { level: 2, xp: 0, points: 0 },
                combat: { level: 1, xp: 0, points: 0 }
            };
        }

        // Migrate old skill format to new points-based system
        Object.keys(gameState.skills).forEach(skill => {
            // Convert old number format
            if (typeof gameState.skills[skill] === 'number') {
                gameState.skills[skill] = {
                    level: gameState.skills[skill],
                    xp: 0,
                    points: 0
                };
            }

            // Convert old level/xp format to new points format
            if (gameState.skills[skill].points === undefined) {
                const oldLevel = gameState.skills[skill].level || 1;
                const oldXP = gameState.skills[skill].xp || 0;

                // Convert: level 1 = 0 points, level 2 = 5 points, etc.
                // Each level beyond 1 = 5 points, plus XP/2 as bonus points
                const convertedPoints = Math.floor((oldLevel - 1) * 5 + oldXP / 2);

                gameState.skills[skill] = {
                    level: 1, // Reset level (not used in new system)
                    xp: 0,    // Reset XP (not used in new system)
                    points: Math.max(0, convertedPoints)
                };

                console.log(`🔄 Migrated ${skill}: level ${oldLevel} + ${oldXP}xp → ${convertedPoints} points`);
            }
        });

        updateGameUI();
        return true;
    } catch (error) {
        console.error('Load failed:', error);
        showError('Failed to load: ' + error.message);
        return false;
    }
}

function listSaveSlots() {
    const slots = [];
    for (let i = 0; i <= 5; i++) {
        const key = STORAGE_KEYS.savePrefix + i;
        const saveString = localStorage.getItem(key);

        if (saveString) {
            try {
                const saveData = JSON.parse(saveString);
                slots.push({
                    slot: i,
                    timestamp: saveData.timestamp,
                    thumbnail: saveData.thumbnail,
                    empty: false
                });
            } catch (e) {
                slots.push({ slot: i, empty: true });
            }
        } else {
            slots.push({ slot: i, empty: true });
        }
    }
    return slots;
}

function autoSave() {
    const settings = getSettings();
    if (!settings.autoSave || !gameState) return;

    saveGame(0); // Slot 0 is auto-save
}

function scheduleAutoSave() {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(autoSave, GAME_CONSTANTS.autoSaveDelay);
}

// ===== DICE & SKILL SYSTEM =====
function rollDice(sides = 20) {
    return Math.floor(Math.random() * sides) + 1;
}

function performSkillCheck(difficulty, bonuses = 0, skillName = null) {
    const roll = rollDice(20);
    const total = roll + bonuses;
    const dc = DIFFICULTY_DC[difficulty.toLowerCase()] || 12;
    const success = total >= dc;

    return {
        roll,
        bonuses,
        total,
        dc,
        success,
        criticalSuccess: roll === 20,
        criticalFailure: roll === 1,
        difficulty,
        skillUsed: skillName
    };
}

function animateDiceRoll(check, skillProgress, callback) {
    const diceEl = document.getElementById('dice-result');
    diceEl.classList.remove('hidden');

    // Show initial rolling message
    let skillText = check.skillUsed ? ` [${capitalize(check.skillUsed)}]` : '';
    diceEl.textContent = `🎲 Rolling for ${check.difficulty}${skillText}`;

    // Animate with random numbers (11 frames, ~100ms each = 1100ms total)
    let frameCount = 0;
    const maxFrames = 11;

    const animationInterval = setInterval(() => {
        playDiceTickSound(); // Sound on each tick

        const randomRoll = Math.floor(Math.random() * 20) + 1;
        diceEl.textContent = `🎲 Rolling for ${check.difficulty}${skillText}\n${randomRoll}...`;

        frameCount++;
        if (frameCount >= maxFrames) {
            clearInterval(animationInterval);
            // Show result without skill points
            displayDiceRoll(check, null);

            // Play success/failure sound after result shows
            setTimeout(() => {
                if (check.success) {
                    playSuccessSound();
                } else {
                    playFailureSound();
                }
            }, 100);

            // After 0.5s, add skill points if earned
            if (skillProgress?.pointsAwarded) {
                setTimeout(() => {
                    displayDiceRoll(check, skillProgress);
                }, 500);
            }

            if (callback) callback();
        }
    }, 100);
}

function displayDiceRoll(check, skillProgress = null) {
    const diceEl = document.getElementById('dice-result');

    // Build result with separate lines
    let skillText = check.skillUsed ? ` [${capitalize(check.skillUsed)}]` : '';
    let result = `🎲 Rolling for ${check.difficulty}${skillText}\n`;

    // Roll result line
    result += `Roll: ${check.roll}`;
    if (check.bonuses !== 0) {
        result += ` + ${check.bonuses}`;
    }
    result += ` = ${check.total} vs DC ${check.dc} `;

    // Success/failure on same line
    if (check.criticalSuccess) {
        result += `CRITICAL SUCCESS! ⭐`;
    } else if (check.criticalFailure) {
        result += `CRITICAL FAILURE! 💀`;
    } else if (check.success) {
        result += `SUCCESS! ✓`;
    } else {
        result += `FAILURE ✗`;
    }

    // Show skill points gained (if any) on new line
    if (skillProgress?.pointsAwarded) {
        result += `\n✨ +${skillProgress.pointsEarned} ${capitalize(skillProgress.skillName)} points`;
    }

    diceEl.textContent = result;
    diceEl.classList.remove('hidden');
}

function detectSkillFromAction(actionText) {
    const text = actionText.toLowerCase();

    // Priority-based keyword detection (most specific first)

    // COMBAT keywords (attacks, weapons, defense)
    const combatKeywords = [
        'attack', 'fight', 'shoot', 'defend', 'weapon', 'kill',
        'battle', 'combat', 'strike', 'hit', 'dodge', 'block',
        'charge', 'assault', 'aggressive'
    ];

    // TECHNOLOGY keywords (repairs, crafting, systems)
    const technologyKeywords = [
        'repair', 'fix', 'craft', 'build', 'upgrade', 'modify',
        'engineer', 'construct', 'assemble', 'calibrate', 'system',
        'computer', 'terminal', 'code', 'hack', 'program', 'wire',
        'circuit', 'technology', 'device', 'tool'
    ];

    // SURVIVAL keywords (resources, hazards, health)
    const survivalKeywords = [
        'gather', 'collect', 'harvest', 'hunt', 'forage', 'scavenge',
        'water', 'food', 'shelter', 'medicine', 'heal', 'survive',
        'resource', 'toxin', 'radiation', 'temperature', 'hazard',
        'environmental', 'adapt'
    ];

    // EXPLORATION keywords (discovery, navigation, investigation)
    const explorationKeywords = [
        'explore', 'search', 'investigate', 'examine', 'look',
        'scout', 'survey', 'navigate', 'map', 'discover', 'find',
        'study', 'analyze', 'inspect', 'observe', 'wander', 'trek',
        'journey', 'travel', 'climb', 'descend', 'venture'
    ];

    // Check each category (return first match for priority)
    for (const keyword of combatKeywords) {
        if (text.includes(keyword)) return 'combat';
    }

    for (const keyword of technologyKeywords) {
        if (text.includes(keyword)) return 'technology';
    }

    for (const keyword of survivalKeywords) {
        if (text.includes(keyword)) return 'survival';
    }

    for (const keyword of explorationKeywords) {
        if (text.includes(keyword)) return 'exploration';
    }

    // Default to exploration (core game theme)
    return 'exploration';
}

function calculateSkillBonus(skillName) {
    if (!gameState || !gameState.skills || !gameState.skills[skillName]) {
        return 0;
    }

    // Bonus = skill level (capped at 10)
    return Math.min(gameState.skills[skillName].level, 10);
}

function awardSkillPoints(skillName, diceRollResult) {
    if (!gameState || !gameState.skills || !gameState.skills[skillName]) {
        console.warn('Cannot award points: invalid skill', skillName);
        return null;
    }

    const skill = gameState.skills[skillName];

    // Award points on success only
    if (!diceRollResult.success) {
        return null; // No points for failures
    }

    // Award points based on margin of success (roll - DC), minimum 1
    const marginOfSuccess = diceRollResult.total - diceRollResult.dc;
    const pointsEarned = Math.max(1, marginOfSuccess);
    skill.points += pointsEarned;

    return {
        pointsAwarded: true,
        pointsEarned: pointsEarned,
        newTotal: skill.points,
        skillName: skillName
    };
}

// ===== AI INTEGRATION =====
async function callAI(userMessage) {
    const settings = getSettings();

    // Route to appropriate AI backend
    if (settings.aiModel === 'webllm') {
        return await callWebLLMBackend(userMessage);
    } else {
        return await callClaudeBackend(userMessage);
    }
}

async function callClaudeBackend(userMessage) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('API key required');
    }

    const messages = [
        ...gameState.conversationHistory,
        {
            role: 'user',
            content: userMessage
        }
    ];

    try {
        const response = await fetch(CLAUDE_CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                model: CLAUDE_CONFIG.model,
                max_tokens: CLAUDE_CONFIG.maxTokens,
                temperature: CLAUDE_CONFIG.temperature,
                system: getSystemPrompt(),
                messages: messages,
                apiVersion: CLAUDE_CONFIG.apiVersion
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                clearApiKey();
                throw new Error('Invalid API key. Please enter a new one.');
            }
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;

    } catch (error) {
        console.error('Claude API error:', error);
        throw error;
    }
}

async function callWebLLMBackend(userMessage) {
    const messages = [
        ...gameState.conversationHistory,
        {
            role: 'user',
            content: userMessage
        }
    ];

    return await callWebLLM(messages, getSystemPrompt());
}

function formatUserMessage(action, diceRoll = null) {
    let message = action + '\n\n[CURRENT STATE]\n';
    message += `Location: ${gameState.currentLocation.planetName} (${gameState.currentLocation.planetType})\n`;
    message += `Ship Health: ${gameState.ship.health}%\n`;
    message += `Fuel: ${gameState.ship.fuel} units\n`;
    message += `Inventory: ${formatInventoryText(gameState.inventory)}\n`;
    message += `Distance from Center: ${gameState.currentLocation.distanceFromCenter} LY`;

    if (diceRoll) {
        message += '\n\n[DICE ROLL RESULT]\n';
        message += `Roll: ${diceRoll.roll}`;
        if (diceRoll.bonuses !== 0) {
            message += ` + ${diceRoll.bonuses}`;
        }
        message += ` = ${diceRoll.total} vs DC ${diceRoll.dc}\n`;
        message += `Result: ${diceRoll.success ? 'SUCCESS' : 'FAILURE'}`;
        if (diceRoll.criticalSuccess) {
            message += ' (Critical Success!)';
        }
        if (diceRoll.criticalFailure) {
            message += ' (Critical Failure!)';
        }
    }

    // Add brevity reminder based on mode
    const settings = getSettings();
    if (settings.narrativeLength === 'concise') {
        message += '\n\n[REMINDER: Maximum 300 characters total - this is a HARD LIMIT]';
    } else {
        message += '\n\n[REMINDER: 1-2 paragraphs maximum]';
    }

    return message;
}

function formatInventoryText(inventory) {
    const items = Object.entries(inventory)
        .filter(([key, val]) => val > 0)
        .map(([key, val]) => `${capitalize(key)} x${val}`)
        .join(', ');
    return items || 'Empty';
}

// ===== UTILITY FUNCTIONS =====
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== SOUND SYSTEM =====
let audioContext = null;
let isSoundMuted = false;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function playClickSound() {
    if (isSoundMuted) return;

    const ctx = initAudioContext();

    // Create mechanical click with brief noise burst
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Two frequencies for mechanical click effect
    oscillator1.type = 'square';
    oscillator1.frequency.value = 180;
    oscillator2.type = 'square';
    oscillator2.frequency.value = 220;

    // Very short, sharp envelope for click
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

    oscillator1.start(ctx.currentTime);
    oscillator1.stop(ctx.currentTime + 0.03);
    oscillator2.start(ctx.currentTime);
    oscillator2.stop(ctx.currentTime + 0.03);
}

function playHoverSound() {
    if (isSoundMuted) return;

    const ctx = initAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = 600;

    // Very subtle, brief hover sound
    gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.02);
}

function playDiceTickSound() {
    if (isSoundMuted) return;

    const ctx = initAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Short beep with varying pitch
    oscillator.type = 'sine';
    oscillator.frequency.value = 400 + Math.random() * 300; // Random pitch beep

    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.06);
}

function playSuccessSound() {
    if (isSoundMuted) return;

    const ctx = initAudioContext();

    // Series of ascending beeps: 500Hz -> 650Hz -> 800Hz
    [0, 0.08, 0.16].forEach((delay, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 500 + (index * 150);

        gainNode.gain.setValueAtTime(0.1, ctx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.07);

        oscillator.start(ctx.currentTime + delay);
        oscillator.stop(ctx.currentTime + delay + 0.07);
    });
}

function playFailureSound() {
    if (isSoundMuted) return;

    const ctx = initAudioContext();

    // Series of descending beeps: 400Hz -> 300Hz -> 200Hz
    [0, 0.09, 0.18].forEach((delay, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 400 - (index * 100);

        gainNode.gain.setValueAtTime(0.1, ctx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.08);

        oscillator.start(ctx.currentTime + delay);
        oscillator.stop(ctx.currentTime + delay + 0.08);
    });
}

function toggleMute() {
    isSoundMuted = !isSoundMuted;
    localStorage.setItem('nmstxt_sound_muted', isSoundMuted ? 'true' : 'false');
    updateMuteButtonUI();
}

function updateMuteButtonUI() {
    const btn = document.getElementById('mute-btn');
    if (btn) {
        btn.textContent = isSoundMuted ? 'Unmute' : 'Mute';
        btn.setAttribute('aria-label', isSoundMuted ? 'Unmute sounds' : 'Mute sounds');
    }
}

function loadSoundSettings() {
    const stored = localStorage.getItem('nmstxt_sound_muted');
    isSoundMuted = stored === 'true';
    updateMuteButtonUI();
}

// ===== RESPONSE PARSING =====
function detectDeathInNarrative(narrative) {
    const text = narrative.toLowerCase();
    const deathPhrases = [
        /you\s+(die|died|have died|are dead)/,
        /your\s+death/,
        /(succumb|perish|perished)/,
        /(life|consciousness)\s+(fades|slips away)/,
        /(last|final)\s+breath/,
        /cease\s+to\s+exist/,
        /game\s+over/,
        /the\s+end\s+(has\s+)?come/,
        /no\s+survivors/,
        /you\s+are\s+dead/,
        /breath\s+stops/,
        /consciousness\s+fades/
    ];
    const isDead = deathPhrases.some(pattern => pattern.test(text));
    if (isDead) {
        console.log('💀 Death detected in narrative');
    }
    return isDead;
}

function parseGameMasterResponse(text) {
    console.log('🎮 Parsing AI response...');
    console.log('Raw response:', text);

    const originalText = text;
    const parsed = {
        narrative: '',
        stateUpdate: null,
        options: []
    };

    // Extract state update
    const stateMatch = text.match(/\[STATE UPDATE\]([\s\S]*?)(?:\[OPTIONS\]|$)/i);
    if (stateMatch) {
        console.log('📋 Found STATE UPDATE section:', stateMatch[1].trim());
        parsed.stateUpdate = parseStateUpdate(stateMatch[1].trim());
        // Remove state update from text
        text = text.replace(/\[STATE UPDATE\][\s\S]*?(?=\[OPTIONS\]|$)/i, '');
    } else {
        console.log('⚠️ No STATE UPDATE section found');
    }

    // Extract options
    const optionsMatch = text.match(/\[OPTIONS\]([\s\S]*?)$/i);
    if (optionsMatch) {
        console.log('📋 Found OPTIONS section');
        parsed.options = parseOptions(optionsMatch[1].trim());
        // Remove options from text
        text = text.replace(/\[OPTIONS\][\s\S]*$/, '');
    } else {
        console.log('⚠️ No OPTIONS section found, trying fallback parser...');
    }

    // Fallback: if no options found, try to extract numbered lists from anywhere
    if (parsed.options.length === 0) {
        console.log('🔍 Using fallback parser to find options...');
        parsed.options = parseOptionsFromAnywhere(originalText);

        // Remove the found options from the narrative
        if (parsed.options.length > 0) {
            console.log(`✅ Fallback parser found ${parsed.options.length} options`);
            // Remove lines that match our options from the narrative
            const lines = text.split('\n');
            const filteredLines = lines.filter(line => {
                const isOptionLine = /^\s*\d+\.\s*.+/.test(line);
                return !isOptionLine;
            });
            text = filteredLines.join('\n');
        }
    }

    // Everything else is narrative
    parsed.narrative = text.trim();

    // Check for death in narrative
    parsed.isPlayerDead = detectDeathInNarrative(parsed.narrative);

    console.log('✅ Parse complete:', {
        hasNarrative: !!parsed.narrative,
        hasStateUpdate: !!parsed.stateUpdate,
        optionCount: parsed.options.length,
        isPlayerDead: parsed.isPlayerDead
    });

    // If still no options, provide default ones
    if (parsed.options.length === 0) {
        console.warn('⚠️ No options found at all, providing defaults');
        parsed.options = [
            { text: 'Continue exploring', difficulty: 'Easy' },
            { text: 'Look around carefully', difficulty: 'Medium' },
            { text: 'Try something risky', difficulty: 'Hard' }
        ];
    }

    return parsed;
}

function parseStateUpdate(updateText) {
    const updates = {};
    const parts = updateText.split('|');

    parts.forEach(part => {
        const trimmed = part.trim();

        if (trimmed.match(/ship/i)) {
            const match = trimmed.match(/([+-]?\d+)%?/);
            if (match) updates.ship = parseInt(match[1]);
        }

        if (trimmed.match(/fuel/i)) {
            const match = trimmed.match(/([+-]?\d+)/);
            if (match) updates.fuel = parseInt(match[1]);
        }

        if (trimmed.match(/distance/i)) {
            const match = trimmed.match(/([+-]?\d+)/);
            if (match) updates.distance = parseInt(match[1]);
        }

        if (trimmed.match(/inventory/i)) {
            updates.inventory = parseInventoryChange(trimmed);
        }
    });

    return updates;
}

function parseInventoryChange(text) {
    const changes = {};
    console.log('🔍 Parsing inventory from text:', text);

    // Match patterns like "+Iron x5", "Iron x5", or "-Carbon x3"
    // Made +/- sign optional, defaults to + if not present
    const regex = /([+-])?\s*(\w+)\s*x\s*(\d+)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const sign = match[1] || '+'; // Default to + if no sign
        const item = match[2].toLowerCase();
        const amount = parseInt(match[3]);
        changes[item] = sign === '+' ? amount : -amount;
        console.log(`  ✓ Found: ${item} ${sign}${amount}`);
    }

    console.log('📦 Inventory changes:', changes);
    return changes;
}

function parseOptions(optionsText) {
    const options = [];
    const lines = optionsText.split('\n');

    lines.forEach(line => {
        // Match patterns like "1. Action text (Difficulty)"
        const match = line.match(/^\d+\.\s*(.+?)\s*\((\w+(?:\s+\w+)?)\)\s*$/i);
        if (match) {
            options.push({
                text: match[1].trim(),
                difficulty: match[2].trim()
            });
        }
    });

    return options;
}

function parseOptionsFromAnywhere(text) {
    // Fallback parser: extract numbered options from anywhere in the text
    const options = [];
    const lines = text.split('\n');

    lines.forEach(line => {
        // Match numbered lines with optional difficulty
        // Patterns: "1. Action text (Difficulty)" or "1. Action text"
        const matchWithDiff = line.match(/^\s*(\d+)\.\s*(.+?)\s*\((\w+(?:\s+\w+)?)\)\s*$/i);
        const matchNoDiff = line.match(/^\s*(\d+)\.\s*(.+?)\s*$/i);

        if (matchWithDiff) {
            options.push({
                text: matchWithDiff[2].trim(),
                difficulty: matchWithDiff[3].trim()
            });
        } else if (matchNoDiff && matchNoDiff[2].trim().length > 5) {
            // No difficulty specified, infer from keywords or default to Medium
            const actionText = matchNoDiff[2].trim();
            let difficulty = 'Medium'; // default

            // Infer difficulty from keywords
            const lowerText = actionText.toLowerCase();
            if (lowerText.includes('search') || lowerText.includes('look') || lowerText.includes('gather') || lowerText.includes('collect')) {
                difficulty = 'Easy';
            } else if (lowerText.includes('explore') || lowerText.includes('investigate') || lowerText.includes('examine')) {
                difficulty = 'Medium';
            } else if (lowerText.includes('repair') || lowerText.includes('climb') || lowerText.includes('fight') || lowerText.includes('attack')) {
                difficulty = 'Hard';
            }

            options.push({
                text: actionText,
                difficulty: difficulty
            });
        }
    });

    return options;
}

function pruneConversationHistory() {
    if (gameState.conversationHistory.length > GAME_CONSTANTS.maxConversationHistory) {
        gameState.conversationHistory = gameState.conversationHistory.slice(-GAME_CONSTANTS.maxConversationHistory);
    }
}

// ===== STATE MANAGEMENT =====
function applyStateUpdates(updates) {
    if (!updates) {
        console.log('⚠️ No updates to apply');
        return;
    }

    console.log('📊 Applying state updates:', updates);

    if (updates.ship !== undefined) {
        const oldHealth = gameState.ship.health;
        gameState.ship.health = Math.max(0, Math.min(100, gameState.ship.health + updates.ship));
        console.log(`🚀 Ship health: ${oldHealth}% → ${gameState.ship.health}%`);
    }

    if (updates.fuel !== undefined) {
        const oldFuel = gameState.ship.fuel;
        gameState.ship.fuel = Math.max(0, gameState.ship.fuel + updates.fuel);
        console.log(`⛽ Fuel: ${oldFuel} → ${gameState.ship.fuel}`);
    }

    if (updates.distance !== undefined) {
        const oldDistance = gameState.currentLocation.distanceFromCenter;
        gameState.currentLocation.distanceFromCenter = Math.max(0, gameState.currentLocation.distanceFromCenter + updates.distance);
        console.log(`🌌 Distance from center: ${oldDistance.toLocaleString()} LY → ${gameState.currentLocation.distanceFromCenter.toLocaleString()} LY`);

        // Track closest distance reached (for stats)
        if (updates.distance < 0) {
            gameState.stats.distanceFromCenter = gameState.currentLocation.distanceFromCenter;
        }
    }

    if (updates.inventory) {
        console.log('📦 Processing inventory updates:', updates.inventory);
        Object.entries(updates.inventory).forEach(([item, amount]) => {
            // Initialize item if it doesn't exist
            if (gameState.inventory[item] === undefined) {
                console.log(`  🆕 Creating new inventory item: ${item}`);
                gameState.inventory[item] = 0;
            }

            const oldAmount = gameState.inventory[item];
            gameState.inventory[item] = Math.max(0, gameState.inventory[item] + amount);
            console.log(`  📦 ${item}: ${oldAmount} → ${gameState.inventory[item]} (${amount >= 0 ? '+' : ''}${amount})`);

            if (amount > 0) {
                gameState.stats.resourcesGathered += amount;
            }
        });
    }

    console.log('✅ Final inventory state:', gameState.inventory);
}

// ===== GAME LOGIC =====
async function processPlayerAction(actionText, difficulty = null, spentPoints = undefined) {
    // If difficulty specified but no points decision made yet, show modal first
    if (difficulty && spentPoints === undefined) {
        pendingAction = { actionText, difficulty };
        showSkillSpendModal(actionText, difficulty);
        return;
    }

    if (isProcessingAction) return;

    try {
        isProcessingAction = true;

        // Scroll to top immediately
        window.scrollTo(0, 0);

        // Clear previous narrative
        const narrativeEl = document.getElementById('narrative');
        narrativeEl.innerHTML = '';

        disableActions();
        hideError();

        // Perform dice roll if difficulty specified
        let diceRoll = null;
        let appliedSkill = null;
        let skillBonus = spentPoints || 0; // Use spent points as bonus

        if (difficulty) {
            appliedSkill = detectSkillFromAction(actionText);

            // Deduct points before roll
            if (spentPoints > 0 && gameState.skills[appliedSkill]) {
                gameState.skills[appliedSkill].points -= spentPoints;
            }

            diceRoll = performSkillCheck(difficulty, skillBonus, appliedSkill);

            // Calculate skill progress immediately (before AI)
            const immediateSkillProgress = awardSkillPoints(appliedSkill, diceRoll);
            if (immediateSkillProgress?.pointsAwarded) {
                console.log(`✨ ${capitalize(appliedSkill)} earned ${immediateSkillProgress.pointsEarned} point(s)! Total: ${immediateSkillProgress.newTotal}`);
            }

            // Animate dice roll with skill progress
            animateDiceRoll(diceRoll, immediateSkillProgress, () => {
                // Animation complete, AI continues processing in background
            });
        }

        // Show loading message in narrative area
        showLoading('Processing your action...');

        // Format message with current state
        const userMessage = formatUserMessage(actionText, diceRoll);

        // Call AI (routes to Claude or WebLLM based on settings)
        const response = await callAI(userMessage);

        // Update conversation history
        gameState.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: response }
        );
        pruneConversationHistory();

        // Parse response
        const parsed = parseGameMasterResponse(response);

        // Apply state updates
        applyStateUpdates(parsed.stateUpdate);

        // Check for death
        const isPlayerDead = parsed.isPlayerDead || false;

        if (isPlayerDead) {
            gameState.stats.deathCount += 1;
            gameState.currentNarrative = parsed.narrative;
            gameState.currentOptions = [];
            updateGameUI();

            // Show game over modal after brief delay (let player read death narrative)
            setTimeout(() => {
                showGameOverModal();
            }, 1500);

            return; // Stop processing
        }

        // Update current game state
        gameState.currentNarrative = parsed.narrative;
        gameState.currentOptions = parsed.options;

        // Add to action history
        gameState.actionHistory.unshift({
            timestamp: Date.now(),
            action: actionText,
            result: parsed.narrative.substring(0, 100) + '...'
        });
        if (gameState.actionHistory.length > GAME_CONSTANTS.maxActionHistory) {
            gameState.actionHistory.pop();
        }

        // Update UI
        updateGameUI();

        // Schedule auto-save
        scheduleAutoSave();

    } catch (error) {
        showError(error.message);
        if (error.message.includes('API key')) {
            setTimeout(() => showApiKeyModal(), 2000);
        }
    } finally {
        hideLoading();
        enableActions();
        isProcessingAction = false;
    }
}

// ===== UI UPDATES =====
function updateGameUI() {
    if (!gameState) return;

    // Hide dice roll from previous action
    document.getElementById('dice-result').classList.add('hidden');

    // Update narrative (parse markdown to HTML)
    const narrativeEl = document.getElementById('narrative');
    narrativeEl.innerHTML = marked.parse(gameState.currentNarrative);

    // Update log number
    const logNumber = String(logCounter).padStart(5, '0');
    narrativeEl.setAttribute('data-log-number', logNumber);
    logCounter++;

    // Update options
    const optionsEl = document.getElementById('options');
    optionsEl.innerHTML = '';

    gameState.currentOptions.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'action-btn';
        button.setAttribute('role', 'menuitem');

        const text = document.createElement('span');
        text.textContent = option.text;

        // Detect which skill this action uses
        const skillUsed = detectSkillFromAction(option.text);
        const skillIcons = {
            survival: '🜲',
            technology: '🝰',
            exploration: '🜳',
            combat: '🜸'
        };
        const skillNames = {
            survival: 'Survival',
            technology: 'Tech',
            exploration: 'Explore',
            combat: 'Combat'
        };

        // Create metadata element with icon, skill name, and difficulty
        const metadata = document.createElement('span');
        metadata.className = 'action-metadata';
        const dc = DIFFICULTY_DC[option.difficulty.toLowerCase()] || 12;
        metadata.innerHTML = `<span class="alchemical-symbol">${skillIcons[skillUsed]}</span> ${skillNames[skillUsed]} (${dc})`;

        button.appendChild(text);
        button.appendChild(metadata);

        button.addEventListener('click', () => {
            processPlayerAction(option.text, option.difficulty);
        });

        optionsEl.appendChild(button);
    });

    // Update info panel
    document.getElementById('ship-health').textContent = gameState.ship.health + '%';
    document.getElementById('fuel').textContent = gameState.ship.fuel;
    document.getElementById('location-display').textContent =
        gameState.currentLocation.planetName.toUpperCase();
    document.getElementById('distance-display').textContent =
        gameState.currentLocation.distanceFromCenter.toLocaleString() + ' LY';

    // Update inventory
    updateInventoryDisplay();

    // Update skills display
    updateSkillsDisplay();

    // Scroll to top
    window.scrollTo(0, 0);
}

function updateInventoryDisplay() {
    console.log('🎒 Updating inventory display...');
    console.log('Current inventory state:', gameState.inventory);

    const itemsEl = document.getElementById('inventory-items');
    const countEl = document.getElementById('inventory-count');
    const inventoryEntries = Object.entries(gameState.inventory);
    console.log('Inventory entries:', inventoryEntries);

    const itemsWithQuantity = inventoryEntries.filter(([key, val]) => val > 0);
    console.log('Items with quantity > 0:', itemsWithQuantity);

    // Calculate total item count
    const totalCount = itemsWithQuantity.reduce((sum, [key, val]) => sum + val, 0);
    if (countEl) {
        countEl.textContent = totalCount;
    }

    const items = itemsWithQuantity
        .map(([key, val]) => `<div class="inventory-item">${capitalize(key)}: ${val}</div>`)
        .join('');

    itemsEl.innerHTML = items || '<div class="inventory-item">Empty</div>';
    console.log('✅ Inventory display updated');
}

function updateSkillsDisplay() {
    if (!gameState || !gameState.skills) return;

    const skillsContent = document.getElementById('skills-content');
    if (!skillsContent) return;

    const skillNames = {
        survival: 'Survival',
        technology: 'Technology',
        exploration: 'Exploration',
        combat: 'Combat'
    };

    const skillIcons = {
        survival: '🜲',
        technology: '🝰',
        exploration: '🜳',
        combat: '🜸'
    };

    let html = '';
    Object.entries(gameState.skills).forEach(([key, skill]) => {
        // Format points with leading zero for single digits
        const formattedPoints = skill.points < 10 ? '0' + skill.points : String(skill.points);
        html += `
            <div class="skill-item">
                <span class="skill-name"><span class="alchemical-symbol">${skillIcons[key]}</span> ${skillNames[key]}</span>
                <span class="skill-points">${formattedPoints}</span>
            </div>
        `;
    });

    skillsContent.innerHTML = html;
}

function showSkillSpendModal(actionText, difficulty) {
    const skill = detectSkillFromAction(actionText);
    const available = gameState.skills[skill]?.points || 0;

    document.getElementById('skill-name-display').textContent = capitalize(skill);
    document.getElementById('available-points-display').textContent = available;

    const slider = document.getElementById('points-slider');
    slider.max = Math.min(5, available); // Can't spend more than you have, max 5
    slider.value = 0;
    document.getElementById('bonus-display').textContent = '0';

    showModal('skill-spend-modal');
}

function showGameOverModal() {
    console.log('💀 Showing game over modal');

    // Set death message
    const messageEl = document.getElementById('death-message');
    messageEl.textContent = 'Your journey has come to an end among the stars.';

    // Populate stats
    document.getElementById('final-planets').textContent = gameState.stats.planetsVisited;
    document.getElementById('final-distance').textContent = (gameState.currentLocation.distanceFromCenter || 715342).toLocaleString() + ' LY';
    document.getElementById('final-resources').textContent = gameState.stats.resourcesGathered;
    document.getElementById('final-aliens').textContent = gameState.stats.aliensEncountered;
    document.getElementById('final-jumps').textContent = gameState.stats.jumpsCompleted;

    showModal('game-over-modal');
}

// ===== UI STATE MANAGEMENT =====
function showLoading(message) {
    // Show loading message in narrative area for better UX
    const narrativeEl = document.getElementById('narrative');
    if (narrativeEl) {
        narrativeEl.innerHTML = `<p class="loading-message">${message}</p>`;
    }
}

function hideLoading() {
    // Loading will be replaced by narrative content
    // No need to clear anything here
}

function showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('success');
    errorEl.classList.add('visible');
}

function hideError() {
    const errorEl = document.getElementById('error-message');
    errorEl.classList.remove('visible');
}

function showSuccessMessage(message) {
    // Use the error message div but style it for success
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.add('success');
    errorEl.classList.add('visible');

    // Auto-hide after 2 seconds
    setTimeout(() => {
        errorEl.classList.remove('visible');
        errorEl.classList.remove('success');
    }, 2000);
}

function disableActions() {
    document.querySelectorAll('.action-btn, #custom-action-submit').forEach(btn => {
        btn.disabled = true;
    });
}

function enableActions() {
    document.querySelectorAll('.action-btn, #custom-action-submit').forEach(btn => {
        btn.disabled = false;
    });
}

// ===== MODAL MANAGEMENT =====
function showModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
}

function showAlertModal(message, title = 'Notice') {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    showModal('alert-modal');
}

function showConfirmModal(message, onConfirm, title = 'Confirm') {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    // Store callback for the yes button
    const yesBtn = document.getElementById('confirm-yes-btn');
    const noBtn = document.getElementById('confirm-no-btn');

    // Remove any existing listeners by cloning and replacing
    const newYesBtn = yesBtn.cloneNode(true);
    const newNoBtn = noBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    // Add new listeners
    newYesBtn.addEventListener('click', () => {
        hideModal('confirm-modal');
        if (onConfirm) onConfirm();
    });

    newNoBtn.addEventListener('click', () => {
        hideModal('confirm-modal');
    });

    showModal('confirm-modal');
}

function showContinueOrNewGameModal(title, message, continueText, newGameText, onContinue, onNewGame) {
    document.getElementById('continue-title').textContent = title;
    document.querySelector('#continue-modal p').textContent = message;

    const continueBtn = document.getElementById('continue-btn');
    const newGameBtn = document.getElementById('start-new-btn');

    continueBtn.textContent = continueText;
    newGameBtn.textContent = newGameText;

    // Remove any existing listeners by cloning and replacing
    const newContinueBtn = continueBtn.cloneNode(true);
    const newNewGameBtn = newGameBtn.cloneNode(true);
    continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
    newGameBtn.parentNode.replaceChild(newNewGameBtn, newGameBtn);

    // Add new listeners
    newContinueBtn.addEventListener('click', () => {
        hideModal('continue-modal');
        if (onContinue) onContinue();
    });

    newNewGameBtn.addEventListener('click', () => {
        hideModal('continue-modal');
        if (onNewGame) onNewGame();
    });

    showModal('continue-modal');
}

function showApiKeyModal() {
    showModal('api-key-modal');
    document.getElementById('api-key-input').focus();
}

function showSettingsModal() {
    const settings = getSettings();

    // Set AI model radio button
    const modelRadio = document.getElementById('model-' + settings.aiModel);
    if (modelRadio) {
        modelRadio.checked = true;
    }

    document.getElementById('font-size-select').value = settings.fontSize;
    document.getElementById('auto-save-toggle').checked = settings.autoSave;
    document.getElementById('narrative-length-select').value = settings.narrativeLength;
    document.getElementById('eink-mode-toggle').checked = settings.einkMode;
    showModal('settings-modal');
}

function showSaveModal() {
    const slots = listSaveSlots().slice(1); // Skip auto-save slot 0
    const slotsEl = document.getElementById('save-slots');

    slotsEl.innerHTML = slots.map(slot => {
        if (slot.empty) {
            return `
                <div class="save-slot empty" data-slot="${slot.slot}">
                    <div class="save-slot-header">Slot ${slot.slot} - Empty</div>
                </div>
            `;
        } else {
            const date = new Date(slot.timestamp).toLocaleString();
            return `
                <div class="save-slot" data-slot="${slot.slot}">
                    <div class="save-slot-header">Slot ${slot.slot}</div>
                    <div class="save-slot-info">${date}</div>
                    <div class="save-slot-info">${slot.thumbnail.location} - ${slot.thumbnail.stats}</div>
                </div>
            `;
        }
    }).join('');

    // Add click handlers
    document.querySelectorAll('#save-slots .save-slot').forEach(el => {
        el.addEventListener('click', () => {
            const slot = parseInt(el.dataset.slot);
            if (!el.classList.contains('empty')) {
                showConfirmModal('Overwrite this save?', () => {
                    if (saveGame(slot)) {
                        hideModal('save-modal');
                        hideError();
                        // Show brief success message without disrupting narrative
                        showSuccessMessage('Game saved!');
                    }
                }, 'Confirm Save');
            } else {
                if (saveGame(slot)) {
                    hideModal('save-modal');
                    hideError();
                    // Show brief success message without disrupting narrative
                    showSuccessMessage('Game saved!');
                }
            }
        });
    });

    showModal('save-modal');
}

function showLoadModal() {
    const slots = listSaveSlots();
    const slotsEl = document.getElementById('load-slots');

    slotsEl.innerHTML = slots.map(slot => {
        if (slot.empty) {
            return `
                <div class="save-slot empty">
                    <div class="save-slot-header">${slot.slot === 0 ? 'Auto-save' : 'Slot ' + slot.slot} - Empty</div>
                </div>
            `;
        } else {
            const date = new Date(slot.timestamp).toLocaleString();
            return `
                <div class="save-slot" data-slot="${slot.slot}">
                    <div class="save-slot-header">${slot.slot === 0 ? 'Auto-save' : 'Slot ' + slot.slot}</div>
                    <div class="save-slot-info">${date}</div>
                    <div class="save-slot-info">${slot.thumbnail.location} - ${slot.thumbnail.stats}</div>
                </div>
            `;
        }
    }).join('');

    // Add click handlers (only for non-empty slots)
    document.querySelectorAll('#load-slots .save-slot:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const slot = parseInt(el.dataset.slot);
            if (loadGame(slot)) {
                hideModal('load-modal');
                hideDiceRoll();
            }
        });
    });

    showModal('load-modal');
}

function hideDiceRoll() {
    document.getElementById('dice-result').classList.add('hidden');
}

// ===== GAME INITIALIZATION =====
async function startNewGame() {
    // Select random starting scenario
    const scenario = STARTING_SCENARIOS[Math.floor(Math.random() * STARTING_SCENARIOS.length)];
    console.log('🎮 Starting scenario:', scenario.name);

    gameState = createInitialGameState();

    // Apply scenario-specific starting conditions
    gameState.ship.health = scenario.shipHealth;
    gameState.ship.fuel = scenario.fuel;
    gameState.inventory = { ...gameState.inventory, ...scenario.inventory };

    // Randomize starting distance (between 650,000 and 780,000 light years)
    const randomDistance = 650000 + Math.floor(Math.random() * 130000);
    gameState.currentLocation.distanceFromCenter = randomDistance;
    console.log(`🌌 Starting distance: ${randomDistance.toLocaleString()} LY`);

    hideDiceRoll();
    hideError();

    // Clear previous game UI immediately
    document.getElementById('narrative').innerHTML = '';
    document.getElementById('options').innerHTML = '';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update UI to show initial state (before AI response)
    updateGameUI();

    try {
        showLoading('Initializing your adventure...');

        // Call AI with scenario-specific prompt
        const response = await callAI(scenario.prompt);

        gameState.conversationHistory.push({
            role: 'assistant',
            content: response
        });

        const parsed = parseGameMasterResponse(response);
        applyStateUpdates(parsed.stateUpdate);

        gameState.currentNarrative = parsed.narrative;
        gameState.currentOptions = parsed.options;

        updateGameUI();
        autoSave();

    } catch (error) {
        showError('Failed to start game: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function initializeGame() {
    // Apply settings
    const settings = getSettings();
    applySettings(settings);

    // Check for URL parameter key import
    const keyImported = importApiKeyFromUrl();
    if (keyImported) {
        // Show brief success message
        const successMsg = document.createElement('div');
        successMsg.textContent = '✓ API key loaded successfully';
        successMsg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#2d4a2b;color:#a8e6a1;padding:12px 24px;border-radius:4px;z-index:10000;font-family:inherit;';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
    }

    // Check for API key (only required for Claude mode)
    if (settings.aiModel === 'claude') {
        const apiKey = getApiKey();
        if (!apiKey) {
            showApiKeyModal();
            return;
        }
    }

    // Check for auto-save
    const autoSaveExists = localStorage.getItem(STORAGE_KEYS.autoSave);
    if (autoSaveExists) {
        showContinueOrNewGameModal(
            'Welcome Back',
            'Auto-save detected. Continue your previous game or start a new one?',
            'Continue',
            'New Game',
            () => {
                if (loadGame(0)) {
                    hideDiceRoll();
                }
            },
            () => startNewGame()
        );
    } else {
        startNewGame();
    }
}

// ===== EVENT HANDLERS =====
document.addEventListener('DOMContentLoaded', () => {
    // Load sound settings
    loadSoundSettings();

    // Global hover sound for all buttons
    document.addEventListener('mouseover', (e) => {
        if (e.target.tagName === 'BUTTON') {
            playHoverSound();
        }
    });

    // Mute button
    document.getElementById('mute-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double sound from global handler
        toggleMute();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', showSettingsModal);

    // Alert modal
    document.getElementById('alert-ok-btn').addEventListener('click', () => {
        hideModal('alert-modal');
    });

    // API key modal
    document.getElementById('api-key-submit').addEventListener('click', () => {
        const apiKey = document.getElementById('api-key-input').value.trim();
        if (!apiKey) {
            showAlertModal('Please enter an API key');
            return;
        }
        saveApiKey(apiKey);
        hideModal('api-key-modal');
        startNewGame();
    });

    // Settings modal
    document.getElementById('settings-close').addEventListener('click', () => {
        hideModal('settings-modal');
    });

    document.getElementById('font-size-select').addEventListener('change', (e) => {
        const settings = getSettings();
        settings.fontSize = parseInt(e.target.value);
        saveSettings(settings);
    });

    document.getElementById('auto-save-toggle').addEventListener('change', (e) => {
        const settings = getSettings();
        settings.autoSave = e.target.checked;
        saveSettings(settings);
    });

    document.getElementById('eink-mode-toggle').addEventListener('change', (e) => {
        const settings = getSettings();
        settings.einkMode = e.target.checked;
        saveSettings(settings);
    });

    document.getElementById('narrative-length-select').addEventListener('change', (e) => {
        const settings = getSettings();
        settings.narrativeLength = e.target.value;
        saveSettings(settings);
    });

    // AI model selection
    document.querySelectorAll('input[name="ai-model"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const settings = getSettings();
            settings.aiModel = e.target.value;
            saveSettings(settings);

            // Show info message about the change
            if (e.target.value === 'webllm') {
                showAlertModal('WebLLM will download ~2GB on first use (Llama 3.2 model). The model runs entirely in your browser with no API costs.', 'AI Model Changed');
            } else {
                showAlertModal('Switched to Claude API. You will need a valid API key to continue.', 'AI Model Changed');
            }
        });
    });

    document.getElementById('change-api-key-btn').addEventListener('click', () => {
        const settings = getSettings();
        if (settings.aiModel === 'webllm') {
            showAlertModal('API key is only needed for Claude API mode. You are currently using WebLLM, which runs entirely in your browser.', 'Notice');
            return;
        }
        hideModal('settings-modal');
        document.getElementById('api-key-input').value = '';
        showApiKeyModal();
    });

    // Save/Load modals
    document.getElementById('save-btn').addEventListener('click', showSaveModal);
    document.getElementById('save-cancel').addEventListener('click', () => hideModal('save-modal'));

    document.getElementById('load-btn').addEventListener('click', showLoadModal);
    document.getElementById('load-cancel').addEventListener('click', () => hideModal('load-modal'));

    // New game
    document.getElementById('new-game-btn').addEventListener('click', () => {
        showContinueOrNewGameModal(
            'Start New Game?',
            'Current progress will be lost unless saved. Continue playing or start a new journey?',
            'Continue Playing',
            'New Game',
            null, // Do nothing on continue
            () => startNewGame() // Start new game on confirmation
        );
    });

    // Skill spending modal
    document.getElementById('points-slider').addEventListener('input', (e) => {
        document.getElementById('bonus-display').textContent = e.target.value;
    });

    document.getElementById('spend-and-roll-btn').addEventListener('click', () => {
        const points = parseInt(document.getElementById('points-slider').value);
        hideModal('skill-spend-modal');
        processPlayerAction(pendingAction.actionText, pendingAction.difficulty, points);
        pendingAction = null;
    });

    document.getElementById('skip-spend-btn').addEventListener('click', () => {
        hideModal('skill-spend-modal');
        processPlayerAction(pendingAction.actionText, pendingAction.difficulty, 0);
        pendingAction = null;
    });

    document.getElementById('cancel-action-btn').addEventListener('click', () => {
        hideModal('skill-spend-modal');
        pendingAction = null;
    });

    // Game over modal handlers
    document.getElementById('restart-from-death-btn').addEventListener('click', () => {
        hideModal('game-over-modal');
        startNewGame();
    });

    document.getElementById('load-from-death-btn').addEventListener('click', () => {
        hideModal('game-over-modal');
        showLoadModal();
    });

    // Custom action form
    const customActionForm = document.getElementById('custom-action-form');
    if (customActionForm) {
        customActionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('custom-action-input');
            const action = input.value.trim();
            if (action) {
                processPlayerAction(action);
                input.value = '';
            }
        });
    }

    // Skills panel toggle
    document.getElementById('skills-header').addEventListener('click', () => {
        const content = document.getElementById('skills-content');
        const toggle = document.getElementById('skills-toggle');
        const header = document.getElementById('skills-header');

        if (content.classList.contains('open')) {
            content.classList.remove('open');
            content.setAttribute('aria-hidden', 'true');
            toggle.textContent = 'EXPAND';
            header.setAttribute('aria-expanded', 'false');
        } else {
            updateSkillsDisplay(); // Update content before showing
            content.classList.add('open');
            content.setAttribute('aria-hidden', 'false');
            toggle.textContent = 'CLOSE';
            header.setAttribute('aria-expanded', 'true');
        }
    });

    // Inventory toggle
    document.getElementById('inventory-header').addEventListener('click', () => {
        const items = document.getElementById('inventory-items');
        const toggle = document.getElementById('inventory-toggle');
        const header = document.getElementById('inventory-header');

        if (items.classList.contains('open')) {
            items.classList.remove('open');
            items.setAttribute('aria-hidden', 'true');
            toggle.textContent = 'EXPAND';
            header.setAttribute('aria-expanded', 'false');
        } else {
            items.classList.add('open');
            items.setAttribute('aria-hidden', 'false');
            toggle.textContent = 'CLOSE';
            header.setAttribute('aria-expanded', 'true');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Number keys for options
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            const buttons = document.querySelectorAll('#options .action-btn');
            if (buttons[num - 1]) {
                buttons[num - 1].click();
            }
        }
    });

    // Auto-save on page unload
    window.addEventListener('beforeunload', () => {
        if (gameState) {
            autoSave();
        }
    });

    // Initialize game
    initializeGame();
});
