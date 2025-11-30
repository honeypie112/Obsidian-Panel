const axios = require('axios');

/**
 * Generate Minecraft server command suggestions using Gemini AI
 */
class AICommandService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    }

    async generateCommand(userPrompt, serverContext = {}) {
        if (!this.apiKey) {
            throw new Error('Gemini API key not configured');
        }

        // Validate that the prompt is Minecraft-related
        const minecraftKeywords = [
            'minecraft', 'server', 'player', 'block', 'world', 'game', 'spawn',
            'teleport', 'give', 'gamemode', 'difficulty', 'time', 'weather',
            'op', 'deop', 'kick', 'ban', 'whitelist', 'seed', 'locate',
            'fill', 'setblock', 'summon', 'kill', 'effect', 'enchant',
            'experience', 'xp', 'creative', 'survival', 'adventure', 'spectator'
        ];

        const promptLower = userPrompt.toLowerCase();
        const isMinecraftRelated = minecraftKeywords.some(keyword =>
            promptLower.includes(keyword)
        );

        if (!isMinecraftRelated) {
            throw new Error('AI Assist is only available for Minecraft server commands. Please ask about Minecraft-related tasks.');
        }

        try {
            const systemPrompt = `You are a STRICT Minecraft server command assistant. You ONLY help with Minecraft server commands and REFUSE any other requests.

STRICT RULES:
1. ONLY respond to Minecraft server-related questions
2. If asked about anything else (write code, explain concepts, general chat, etc.), respond with: "I only help with Minecraft server commands"
3. Generate ONLY the exact command needed, nothing else
4. NO explanations, NO markdown, NO conversation
5. Commands should work on Minecraft Java Edition servers

Server Info:
- Version: ${serverContext.version || 'Unknown'}
- Players online: ${serverContext.activePlayers || 0}

User request: ${userPrompt}

If this is NOT a Minecraft server command request, respond ONLY with: "INVALID_REQUEST"
If it IS valid, respond with ONLY the command itself (no slashes, no extra text).`;

            const response = await axios.post(
                `${this.apiUrl}?key=${this.apiKey}`,
                {
                    contents: [{
                        parts: [{
                            text: systemPrompt
                        }]
                    }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!generatedText) {
                throw new Error('No response from AI');
            }

            // Check if AI refused the request
            if (generatedText.includes('INVALID_REQUEST') ||
                generatedText.toLowerCase().includes('only help with minecraft')) {
                throw new Error('AI Assist is only for Minecraft server commands');
            }

            // Clean up any markdown or extra formatting
            let command = generatedText.replace(/```/g, '').replace(/`/g, '').trim();

            // Remove common prefixes
            command = command.replace(/^(Command: |Minecraft command: |\/)/i, '').trim();

            // Additional validation: command should look like a Minecraft command
            const validCommandStarts = [
                'give', 'gamemode', 'teleport', 'tp', 'op', 'deop', 'kick', 'ban',
                'difficulty', 'time', 'weather', 'setworldspawn', 'spawnpoint',
                'fill', 'setblock', 'summon', 'kill', 'effect', 'enchant', 'say',
                'whitelist', 'list', 'seed', 'locate', 'experience', 'xp', 'clear'
            ];

            const commandStart = command.split(' ')[0].toLowerCase();
            const isValidCommand = validCommandStarts.some(cmd =>
                commandStart === cmd || commandStart.startsWith(cmd)
            );

            if (!isValidCommand) {
                throw new Error('Generated command does not appear to be a valid Minecraft command');
            }

            return {
                command,
                original: userPrompt,
            };
        } catch (error) {
            console.error('AI Command Generation Error:', error.response?.data || error.message);

            if (error.response?.status === 429) {
                throw new Error('AI rate limit exceeded. Please try again later.');
            }

            if (error.message.includes('only for Minecraft')) {
                throw error; // Pass through our custom error
            }

            throw new Error('Failed to generate command: ' + (error.message || 'Unknown error'));
        }
    }
}

module.exports = new AICommandService();
