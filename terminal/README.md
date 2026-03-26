# NMS.TXT — Terminal Edition

A split-pane terminal UI for the NMS.TXT space exploration game, powered by Claude AI.

```
* Xerath-9 (Scorched)  ·  Draveth System  ·  8,847 ly from center

┌─ NARRATIVE ──────────────────────┬─ SHIP ──────────────────┐
│ LOG: 00003                       │ Hull ████████░░ 78%      │
│                                  │ Fuel █████░░░░░ 52u      │
│ The scorched plains of           │                          │
│ Xerath-9 stretch endlessly       │ INVENTORY                │
│ before you...                    │ Iron         x12         │
│                                  │ Carbon       x5          │
│                                  │                          │
│                                  │ SKILLS                   │
│                                  │ Survival       0 pts     │
│                                  │ Technology     0 pts     │
│                                  │ Exploration    0 pts     │
│                                  │ Combat         0 pts     │
├─ OPTIONS ────────────────────────┴──────────────────────────┤
│ 1. Salvage engine components          (Medium)              │
│ 2. Open the emergency supply pod      (Easy)                │
│ 3. Climb the ridge to survey          (Easy)                │
│ 4. Signal for rescue                  (Hard)                │
└─────────────────────────────────────────────────────────────┘
  [1-4] Action  [S] Save  [L] Load  [N] New  [Q] Quit
```

## Install

**Requires Python 3.10+ and an Anthropic API key.**

```bash
# Recommended: pipx (isolated install, globally available command)
pipx install git+https://github.com/milesgilbert/nms-txt.git#subdirectory=terminal

# Or: pip into a venv
python3 -m venv .venv && source .venv/bin/activate
pip install git+https://github.com/milesgilbert/nms-txt.git#subdirectory=terminal

# Run
nms-txt
```

## API Key

Set the `ANTHROPIC_API_KEY` environment variable, or the game will prompt you on first run and save the key to `~/.config/nms-txt/config.json`.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
nms-txt
```

## Controls

| Key | Action |
|-----|--------|
| `1`–`6` | Choose action |
| `s` | Save game (5 slots) |
| `l` | Load game |
| `n` | New game |
| `q` | Quit |

## Saves

Save files are stored in `~/.local/share/nms-txt/saves/`.

## Local development

```bash
cd terminal
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
nms-txt
```
