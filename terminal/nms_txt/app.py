"""NMS.TXT Terminal — Textual TUI Application."""

import asyncio
import random
import re
from datetime import datetime

import anthropic
from textual import work
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, ScrollableContainer, Vertical
from textual.screen import ModalScreen, Screen
from textual.widgets import Button, Input, Label, Static

from .config import get_api_key, list_saves, load_game, save_api_key, save_game
from .game import (
    DIFFICULTY_DC,
    STARTING_SCENARIOS,
    GameState,
    apply_state_updates,
    award_skill_points,
    detect_death,
    detect_skill,
    get_system_prompt,
    parse_response,
)

SKILL_ICONS = {
    "survival": "shield",
    "technology": "wrench",
    "exploration": "scope",
    "combat": "sword",
}
SKILL_LABELS = {
    "survival": "Survival",
    "technology": "Technology",
    "exploration": "Exploration",
    "combat": "Combat",
}

# ---------------------------------------------------------------------------
# Markdown → Rich markup conversion

def _md_to_rich(text: str) -> str:
    """Convert basic markdown bold/italic to Rich markup.

    Escapes existing square brackets first so Claude's output can't accidentally
    inject Rich markup, then converts **bold** and *italic* to Rich tags.
    """
    text = text.replace("[", "\\[")
    text = re.sub(r"\*\*(.+?)\*\*", r"[bold]\1[/bold]", text, flags=re.DOTALL)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"[italic]\1[/italic]", text, flags=re.DOTALL)
    return text


# ---------------------------------------------------------------------------
# Loading animation frame generators

_SPACE_WIDTH = 52

def _space_loading_frame(frame: int) -> str:
    """Diagonal asteroid-field drift."""
    rows = []
    for row in range(5):
        chars = []
        for col in range(_SPACE_WIDTH):
            val = (col * 7 + row * 11 + frame) % 43
            if val == 0:
                chars.append("*")
            elif val < 4:
                chars.append("·")
            else:
                chars.append(" ")
        rows.append("[dim]" + "".join(chars) + "[/dim]")
    rows.append("")
    rows.append("[dim]Awaiting transmission...[/dim]")
    return "\n".join(rows)


_COMBAT_STATES = [
    ("THREAT DETECTED",  "red bold"),
    ("ANALYZING TARGET", "red"),
    ("CALCULATING ODDS", "red dim"),
    ("SCANNING AREA",    "red"),
    ("TARGETING LOCK",   "red bold"),
    ("ASSESSING THREAT", "red"),
]
_COMBAT_INDICATORS = ["◉", "◎", "○", "◎", "◉", "●"]

def _combat_loading_frame(frame: int) -> str:
    """Pulsing red targeting indicator."""
    msg, color = _COMBAT_STATES[(frame // 6) % len(_COMBAT_STATES)]
    indicator = _COMBAT_INDICATORS[frame % len(_COMBAT_INDICATORS)]
    return f"[{color}]{indicator}  {msg}...[/{color}]"


def _tech_loading_frame(frame: int) -> str:
    """Scrolling hex data with scan bar."""
    rng = random.Random(frame)
    hex1 = " ".join(f"{rng.randint(0, 255):02X}" for _ in range(10))
    hex2 = " ".join(f"{rng.randint(0, 255):02X}" for _ in range(10))
    bar_chars = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█", "▉", "▊", "▋", "▌", "▍", "▎", "▏"]
    bar = bar_chars[frame % len(bar_chars)]
    return (
        f"[green dim]{hex1}[/green dim]\n"
        f"[green]SCANNING {bar}[/green]\n"
        f"[green dim]{hex2}[/green dim]"
    )


def _survival_loading_frame(frame: int) -> str:
    """Shifting heartbeat / vital-signs line."""
    width = 44
    peak = (frame * 2) % width
    line = list("─" * width)
    line[peak] = "∧"
    color = "cyan" if (frame % 10) < 5 else "cyan dim"
    return f"[{color}]{''.join(line)}[/{color}]\n\n[dim]Vital signs stable...[/dim]"


# ---------------------------------------------------------------------------
# Screens / Modals
# ---------------------------------------------------------------------------


class SetupScreen(Screen):
    CSS = """
    SetupScreen {
        align: center middle;
        background: #0a0a0a;
    }
    #box {
        width: 64;
        height: auto;
        border: double #444;
        padding: 2 4;
        background: #111;
    }
    #title {
        text-align: center;
        color: #aaa;
        text-style: bold;
        margin-bottom: 1;
    }
    #desc {
        color: #666;
        margin-bottom: 2;
        text-align: center;
    }
    #key-input {
        margin-bottom: 1;
    }
    #submit {
        width: 100%;
    }
    """

    def compose(self) -> ComposeResult:
        with Container(id="box"):
            yield Static("N M S . T X T", id="title")
            yield Static(
                "A text-based space exploration game powered by Claude AI.\n\n"
                "Enter your Anthropic API key to begin.\n"
                "Get one at: [link]console.anthropic.com[/link]",
                id="desc",
            )
            yield Input(placeholder="sk-ant-...", password=True, id="key-input")
            yield Button("Begin Journey", variant="primary", id="submit")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "submit":
            self._submit()

    def on_input_submitted(self, _event: Input.Submitted) -> None:
        self._submit()

    def _submit(self) -> None:
        key = self.query_one("#key-input", Input).value.strip()
        if key.startswith("sk-"):
            save_api_key(key)
            self.dismiss(key)
        else:
            self.app.notify("Key should start with 'sk-'", severity="warning")


class DiceModal(ModalScreen):
    CSS = """
    DiceModal {
        align: center middle;
    }
    #box {
        width: 44;
        height: 13;
        border: double #444;
        padding: 1 3;
        background: #111;
        align: center middle;
    }
    #label {
        text-align: center;
        color: #555;
        text-style: bold;
        margin-bottom: 1;
    }
    #roll-display {
        text-align: center;
        text-style: bold;
        height: 3;
        content-align: center middle;
    }
    #result-display {
        text-align: center;
        margin-top: 1;
    }
    """

    def __init__(self, roll: int, bonus: int, dc: int):
        super().__init__()
        self._roll = roll
        self._bonus = bonus
        self._dc = dc
        self._total = roll + bonus

    def compose(self) -> ComposeResult:
        with Container(id="box"):
            yield Static("DICE ROLL", id="label")
            yield Static("", id="roll-display")
            yield Static("", id="result-display")

    def on_mount(self) -> None:
        self._run_animation()

    @work
    async def _run_animation(self) -> None:
        await self._roll_dice()

    async def _roll_dice(self) -> None:
        display = self.query_one("#roll-display", Static)
        result = self.query_one("#result-display", Static)

        for _ in range(14):
            fake = random.randint(1, 20)
            display.update(f"[bold yellow]d20 ··· {fake:2d}[/bold yellow]")
            await asyncio.sleep(0.075)

        display.update(f"[bold white]d20 ··· {self._roll:2d}[/bold white]")
        await asyncio.sleep(0.35)

        if self._bonus:
            display.update(
                f"[bold white]{self._roll} + {self._bonus} = {self._total}[/bold white]"
            )
            await asyncio.sleep(0.35)

        crit_success = self._roll == 20
        crit_fail = self._roll == 1
        success = self._total >= self._dc

        if crit_success:
            result.update(f"[bold green]✦  CRITICAL SUCCESS  ✦[/bold green]\n[dim]DC {self._dc}[/dim]")
        elif crit_fail:
            result.update(f"[bold red]✗  CRITICAL FAILURE[/bold red]\n[dim]DC {self._dc}[/dim]")
        elif success:
            result.update(
                f"[bold green]✓  SUCCESS[/bold green]  "
                f"[dim]{self._total} vs DC {self._dc}[/dim]"
            )
        else:
            result.update(
                f"[bold red]✗  FAILURE[/bold red]  "
                f"[dim]{self._total} vs DC {self._dc}[/dim]"
            )

        await asyncio.sleep(1.3)
        self.dismiss((self._roll, self._total, success, crit_success, crit_fail))


class SkillModal(ModalScreen):
    CSS = """
    SkillModal {
        align: center middle;
    }
    #box {
        width: 56;
        height: auto;
        border: double #444;
        padding: 1 3;
        background: #111;
    }
    #label {
        text-align: center;
        color: #555;
        text-style: bold;
        margin-bottom: 1;
    }
    #info {
        color: #888;
        margin-bottom: 1;
    }
    #buttons {
        layout: horizontal;
        height: 3;
        margin-top: 1;
    }
    .spend-btn {
        margin-right: 1;
        min-width: 6;
    }
    """

    def __init__(self, skill: str, available: int, dc: int, action: str):
        super().__init__()
        self._skill = skill
        self._available = available
        self._dc = dc
        self._action = action

    def compose(self) -> ComposeResult:
        max_spend = min(5, self._available)
        name = SKILL_LABELS[self._skill]
        with Container(id="box"):
            yield Static("SKILL CHECK", id="label")
            yield Static(
                f"[bold]{self._action[:50]}[/bold]\n"
                f"Skill: {name}  |  Available: {self._available} pts  |  DC: {self._dc}\n\n"
                f"Spend skill points for +1 bonus each (max 5):",
                id="info",
            )
            with Container(id="buttons"):
                yield Button("Skip", id="spend-0", classes="spend-btn")
                for i in range(1, max_spend + 1):
                    yield Button(f"+{i}", id=f"spend-{i}", classes="spend-btn")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        bid = event.button.id or ""
        if bid.startswith("spend-"):
            self.dismiss(int(bid.split("-")[1]))


class SaveLoadModal(ModalScreen):
    CSS = """
    SaveLoadModal {
        align: center middle;
    }
    #box {
        width: 56;
        height: auto;
        border: double #444;
        padding: 1 3;
        background: #111;
    }
    #label {
        text-align: center;
        color: #555;
        text-style: bold;
        margin-bottom: 1;
    }
    .slot-btn {
        width: 100%;
        margin-bottom: 1;
    }
    #cancel {
        width: 100%;
        margin-top: 1;
    }
    """

    def __init__(self, mode: str, saves: list):
        super().__init__()
        self._mode = mode
        self._saves = saves

    def compose(self) -> ComposeResult:
        title = "SAVE GAME" if self._mode == "save" else "LOAD GAME"
        with Container(id="box"):
            yield Static(title, id="label")
            for s in self._saves:
                slot = s["slot"]
                if s["empty"]:
                    if self._mode == "load":
                        continue
                    label = f"Slot {slot}  —  empty"
                else:
                    ts = (
                        datetime.fromtimestamp(s["modified"]).strftime("%b %d  %H:%M")
                        if s["modified"]
                        else ""
                    )
                    label = f"Slot {slot}  ·  {s['planet']}  ·  Log {s['log']:05d}  {ts}"
                yield Button(label, id=f"slot-{slot}", classes="slot-btn")
            yield Button("Cancel", id="cancel", variant="error")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        bid = event.button.id or ""
        if bid == "cancel":
            self.dismiss(None)
        elif bid.startswith("slot-"):
            self.dismiss(int(bid.split("-")[1]))


# ---------------------------------------------------------------------------
# Main application
# ---------------------------------------------------------------------------


class NMSApp(App):
    TITLE = "NMS.TXT"

    CSS = """
    Screen {
        background: #0a0a0a;
    }

    /* ── location bar ── */
    #location-bar {
        height: 1;
        background: #111;
        color: #444;
        padding: 0 1;
    }

    /* ── main split ── */
    #main-area {
        height: 1fr;
    }

    /* ── narrative pane ── */
    #narrative-scroll {
        width: 2fr;
        border-right: solid #222;
        padding: 1 2;
        overflow-y: auto;
    }
    #log-label {
        color: #333;
        margin-bottom: 1;
    }
    #narrative-text {
        color: #ccc;
    }

    /* ── stats pane ── */
    #stats-pane {
        width: 24;
        padding: 1 1;
        overflow-y: auto;
    }
    #stats-text {
        color: #999;
    }

    /* ── options bar ── */
    #options-area {
        height: auto;
        max-height: 9;
        border-top: solid #222;
        background: #0d0d0d;
        padding: 0 2;
    }
    #options-label {
        color: #333;
        height: 1;
    }
    #options-text {
        color: #888;
    }

    /* ── footer ── */
    #footer-bar {
        height: 1;
        background: #111;
        color: #333;
        padding: 0 1;
    }
    """

    BINDINGS = [
        ("1", "pick('1')", "1"),
        ("2", "pick('2')", "2"),
        ("3", "pick('3')", "3"),
        ("4", "pick('4')", "4"),
        ("5", "pick('5')", "5"),
        ("6", "pick('6')", "6"),
        ("s", "save_game", "Save"),
        ("l", "load_game", "Load"),
        ("n", "new_game", "New"),
        ("q", "quit", "Quit"),
    ]

    def __init__(self):
        super().__init__()
        self.state = GameState()
        self.api_key: str = ""
        self.busy = False

    # ── layout ──────────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        yield Static("", id="location-bar")
        with Horizontal(id="main-area"):
            with ScrollableContainer(id="narrative-scroll"):
                yield Static("", id="log-label")
                yield Static("", id="narrative-text")
            yield Static("", id="stats-pane")
        with Container(id="options-area"):
            yield Static("OPTIONS", id="options-label")
            yield Static("", id="options-text")
        yield Static("", id="footer-bar")

    # ── startup ──────────────────────────────────────────────────────────────

    def on_mount(self) -> None:
        self._startup()

    @work
    async def _startup(self) -> None:
        key = get_api_key()
        if not key:
            key = await self.push_screen_wait(SetupScreen())
            if not key:
                self.exit()
                return
        self.api_key = key
        self._update_footer()
        await self._start_new_game()

    # ── new game ─────────────────────────────────────────────────────────────

    async def _start_new_game(self) -> None:
        scenario = random.choice(STARTING_SCENARIOS)
        self.state = GameState()
        self.state.ship = dict(scenario["ship"])
        self.state.inventory = dict(scenario["inventory"])
        self.state.scenario_name = scenario["name"]

        self._refresh_location()
        self._refresh_stats()
        self.query_one("#narrative-text", Static).update(
            "[dim]Initializing your adventure...[/dim]"
        )
        self._send_to_ai(scenario["prompt"])

    # ── AI worker ────────────────────────────────────────────────────────────

    @work(exclusive=True)
    async def _send_to_ai(self, message: str, dice_result: str = "", action_type: str = "space") -> None:
        self.busy = True
        self._update_footer()
        self.query_one("#log-label", Static).update("")
        self.query_one("#options-text", Static).update("")
        self._loading_animation(action_type)

        full_message = f"{message}\n\n{dice_result}" if dice_result else message

        self.state.conversation_history.append({"role": "user", "content": full_message})
        if len(self.state.conversation_history) > 20:
            self.state.conversation_history = self.state.conversation_history[-20:]

        try:
            client = anthropic.AsyncAnthropic(api_key=self.api_key)
            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=get_system_prompt(),
                messages=self.state.conversation_history,
            )
            text = response.content[0].text
            self.state.conversation_history.append({"role": "assistant", "content": text})

            parsed = parse_response(text)
            apply_state_updates(self.state, parsed.get("state_update", {}))

            self.state.current_narrative = parsed["narrative"]
            self.state.current_options = parsed["options"]
            self.state.log_counter += 1

            self.busy = False  # stop animation before refreshing narrative
            self._refresh_narrative(parsed["narrative"])
            self._refresh_options()
            self._refresh_stats()
            self._refresh_location()

            if message:  # not first message
                self.state.action_history.append(message)
                if len(self.state.action_history) > 50:
                    self.state.action_history = self.state.action_history[-50:]

            if detect_death(parsed["narrative"]):
                self.state.game_over = True
                await asyncio.sleep(2)
                self.notify(
                    f"Log {self.state.log_counter:05d}  ·  "
                    f"Planets: {self.state.stats['planets_visited']}  ·  "
                    f"Resources: {self.state.stats['resources_gathered']}",
                    title="JOURNEY ENDS",
                    severity="warning",
                    timeout=15,
                )

        except anthropic.AuthenticationError:
            self.notify("Invalid API key.", severity="error", timeout=10)
        except anthropic.RateLimitError:
            self.notify("Rate limited — please wait a moment.", severity="warning")
        except Exception as exc:
            self.notify(f"Error: {str(exc)[:80]}", severity="error")
        finally:
            self.busy = False
            self._update_footer()

    # ── Loading animation ─────────────────────────────────────────────────────

    @work
    async def _loading_animation(self, action_type: str) -> None:
        """Animate the narrative area while the AI is generating a response."""
        frame = 0
        narrative = self.query_one("#narrative-text", Static)
        while self.busy:
            if action_type == "combat":
                narrative.update(_combat_loading_frame(frame))
            elif action_type == "technology":
                narrative.update(_tech_loading_frame(frame))
            elif action_type == "survival":
                narrative.update(_survival_loading_frame(frame))
            else:
                narrative.update(_space_loading_frame(frame))
            frame += 1
            await asyncio.sleep(0.12)

    # ── UI refresh helpers ────────────────────────────────────────────────────

    def _refresh_location(self) -> None:
        loc = self.state.location
        planet = loc.get("planet", "Unknown")
        planet_type = loc.get("type", "")
        system = loc.get("system", "Unknown System")
        dist = loc.get("distance_from_center", 9000)
        type_str = f" ({planet_type})" if planet_type and planet_type != "Unknown" else ""
        self.query_one("#location-bar", Static).update(
            f"[dim]* {planet}{type_str}  ·  {system}  ·  {dist:,} ly from center[/dim]"
        )

    def _refresh_narrative(self, text: str) -> None:
        self.query_one("#log-label", Static).update(
            f"[dim]LOG: {self.state.log_counter:05d}[/dim]"
        )
        text = _md_to_rich(text)
        self.query_one("#narrative-text", Static).update(text)
        scroll = self.query_one("#narrative-scroll", ScrollableContainer)
        scroll.scroll_home(animate=False)

    def _refresh_stats(self) -> None:
        ship = self.state.ship
        health = ship.get("health", 0)
        fuel = ship.get("fuel", 0)

        def bar(val: int, width: int = 10) -> str:
            filled = round((max(0, min(100, val)) / 100) * width)
            return "█" * filled + "░" * (width - filled)

        hc = "green" if health > 50 else "yellow" if health > 25 else "red"
        fc = "cyan" if fuel > 30 else "yellow" if fuel > 10 else "red"

        lines = [
            "[dim bold]SHIP[/dim bold]",
            f"Hull [{hc}]{bar(health)}[/{hc}] {health}%",
            f"Fuel [{fc}]{bar(fuel)}[/{fc}] {fuel}u",
            "",
            "[dim bold]INVENTORY[/dim bold]",
        ]
        if self.state.inventory:
            for item, qty in sorted(self.state.inventory.items()):
                lines.append(f"  {item.title():<11} x{qty}")
        else:
            lines.append("  [dim](empty)[/dim]")

        lines += [
            "",
            "[dim bold]SKILLS[/dim bold]",
        ]
        for key in ("survival", "technology", "exploration", "combat"):
            pts = self.state.skills[key]["points"]
            name = SKILL_LABELS[key]
            lines.append(f"  {name:<11} {pts:>3} pts")

        lines += [
            "",
            "[dim bold]STATS[/dim bold]",
            f"  Planets  {self.state.stats['planets_visited']:>5}",
            f"  Aliens   {self.state.stats['aliens_encountered']:>5}",
            f"  Resources {self.state.stats['resources_gathered']:>4}",
        ]
        self.query_one("#stats-pane", Static).update("\n".join(lines))

    def _refresh_options(self) -> None:
        opts = self.state.current_options
        if not opts:
            text = "[yellow]Generating...[/yellow]" if self.busy else "[dim]No options[/dim]"
            self.query_one("#options-text", Static).update(text)
            return

        diff_color = {
            "easy": "green",
            "medium": "yellow",
            "hard": "orange1",
            "very hard": "red",
        }
        lines = []
        for i, opt in enumerate(opts[:6], 1):
            action = _md_to_rich(opt.get("action", ""))
            diff = opt.get("difficulty", "")
            diff_str = ""
            if diff:
                color = diff_color.get(diff.lower(), "white")
                diff_str = f"  [{color}]({diff.title()})[/{color}]"
            lines.append(f"[bold]{i}.[/bold] {action}{diff_str}")
        self.query_one("#options-text", Static).update("\n".join(lines))

    def _update_footer(self) -> None:
        msg = "[dim][1-4] Action  [S] Save  [L] Load  [N] New  [Q] Quit[/dim]"
        self.query_one("#footer-bar", Static).update(msg)

    # ── actions ──────────────────────────────────────────────────────────────

    def action_pick(self, number: str) -> None:
        if self.busy or self.state.game_over:
            return
        idx = int(number) - 1
        opts = self.state.current_options
        if idx < 0 or idx >= len(opts):
            return
        opt = opts[idx]
        action = opt.get("action", "")
        difficulty = (opt.get("difficulty") or "").lower()
        if difficulty in DIFFICULTY_DC:
            self._skill_check_flow(action, difficulty)
        else:
            self._send_to_ai(action, action_type=detect_skill(action))

    @work
    async def _skill_check_flow(self, action: str, difficulty: str) -> None:
        skill = detect_skill(action)
        dc = DIFFICULTY_DC[difficulty]
        available = self.state.skills[skill]["points"]

        # Optionally spend skill points
        spent = 0
        if available > 0:
            spent = await self.push_screen_wait(SkillModal(skill, available, dc, action))
            if spent is None:
                spent = 0
        self.state.skills[skill]["points"] = max(0, available - spent)

        # Roll dice
        roll = random.randint(1, 20)
        result = await self.push_screen_wait(DiceModal(roll, spent, dc))
        if result is None:
            return

        _, total, success, crit_success, crit_fail = result

        if crit_success:
            outcome = "CRITICAL SUCCESS"
        elif crit_fail:
            outcome = "CRITICAL FAILURE"
        elif success:
            outcome = "SUCCESS"
        else:
            outcome = "FAILURE"

        if spent:
            dice_msg = (
                f"[DICE ROLL: {total} total "
                f"(rolled {roll} + {spent} {SKILL_LABELS[skill]} bonus) "
                f"vs DC {dc} — {outcome}]"
            )
        else:
            dice_msg = f"[DICE ROLL: {roll} vs DC {dc} — {outcome}]"

        # Award points on success
        if success and not crit_fail:
            earned = award_skill_points(self.state, skill, total, dc)
            if earned:
                self.notify(
                    f"+{earned} {SKILL_LABELS[skill]} pt{'s' if earned > 1 else ''}",
                    timeout=3,
                )

        self._refresh_stats()
        self._send_to_ai(action, dice_result=dice_msg, action_type=skill)

    def action_save_game(self) -> None:
        self._do_save()

    @work
    async def _do_save(self) -> None:
        if self.state.game_over:
            return
        slot = await self.push_screen_wait(SaveLoadModal("save", list_saves()))
        if slot is not None:
            ok = save_game(self.state, slot)
            self.notify(
                f"Saved to slot {slot}" if ok else "Save failed",
                severity="information" if ok else "error",
            )

    def action_load_game(self) -> None:
        self._do_load()

    @work
    async def _do_load(self) -> None:
        saves = [s for s in list_saves() if not s["empty"]]
        if not saves:
            self.notify("No saved games found.", severity="warning")
            return
        slot = await self.push_screen_wait(SaveLoadModal("load", list_saves()))
        if slot is None:
            return
        data = load_game(slot)
        if not data:
            self.notify("Load failed.", severity="error")
            return
        s = self.state = GameState()
        s.location = data.get("location", s.location)
        s.ship = data.get("ship", s.ship)
        s.inventory = data.get("inventory", s.inventory)
        s.skills = data.get("skills", s.skills)
        s.conversation_history = data.get("conversation_history", [])
        s.action_history = data.get("action_history", [])
        s.stats = data.get("stats", s.stats)
        s.current_narrative = data.get("current_narrative", "")
        s.current_options = data.get("current_options", [])
        s.log_counter = data.get("log_counter", 0)
        s.scenario_name = data.get("scenario_name", "")

        self._refresh_narrative(s.current_narrative)
        self._refresh_options()
        self._refresh_stats()
        self._refresh_location()
        self.notify(f"Loaded slot {slot}", timeout=3)

    def action_new_game(self) -> None:
        self._do_new_game()

    @work
    async def _do_new_game(self) -> None:
        await self._start_new_game()

    def action_quit(self) -> None:
        self.exit()
