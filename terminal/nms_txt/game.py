"""Game state, constants, system prompt, and parsing logic."""

import re
import random
from dataclasses import dataclass, field
from typing import Optional


DIFFICULTY_DC = {
    "easy": 6,
    "medium": 9,
    "hard": 13,
    "very hard": 17,
}

STARTING_SCENARIOS = [
    {
        "name": "Crash Landing",
        "ship": {"health": 15, "fuel": 0},
        "inventory": {"iron": 3, "carbon": 2},
        "prompt": (
            "I've just crash-landed on an alien planet. My ship is at 15% hull integrity, "
            "thrusters destroyed, no fuel. Begin the game by describing my situation vividly "
            "and give me 4 options for what to do first."
        ),
    },
    {
        "name": "Adrift in Space",
        "ship": {"health": 40, "fuel": 5},
        "inventory": {"carbon": 5},
        "prompt": (
            "I'm adrift in space near an alien planet with my ship at 40% integrity and "
            "barely any fuel. Begin the game by describing the view and my situation, "
            "then give me 4 options."
        ),
    },
    {
        "name": "Underwater Pod",
        "ship": {"health": 5, "fuel": 0},
        "inventory": {"oxygen": 20, "carbon": 1},
        "prompt": (
            "I'm trapped in an underwater escape pod at 5% integrity with limited oxygen supply. "
            "Begin the game with this tense underwater situation and give me 4 options to escape."
        ),
    },
    {
        "name": "Derelict Freighter",
        "ship": {"health": 30, "fuel": 15},
        "inventory": {"iron": 10, "carbon": 8, "plutonium": 2},
        "prompt": (
            "I'm aboard a derelict alien freighter floating in space. My ship is docked at 30% "
            "integrity. The freighter's systems are unstable. Begin the game describing the "
            "eerie derelict ship and give me 4 options."
        ),
    },
    {
        "name": "Alien Study",
        "ship": {"health": 50, "fuel": 20},
        "inventory": {"carbon": 3},
        "prompt": (
            "I've been captured and am being studied in an alien laboratory. My ship is intact "
            "outside at 50%. Begin the game with this unsettling situation and give me 4 options."
        ),
    },
    {
        "name": "Frozen Tundra",
        "ship": {"health": 25, "fuel": 8},
        "inventory": {"iron": 5, "carbon": 10},
        "prompt": (
            "I crashed on a frozen ice world. My ship is at 25% and the heating systems are "
            "failing. Temperature is dropping fast. Begin the game with this desperate cold "
            "situation and give me 4 options."
        ),
    },
]

SKILL_KEYWORDS = {
    "survival": [
        "eat", "food", "water", "shelter", "survive", "heal", "health", "forage",
        "gather", "harvest", "hunt", "craft", "bandage", "rest", "breathe", "oxygen",
        "temperature", "hazard", "poison", "antidote", "medkit",
    ],
    "technology": [
        "repair", "fix", "build", "hack", "scan", "analyze", "modify", "install",
        "upgrade", "wire", "circuit", "computer", "system", "engine", "thruster",
        "reactor", "device", "module", "technology", "calibrate", "program",
    ],
    "exploration": [
        "explore", "search", "scout", "investigate", "navigate", "travel", "climb",
        "enter", "examine", "look", "survey", "map", "discover", "find", "go",
        "approach", "walk", "run", "move", "venture", "investigate", "check",
    ],
    "combat": [
        "attack", "fight", "shoot", "defend", "evade", "dodge", "strike", "battle",
        "combat", "weapon", "fire", "charge", "ambush", "guard", "kill", "threaten",
    ],
}


def detect_skill(action: str) -> str:
    """Determine which skill applies to an action via keyword matching."""
    action_lower = action.lower()
    scores = {skill: 0 for skill in SKILL_KEYWORDS}
    for skill, keywords in SKILL_KEYWORDS.items():
        for kw in keywords:
            if kw in action_lower:
                scores[skill] += 1
    best = max(scores, key=lambda s: scores[s])
    return best if scores[best] > 0 else "exploration"


def award_skill_points(state, skill: str, total: int, dc: int) -> int:
    """Award skill points based on margin of success. Returns points earned."""
    margin = total - dc
    points = max(1, margin)
    state.skills[skill]["points"] += points
    return points


def get_system_prompt() -> str:
    return """\
You are the Game Master for NMS.TXT, a text-based space exploration game inspired by No Man's Sky. \
The player has crash-landed (or is otherwise stranded) and must repair their ship, explore alien worlds, \
and journey toward the galaxy's center.

## RESPONSE FORMAT
Every response MUST follow this exact structure:

[Your narrative — 1 short paragraph (3-5 sentences) of atmospheric prose in second-person]

[STATE UPDATE]
Location: Planet Name (Type) | System: System Name | Distance: NNNNly
Ship: +/-N% | Fuel: +/-N | Inventory: +ItemName xN, -ItemName xN

[OPTIONS]
1. Action description (Easy)
2. Action description (Medium)
3. Action description (Hard)
4. Action description (Easy)

## RULES

**Difficulty Classes:**
- Easy (DC 6): routine tasks, ~75% success
- Medium (DC 9): challenging tasks, ~60% success
- Hard (DC 13): dangerous tasks, ~40% success
- Very Hard (DC 17): near-impossible, ~20% success

**Dice Roll Results:**
When the player's message includes a roll result like "[DICE ROLL: 14 total (rolled 11 + 3 survival bonus) vs DC 9 - SUCCESS]", \
incorporate the result naturally into your narrative. Success means they accomplish it (perhaps partially on close calls), \
failure means complications or setbacks.

**State Updates:**
- Location line: always include current planet name, type (Toxic/Frozen/Lush/Barren/Radioactive/Scorched/Dead), \
  system name, and distance from galactic center in light-years
- Ship: use + or - to show change (e.g. +5% for repair, -10% for damage). If no change: +0%
- Fuel: use + or - for change. If no change: +0
- Inventory: list items that changed with + or -. If nothing changed: none
- Distance decreases as the player moves toward the galactic center (starts ~9000ly)

**Game Rules:**
- Players must gather resources before repairing (iron, carbon, ferrite, etc.)
- Ship repairs require specific resources and successful Technology checks
- Only narrative-described death triggers game over — ship health at 0% alone does not
- Players cannot skip major progression steps
- Track what names/lore you establish and stay consistent within a session

**Tone:**
- Atmospheric and literary, like quality sci-fi fiction
- Second-person ("you see...", "ahead of you...")
- Invent vivid alien planet names, species names, technology names
- Balance tension and wonder

Always end with exactly 4 numbered options."""


@dataclass
class GameState:
    location: dict = field(default_factory=lambda: {
        "planet": "Unknown",
        "type": "Unknown",
        "system": "Unknown",
        "distance_from_center": 9000,
    })
    ship: dict = field(default_factory=lambda: {"health": 15, "fuel": 0})
    inventory: dict = field(default_factory=dict)
    skills: dict = field(default_factory=lambda: {
        "survival": {"points": 0},
        "technology": {"points": 0},
        "exploration": {"points": 0},
        "combat": {"points": 0},
    })
    conversation_history: list = field(default_factory=list)
    action_history: list = field(default_factory=list)
    stats: dict = field(default_factory=lambda: {
        "planets_visited": 0,
        "aliens_encountered": 0,
        "resources_gathered": 0,
        "distance_traveled": 0,
    })
    current_narrative: str = ""
    current_options: list = field(default_factory=list)
    log_counter: int = 0
    game_over: bool = False
    scenario_name: str = ""


def parse_response(text: str) -> dict:
    """Parse Claude's structured response into components."""
    result = {"narrative": "", "state_update": {}, "options": []}

    parts = re.split(r"\[STATE UPDATE\]", text, maxsplit=1, flags=re.IGNORECASE)
    result["narrative"] = parts[0].strip()

    if len(parts) > 1:
        remaining = parts[1]
        state_option_parts = re.split(r"\[OPTIONS\]", remaining, maxsplit=1, flags=re.IGNORECASE)
        result["state_update"] = _parse_state_update(state_option_parts[0].strip())
        if len(state_option_parts) > 1:
            result["options"] = _parse_options(state_option_parts[1].strip())

    return result


def _parse_state_update(text: str) -> dict:
    updates = {}

    # Location
    loc_match = re.search(r"Location:\s*([^|]+)\s*\(([^)]+)\)\s*\|\s*System:\s*([^|]+)\s*\|\s*Distance:\s*(\d+)", text, re.IGNORECASE)
    if loc_match:
        updates["planet"] = loc_match.group(1).strip()
        updates["planet_type"] = loc_match.group(2).strip()
        updates["system"] = loc_match.group(3).strip()
        updates["distance"] = int(loc_match.group(4))

    # Ship health
    ship_match = re.search(r"Ship:\s*([+-]?\d+)%", text, re.IGNORECASE)
    if ship_match:
        updates["ship_health"] = int(ship_match.group(1))

    # Fuel
    fuel_match = re.search(r"Fuel:\s*([+-]?\d+)", text, re.IGNORECASE)
    if fuel_match:
        updates["fuel"] = int(fuel_match.group(1))

    # Inventory
    inventory = {}
    inv_match = re.search(r"Inventory:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    if inv_match:
        inv_text = inv_match.group(1)
        if inv_text.lower().strip() != "none":
            for sign, item, qty in re.findall(r"([+-]?)(\w+(?:\s+\w+)?)\s+[xX](\d+)", inv_text):
                item_key = item.strip().lower()
                qty_val = int(qty) if sign != "-" else -int(qty)
                inventory[item_key] = qty_val
    updates["inventory"] = inventory

    return updates


def _parse_options(text: str) -> list:
    options = []
    for line in text.strip().split("\n"):
        line = line.strip()
        match = re.match(r"^\d+[.)]\s+(.+?)(?:\s+\(([^)]+)\))?$", line)
        if match:
            action = match.group(1).strip()
            difficulty = match.group(2).lower() if match.group(2) else None
            options.append({"action": action, "difficulty": difficulty})
    return options


def apply_state_updates(state: GameState, updates: dict) -> None:
    """Apply parsed state updates to game state in place."""
    if "ship_health" in updates:
        state.ship["health"] = max(0, min(100, state.ship["health"] + updates["ship_health"]))

    if "fuel" in updates:
        state.ship["fuel"] = max(0, min(100, state.ship["fuel"] + updates["fuel"]))

    for item, delta in updates.get("inventory", {}).items():
        current = state.inventory.get(item, 0)
        new_val = max(0, current + delta)
        if new_val == 0 and item in state.inventory:
            del state.inventory[item]
        else:
            state.inventory[item] = new_val
        if delta > 0:
            state.stats["resources_gathered"] += delta

    if "planet" in updates:
        state.location["planet"] = updates["planet"]
    if "planet_type" in updates:
        state.location["type"] = updates["planet_type"]
    if "system" in updates:
        state.location["system"] = updates["system"]
    if "distance" in updates:
        old = state.location["distance_from_center"]
        state.location["distance_from_center"] = updates["distance"]
        if updates["distance"] < old:
            state.stats["distance_traveled"] += old - updates["distance"]


def detect_death(narrative: str) -> bool:
    patterns = [
        r"\byou die\b", r"\byou died\b", r"\byou are dead\b", r"\byou're dead\b",
        r"\byour death\b", r"\byou succumb\b", r"\byou perish\b",
        r"\blife fades\b", r"\blast breath\b", r"\bcease to exist\b",
        r"\bgame over\b", r"\byou have died\b",
    ]
    lower = narrative.lower()
    return any(re.search(p, lower) for p in patterns)
