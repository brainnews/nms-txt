"""API key and save file management."""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

CONFIG_DIR = Path.home() / ".config" / "nms-txt"
SAVE_DIR = Path.home() / ".local" / "share" / "nms-txt" / "saves"
CONFIG_FILE = CONFIG_DIR / "config.json"


def get_api_key() -> Optional[str]:
    """Return API key from env var or saved config file."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text()).get("api_key")
        except Exception:
            pass
    return None


def save_api_key(key: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps({"api_key": key}))


def save_game(state, slot: int) -> bool:
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    path = SAVE_DIR / f"save_{slot}.json"
    try:
        data = {
            "location": state.location,
            "ship": state.ship,
            "inventory": state.inventory,
            "skills": state.skills,
            "conversation_history": state.conversation_history,
            "action_history": state.action_history,
            "stats": state.stats,
            "current_narrative": state.current_narrative,
            "current_options": state.current_options,
            "log_counter": state.log_counter,
            "scenario_name": state.scenario_name,
            "saved_at": datetime.now().isoformat(),
        }
        path.write_text(json.dumps(data, indent=2))
        return True
    except Exception:
        return False


def load_game(slot: int) -> Optional[dict]:
    path = SAVE_DIR / f"save_{slot}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def list_saves() -> list:
    saves = []
    for slot in range(1, 6):
        path = SAVE_DIR / f"save_{slot}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text())
                saves.append({
                    "slot": slot,
                    "planet": data.get("location", {}).get("planet", "Unknown"),
                    "log": data.get("log_counter", 0),
                    "modified": path.stat().st_mtime,
                    "empty": False,
                })
            except Exception:
                saves.append({"slot": slot, "planet": "Corrupted", "log": 0, "modified": 0, "empty": False})
        else:
            saves.append({"slot": slot, "planet": None, "log": 0, "modified": 0, "empty": True})
    return saves
