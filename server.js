const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
let PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static(__dirname));

// Proxy endpoint for Claude API
app.post('/api/chat', async (req, res) => {
    console.log('📥 Received request to /api/chat');
    console.log('   Model:', req.body.model);
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
        }

        // Forward the request to Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': req.body.apiVersion || '2023-06-01'
            },
            body: JSON.stringify({
                model: req.body.model,
                max_tokens: req.body.max_tokens,
                temperature: req.body.temperature,
                system: req.body.system,
                messages: req.body.messages
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.log('❌ Anthropic API error:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ Success! Response received');
        res.json(data);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Try to start server, automatically find available port if default is taken
function startServer(port) {
    const server = app.listen(port)
        .on('listening', () => {
            console.log(`\n🚀 NMS.TXT Server running at http://localhost:${port}`);
            if (port !== 3000) {
                console.log(`   ⚠️  Port 3000 was in use, using port ${port} instead`);
            }
            console.log(`\n📱 To test on mobile/e-ink device, use your local IP address.`);
            console.log(`   Find your IP with: ifconfig | grep "inet "`);
            console.log(`\n🎮 Open http://localhost:${port} to play!\n`);
        })
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
                startServer(port + 1);
            } else {
                console.error('Server error:', err);
                process.exit(1);
            }
        });
}

startServer(PORT);
