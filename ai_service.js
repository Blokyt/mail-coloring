/**
 * AI SERVICE - Gemini API Integration
 * Handles AI-powered text analysis for automatic coloring
 * 
 * @module AIService
 */

const AIService = (() => {
    const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

    // Cache for available models
    let cachedModels = null;

    /**
     * Fetch available models from Gemini API
     * @param {string} apiKey - Google AI API key
     * @returns {Promise<string[]>} - Sorted list of model names (best first)
     */
    async function fetchAvailableModels(apiKey) {
        if (cachedModels) return cachedModels;

        const response = await fetch(`${API_BASE}/models?key=${apiKey}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();

        // Filter models that support generateContent and are text-capable
        const validModels = data.models
            .filter(m => {
                // Must support generateContent
                if (!m.supportedGenerationMethods?.includes('generateContent')) return false;

                // Exclude TTS, audio-only, vision-only, and embedding models
                const name = m.name.toLowerCase();
                if (name.includes('tts')) return false;
                if (name.includes('audio')) return false;
                if (name.includes('embedding')) return false;
                if (name.includes('aqa')) return false;
                if (name.includes('imagen')) return false;

                return true;
            })
            .map(m => m.name.replace('models/', ''));

        // Sort by quality (pro > flash > others, newer versions first)
        cachedModels = sortModelsByQuality(validModels);
        return cachedModels;
    }

    /**
     * Sort models by quality: pro > flash, newer > older
     */
    function sortModelsByQuality(models) {
        const getScore = (name) => {
            let score = 0;

            // Version scoring (2.5 > 2.0 > 1.5 > 1.0)
            if (name.includes('2.5')) score += 1000;
            else if (name.includes('2.0')) score += 800;
            else if (name.includes('1.5')) score += 600;
            else if (name.includes('1.0')) score += 400;

            // Type scoring (pro > flash > others)
            if (name.includes('-pro')) score += 100;
            else if (name.includes('-flash')) score += 50;

            // Penalize experimental/preview
            if (name.includes('exp') || name.includes('preview')) score -= 10;

            return score;
        };

        return models.sort((a, b) => getScore(b) - getScore(a));
    }

    /**
     * Analyze text and identify important words to color
     * @param {string} text - Text to analyze
     * @param {string} apiKey - Google AI API key
     * @param {number} density - Percentage of words to color (0-100)
     * @returns {Promise<{words: string[], model: string}>}
     */
    async function analyzeTextForColoring(text, apiKey, density = 30) {
        const models = await fetchAvailableModels(apiKey);

        if (models.length === 0) {
            throw new Error('No compatible models available');
        }

        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const targetWords = Math.max(1, Math.round(wordCount * (density / 100)));

        const prompt = `Tu es un assistant qui identifie les mots importants dans un texte pour les mettre en couleur.

Analyse ce texte et retourne EXACTEMENT ${targetWords} mots importants à colorier.
Choisis les mots les plus significatifs, impactants ou émotionnels.

RÈGLES:
- Retourne les mots EXACTEMENT comme ils apparaissent dans le texte (même casse)
- Ne retourne que des mots qui existent dans le texte
- Format: JSON array uniquement, exemple: ["mot1", "mot2", "mot3"]

TEXTE À ANALYSER:
${text}

Réponse (JSON array uniquement):`;

        // Try each model with fallback on quota errors
        let lastError = null;

        for (const model of models) {
            try {
                const result = await callGeminiAPI(model, prompt, apiKey);
                const words = parseWordsFromResponse(result, text);

                if (words.length > 0) {
                    return { words, model };
                }
            } catch (error) {
                lastError = error;

                // Only retry on quota/rate limit errors (429)
                if (!error.message.includes('429') && !error.message.includes('quota')) {
                    throw error;
                }
                console.warn(`Model ${model} quota exceeded, trying next...`);
            }
        }

        throw lastError || new Error('All models failed');
    }

    /**
     * Call Gemini API with a specific model
     */
    async function callGeminiAPI(model, prompt, apiKey) {
        const response = await fetch(
            `${API_BASE}/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API error ${response.status}: ${errorData.error?.message || 'Unknown'}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    /**
     * Parse words from AI response and validate they exist in original text
     */
    function parseWordsFromResponse(response, originalText) {
        try {
            // Extract JSON array from response
            const jsonMatch = response.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) return [];

            const words = JSON.parse(jsonMatch[0]);

            // Validate words exist in original text
            return words.filter(word =>
                typeof word === 'string' &&
                originalText.includes(word)
            );
        } catch {
            return [];
        }
    }

    /**
     * Clear cached models (useful if API key changes)
     */
    function clearCache() {
        cachedModels = null;
    }

    /**
     * Analyze text and identify words that should get emojis
     * @param {string} text - Text to analyze
     * @param {string} apiKey - Google AI API key
     * @param {number} density - Percentage of words to emojify (0-100)
     * @returns {Promise<{emojis: {word: string, emoji: string}[], model: string}>}
     */
    async function analyzeTextForEmojis(text, apiKey, density = 20) {
        const models = await fetchAvailableModels(apiKey);

        if (models.length === 0) {
            throw new Error('No compatible models available');
        }

        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const targetEmojis = Math.max(1, Math.round(wordCount * (density / 100)));

        const prompt = `Identifie ${targetEmojis} mots importants dans ce texte et donne un emoji pertinent pour chacun.
Retourne UNIQUEMENT un JSON array: [{"word": "soleil", "emoji": "☀️"}, {"word": "fête", "emoji": "🎉"}]

Texte: ${text}

Réponse:`;

        let lastError = null;

        for (const model of models) {
            try {
                const result = await callGeminiAPI(model, prompt, apiKey);
                const emojis = parseEmojisFromResponse(result, text);

                if (emojis.length > 0) {
                    return { emojis, model };
                }
            } catch (error) {
                lastError = error;
                if (!error.message.includes('429') && !error.message.includes('quota')) throw error;
            }
        }

        throw lastError || new Error('All models failed');
    }

    /**
     * Parse emojis from AI response
     */
    function parseEmojisFromResponse(response, originalText) {
        try {
            const jsonMatch = response.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) return [];

            const items = JSON.parse(jsonMatch[0]);
            return items.filter(item =>
                item && typeof item.word === 'string' &&
                item.emoji && originalText.includes(item.word)
            );
        } catch {
            return [];
        }
    }

    /**
     * Get a relevant emoji for the given text
     * @param {string} text - Text to analyze
     * @param {string} apiKey - Google AI API key
     * @returns {Promise<{emoji: string, model: string}>}
     */
    async function getEmojiForText(text, apiKey) {
        const models = await fetchAvailableModels(apiKey);

        if (models.length === 0) {
            throw new Error('No compatible models available');
        }

        const prompt = `Tu dois trouver UN SEUL emoji qui correspond le mieux au texte donné.

TEXTE: "${text}"

RÈGLES:
- Retourne UNIQUEMENT l'emoji, rien d'autre
- Un seul emoji
- Choisis l'emoji le plus pertinent et représentatif

Réponse (emoji uniquement):`;

        let lastError = null;

        for (const model of models) {
            try {
                const result = await callGeminiAPI(model, prompt, apiKey);
                const emoji = extractEmoji(result);

                if (emoji) {
                    return { emoji, model };
                }
            } catch (error) {
                lastError = error;

                if (!error.message.includes('429') && !error.message.includes('quota')) {
                    throw error;
                }
                console.warn(`Model ${model} quota exceeded, trying next...`);
            }
        }

        throw lastError || new Error('All models failed');
    }

    /**
     * Extract first emoji from text
     */
    function extractEmoji(text) {
        const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
        const match = text.match(emojiRegex);
        return match ? match[0] : null;
    }

    // Public API
    return {
        fetchAvailableModels,
        analyzeTextForColoring,
        analyzeTextForEmojis,
        getEmojiForText,
        clearCache
    };
})();

// Export for browser
window.AIService = AIService;
