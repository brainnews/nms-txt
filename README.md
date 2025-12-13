# NMS.TXT

A text-based space exploration game inspired by No Man's Sky, powered by the Claude API. Features procedurally generated narrative gameplay with D&D-style dice mechanics, optimized for e-ink devices and mobile.

## Live Demo

🎮 **Play now:** [nms.milesgilbert.xyz](https://nms.milesgilbert.xyz)

## Features

- 🌌 Procedurally generated planets, aliens, and events
- 🎲 D&D-style dice roll mechanics for actions
- 📝 Rich markdown-formatted narratives
- 💾 5 manual save slots + auto-save
- 📱 Optimized for e-ink devices (Boox Palma) and mobile
- 🎨 Minimal, high-contrast design for readability

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- Claude API key ([get one here](https://console.anthropic.com/))

### Setup

```bash
# Install dependencies
npm install

# Start the local server
npm start

# Open http://localhost:3000
```

For mobile/e-ink device testing, find your local IP:
```bash
ifconfig | grep "inet "
```

Then access `http://<YOUR_IP>:3000` from your device.

## Deployment

This project is deployed to Cloudflare Pages with Cloudflare Functions handling the API proxy.

### Deploy to Cloudflare Pages

1. Push your changes to GitHub
2. In Cloudflare Dashboard → Pages → Create a project
3. Connect your GitHub repository
4. Configure build settings:
   - Build command: (leave empty)
   - Build output directory: `/`
5. Deploy!
6. Add custom domain: `nms.milesgilbert.xyz`

The `/functions/api/chat.js` file automatically becomes a serverless endpoint at `/api/chat`.

## Architecture

- **Frontend:** Single-file HTML/CSS/JS (`index.html`)
- **Backend:** Cloudflare Functions (or local Express server for development)
- **API:** Claude Messages API for narrative generation
- **Storage:** Browser localStorage for saves and API keys

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Tech Stack

- Vanilla JavaScript (no build process)
- [marked.js](https://marked.js.org/) for markdown rendering
- [Claude API](https://www.anthropic.com/api) for AI-powered narrative
- Express.js (local dev server)
- Cloudflare Pages + Functions (production)

## Game Mechanics

- Start on a crashed planet with 15% ship health, no fuel
- Explore procedurally generated worlds
- Gather resources to repair your ship
- Navigate toward the galaxy's center
- D&D-style difficulty: Easy (DC 8), Medium (DC 12), Hard (DC 16), Very Hard (DC 20)

## License

MIT

## Credits

Built with [Claude Code](https://claude.com/claude-code)
