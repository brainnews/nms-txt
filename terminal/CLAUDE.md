# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Python/Textual TUI version of NMS.TXT. Talks directly to the Anthropic API (no proxy). Packaged as `nms-txt` with a `nms-txt` CLI entry point.

## Development

```bash
cd terminal

# First time
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# Run
nms-txt

# After changing game.py or config.py, just relaunch — no build step needed.
# After changing app.py, relaunch. Textual has no hot-reload.
```

## Architecture

**`game.py`** — All game logic, no UI imports. Contains:
- `GameState` dataclass — the full game state (location, ship, inventory, skills, conversation history)
- `get_system_prompt()` — the Claude system prompt that defines response format, difficulty classes, and game rules. **This is the primary lever for changing game behavior.**
- `parse_response(text)` → `{narrative, state_update, options}` — parses Claude's structured `[STATE UPDATE]` / `[OPTIONS]` response format
- `apply_state_updates(state, updates)` — mutates `GameState` in place from parsed updates
- `detect_skill(action)` — keyword matching to pick which skill (survival/technology/exploration/combat) applies to an action
- `STARTING_SCENARIOS` — list of dicts with ship/inventory starting values and an initial prompt

**`app.py`** — Textual TUI. Key patterns:
- All `push_screen_wait()` calls must be inside `@work` methods — Textual requires this. Action handlers (`action_*`) are sync and delegate to `@work` methods.
- `_send_to_ai()` is `@work(exclusive=True)` — the `exclusive` flag cancels any in-flight call if a new one starts.
- `DiceModal._animate` was renamed to `_roll_dice` to avoid conflicting with Textual's internal `Widget._animate` method. Never name a method `_animate` on a Textual widget.
- `anthropic.AsyncAnthropic` is used directly (no proxy needed unlike the web app).
- Model: `claude-haiku-4-5-20251001`

**`config.py`** — API key: checks `ANTHROPIC_API_KEY` env var first, then `~/.config/nms-txt/config.json`. Saves: `~/.local/share/nms-txt/saves/save_{1-5}.json`.

## Response Format Contract

Claude must return responses in this exact structure — the parser depends on it:

```
[Narrative text]

[STATE UPDATE]
Location: Planet Name (Type) | System: System Name | Distance: NNNNly
Ship: +/-N% | Fuel: +/-N | Inventory: +Item xN, -Item xN

[OPTIONS]
1. Action (Easy)
2. Action (Medium)
3. Action (Hard)
4. Action (Easy)
```

If parsing breaks, `parse_response()` in `game.py` is the first place to check. The narrative length and token count are controlled by `max_tokens` in `_send_to_ai()` and the narrative instruction in `get_system_prompt()`.

## Textual Gotchas

- `push_screen_wait()` requires a `@work` context — calling it from `on_mount` or a sync action handler crashes with `NoActiveWorker`.
- Don't name widget methods `_animate` — conflicts with `Widget._animate` internally.
- `self.dismiss(value)` ends a `ModalScreen` and returns `value` to the `push_screen_wait` caller.
- Async `on_mount` that needs to do real work should dispatch to a `@work` method immediately.
