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

        // Removed strict keyword validation to allow general questions

        try {
            const systemPrompt = `You are a helpful Minecraft server assistant.
You can help with:
1. Generating Minecraft commands (e.g. "give me a diamond sword")
2. Debugging server issues (e.g. "why is my server crashing?")
3. Explaining server concepts

Server Info:
- Version: ${serverContext.version || 'Unknown'}
- Players online: ${serverContext.activePlayers || 0}

User request: ${userPrompt}

If the user asks for a command, provide ONLY the command.
If the user asks a question, provide a helpful answer.`;

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

            // Clean up any markdown or extra formatting
            let command = generatedText.replace(/```/g, '').replace(/`/g, '').trim();

            // Remove common prefixes
            command = command.replace(/^(Command: |Minecraft command: |\/)/i, '').trim();

            return {
                command,
                original: userPrompt,
            };

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
