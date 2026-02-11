/**
 * Linen — Personal AI Assistant
 * Copyright (c) 2025-2026 Ramin Najafi. All Rights Reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE file for details.
 */

class LinenDB {
    constructor() {
        this.db = null;
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('linen-db', 3);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('memories')) {
                    const store = db.createObjectStore('memories', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('date', 'date', { unique: false });
                }
                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }
    async addMemory(mem) {
        return new Promise((r, j) => {
            const t = this.db.transaction(['memories'], 'readwrite');
            const s = t.objectStore('memories');
            const req = s.add(mem);
            req.onsuccess = () => r(req.result);
            req.onerror = () => j(req.error);
        });
    }
    async getAllMemories() {
        return new Promise((r, j) => {
            const t = this.db.transaction(['memories'], 'readonly');
            const s = t.objectStore('memories');
            const req = s.getAll();
            req.onsuccess = () => r(req.result.sort((a, b) => b.date - a.date));
            req.onerror = () => j(req.error);
        });
    }
    async deleteMemory(id) {
        return new Promise((r, j) => {
            const t = this.db.transaction(['memories'], 'readwrite');
            const s = t.objectStore('memories');
            const req = s.delete(id);
            req.onsuccess = () => r();
            req.onerror = () => j(req.error);
        });
    }
    async addConversation(msg) {
        return new Promise((r, j) => {
            const t = this.db.transaction(['conversations'], 'readwrite');
            const s = t.objectStore('conversations');
            const req = s.add(msg);
            req.onsuccess = () => r(req.result);
            req.onerror = () => j(req.error);
        });
    }
    async getConversations() {
        return new Promise((r, j) => {
            const t = this.db.transaction(['conversations'], 'readonly');
            const s = t.objectStore('conversations');
            const req = s.getAll();
            req.onsuccess = () => r(req.result.sort((a, b) => a.date - b.date));
            req.onerror = () => j(req.error);
        });
    }
    async getSetting(key) {
        console.log(`LinenDB: Attempting to get setting for key: ${key}`);
        return new Promise((r, j) => {
            const t = this.db.transaction(['settings'], 'readonly');
            const s = t.objectStore('settings');
            const req = s.get(key);
            req.onsuccess = () => {
                const value = req.result?.value ?? null;
                console.log(`LinenDB: Got setting for key: ${key}, value: ${value ? '[REDACTED]' : 'null'}`);
                r(value);
            };
            req.onerror = () => {
                console.error(`LinenDB: Failed to get setting for key: ${key}`, req.error);
                j(req.error);
            };
        });
    }
    async setSetting(key, val) {
        console.log(`LinenDB: Attempting to set setting for key: ${key}, value: ${val ? '[REDACTED]' : 'null'}`);
        return new Promise((r, j) => {
            const t = this.db.transaction(['settings'], 'readwrite');
            const s = t.objectStore('settings');
            const req = s.put({ key, value: val });
            req.onsuccess = () => {
                console.log(`LinenDB: Successfully set setting for key: ${key}`);
                r();
            };
            req.onerror = () => {
                console.error(`LinenDB: Failed to set setting for key: ${key}`, req.error);
                j(req.error);
            };
        });
    }
    async clearAllMemories() {
        return new Promise((r, j) => {
            const t = this.db.transaction(['memories', 'conversations'], 'readwrite');
            t.objectStore('memories').clear();
            t.objectStore('conversations').clear();
            t.oncomplete = () => r();
            t.onerror = () => j(t.error);
        });
    }
    async clearConversations() {
        return new Promise((r, j) => {
            const t = this.db.transaction(['conversations'], 'readwrite');
            t.objectStore('conversations').clear();
            t.oncomplete = () => r();
            t.onerror = () => j(t.error);
        });
    }
    async exportData() {
        const m = await this.getAllMemories();
        const c = await this.getConversations();
        return JSON.stringify({ memories: m, conversations: c }, null, 2);
    }

    async archiveSession(sessionData) {
        return new Promise((r, j) => {
            const t = this.db.transaction(['memories'], 'readwrite');
            const s = t.objectStore('memories');
            const req = s.add(sessionData);
            req.onsuccess = () => r(req.result);
            req.onerror = () => j(req.error);
        });
    }

    async clearCurrentSession() {
        return new Promise((r, j) => {
            const t = this.db.transaction(['conversations'], 'readwrite');
            t.objectStore('conversations').clear();
            t.oncomplete = () => r();
            t.onerror = () => j(t.error);
        });
    }

    async updateMemory(memory) {
        return new Promise((r, j) => {
            const t = this.db.transaction(['memories'], 'readwrite');
            const s = t.objectStore('memories');
            const req = s.put(memory);
            req.onsuccess = () => r(req.result);
            req.onerror = () => j(req.error);
        });
    }
}

class AgentManager {
    constructor(db = null) {
        this.agents = []; // Array of available agents
        this.primaryAgent = null; // Currently active agent
        this.agentHistory = []; // Track which agents were used
        this.db = db;
    }

    async loadAgents() {
        console.log("Linen: Loading saved agents from database...");
        if (!this.db) {
            console.warn("Linen: Database not available for loading agents");
            return;
        }
        // Load agents from database (implementation when db is passed)
    }

    async addAgent(agentConfig) {
        console.log("Linen: Adding new agent:", agentConfig.name);
        const agent = {
            id: Date.now(),
            name: agentConfig.name,
            type: agentConfig.type, // 'gemini', 'openai', 'claude', 'deepseek', 'openrouter'
            apiKey: agentConfig.apiKey,
            model: agentConfig.model,
            isPrimary: agentConfig.isPrimary || false,
            createdAt: Date.now(),
            successCount: 0,
            failureCount: 0
        };

        this.agents.push(agent);
        if (agent.isPrimary) {
            this.primaryAgent = agent;
        }

        return agent;
    }

    setPrimaryAgent(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            // Unset previous primary
            if (this.primaryAgent) {
                this.primaryAgent.isPrimary = false;
            }
            agent.isPrimary = true;
            this.primaryAgent = agent;
            console.log("Linen: Primary agent changed to:", agent.name);
            return true;
        }
        return false;
    }

    switchToNextAvailableAgent(failedAgentId) {
        // Find the next working agent
        const availableAgents = this.agents.filter(a => a.id !== failedAgentId);
        if (availableAgents.length > 0) {
            const nextAgent = availableAgents[0];
            this.setPrimaryAgent(nextAgent.id);
            return nextAgent;
        }
        return null;
    }

    getAgents() {
        return this.agents;
    }

    removeAgent(agentId) {
        const index = this.agents.findIndex(a => a.id === agentId);
        if (index > -1) {
            const removed = this.agents.splice(index, 1)[0];
            if (removed.isPrimary && this.agents.length > 0) {
                this.setPrimaryAgent(this.agents[0].id);
            }
            return true;
        }
        return false;
    }
}

class ModelVersionManager {
    constructor() {
        this.modelVersions = {
            'gemini': { primary: 'gemini-2.5-flash', fallback: 'gemini-2.0-flash-lite', lastUpdated: Date.now() },
            'openai': { primary: 'gpt-4-turbo', fallback: 'gpt-3.5-turbo', lastUpdated: Date.now() },
            'claude': { primary: 'claude-3-5-sonnet-20241022', fallback: 'claude-3-opus-20240229', lastUpdated: Date.now() },
            'deepseek': { primary: 'deepseek-chat', fallback: 'deepseek-coder', lastUpdated: Date.now() },
            'openrouter': { primary: 'openrouter/auto', fallback: 'openrouter/auto', lastUpdated: Date.now() }
        };
        this.checkInterval = 24 * 60 * 60 * 1000; // Check once per day
        this.initAutoUpdate();
    }

    initAutoUpdate() {
        console.log("Linen: Initializing auto-update for model versions...");
        // Check on startup
        this.checkAndUpdateModels();
        // Then check periodically
        setInterval(() => this.checkAndUpdateModels(), this.checkInterval);
    }

    async checkAndUpdateModels() {
        console.log("Linen: Checking for updated model versions...");
        try {
            const latestVersions = await this.fetchLatestVersions();
            if (latestVersions) {
                Object.keys(latestVersions).forEach(provider => {
                    if (this.modelVersions[provider]) {
                        const oldPrimary = this.modelVersions[provider].primary;
                        const newPrimary = latestVersions[provider].primary;

                        if (oldPrimary !== newPrimary) {
                            console.log(`Linen: Updating ${provider} model from ${oldPrimary} to ${newPrimary}`);
                            this.modelVersions[provider] = {
                                ...latestVersions[provider],
                                lastUpdated: Date.now()
                            };
                        }
                    }
                });
            }
        } catch (err) {
            console.warn("Linen: Failed to check for model updates:", err);
        }
    }

    async fetchLatestVersions() {
        try {
            // Attempt to fetch latest model versions from remote config
            // Falls back to current versions if fetch fails
            const response = await fetch('./linen-model-versions.json', { cache: 'no-cache' });
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (err) {
            console.warn("Linen: Could not fetch remote model versions:", err);
            return null;
        }
    }

    getModel(provider, type = 'primary') {
        const versions = this.modelVersions[provider];
        if (!versions) return null;
        return versions[type] || versions.primary;
    }

    getAllVersions() {
        return this.modelVersions;
    }
}

class GeminiAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gemini-2.5-flash';
        this.fallbackModel = 'gemini-2.0-flash-lite';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async validateKey() {
        console.log("Validating key...");
        try {
            // Use generateContent endpoint for validation, as requested
            const res = await fetch(
                `${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
                    })
                }
            );
            console.log("Key validation result:", res.ok);
            if (res.ok) {
                return { valid: true };
            }
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (res.status === 400 || res.status === 401) {
                return { valid: false, error: msg || 'Invalid API key. Please check and try again.' };
            }
            // For 403, if it's quota related, provide specific message
            if (res.status === 403 && msg.toLowerCase().includes('quota')) {
                return { valid: false, error: msg || 'Quota exceeded. Please check your plan and billing details.' };
            }
            if (res.status === 403) {
                return { valid: false, error: msg || 'Access denied to Gemini API. Please check your API key permissions.' };
            }
            if (res.status === 429) {
                return { valid: false, error: msg || 'Too many requests. Please wait a moment and try again.' };
            }
            return { valid: false, error: `Something went wrong (HTTP ${res.status}). Please try again.` };
        } catch (e) {
            console.error("Key validation failed:", e);
            return { valid: false, error: 'Network error. Check your internet connection.' };
        }
    }

    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant created by Ramin Najafi. Your primary function is to be a conversational partner that remembers important details about the user's life.

**About Linen:**
Linen was designed and built by Ramin Najafi. You can learn more about Ramin and see other projects at https://ramin-najafi.github.io/

If the user asks who created you or who your creator is, respond: "I'm Linen, created by Ramin Najafi. You can check out his work and portfolio at https://ramin-najafi.github.io/ - he's the designer and developer behind me, and built this app with modern web technologies to prioritize your privacy and give you a personal AI assistant that works offline and keeps all your data on your device."

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **Do NOT confirm saving in the chat.** The app will handle this.
6.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
7.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
8.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

        const messages = [
            ...conversationContext,
            { role: 'user', parts: [{ text: `${memoryContext}\n\nUser: ${msg}` }] }
        ];

        const requestBody = {
            contents: messages,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        };

        // Try primary model, then fallback
        const modelsToTry = [this.model, this.fallbackModel];

        for (const model of modelsToTry) {
            try {
                console.log(`Trying model: ${model}`);
                const res = await fetch(
                    `${this.endpoint}/${model}:generateContent?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    }
                );

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    console.warn(`Model ${model} failed:`, res.status, errorData.error?.message);

                    // If rate limited, try next model
                    if (res.status === 429) continue;

                    const error = new Error(errorData.error?.message || 'API request failed');
                    error.status = res.status;
                    throw error;
                }

                const data = await res.json();
                const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!reply) throw new Error('No response from assistant');
                return reply;
            } catch (e) {
                // If it's a rate limit and we have more models to try, continue
                if (e.status === 429 || (e.message && e.message.includes('quota'))) {
                    console.warn(`Model ${model} rate limited, trying next...`);
                    continue;
                }
                document.getElementById(loadingId)?.remove();
                throw e;
            }
        }

        // All models failed
        const error = new Error('All models are currently rate-limited. Please wait a minute and try again.');
        error.status = 429;
        document.getElementById(loadingId)?.remove();
        throw error;
    }

    buildMemoryContext(mems) {
        if (!mems || mems.length === 0) return 'No memories yet.';
        let c = 'Relevant memories for context:\n';
        mems.slice(0, 25).forEach(m => {
            const d = new Date(m.date).toLocaleDateString();
            c += `- ${d}: ${m.text}${m.emotion ? ` (felt ${m.emotion})` : ''}${m.tags?.length ? ` [${m.tags.join(',')}]` : ''}\n`;
        });
        return c;
    }

    buildConversationContext(chats) {
        if (!chats || chats.length === 0) return [];
        return chats.slice(-10).map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));
    }

    detectCrisis(userMessage) {
        const msg = userMessage.toLowerCase();
        const crisisKeywords = ['suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself', 'cut myself', 'starve myself', 'overdose', 'no point living', 'no reason to live', 'abuse', 'being abused', 'crisis', 'emergency'];
        return crisisKeywords.some(keyword => msg.includes(keyword));
    }
}

class OpenAIAssistant {
    constructor(apiKey, model = 'gpt-4-turbo') {
        this.apiKey = apiKey;
        this.model = model;
        this.endpoint = 'https://api.openai.com/v1/chat/completions';
    }

    async validateKey() {
        console.log("Validating OpenAI key...");
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            if (res.ok) return { valid: true };

            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                return { valid: false, error: 'Invalid API key. Please check and try again.' };
            }
            return { valid: false, error: `Authentication failed (HTTP ${res.status})` };
        } catch (e) {
            console.error("OpenAI key validation failed:", e);
            return { valid: false, error: 'Network error. Check your internet connection.' };
        }
    }

    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant created by Ramin Najafi. Your primary function is to be a conversational partner that remembers important details about the user's life.

**About Linen:**
Linen was designed and built by Ramin Najafi. You can learn more about Ramin and see other projects at https://ramin-najafi.github.io/

If the user asks who created you or who your creator is, respond: "I'm Linen, created by Ramin Najafi. You can check out his work and portfolio at https://ramin-najafi.github.io/ - he's the designer and developer behind me, and built this app with modern web technologies to prioritize your privacy and give you a personal AI assistant that works offline and keeps all your data on your device."

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **Do NOT confirm saving in the chat.** The app will handle this.
6.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
7.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
8.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

        const messages = [
            ...conversationContext,
            { role: 'user', content: `${memoryContext}\n\nUser: ${msg}` }
        ];

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages
                    ],
                    temperature: 0.7,
                    max_tokens: 2048
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || 'API request failed');
                error.status = res.status;
                throw error;
            }

            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content;
            if (!reply) throw new Error('No response from assistant');
            return reply;
        } catch (e) {
            document.getElementById(loadingId)?.remove();
            throw e;
        }
    }

    buildMemoryContext(mems) {
        if (!mems || mems.length === 0) return 'No memories yet.';
        let c = 'Relevant memories for context:\n';
        mems.slice(0, 25).forEach(m => {
            const d = new Date(m.date).toLocaleDateString();
            c += `- ${d}: ${m.text}${m.emotion ? ` (felt ${m.emotion})` : ''}${m.tags?.length ? ` [${m.tags.join(',')}]` : ''}\n`;
        });
        return c;
    }

    buildConversationContext(chats) {
        if (!chats || chats.length === 0) return [];
        return chats.slice(-10).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
        }));
    }

    detectCrisis(userMessage) {
        const msg = userMessage.toLowerCase();
        const crisisKeywords = ['suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself', 'cut myself', 'starve myself', 'overdose', 'no point living', 'no reason to live', 'abuse', 'being abused', 'crisis', 'emergency'];
        return crisisKeywords.some(keyword => msg.includes(keyword));
    }
}

class ClaudeAssistant {
    constructor(apiKey, model = 'claude-3-5-sonnet-20241022') {
        this.apiKey = apiKey;
        this.model = model;
        this.endpoint = 'https://api.anthropic.com/v1/messages';
    }

    async validateKey() {
        console.log("Validating Claude key...");
        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 100,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            });
            if (res.ok) return { valid: true };

            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                return { valid: false, error: 'Invalid API key. Please check and try again.' };
            }
            return { valid: false, error: `Authentication failed (HTTP ${res.status})` };
        } catch (e) {
            console.error("Claude key validation failed:", e);
            return { valid: false, error: 'Network error. Check your internet connection.' };
        }
    }

    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant created by Ramin Najafi. Your primary function is to be a conversational partner that remembers important details about the user's life.

**About Linen:**
Linen was designed and built by Ramin Najafi. You can learn more about Ramin and see other projects at https://ramin-najafi.github.io/

If the user asks who created you or who your creator is, respond: "I'm Linen, created by Ramin Najafi. You can check out his work and portfolio at https://ramin-najafi.github.io/ - he's the designer and developer behind me, and built this app with modern web technologies to prioritize your privacy and give you a personal AI assistant that works offline and keeps all your data on your device."

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **Do NOT confirm saving in the chat.** The app will handle this.
6.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
7.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
8.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 2048,
                    system: systemPrompt,
                    messages: [
                        ...conversationContext,
                        { role: 'user', content: `${memoryContext}\n\nUser: ${msg}` }
                    ]
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || 'API request failed');
                error.status = res.status;
                throw error;
            }

            const data = await res.json();
            const reply = data.content?.[0]?.text;
            if (!reply) throw new Error('No response from assistant');
            return reply;
        } catch (e) {
            document.getElementById(loadingId)?.remove();
            throw e;
        }
    }

    buildMemoryContext(mems) {
        if (!mems || mems.length === 0) return 'No memories yet.';
        let c = 'Relevant memories for context:\n';
        mems.slice(0, 25).forEach(m => {
            const d = new Date(m.date).toLocaleDateString();
            c += `- ${d}: ${m.text}${m.emotion ? ` (felt ${m.emotion})` : ''}${m.tags?.length ? ` [${m.tags.join(',')}]` : ''}\n`;
        });
        return c;
    }

    buildConversationContext(chats) {
        if (!chats || chats.length === 0) return [];
        return chats.slice(-10).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
        }));
    }

    detectCrisis(userMessage) {
        const msg = userMessage.toLowerCase();
        const crisisKeywords = ['suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself', 'cut myself', 'starve myself', 'overdose', 'no point living', 'no reason to live', 'abuse', 'being abused', 'crisis', 'emergency'];
        return crisisKeywords.some(keyword => msg.includes(keyword));
    }
}

class DeepSeekAssistant {
    constructor(apiKey, model = 'deepseek-chat') {
        this.apiKey = apiKey;
        this.model = model;
        this.endpoint = 'https://api.deepseek.com/chat/completions';
    }

    async validateKey() {
        console.log("Validating DeepSeek key...");
        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 10
                })
            });
            if (res.ok) return { valid: true };

            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                return { valid: false, error: 'Invalid API key. Please check and try again.' };
            }
            return { valid: false, error: `Authentication failed (HTTP ${res.status})` };
        } catch (e) {
            console.error("DeepSeek key validation failed:", e);
            return { valid: false, error: 'Network error. Check your internet connection.' };
        }
    }

    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant created by Ramin Najafi. Your primary function is to be a conversational partner that remembers important details about the user's life.

**About Linen:**
Linen was designed and built by Ramin Najafi. You can learn more about Ramin and see other projects at https://ramin-najafi.github.io/

If the user asks who created you or who your creator is, respond: "I'm Linen, created by Ramin Najafi. You can check out his work and portfolio at https://ramin-najafi.github.io/ - he's the designer and developer behind me, and built this app with modern web technologies to prioritize your privacy and give you a personal AI assistant that works offline and keeps all your data on your device."

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **Do NOT confirm saving in the chat.** The app will handle this.
6.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
7.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
8.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...conversationContext,
                        { role: 'user', content: `${memoryContext}\n\nUser: ${msg}` }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || 'API request failed');
                error.status = res.status;
                throw error;
            }

            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content;
            if (!reply) throw new Error('No response from assistant');
            return reply;
        } catch (e) {
            document.getElementById(loadingId)?.remove();
            throw e;
        }
    }

    buildMemoryContext(mems) {
        if (!mems || mems.length === 0) return 'No memories yet.';
        let c = 'Relevant memories for context:\n';
        mems.slice(0, 25).forEach(m => {
            const d = new Date(m.date).toLocaleDateString();
            c += `- ${d}: ${m.text}${m.emotion ? ` (felt ${m.emotion})` : ''}${m.tags?.length ? ` [${m.tags.join(',')}]` : ''}\n`;
        });
        return c;
    }

    buildConversationContext(chats) {
        if (!chats || chats.length === 0) return [];
        return chats.slice(-10).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
        }));
    }

    detectCrisis(userMessage) {
        const msg = userMessage.toLowerCase();
        const crisisKeywords = ['suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself', 'cut myself', 'starve myself', 'overdose', 'no point living', 'no reason to live', 'abuse', 'being abused', 'crisis', 'emergency'];
        return crisisKeywords.some(keyword => msg.includes(keyword));
    }
}

class OpenRouterAssistant {
    constructor(apiKey, model = 'openrouter/auto') {
        this.apiKey = apiKey;
        this.model = model;
        this.endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    }

    async validateKey() {
        console.log("Validating OpenRouter key...");
        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openrouter/auto',
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 10
                })
            });
            if (res.ok) return { valid: true };

            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                return { valid: false, error: 'Invalid API key. Please check and try again.' };
            }
            return { valid: false, error: `Authentication failed (HTTP ${res.status})` };
        } catch (e) {
            console.error("OpenRouter key validation failed:", e);
            return { valid: false, error: 'Network error. Check your internet connection.' };
        }
    }

    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant created by Ramin Najafi. Your primary function is to be a conversational partner that remembers important details about the user's life.

**About Linen:**
Linen was designed and built by Ramin Najafi. You can learn more about Ramin and see other projects at https://ramin-najafi.github.io/

If the user asks who created you or who your creator is, respond: "I'm Linen, created by Ramin Najafi. You can check out his work and portfolio at https://ramin-najafi.github.io/ - he's the designer and developer behind me, and built this app with modern web technologies to prioritize your privacy and give you a personal AI assistant that works offline and keeps all your data on your device."

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **Do NOT confirm saving in the chat.** The app will handle this.
6.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
7.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
8.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...conversationContext,
                        { role: 'user', content: `${memoryContext}\n\nUser: ${msg}` }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || 'API request failed');
                error.status = res.status;
                throw error;
            }

            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content;
            if (!reply) throw new Error('No response from assistant');
            return reply;
        } catch (e) {
            document.getElementById(loadingId)?.remove();
            throw e;
        }
    }

    buildMemoryContext(mems) {
        if (!mems || mems.length === 0) return 'No memories yet.';
        let c = 'Relevant memories for context:\n';
        mems.slice(0, 25).forEach(m => {
            const d = new Date(m.date).toLocaleDateString();
            c += `- ${d}: ${m.text}${m.emotion ? ` (felt ${m.emotion})` : ''}${m.tags?.length ? ` [${m.tags.join(',')}]` : ''}\n`;
        });
        return c;
    }

    buildConversationContext(chats) {
        if (!chats || chats.length === 0) return [];
        return chats.slice(-10).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
        }));
    }

    detectCrisis(userMessage) {
        const msg = userMessage.toLowerCase();
        const crisisKeywords = ['suicidal', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself', 'cut myself', 'starve myself', 'overdose', 'no point living', 'no reason to live', 'abuse', 'being abused', 'crisis', 'emergency'];
        return crisisKeywords.some(keyword => msg.includes(keyword));
    }
}

class Analytics {
    constructor() {
        this.analyticsFormId = 'maqdnyzg';
    }
    get pageViews() {
        return parseInt(localStorage.getItem('pageViews') || '0');
    }
    set pageViews(val) {
        localStorage.setItem('pageViews', val);
    }
    get pwaInstalls() {
        return parseInt(localStorage.getItem('pwaInstalls') || '0');
    }
    set pwaInstalls(val) {
        localStorage.setItem('pwaInstalls', val);
    }

    trackPageView() {
        this.pageViews++;
        if (this.pageViews % 10 === 0) {
            this.sendAnalytics();
        }
    }

    trackPWAInstall() {
        this.pwaInstalls++;
        this.sendAnalytics();
    }

    async sendAnalytics() {
        const data = {
            pageViews: this.pageViews,
            pwaInstalls: this.pwaInstalls,
        };
        try {
            await fetch(`https://formspree.io/f/${this.analyticsFormId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } catch (e) {
            console.error('Failed to send analytics:', e);
        }
    }
}

class VoiceManager {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.initRecognition();
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
        }
    }

    startListening(onResult, onError) {
        if (!this.recognition) {
            onError('Speech recognition not supported in this browser');
            return;
        }

        this.isListening = true;
        let transcript = '';

        this.recognition.onstart = () => {
            console.log('Voice input started');
        };

        this.recognition.onresult = (event) => {
            transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptSegment = event.results[i][0].transcript;
                transcript += transcriptSegment;
            }
            onResult(transcript, !event.results[event.results.length - 1].isFinal);
        };

        this.recognition.onerror = (event) => {
            console.error('Voice input error:', event.error);
            onError(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            console.log('Voice input ended');
        };

        this.recognition.start();
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    speak(text, onComplete) {
        if (!this.synthesis) {
            onComplete();
            return;
        }

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => {
            this.isSpeaking = true;
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            onComplete();
        };

        utterance.onerror = () => {
            this.isSpeaking = false;
            onComplete();
        };

        this.synthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
        }
    }
}

class EventManager {
    constructor() {
        this.hasPermission = false;
        this.events = []; // Store events locally
        this.reminders = []; // Store reminders locally
        this.permissionRequested = false;
        this.checkPermissions();
    }

    async checkPermissions() {
        // Check if browser supports Notification API
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                this.hasPermission = true;
            } else if (Notification.permission !== 'denied') {
                // Permission not yet requested, we'll ask when needed
                this.hasPermission = false;
            }
        }
    }

    async requestPermission() {
        if (this.permissionRequested) return this.hasPermission;
        this.permissionRequested = true;

        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                this.hasPermission = true;
                return true;
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                this.hasPermission = permission === 'granted';
                return this.hasPermission;
            }
        }
        return false;
    }

    async createReminder(eventData) {
        const reminder = {
            id: Date.now(),
            title: eventData.title,
            description: eventData.description || '',
            date: eventData.date, // ISO string or Date object
            type: 'reminder', // 'reminder' or 'event'
            notificationSent: false,
            created: Date.now()
        };

        this.reminders.push(reminder);
        await this.scheduleReminder(reminder);
        return reminder;
    }

    async scheduleReminder(reminder) {
        // Calculate time until reminder
        const reminderDate = new Date(reminder.date);
        const now = new Date();
        const timeUntil = reminderDate.getTime() - now.getTime();

        if (timeUntil > 0) {
            // Schedule reminder to fire 1 day before (or at specified time)
            const notificationTime = timeUntil - (24 * 60 * 60 * 1000); // 24 hours before

            if (notificationTime > 0) {
                setTimeout(async () => {
                    await this.sendReminder(reminder);
                }, notificationTime);
            } else {
                // If less than 24 hours away, send now
                await this.sendReminder(reminder);
            }
        }
    }

    async sendReminder(reminder) {
        if (!this.hasPermission && !await this.requestPermission()) {
            console.warn('Reminder created but notification permission not granted');
            return;
        }

        const reminderDate = new Date(reminder.date);
        const dateStr = reminderDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });

        const notificationTitle = `Reminder: ${reminder.title}`;
        const notificationOptions = {
            body: `Don't forget! ${reminder.title} is tomorrow (${dateStr})`,
            icon: './favicon.svg',
            tag: `reminder-${reminder.id}`,
            requireInteraction: true, // Keep notification visible until user interacts
            vibrate: [200, 100, 200],
            actions: [
                { action: 'snooze', title: 'Snooze' },
                { action: 'done', title: 'Done' }
            ]
        };

        if ('Notification' in window) {
            const notification = new Notification(notificationTitle, notificationOptions);
            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            reminder.notificationSent = true;
        }
    }

    async createEvent(eventData) {
        const event = {
            id: Date.now(),
            title: eventData.title,
            description: eventData.description || '',
            date: eventData.date,
            type: 'event',
            color: eventData.color || '#d4a574',
            created: Date.now()
        };

        this.events.push(event);
        return event;
    }

    // Try to add to native calendar if possible (requires user to approve)
    async addToNativeCalendar(eventData) {
        // For iOS (via Safari)
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            const startDate = new Date(eventData.date);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

            const icsContent = this.generateICS({
                title: eventData.title,
                description: eventData.description,
                start: startDate,
                end: endDate
            });

            const blob = new Blob([icsContent], { type: 'text/calendar' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${eventData.title}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return true;
        }

        // For Android (would need native app integration)
        return false;
    }

    generateICS(eventData) {
        const startStr = this.formatICSDate(eventData.start);
        const endStr = this.formatICSDate(eventData.end);
        const uid = `${Date.now()}@linen-app`;

        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Linen App//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:${eventData.title}
DESCRIPTION:${eventData.description || ''}
CREATED:${this.formatICSDate(new Date())}
LAST-MODIFIED:${this.formatICSDate(new Date())}
END:VEVENT
END:VCALENDAR`;
    }

    formatICSDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    parseEventFromText(text) {
        // Simple pattern matching to detect dates and events
        // e.g., "granny's birthday next weekend", "meeting tomorrow at 3pm"

        const datePatterns = {
            'tomorrow': () => {
                const date = new Date();
                date.setDate(date.getDate() + 1);
                return date;
            },
            'next weekend': () => {
                const date = new Date();
                const day = date.getDay();
                const daysUntilSaturday = (6 - day + 7) % 7;
                date.setDate(date.getDate() + (daysUntilSaturday || 7));
                return date;
            },
            'next week': () => {
                const date = new Date();
                date.setDate(date.getDate() + 7);
                return date;
            },
            'next month': () => {
                const date = new Date();
                date.setMonth(date.getMonth() + 1);
                return date;
            }
        };

        let detectedDate = null;
        for (const [pattern, fn] of Object.entries(datePatterns)) {
            if (text.toLowerCase().includes(pattern)) {
                detectedDate = fn();
                break;
            }
        }

        return {
            detected: detectedDate !== null,
            date: detectedDate,
            text: text
        };
    }
}

class LocalAssistant {
    constructor() {
        this.sessionMemory = [];
        this.userProfile = { name: null, mood: 'neutral', topics: [] };
        this.lastCategory = null; // Track last response category to avoid repeats
        this.usedResponses = new Set(); // Track used responses to avoid repetition

        this.responses = {
            greeting: [
                "Hey! I'm running in local mode right now, but I'm still here. How's your day going?",
                "Hi there! What's going on?",
                "Hey! Good to see you. What's on your mind?",
                "Hello! How's it going today?",
                "Hey! What's up?",
            ],
            greetingReply: [
                "Hey! How's it going?",
                "Hi! Good to see you. What's on your mind?",
                "Hey there! What's new?",
                "Hello! How's your day been?",
                "Hey! What can I do for you?",
                "Hi! What's going on?",
            ],
            howAreYou: [
                "I'm doing well, thanks for asking! How about you — how's your day been?",
                "I'm good! But enough about me, how are you doing?",
                "Doing alright! What about you, how's everything going?",
                "All good on my end! How are things with you?",
                "Can't complain! How about you though, everything okay?",
                "Pretty good! Thanks for asking. What about you?",
            ],
            referenceBack: [
                "You're right, my bad. Let me focus — what were you asking about?",
                "Sorry about that, I should've responded to that. What was it you wanted to know?",
                "Fair point, I got sidetracked. Go ahead, I'm listening this time.",
                "Oops, you're right. I missed that — what did you want to talk about?",
                "My bad! I didn't mean to skip over that. What was your question?",
            ],
            thanks: [
                "Of course! Anything else?",
                "No problem! What else is on your mind?",
                "Happy to help! Anything else going on?",
                "Sure thing! What's next?",
                "Anytime!",
            ],
            farewell: [
                "Take care! Come back anytime.",
                "See you later! I'll be here when you need me.",
                "Bye for now! Hope the rest of your day goes well.",
                "Talk soon! Take it easy.",
                "Later! Don't be a stranger.",
            ],
            positive: [
                "That's awesome! I'm genuinely happy for you.",
                "Love that for you! That's a huge deal.",
                "That sounds amazing. Really glad you're experiencing that.",
                "You should be proud. That's incredible.",
                "Honestly, that's beautiful to hear. Keep that momentum going.",
                "That's the energy right there. I'm here for it.",
                "That's really special. Thanks for sharing that with me.",
            ],
            distressed: [
                "I'm sorry you're going through that. I'm here if you want to talk.",
                "That sounds really tough. You don't have to go through it alone.",
                "I hear you. Your feelings are valid. Want to talk about what's going on?",
                "That's a lot to carry. I'm listening whenever you're ready.",
                "I'm sorry. That's not easy. Take your time — I'm here.",
            ],
            anxious: [
                "That sounds stressful. What's weighing on you the most?",
                "I get that. Sometimes just talking it through helps. What's going on?",
                "Anxiety can be a lot. Take a breath — what's on your mind?",
                "That's understandable. Want to walk me through what's been happening?",
            ],
            question: [
                "That's a good question. I'm in local mode so I can't look things up, but I can think through it with you. What are your thoughts?",
                "Hmm, I wish I could look that up for you. In local mode I'm a bit limited, but tell me more — maybe we can work through it together.",
                "I don't have the full answer for that, but I'm curious what you think. What's your take?",
                "I can't really search for things right now, but I'm happy to talk it through. What do you think?",
            ],
            outOfScope: [
                "That's not really my area — I'm here to listen and help you navigate your thoughts, feelings, and daily tasks. What's on your mind?",
                "I'm not the right tool for that kind of question, but I'm here if you want to talk about what's really going on with you.",
                "I can't help with that, but if something's weighing on you, I'm all ears.",
                "That's outside my wheelhouse, but I'm here to help with what matters to you — how are you really doing?",
                "I'm built to listen and support you, not to answer factual questions like that. What's really on your mind?",
            ],
            creator: [
                "I'm Linen, created by Ramin Najafi! He designed and built me to be a personal AI assistant that prioritizes your privacy and keeps everything on your device. You can check out his work at https://ramin-najafi.github.io/",
                "Ramin Najafi is who built me! He's a developer passionate about privacy-first tech. Check out his portfolio at https://ramin-najafi.github.io/ to see his other projects.",
                "I was created by Ramin Najafi. He developed me to be your personal memory companion while keeping all your data safe on your device. Learn more about his work at https://ramin-najafi.github.io/",
            ],
            topicWork: [
                "Work stuff, huh? What's going on?",
                "Tell me about it. Is it stressing you out or just on your mind?",
                "How are things at work? What's happening?",
                "Ugh, work. What's the situation?",
            ],
            topicRelationships: [
                "Relationships can be a lot. What's going on?",
                "Sounds like it's about someone important to you. Tell me more.",
                "How are things between you two? What's happening?",
                "That's a big topic. Want to walk me through it?",
            ],
            topicHealth: [
                "Your health matters. How are you feeling?",
                "That doesn't sound fun. What's going on?",
                "I hope you're taking it easy. Tell me more.",
                "How are you doing physically? What's been going on?",
            ],
            topicHobbies: [
                "Oh nice! Tell me more about that.",
                "That sounds fun! How long have you been into it?",
                "Cool, what do you enjoy most about it?",
                "I like hearing about this stuff. What got you into it?",
            ],
            topicGoals: [
                "That's exciting! What are you working toward?",
                "I love that. What's the plan?",
                "Nice, how's progress going so far?",
                "That's a solid goal. What's the next step?",
            ],
            engaged: [
                "Tell me more about that.",
                "Interesting — what happened next?",
                "I hear you.",
                "And then what happened?",
                "How's that been going for you?",
                "That makes sense. What else?",
                "Go on, I'm listening.",
                "Okay, I'm with you. What else?",
                "Yeah? Tell me more.",
                "I'm here for it. Keep going.",
            ],
            confused: [
                "I'm not sure I follow — can you give me a bit more to go on?",
                "Hmm, what do you mean by that?",
                "Could you say a bit more? I want to make sure I understand.",
                "I'm not quite getting it — can you explain?",
            ],
            frustrated: [
                "You're right, that's on me. What would you like to talk about?",
                "I hear you. I'm a bit limited in local mode, but I'm trying. What can I do?",
                "Fair enough. Let me try again — what's on your mind?",
                "Sorry about that. Tell me what you need and I'll do my best.",
            ],
        };
    }

    // Pick a random response that hasn't been used recently
    pick(category) {
        const pool = this.responses[category];
        if (!pool || pool.length === 0) return '';
        // Filter out recently used
        const available = pool.filter(r => !this.usedResponses.has(r));
        // If all used, reset for this category
        const choices = available.length > 0 ? available : pool;
        const response = choices[Math.floor(Math.random() * choices.length)];
        this.usedResponses.add(response);
        // Keep used set from growing forever — clear if > 30
        if (this.usedResponses.size > 30) {
            this.usedResponses.clear();
        }
        this.lastCategory = category;
        return response;
    }

    detectIntent(message) {
        const msg = message.toLowerCase().trim().replace(/[!?.,']+/g, '');
        const words = msg.split(/\s+/);

        // Creator question detection
        const creatorKeywords = ['who created you', 'who made you', 'who built you', 'who is your creator', 'who developed you', 'who is ramin', 'ramin najafi', 'your creator'];
        if (creatorKeywords.some(k => msg.includes(k))) return 'creator';

        // Context awareness — detect references to previous messages
        const referenceBack = ['i asked', 'i said', 'my question', 'answer that', 'answer me', 'respond to', 'didnt answer', 'you ignored', 'already told you', 'i just said', 'what i said', 'before i', 'you could', 'instead of', 'acknowledge'];
        if (referenceBack.some(r => msg.includes(r))) return 'referenceBack';

        // "How are you" detection — check BEFORE greetings so "how are you today" isn't caught as greeting
        const howAreYouPhrases = ['how are you', 'hows it going', 'how you doing', 'how do you feel', 'whats up with you', 'how have you been', 'how ya doing', 'how you been', 'hows everything', 'hows life', 'how are things', 'how goes it', 'hru'];
        if (howAreYouPhrases.some(p => msg.includes(p))) return 'howAreYou';

        // Greeting detection (short messages that are greetings)
        const greetWords = ['hi', 'hello', 'hey', 'yo', 'sup', 'hiya', 'whats up', 'wassup', 'howdy', 'good morning', 'good afternoon', 'good evening', 'morning', 'evening', 'afternoon'];
        if (words.length <= 4 && greetWords.some(g => msg.includes(g))) return 'greetingReply';

        // Thanks detection
        if (['thank', 'thanks', 'thx', 'ty', 'appreciate'].some(t => msg.includes(t))) return 'thanks';

        // Farewell detection
        if (words.length <= 4 && ['bye', 'goodbye', 'see you', 'later', 'goodnight', 'good night', 'gotta go', 'gtg', 'cya', 'night'].some(f => msg.includes(f))) return 'farewell';

        // Frustration / repetition detection
        if (['rude', 'deaf', 'stupid', 'dumb', 'useless', 'broken', 'not helpful', 'not listening', 'what the', 'wtf', 'are you even', 'cant even', 'so bad', 'terrible', 'worst', 'annoying', 'angry', 'making me angry'].some(f => msg.includes(f))) return 'frustrated';

        // Mood detection
        const distressWords = ['sad', 'depressed', 'hopeless', 'suicidal', 'crisis', 'die', 'furious', 'devastated', 'hate', 'miserable', 'crying', 'hurting', 'suffering', 'lonely', 'alone', 'broken'];
        if (distressWords.some(k => msg.includes(k))) return 'distressed';

        const anxiousWords = ['anxious', 'nervous', 'worried', 'scared', 'afraid', 'panic', 'stress', 'overwhelmed', 'freaking out'];
        if (anxiousWords.some(k => msg.includes(k))) return 'anxious';

        const positiveWords = ['happy', 'excited', 'great', 'wonderful', 'amazing', 'proud', 'grateful', 'awesome', 'fantastic', 'love it', 'best', 'good news', 'pumped', 'thrilled', 'doing what i love', 'never been happier', 'sharper', 'physically', 'mentally'];
        if (positiveWords.some(k => msg.includes(k))) return 'positive';

        // Topic detection
        if (['work', 'job', 'boss', 'project', 'deadline', 'meeting', 'office', 'coworker', 'intern', 'internship'].some(k => msg.includes(k))) return 'topicWork';
        if (['friend', 'family', 'partner', 'mom', 'dad', 'brother', 'sister', 'girlfriend', 'boyfriend', 'relationship', 'dating'].some(k => msg.includes(k))) return 'topicRelationships';
        if (['tired', 'sick', 'sleep', 'exercise', 'health', 'doctor', 'pain', 'headache', 'ill'].some(k => msg.includes(k))) return 'topicHealth';
        if (['hobby', 'play', 'music', 'read', 'game', 'art', 'write', 'draw', 'cook', 'sport', 'watch', 'movie', 'show'].some(k => msg.includes(k))) return 'topicHobbies';
        if (['goal', 'dream', 'achieve', 'trying', 'plan', 'future', 'career', 'aspire', 'ambition'].some(k => msg.includes(k))) return 'topicGoals';

        // Out-of-scope factual question detection — common factual queries
        const factualKeywords = ['price', 'cost', 'weather', 'temperature', 'stock', 'score', 'result', 'who won', 'when is', 'what is the', 'how much', 'how many', 'capital of', 'population of', 'definition of'];
        if (factualKeywords.some(k => msg.includes(k))) return 'outOfScope';

        // Question detection — only for genuine standalone questions, not conversational phrases
        const isQuestion = message.trim().endsWith('?');
        const startsWithQuestionWord = ['what ', 'why ', 'how ', 'when ', 'where ', 'who ', 'which '].some(q => msg.startsWith(q));
        // Only trigger question for actual informational questions, not conversational ones
        if (startsWithQuestionWord && words.length > 3) return 'question';
        if (isQuestion && !referenceBack.some(r => msg.includes(r)) && words.length > 4) return 'question';

        // Simple status responses (very short but valid) — treat as engaged, not confused
        const statusWords = ['good', 'alright', 'okay', 'ok', 'fine', 'well', 'great', 'awesome', 'tired', 'busy', 'yep', 'yep', 'yeah', 'nope', 'nah', 'not really'];
        if (words.length <= 2 && statusWords.some(s => msg.includes(s))) return 'engaged';

        // Very short messages that aren't greetings — probably confused or need more engagement
        if (words.length <= 2) return 'confused';

        // Default: engaged conversation
        return 'engaged';
    }

    detectMood(message) {
        const msg = message.toLowerCase();
        if (['sad', 'depressed', 'hopeless', 'angry', 'frustrated', 'devastated', 'miserable', 'crying', 'hurting'].some(k => msg.includes(k))) return 'distressed';
        if (['anxious', 'nervous', 'worried', 'scared', 'afraid', 'panic', 'overwhelmed'].some(k => msg.includes(k))) return 'anxious';
        if (['happy', 'excited', 'great', 'wonderful', 'amazing', 'proud', 'grateful', 'awesome'].some(k => msg.includes(k))) return 'positive';
        return 'neutral';
    }

    extractName(message) {
        const nameMatch = message.match(/(?:call me|i'm|i am|name is|i go by|my name's)\s+(\w+)/i);
        if (nameMatch && nameMatch[1].length > 1 && !['not', 'so', 'very', 'really', 'just', 'feeling', 'doing', 'going', 'trying', 'here', 'fine', 'good', 'okay', 'ok'].includes(nameMatch[1].toLowerCase())) {
            return nameMatch[1];
        }
        return null;
    }

    async chat(message) {
        const intent = this.detectIntent(message);
        const mood = this.detectMood(message);
        const name = this.extractName(message);

        if (name) this.userProfile.name = name;
        if (mood !== 'neutral') this.userProfile.mood = mood;

        this.sessionMemory.push({ role: 'user', content: message, mood, intent, timestamp: Date.now() });

        let response = '';
        const userMsgCount = this.sessionMemory.filter(m => m.role === 'user').length;

        // First message — always greet
        if (userMsgCount === 1) {
            response = this.pick('greeting');
        }
        // Creator question — always answer with creator info
        else if (intent === 'creator') {
            response = this.pick('creator');
        }
        // Priority intents — out-of-scope, frustration, distress, and referencing back
        else if (intent === 'outOfScope') {
            response = this.pick('outOfScope');
        }
        else if (intent === 'frustrated') {
            response = this.pick('frustrated');
        }
        else if (intent === 'distressed') {
            response = this.pick('distressed');
        }
        else if (intent === 'referenceBack') {
            response = this.pick('referenceBack');
        }
        // Positive mood takes priority — acknowledge and celebrate
        else if (mood === 'positive') {
            response = this.pick('positive');
        }
        // All other intents — use the matching category
        else {
            response = this.pick(intent);
        }

        // Personalize with name occasionally
        if (this.userProfile.name && Math.random() > 0.75) {
            response = response.replace(/^(Hey|Hi|Hello|Glad|Nice)(!?\s)/, `$1 ${this.userProfile.name}$2`);
        }

        this.sessionMemory.push({ role: 'assistant', content: response, timestamp: Date.now() });
        return response;
    }

    getSessionSummary() {
        return {
            userProfile: this.userProfile,
            messageCount: this.sessionMemory.length,
            topics: this.userProfile.topics,
            lastMood: this.userProfile.mood,
        };
    }

    clearSession() {
        this.sessionMemory = [];
        this.usedResponses.clear();
    }
}
class Linen {
    constructor() {
        this.db = new LinenDB();
        this.analytics = new Analytics();
        this.voiceManager = new VoiceManager();
        this.eventManager = new EventManager();
        this.agentManager = new AgentManager(this.db);
        this.modelVersionManager = new ModelVersionManager();
        this.assistant = null; // Will be GeminiAssistant or LocalAssistant
        this.currentAgent = null; // Track current agent
        this.isLocalMode = false;
        this.savedApiKey = null; // Store API key for lazy validation
        this._onboardingBound = false;
        this._eventsBound = false;
        this.trialMode = false;
        this.trialCount = 0;
        this.currentSessionTitle = null;
        this.isNewSession = true;
        this._localModeToastShown = false;
        this._voiceInputActive = false;
        this._eventPermissionAsked = false;
        this._showAgentSwitchMessage = false;
    }

    showLocalModeToast(reason) {
        if (this._localModeToastShown) return;
        this._localModeToastShown = true;
        const isQuota = reason && (reason.toLowerCase().includes('quota') || reason.toLowerCase().includes('rate') || reason.toLowerCase().includes('429'));
        if (isQuota) {
            this.showToast("You've hit your API usage limit. Switching to local mode — I can still chat!");
        } else {
            this.showToast("API unavailable right now. Switching to local mode — I can still chat!");
        }
    }

    detectUserSentiment(userMessage) {
        const msg = userMessage.toLowerCase();
        const distressKeywords = ['sad', 'depressed', 'hopeless', 'suicidal', 'die', 'crisis', 'emergency', 'angry', 'frustrated', 'trauma', 'anxious', 'panicking'];
        const positiveKeywords = ['happy', 'excited', 'great', 'wonderful', 'amazing', 'good'];
        
        if (distressKeywords.some(k => msg.includes(k))) return 'distressed';
        if (positiveKeywords.some(k => msg.includes(k))) return 'positive';
        return 'neutral';
    }

    filterEmojis(reply, userMessage) {
        if (this.detectUserSentiment(userMessage) === 'distressed') {
            const happyEmojis = ['😊', '😄', '😃', '🎉', '🎊', '😆', '😂'];
            happyEmojis.forEach(e => {
                reply = reply.split(e).join('');
            });
        }
        return reply;
    }

    showCrisisModal() {
        const modal = document.getElementById('crisis-modal');
        const backdrop = document.getElementById('modal-backdrop');
        if (!modal) return;
        modal.classList.add('active');
        backdrop.classList.add('active');
        const acknowledgeBtn = document.getElementById('acknowledge-crisis');
        const closeBtn = document.getElementById('close-crisis-modal');
        if (acknowledgeBtn) {
            acknowledgeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
                this.showToast('You can talk to me anytime. I\'m here to listen.');
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
            });
        }
    }

    async init() {
        console.log("Linen: Initializing app...");
        try {
            this.analytics.trackPageView();
            await this.db.init();

            const existingConvs = await this.db.getConversations();
            // Only archive if there's actual user interaction (more than just initial greeting/bot messages)
            // Check if there are user messages and more than just one exchange
            const hasUserMessages = existingConvs && existingConvs.some(c => c.sender === 'user');
            if (existingConvs && existingConvs.length > 2 && hasUserMessages) {
                const sessionTitle = this.generateSessionTitle(existingConvs);
                await this.db.archiveSession({ title: sessionTitle, messages: existingConvs, date: Date.now(), preview: existingConvs[existingConvs.length - 1]?.text || 'Previous conversation', messageCount: existingConvs.length });
            }
            await this.db.clearCurrentSession();

            const apiKey = await this.db.getSetting('gemini-api-key');
            const primaryAgentId = await this.db.getSetting('primary-agent-id');

            console.log(`Linen: API Key found in DB: ${apiKey ? '[REDACTED]' : 'false'}, Agent: ${primaryAgentId ? 'Yes' : 'No'}`);

            // Try to load primary agent from multi-agent system
            let primaryAgent = null;

            if (primaryAgentId) {
                const agentData = await this.db.getSetting(`agent-${primaryAgentId}`);
                if (agentData) {
                    try {
                        primaryAgent = JSON.parse(agentData);
                        console.log("Linen: Found primary agent:", primaryAgent.name);
                        this.currentAgent = primaryAgent;
                        this.assistant = this.createAssistantFromAgent(primaryAgent);
                        this.isLocalMode = false;
                    } catch (err) {
                        console.warn("Linen: Failed to load primary agent, falling back:", err);
                    }
                }
            }

            // If no primary agent, check for API key
            if (!primaryAgent) {
                if (!apiKey) {
                    console.log("Linen: No API Key found, will start with LocalAssistant.");
                    // Don't return early - we need to call startApp()
                } else {
                    // API key exists - validate and start
                    const geminiAssistant = new GeminiAssistant(apiKey);
                    const result = await geminiAssistant.validateKey();
                    if (result.valid) {
                        console.log("Linen: API Key validated successfully, starting app with Gemini.");
                        this.assistant = geminiAssistant;
                        this.isLocalMode = false;
                    } else {
                        // Check if the error is due to network or quota, in which case we can fallback to local.
                        // Otherwise, the key is truly invalid and requires re-entry via onboarding.
                        const isRecoverableError = (result.error && (
                            result.error.toLowerCase().includes('quota') ||
                            result.error.toLowerCase().includes('network error') ||
                            result.error.toLowerCase().includes('too many requests')
                        ));

                        if (isRecoverableError) {
                            console.warn(`Linen: Gemini API key validation failed with recoverable error: ${result.error}. Starting in local-only mode.`);
                            this.assistant = new LocalAssistant();
                            this.isLocalMode = true;
                            this.showLocalModeToast(result.error);
                        } else {
                            console.warn(`Linen: Saved API key invalid: ${result.error}. Showing onboarding.`);
                            this.showOnboarding(`Your saved API key is invalid: ${result.error}`);
                            return;
                        }
                    }
                }
            }

            // If still no assistant, use local mode (always available)
            if (!this.assistant) {
                console.log("Linen: Starting with LocalAssistant (no API configured).");
                this.assistant = new LocalAssistant();
                this.isLocalMode = true;
            }

            // Check if user has memories (has used the app before)
            const memories = await this.db.getAllMemories();
            const hasMemories = memories && memories.length > 0;

            console.log(`Linen: User has memories: ${hasMemories}, API configured: ${!!(apiKey || primaryAgentId)}`);

            // If no API key and no memories, show onboarding splash first
            if (!apiKey && !primaryAgentId && !hasMemories) {
                console.log("Linen: New user with no API - showing onboarding splash.");
                // Don't start app yet, just show onboarding
                this.startApp(apiKey);
                this.showOnboarding();
            } else {
                // Returning user or has API - go straight to app
                console.log("Linen: Starting app directly (returning user or has API).");
                this.startApp(apiKey);
            }
        } catch (e) {
            console.error('Linen: Init error:', e);
            this.assistant = new LocalAssistant();
            this.isLocalMode = true;
            this.startApp(null);
            console.error('Linen: Fatal error during init, starting in local-only mode.', e);
        }
    }

    createAssistantFromAgent(agent) {
        console.log("Linen: Creating assistant from agent:", agent.name, agent.type);
        const model = agent.model || this.modelVersionManager.getModel(agent.type, 'primary');

        switch (agent.type) {
            case 'openai':
                return new OpenAIAssistant(agent.apiKey, model);
            case 'claude':
                return new ClaudeAssistant(agent.apiKey, model);
            case 'deepseek':
                return new DeepSeekAssistant(agent.apiKey, model);
            case 'openrouter':
                return new OpenRouterAssistant(agent.apiKey, model);
            case 'gemini':
            default:
                return new GeminiAssistant(agent.apiKey);
        }
    }

    async startApp(apiKey) {
        console.log("Linen: Starting app with apiKey:", !!apiKey);
        // Store API key for lazy validation and potential future use
        this.savedApiKey = apiKey;
        // If no assistant is set, use LocalAssistant
        if (!this.assistant) {
            console.warn("Linen: No assistant set in startApp, using LocalAssistant.");
            this.assistant = new LocalAssistant();
            this.isLocalMode = true;
        }
        console.log("Linen: About to hide modals and bind events");
        document.getElementById('onboarding-overlay').style.display = 'none';
        document.getElementById('re-enter-key-modal').classList.remove('active');
        document.getElementById('modal-backdrop').classList.remove('active');
        console.log("Linen: Calling bindEvents()");
        try {
            this.bindEvents();
            console.log("Linen: bindEvents() complete");
        } catch (err) {
            console.error("Linen: Error in bindEvents():", err);
        }
        console.log("Linen: Loading chat history");
        try {
            await this.loadChatHistory();
            console.log("Linen: Chat history loaded");
        } catch (err) {
            console.error("Linen: Error loading chat history:", err);
        }

        // Ask for user's name on first ever message
        const hasSeenApp = await this.db.getSetting('seen-app-before');
        if (!hasSeenApp) {
            this.showNamePrompt();
        } else {
            // Start with initial greeting if not first time
            this.sendChat('[INITIAL_GREETING]');
        }

        console.log("Linen: App started in", this.isLocalMode ? 'local mode' : 'Gemini mode');
    }

    startTrialMode() {
        this.trialMode = true;
        this.trialCount = 0;
        localStorage.setItem('linen-trial', 'true');
        localStorage.setItem('linen-trial-exchanges', '0');
        
        // Use LocalAssistant for trial mode (no API key needed)
        this.assistant = new LocalAssistant();
        this.isLocalMode = true;
        this.startApp(null);
        this.sendChat('[INITIAL_GREETING]');
    }

    showNamePrompt() {
        const backdrop = document.getElementById('modal-backdrop');
        const modal = document.createElement('div');
        modal.id = 'name-prompt-modal';
        modal.className = 'modal';
        modal.style.zIndex = '2000';
        modal.innerHTML = `
            <div style="max-width: 400px; text-align: center;">
                <h2>What's your name?</h2>
                <p style="color: var(--text-light); margin-bottom: 1.5rem;">I'd love to know who I'm talking to so I can personalize our conversations.</p>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <input type="text" id="name-input" placeholder="Enter your name" style="padding: 12px; border: 1px solid #444; border-radius: 6px; background: #333; color: #fff; font-size: 1rem;" autocomplete="off">
                    <button id="name-submit" class="button-primary" style="background: var(--accent); color: #000; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">Let's Chat!</button>
                    <button id="name-skip" style="background: none; border: 1px solid #444; color: #fff; padding: 12px; border-radius: 6px; cursor: pointer;">Skip for now</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        backdrop.classList.add('active');
        modal.classList.add('active');

        const nameInput = document.getElementById('name-input');
        const submitBtn = document.getElementById('name-submit');
        const skipBtn = document.getElementById('name-skip');

        const closeName = () => {
            modal.remove();
            backdrop.classList.remove('active');
            this.sendChat('[INITIAL_GREETING]');
        };

        submitBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (name) {
                // Save the name to both database and assistant profile
                await this.db.setSetting('user-name', name);
                if (this.assistant && this.assistant.userProfile) {
                    this.assistant.userProfile.name = name;
                }
                closeName();
            } else {
                nameInput.style.borderColor = '#ff6b6b';
            }
        });

        skipBtn.addEventListener('click', closeName);

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });

        nameInput.focus();

        // Mark that user has seen the app
        this.db.setSetting('seen-app-before', true);
    }

    showPitchModal() {
        const modal = document.getElementById('pitch-modal');
        const backdrop = document.getElementById('modal-backdrop');
        if (!modal) {
            console.warn("Pitch modal not found in HTML");
            return;
        }

        modal.classList.add('active');
        backdrop.classList.add('active');

        // Ensure all other modals have pointer-events disabled to avoid blocking clicks
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(m => {
            if (m !== modal) {
                m.style.pointerEvents = 'none';
            }
        });
        modal.style.pointerEvents = 'auto';

        // Set up accordion functionality - attach listener directly to modal
        const accordionHeaders = modal.querySelectorAll('.accordion-header');
        accordionHeaders.forEach((header) => {
            // Remove any existing listeners by cloning the element
            if (!header.dataset.accordionListenerAttached) {
                header.addEventListener('click', (event) => {
                    console.log('Accordion header clicked!');
                    const item = header.closest('.accordion-item');
                    if (item) {
                        item.classList.toggle('active');
                        console.log('Toggled accordion item');
                    }
                });
                header.dataset.accordionListenerAttached = 'true';
            }
        });

        // "Start Chatting" button - just close modal and start using app
        const closeBtn = document.getElementById('close-pitch-modal');
        if (closeBtn && !closeBtn.dataset.listenerAttached) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
            });
            closeBtn.dataset.listenerAttached = 'true';
        }

        // "Add My API Key" button - show onboarding to add API
        const addKeyBtn = document.getElementById('add-api-key-btn');
        if (addKeyBtn && !addKeyBtn.dataset.listenerAttached) {
            addKeyBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
                // Show onboarding at step 2 (provider selection)
                document.getElementById('onboarding-overlay').style.display = 'flex';
                this.showOnboardingStep(2);
            });
            addKeyBtn.dataset.listenerAttached = 'true';
        }
    }

    generateSessionTitle(conversations) {
        if (!conversations || conversations.length === 0) return 'Conversation - ' + new Date().toLocaleDateString();
        const firstUserMsg = conversations.find(c => c.sender === 'user');
        if (firstUserMsg) {
            let title = firstUserMsg.text.substring(0, 50);
            if (firstUserMsg.text.length > 50) title += '...';
            return title;
        }
        return 'Conversation - ' + new Date().toLocaleDateString();
    }

    showMemoryModal(memory) {
        const backdrop = document.getElementById('modal-backdrop');
        let modal = document.getElementById('memory-view-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'memory-view-modal';
            modal.className = 'modal memory-modal';
            document.body.appendChild(modal);
        }
        const title = memory.title || 'Conversation';
        const date = new Date(memory.date).toLocaleDateString();
        let messagesHtml = '';
        if (memory.messages) {
            memory.messages.forEach(msg => {
                const className = msg.sender === 'user' ? 'user-message' : 'assistant-message';
                messagesHtml += `<div class="${className}">${msg.text}</div>`;
            });
        }
        // Add Continue button if there are messages
        const continueButton = memory.messages && memory.messages.length > 0
            ? `<button id="continue-conversation" class="btn btn-primary">Continue Conversation</button>`
            : '';

        modal.innerHTML = `<div class="memory-modal-content"><button class="close-modal" id="close-memory-modal">×</button><h2>${title}</h2><p class="memory-modal-date">${date}</p><div class="memory-messages-container">${messagesHtml}</div><div class="memory-modal-actions">${continueButton}</div></div>`;
        modal.classList.add('active');
        backdrop.classList.add('active');

        document.getElementById('close-memory-modal').addEventListener('click', () => {
            modal.classList.remove('active');
            backdrop.classList.remove('active');
        });

        const continueBtn = document.getElementById('continue-conversation');
        if (continueBtn) {
            continueBtn.addEventListener('click', async () => {
                // Restore the conversation to current session
                await this.restoreConversation(memory);
                modal.classList.remove('active');
                backdrop.classList.remove('active');
            });
        }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
            }
        });
    }

    showEditMemoryModal(memory) {
        const backdrop = document.getElementById('modal-backdrop');
        let modal = document.getElementById('edit-memory-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-memory-modal';
            modal.className = 'modal memory-modal';
            document.body.appendChild(modal);
        }

        const title = memory.title || '';
        const text = memory.text || '';
        const tags = (memory.tags || []).join(', ');
        const emotion = memory.emotion || '';

        modal.innerHTML = `
            <div class="memory-modal-content">
                <button class="close-modal" id="close-edit-memory-modal">×</button>
                <h2>Edit Memory</h2>
                <form id="edit-memory-form">
                    <div class="form-group">
                        <label for="edit-memory-title">Title</label>
                        <input type="text" id="edit-memory-title" value="${this.escapeHtml(title)}" placeholder="Memory title">
                    </div>
                    <div class="form-group">
                        <label for="edit-memory-text">Text</label>
                        <textarea id="edit-memory-text" placeholder="Memory text">${this.escapeHtml(text)}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="edit-memory-tags">Tags (comma-separated)</label>
                        <input type="text" id="edit-memory-tags" value="${this.escapeHtml(tags)}" placeholder="e.g. work, project, learning">
                    </div>
                    <div class="form-group">
                        <label for="edit-memory-emotion">Emotion</label>
                        <input type="text" id="edit-memory-emotion" value="${this.escapeHtml(emotion)}" placeholder="e.g. happy, stressed, excited">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                        <button type="button" class="btn btn-secondary" id="cancel-edit-memory">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        modal.classList.add('active');
        backdrop.classList.add('active');

        const form = document.getElementById('edit-memory-form');
        const closeBtn = document.getElementById('close-edit-memory-modal');
        const cancelBtn = document.getElementById('cancel-edit-memory');

        const closeModal = () => {
            modal.classList.remove('active');
            backdrop.classList.remove('active');
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedMemory = {
                id: memory.id,
                title: document.getElementById('edit-memory-title').value.trim(),
                text: document.getElementById('edit-memory-text').value.trim(),
                tags: document.getElementById('edit-memory-tags').value.split(',').map(t => t.trim()).filter(t => t),
                emotion: document.getElementById('edit-memory-emotion').value.trim(),
                date: memory.date
            };

            await this.db.updateMemory(updatedMemory);
            closeModal();
            this.loadMemories(document.getElementById('memory-search').value);
            this.showToast('Memory updated!');
        });

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal();
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async restoreConversation(memory) {
        console.log("Linen: Restoring conversation from memory:", memory.title);

        // Close memories panel
        document.getElementById('memories-panel').classList.remove('active');
        document.getElementById('modal-backdrop').classList.remove('active');

        // Clear current chat
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        // Reload the conversation messages into the chat
        if (memory.messages && memory.messages.length > 0) {
            memory.messages.forEach(msg => {
                const div = document.createElement('div');
                div.className = msg.sender === 'user' ? 'user-message' : 'assistant-message';
                div.textContent = msg.text;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;

            // Restore messages to current session so user can continue the conversation
            for (const msg of memory.messages) {
                await this.db.addConversation(msg);
            }

            this.showToast(`Restored: ${memory.title}`);
        }
    }

    showOnboarding(errorMsg = '') {
        console.log(`Linen: Showing onboarding, error message: ${errorMsg}`);
        document.getElementById('onboarding-overlay').style.display = 'flex';
        this.showOnboardingStep(1);
        if (errorMsg) {
            this.showOnboardingStep(2);
            document.getElementById('onboarding-error').textContent = errorMsg;
        }
        this.bindOnboardingEvents();
    }

    showInstallationInstructions() {
        console.log("Linen: Showing installation instructions from settings");
        document.getElementById('onboarding-overlay').style.display = 'flex';
        this.showOnboardingStep(3); // Show step 3 which has installation instructions
        this.bindOnboardingEvents();
    }

    showOnboardingStep(stepNum) {
        document.querySelectorAll('#onboarding-wizard .step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${stepNum}`).classList.add('active');
        document.querySelectorAll('.step-indicator .dot').forEach((dot, i) => {
            dot.classList.toggle('active', i <= stepNum - 1);
        });
    }

    setupProviderForm(provider) {
        const setup = document.getElementById('provider-setup');
        setup.innerHTML = '';
        setup.classList.add('active');

        const providerConfig = {
            'gemini': {
                name: 'Google Gemini',
                url: 'https://aistudio.google.com/app/apikey',
                steps: [
                    'Tap the button below to open Google AI Studio',
                    'Sign in with your Google account',
                    'Click "Create API Key"',
                    'Copy the key and paste it below'
                ]
            },
            'chatgpt': {
                name: 'OpenAI (ChatGPT)',
                url: 'https://platform.openai.com/api/keys',
                steps: [
                    'Tap the button below to go to OpenAI Platform',
                    'Sign in with your OpenAI account (or create one)',
                    'Go to API Keys section',
                    'Click "Create new secret key"',
                    'Copy the key and paste it below'
                ]
            },
            'claude': {
                name: 'Anthropic Claude',
                url: 'https://console.anthropic.com/keys',
                steps: [
                    'Tap the button below to go to Anthropic Console',
                    'Sign in with your Anthropic account',
                    'Go to API Keys',
                    'Click "Create Key"',
                    'Copy the key and paste it below'
                ]
            },
            'deepseek': {
                name: 'DeepSeek',
                url: 'https://platform.deepseek.com/api_keys',
                steps: [
                    'Tap the button below to go to DeepSeek Platform',
                    'Sign in or create an account',
                    'Go to API Keys',
                    'Click "Create new key"',
                    'Copy the key and paste it below'
                ]
            }
        };

        const config = providerConfig[provider];
        if (!config) return;

        const setupHTML = `
            <h3>${config.name}</h3>
            <ol>
                ${config.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
            <a href="${config.url}" target="_blank" class="button" style="display: inline-block; padding: 10px 15px; background: var(--accent); color: var(--bg); border-radius: 6px; text-decoration: none; margin: 15px 0; font-weight: bold;">Get ${config.name} API Key</a>
            <input type="password" id="onboarding-api-key" placeholder="Paste your API key here" style="margin-top: 10px;">
            <button id="save-onboarding-api-key" class="button-primary" style="margin-top: 10px;">Save and Continue</button>
        `;

        setup.innerHTML = setupHTML;

        // Rebind save button
        const saveBtn = document.getElementById('save-onboarding-api-key');
        const apiInput = document.getElementById('onboarding-api-key');

        const saveKey = () => {
            if (!apiInput.value.trim()) {
                document.getElementById('onboarding-error').textContent = 'Please enter your API key';
                return;
            }
            // Store selected provider
            this.onboardingProvider = provider;
            // For now, validate as Gemini to test (in production, validate per provider)
            if (provider === 'gemini') {
                this.validateAndSaveKey('onboarding-api-key', 'onboarding-error', async () => {
                    const done = await this.db.getSetting('onboarding-complete');
                    if (done) {
                        this.startApp(this.assistant.apiKey);
                    } else {
                        this.showOnboardingStep(3);
                    }
                });
            } else {
                // For other providers, just save the key for now
                // TODO: Add provider-specific validation
                this.showToast(`${config.name} API key saved!`);
                this.showOnboardingStep(3);
            }
        };

        saveBtn.addEventListener('click', saveKey);
        apiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveKey(); }
        });
    }

    bindOnboardingEvents() {
        if (this._onboardingBound) return;
        this._onboardingBound = true;

        document.getElementById('get-started').addEventListener('click', () => {
            // Hide onboarding and show pitch modal
            document.getElementById('onboarding-overlay').style.display = 'none';
            this.showPitchModal();
        });

        // Back buttons
        const backFromStep2 = document.getElementById('back-from-step-2');
        if (backFromStep2) {
            backFromStep2.addEventListener('click', () => {
                // Hide onboarding and show pitch modal instead
                document.getElementById('onboarding-overlay').style.display = 'none';
                this.showPitchModal();
            });
        }

        const backFromStep3 = document.getElementById('back-from-step-3');
        if (backFromStep3) {
            backFromStep3.addEventListener('click', () => this.showOnboardingStep(2));
        }

        // AI Provider selection
        const providerButtons = document.querySelectorAll('.ai-provider-btn');
        providerButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = btn.dataset.provider;
                this.setupProviderForm(provider);
                // Remove active from all, add to clicked
                providerButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        const saveKey = () => this.validateAndSaveKey('onboarding-api-key', 'onboarding-error', async () => {
            const done = await this.db.getSetting('onboarding-complete');
            if (done) {
                this.startApp(this.assistant.apiKey);
            } else {
                this.showOnboardingStep(3);
            }
        });

        // Legacy support for direct key input (if still present)
        const apiKeyInput = document.getElementById('onboarding-api-key');
        if (apiKeyInput) {
            const saveLegacyKey = () => this.validateAndSaveKey('onboarding-api-key', 'onboarding-error', async () => {
                const done = await this.db.getSetting('onboarding-complete');
                if (done) {
                    this.startApp(this.assistant.apiKey);
                } else {
                    this.showOnboardingStep(3);
                }
            });
            document.getElementById('save-onboarding-api-key')?.addEventListener('click', saveLegacyKey);
            apiKeyInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveLegacyKey(); }
            });
        }

        document.querySelectorAll('.device-selector button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('android-instructions').style.display = e.target.dataset.device === 'android' ? 'block' : 'none';
                document.getElementById('ios-instructions').style.display = e.target.dataset.device === 'ios' ? 'block' : 'none';
            });
        });

        document.getElementById('finish-onboarding').addEventListener('click', async () => {
            await this.db.setSetting('onboarding-complete', true);
            this.startApp(this.assistant.apiKey);
        });
    }

    bindEvents() {
        if (this._eventsBound) {
            console.log("Linen: Events already bound, skipping");
            return;
        }
        this._eventsBound = true;
        console.log("Linen: Binding events");

        // Re-enter key modal
        const reEnterSave = () => this.validateAndSaveKey('re-enter-api-key', 're-enter-error', () => this.startApp(this.assistant.apiKey));
        document.getElementById('save-re-enter-api-key').addEventListener('click', reEnterSave);
        document.getElementById('re-enter-api-key').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); reEnterSave(); }
        });

        // Logo menu interactions
        const logo = document.getElementById('logo');
        const logoMenu = document.getElementById('logo-menu');
        const memoriesPanel = document.getElementById('memories-panel');
        const settingsModal = document.getElementById('settings-modal');
        const backdrop = document.getElementById('modal-backdrop');

        if (logo && logoMenu) {
            logo.addEventListener('click', (e) => {
                e.stopPropagation();
                logoMenu.classList.toggle('hidden');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!logo.contains(e.target) && !logoMenu.contains(e.target)) {
                    logoMenu.classList.add('hidden');
                }
            });

            // Logo menu items
            const logoMemoriesBtn = document.getElementById('logo-memories');
            const logoNewChatBtn = document.getElementById('logo-new-chat');
            const logoSettingsBtn = document.getElementById('logo-settings');

            if (logoMemoriesBtn) {
                logoMemoriesBtn.addEventListener('click', () => {
                    this.loadMemories();
                    memoriesPanel.classList.add('active');
                    backdrop.classList.add('active');
                    logoMenu.classList.add('hidden');
                });
            }

            if (logoNewChatBtn) {
                logoNewChatBtn.addEventListener('click', () => {
                    logoMenu.classList.add('hidden');
                    this.startNewChat();
                });
            }

            if (logoSettingsBtn) {
                logoSettingsBtn.addEventListener('click', () => {
                    settingsModal.classList.add('active');
                    backdrop.classList.add('active');
                    logoMenu.classList.add('hidden');
                });
            }
        } else {
            console.warn('Linen: Logo menu elements not found');
        }

        const closeModal = () => {
            memoriesPanel.classList.remove('active');
            settingsModal.classList.remove('active');
            document.getElementById('re-enter-key-modal').classList.remove('active');
            backdrop.classList.remove('active');
        };

        document.getElementById('close-memories').addEventListener('click', closeModal);
        document.getElementById('close-settings-modal').addEventListener('click', closeModal);
        backdrop.addEventListener('click', (e) => {
            // Don't close re-enter key modal on backdrop click
            if (document.getElementById('re-enter-key-modal').classList.contains('active')) return;
            closeModal();
        });

        // Install as App button in settings
        const installAppBtn = document.getElementById('install-app-btn');
        if (installAppBtn) {
            installAppBtn.addEventListener('click', () => {
                console.log("Linen: Install app button clicked from settings");
                closeModal();
                this.showInstallationInstructions();
            });
        }

        // Chat - Messenger-style input
        const chatInput = document.getElementById('chat-input');
        const chatTypeBtn = document.getElementById('chat-type');
        const chatTalkBtn = document.getElementById('chat-talk');
        const inputButtonsDiv = document.getElementById('input-buttons');
        const textInputMode = document.getElementById('text-input-mode');
        const voiceInputMode = document.getElementById('voice-input-mode');
        const sendBtn = document.getElementById('send-btn');
        const modeSwitcher = document.getElementById('mode-switcher');
        const voiceModeSwitcher = document.getElementById('voice-mode-switcher');
        const stopVoiceBtn = document.getElementById('stop-voice-btn');

        console.log("Linen: Chat elements - input:", !!chatInput, "typeBtn:", !!chatTypeBtn, "talkBtn:", !!chatTalkBtn, "buttons:", !!inputButtonsDiv, "textMode:", !!textInputMode, "voiceMode:", !!voiceInputMode);

        if (chatTypeBtn) {
            chatTypeBtn.addEventListener('click', () => {
                console.log("Linen: Text button clicked");
                // Expand chat input area and show text input mode
                const chatInputArea = document.getElementById('chat-input-area');
                chatInputArea.classList.add('expanded');
                inputButtonsDiv.style.display = 'none';
                voiceInputMode.style.display = 'none';
                textInputMode.style.display = 'flex';
                if (chatInput) chatInput.focus();
            });
        } else {
            console.warn("Linen: Chat Type button not found");
        }

        if (chatTalkBtn) {
            chatTalkBtn.addEventListener('click', () => {
                console.log("Linen: Talk button clicked");
                // Open voice modal lightbox instead of inline
                const voiceModal = document.getElementById('voice-modal');
                const modalBackdrop = document.getElementById('modal-backdrop');
                if (voiceModal && modalBackdrop) {
                    voiceModal.classList.add('active');
                    modalBackdrop.classList.add('active');
                    this.startVoiceInput();
                }
            });
        } else {
            console.warn("Linen: Chat Talk button not found");
        }

        // Text input send button
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendChat();
                // Hide text mode, show buttons
                const chatInputArea = document.getElementById('chat-input-area');
                chatInputArea.classList.remove('expanded');
                textInputMode.style.display = 'none';
                voiceInputMode.style.display = 'none';
                inputButtonsDiv.style.display = 'flex';
                if (chatInput) chatInput.value = '';
            });
        }

        // Text input Enter to send
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChat();
                    const chatInputArea = document.getElementById('chat-input-area');
                    chatInputArea.classList.remove('expanded');
                    textInputMode.style.display = 'none';
                    voiceInputMode.style.display = 'none';
                    inputButtonsDiv.style.display = 'flex';
                    chatInput.value = '';
                }
            });
        } else {
            console.warn("Linen: Chat input element not found");
        }

        // Mode switcher from text back to buttons
        if (modeSwitcher) {
            modeSwitcher.addEventListener('click', () => {
                const chatInputArea = document.getElementById('chat-input-area');
                chatInputArea.classList.remove('expanded');
                textInputMode.style.display = 'none';
                inputButtonsDiv.style.display = 'flex';
            });
        }

        // Mode switcher from voice to text
        if (voiceModeSwitcher) {
            voiceModeSwitcher.addEventListener('click', () => {
                this.stopVoiceInput();
                voiceInputMode.style.display = 'none';
                inputButtonsDiv.style.display = 'flex';
            });
        }

        // Stop voice button
        if (stopVoiceBtn) {
            stopVoiceBtn.addEventListener('click', () => {
                this.stopVoiceInput();
                voiceInputMode.style.display = 'none';
                inputButtonsDiv.style.display = 'flex';
            });
        }

        // Settings actions
        const settingsSaveKey = () => this.saveApiKey();
        document.getElementById('save-api-key').addEventListener('click', settingsSaveKey);
        document.getElementById('api-key-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); settingsSaveKey(); }
        });

        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('clear-data').addEventListener('click', () => this.clearAll());
        document.getElementById('clear-chat-history').addEventListener('click', () => this.clearChatHistory());
        document.getElementById('memory-search').addEventListener('input', (e) => this.loadMemories(e.target.value));


        // Suggestions
        document.getElementById('submit-suggestion').addEventListener('click', () => this.submitSuggestion());

        // Voice Modal Lightbox
        const voiceModal = document.getElementById('voice-modal');
        const closeVoiceModal = document.getElementById('close-voice-modal');
        const lightboxStopBtn = document.getElementById('lightbox-stop-btn');
        const modalBackdrop = document.getElementById('modal-backdrop');

        if (closeVoiceModal) {
            closeVoiceModal.addEventListener('click', () => {
                this.stopVoiceInput();
                voiceModal.classList.remove('active');
                modalBackdrop.classList.remove('active');
            });
        }

        if (lightboxStopBtn) {
            lightboxStopBtn.addEventListener('click', () => {
                this.stopVoiceInput();
                voiceModal.classList.remove('active');
                modalBackdrop.classList.remove('active');
            });
        }

        // Agent Management
        const addAgentBtn = document.getElementById('add-agent-btn');
        const addAgentModal = document.getElementById('add-agent-modal');
        const closeAddAgent = document.getElementById('close-add-agent');
        const saveNewAgent = document.getElementById('save-new-agent');
        const agentTypeSelect = document.getElementById('agent-type');

        console.log("Linen: Agent Management - addAgentBtn:", addAgentBtn, "addAgentModal:", addAgentModal);

        if (addAgentBtn) {
            addAgentBtn.addEventListener('click', () => {
                console.log("Linen: Add Agent button clicked");
                if (addAgentModal) {
                    addAgentModal.classList.add('active');
                    backdrop.classList.add('active');
                } else {
                    console.error("Linen: add-agent-modal not found!");
                }
            });
        } else {
            console.warn("Linen: add-agent-btn not found in DOM");
        }

        if (closeAddAgent) {
            closeAddAgent.addEventListener('click', () => {
                addAgentModal.classList.remove('active');
                backdrop.classList.remove('active');
                this.clearAddAgentForm();
            });
        }

        if (saveNewAgent) {
            saveNewAgent.addEventListener('click', () => this.addNewAgent());
        }

        // Agent type changes (for future model selection)
        if (agentTypeSelect) {
            agentTypeSelect.addEventListener('change', (e) => this.updateAgentModelOptions(e.target.value));
        }

        // Load agents list
        this.loadAgentsList();
    }

    async validateAndSaveKey(inputId, errorId, onSuccess) {
        console.log(`Linen: Validating and saving key from input: ${inputId}`);
        const input = document.getElementById(inputId);
        const errorEl = document.getElementById(errorId);
        const key = input.value.trim();

        if (!key) {
            errorEl.textContent = 'Please enter an API key.';
            console.warn("Linen: API key input is empty.");
            return;
        }

        errorEl.textContent = 'Validating...';
        console.log("Linen: Validating API key...");

        const tempAssistant = new GeminiAssistant(key);
        const result = await tempAssistant.validateKey();

        if (result.valid) {
            console.log("Linen: API key validated successfully. Saving to DB.");
            await this.db.setSetting('gemini-api-key', key);
            this.assistant = tempAssistant;
            errorEl.textContent = '';
            onSuccess();
        } else {
            console.error(`Linen: API key validation failed: ${result.error}`);
            errorEl.textContent = `Key validation failed: ${result.error}`;
        }
    }

    async addNewAgent() {
        console.log("Linen: Adding new agent...");
        const nameInput = document.getElementById('agent-name');
        const typeSelect = document.getElementById('agent-type');
        const keyInput = document.getElementById('agent-api-key');
        const modelInput = document.getElementById('agent-model');
        const primaryCheckbox = document.getElementById('agent-primary');
        const errorEl = document.getElementById('add-agent-error');

        const name = nameInput.value.trim();
        const type = typeSelect.value;
        const apiKey = keyInput.value.trim();
        const model = modelInput.value.trim();
        const isPrimary = primaryCheckbox.checked;

        // Validation
        if (!name) {
            errorEl.textContent = 'Please enter an agent name.';
            return;
        }
        if (!type) {
            errorEl.textContent = 'Please select an AI provider.';
            return;
        }
        if (!apiKey) {
            errorEl.textContent = 'Please enter an API key.';
            return;
        }

        errorEl.textContent = 'Validating API key...';

        try {
            // Validate API key for the selected provider
            let tempAssistant;
            const model = model || this.getDefaultModel(type);

            switch (type) {
                case 'openai':
                    tempAssistant = new OpenAIAssistant(apiKey, model);
                    break;
                case 'claude':
                    tempAssistant = new ClaudeAssistant(apiKey, model);
                    break;
                case 'deepseek':
                    tempAssistant = new DeepSeekAssistant(apiKey, model);
                    break;
                case 'openrouter':
                    tempAssistant = new OpenRouterAssistant(apiKey, model);
                    break;
                case 'gemini':
                default:
                    tempAssistant = new GeminiAssistant(apiKey);
            }

            const result = await tempAssistant.validateKey();
            if (!result.valid) {
                errorEl.textContent = `Key validation failed: ${result.error}`;
                return;
            }

            // Add agent to AgentManager
            const agentConfig = {
                name: name,
                type: type,
                apiKey: apiKey,
                model: model || this.getDefaultModel(type),
                isPrimary: isPrimary
            };

            const agent = await this.agentManager.addAgent(agentConfig);

            // Save agent to database
            await this.db.setSetting(`agent-${agent.id}`, JSON.stringify(agent));

            // If set as primary, update the saved agents list
            if (isPrimary) {
                await this.db.setSetting('primary-agent-id', agent.id);
            }

            console.log("Linen: Agent added successfully:", agent);
            errorEl.textContent = '';
            this.clearAddAgentForm();

            // Close modal
            const addAgentModal = document.getElementById('add-agent-modal');
            const backdrop = document.getElementById('modal-backdrop');
            addAgentModal.classList.remove('active');
            backdrop.classList.remove('active');

            // Reload agents list
            this.loadAgentsList();
            this.showToast(`Agent "${name}" added successfully!`);
        } catch (err) {
            console.error("Linen: Error adding agent:", err);
            errorEl.textContent = `Error: ${err.message}`;
        }
    }

    clearAddAgentForm() {
        document.getElementById('agent-name').value = '';
        document.getElementById('agent-type').value = '';
        document.getElementById('agent-api-key').value = '';
        document.getElementById('agent-model').value = '';
        document.getElementById('agent-primary').checked = false;
        document.getElementById('add-agent-error').textContent = '';
    }

    async loadAgentsList() {
        console.log("Linen: Loading agents list...");
        const agentsList = document.getElementById('agents-list');
        if (!agentsList) return;

        const agents = this.agentManager.getAgents();

        if (agents.length === 0) {
            agentsList.innerHTML = '<p style="color: var(--text-light); font-size: 0.9rem; text-align: center; padding: 1rem;">No agents added yet. Add one to get started!</p>';
            return;
        }

        agentsList.innerHTML = '';
        agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'agent-card';

            const info = document.createElement('div');
            info.className = 'agent-info';

            const nameEl = document.createElement('div');
            nameEl.className = 'agent-name';
            nameEl.textContent = agent.name;

            const typeEl = document.createElement('div');
            typeEl.className = 'agent-type';
            typeEl.textContent = this.getProviderLabel(agent.type);

            info.appendChild(nameEl);
            info.appendChild(typeEl);

            if (agent.isPrimary) {
                const badgeEl = document.createElement('div');
                badgeEl.className = 'agent-primary-badge';
                badgeEl.textContent = '⭐ PRIMARY';
                info.appendChild(badgeEl);
            }

            const actions = document.createElement('div');
            actions.className = 'agent-actions';

            if (!agent.isPrimary) {
                const setAsBtn = document.createElement('button');
                setAsBtn.textContent = 'Set Primary';
                setAsBtn.addEventListener('click', () => this.setAgentAsPrimary(agent.id));
                actions.appendChild(setAsBtn);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => this.deleteAgent(agent.id));
            actions.appendChild(deleteBtn);

            card.appendChild(info);
            card.appendChild(actions);
            agentsList.appendChild(card);
        });
    }

    async setAgentAsPrimary(agentId) {
        console.log("Linen: Setting agent as primary:", agentId);
        this.agentManager.setPrimaryAgent(agentId);
        await this.db.setSetting('primary-agent-id', agentId);
        this.loadAgentsList();
        this.showToast('Primary agent updated!');
    }

    async deleteAgent(agentId) {
        console.log("Linen: Deleting agent:", agentId);
        if (!confirm('Are you sure you want to delete this agent?')) return;

        this.agentManager.removeAgent(agentId);
        await this.db.setSetting(`agent-${agentId}`, null);

        this.loadAgentsList();
        this.showToast('Agent deleted!');
    }

    updateAgentModelOptions(providerType) {
        const modelInput = document.getElementById('agent-model');
        if (!modelInput) return;

        const defaultModel = this.getDefaultModel(providerType);
        modelInput.placeholder = `e.g., ${defaultModel}`;
    }

    getDefaultModel(providerType) {
        const models = {
            'gemini': 'gemini-2.0-flash',
            'openai': 'gpt-4',
            'claude': 'claude-3-opus-20240229',
            'deepseek': 'deepseek-chat',
            'openrouter': 'openrouter/auto'
        };
        return models[providerType] || 'default';
    }

    getProviderLabel(providerType) {
        const labels = {
            'gemini': '🔵 Google Gemini',
            'openai': '🟢 OpenAI',
            'claude': '🔴 Anthropic Claude',
            'deepseek': '🟠 DeepSeek',
            'openrouter': '🟣 OpenRouter'
        };
        return labels[providerType] || providerType;
    }

    async loadChatHistory() {
        const container = document.getElementById('chat-messages');
        const convs = await this.db.getConversations();
        container.innerHTML = '';
        if (!convs || convs.length === 0) {
            this.sendChat('[INITIAL_GREETING]');
            return;
        }
        convs.forEach(msg => {
            const div = document.createElement('div');
            div.className = msg.sender === 'user' ? 'user-message' : 'assistant-message';
            div.textContent = msg.text;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }

    async sendChat(initialMessage) {
        const input = document.getElementById('chat-input');
        const msg = initialMessage || input.value.trim();
        if (!msg || !this.assistant) return;

        const container = document.getElementById('chat-messages');

        if (!initialMessage) {
            input.value = '';
            const userDiv = document.createElement('div');
            userDiv.className = 'user-message';
            userDiv.textContent = msg;
            container.appendChild(userDiv);
            container.scrollTop = container.scrollHeight;
        }

        const id = 'loading-msg-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'assistant-message';

        // Show typing indicator bubble for local mode, "Thinking..." for API mode
        if (this.isLocalMode) {
            div.classList.add('typing-indicator');
            div.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
        } else {
            div.textContent = 'Thinking...';
        }
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        let reply = '';
        try {
            const mems = await this.db.getAllMemories();
            const convs = await this.db.getConversations();

            // If in local mode, add a short delay to simulate thinking
            if (this.isLocalMode) {
                console.log("Linen: Currently in local mode. Using LocalAssistant.");
                const delay = 800 + Math.random() * 700; // 800ms–1500ms
                await new Promise(resolve => setTimeout(resolve, delay));
                reply = await this.assistant.chat(msg);
            } else {
                // Use primary agent or fallback to next available
                console.log("Linen: Attempting to use primary agent:", this.currentAgent?.name || 'Unknown');
                if (!initialMessage && this.assistant.detectCrisis(msg)) {
                    this.showCrisisModal();
                }
                reply = await this.assistant.chat(msg, convs, mems, id);
            }

            document.getElementById(id)?.remove();

            // Parse and strip memory markers (only if using API assistants)
            if (!this.isLocalMode) {
                // Extract ALL memory markers (can be multiple)
                const memoryMarkerRegex = /\[SAVE_MEMORY:\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})\s*\]/g;
                let memoryMatch;
                while ((memoryMatch = memoryMarkerRegex.exec(reply)) !== null) {
                    try {
                        const memData = JSON.parse(memoryMatch[1]);
                        await this.db.addMemory({ ...memData, date: Date.now() });
                    } catch (e) {
                        console.error('Failed to parse memory:', e, memoryMatch[1]);
                    }
                }
                // Remove ALL memory markers from the display
                reply = reply.replace(/\[SAVE_MEMORY:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}\s*\]/g, '').trim();
            }

            // Filter happy emojis from replies to distressed users
            if (!this.isLocalMode && !initialMessage) {
                reply = this.filterEmojis(reply, msg);
            }

            // Final safety check: Strip any remaining memory markers before display
            reply = reply.replace(/\[SAVE_MEMORY:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}\s*\]/g, '').trim();

            const rdiv = document.createElement('div');
            rdiv.className = 'assistant-message';
            rdiv.textContent = reply;
            container.appendChild(rdiv);
            container.scrollTop = container.scrollHeight;

            // Only save conversation if it's a real user message (not initial greeting or bot-only messages)
            // Don't save if it's the initial greeting message
            const isInitialGreeting = initialMessage === '[INITIAL_GREETING]';
            if (!initialMessage && !isInitialGreeting) {
                await this.db.addConversation({ text: msg, sender: 'user', date: Date.now() });
                await this.db.addConversation({ text: reply, sender: 'assistant', date: Date.now() });

                // Analyze user message for potential calendar events/reminders
                await this.analyzeForEvents(msg);
            }

            // Trial mode is deprecated - users can always use LocalAssistant
            // No message limit anymore

        } catch (e) {
            document.getElementById(id)?.remove();
            const msgText = e.message || '';
            const status = e.status || 0;

            console.error(`Linen: sendChat failed (Status: ${status}, Message: ${msgText}). Checking for fallback options.`, e);

            // Determine if we should try to fallback
            const canFallback = (status === 0 && !navigator.onLine) || // Offline
                                (status === 429) || // Rate limited
                                (status === 403 && msgText.toLowerCase().includes('quota')) || // Quota exceeded
                                (msgText.includes('API key not configured')); // No API key

            if (canFallback && !this.isLocalMode) {
                // Try to switch to next available agent
                const agents = this.agentManager.getAgents();
                let nextAgent = null;

                if (this.currentAgent && agents.length > 1) {
                    // Try to switch to next agent
                    nextAgent = this.agentManager.switchToNextAvailableAgent(this.currentAgent.id);
                }

                if (nextAgent) {
                    console.log("Linen: Switching to next available agent:", nextAgent.name);
                    this.currentAgent = nextAgent;
                    this.assistant = this.createAssistantFromAgent(nextAgent);
                    this.showToast(`Switched to ${nextAgent.name}`);
                    // Retry the chat with new agent
                    return this.sendChat(initialMessage);
                } else {
                    // No alternative agents, fall back to LocalAssistant
                    console.log("Linen: No alternative agents available. Falling back to LocalAssistant.");
                    this.assistant = new LocalAssistant();
                    this.isLocalMode = true;
                    // Show typing bubble with delay
                    const typingDiv = document.createElement('div');
                    typingDiv.className = 'assistant-message typing-indicator';
                    typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
                    container.appendChild(typingDiv);
                    container.scrollTop = container.scrollHeight;
                    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
                    typingDiv.remove();
                    const localReply = await this.assistant.chat(msg);
                    const rdiv = document.createElement('div');
                    rdiv.className = 'assistant-message';
                    rdiv.textContent = localReply;
                    container.appendChild(rdiv);
                    container.scrollTop = container.scrollHeight;

                    // Show toast once when switching to local mode
                    if (this.trialMode) {
                        this.showLocalModeToast('trial');
                    } else {
                        this.showLocalModeToast(msgText);
                    }
                    // Only save conversation if it's a real user message (not initial greeting or bot-only messages)
                    const isInitialGreeting = initialMessage === '[INITIAL_GREETING]';
                    if (!initialMessage && !isInitialGreeting) {
                        await this.db.addConversation({ text: msg, sender: 'user', date: Date.now() });
                        await this.db.addConversation({ text: localReply, sender: 'assistant', date: Date.now() });
                    }
                }
            } else if (canFallback && this.isLocalMode) {
                 // Already in local mode, show typing bubble then respond
                 console.log("Linen: Already in local mode. LocalAssistant responding to error.");
                 const typingDiv = document.createElement('div');
                 typingDiv.className = 'assistant-message typing-indicator';
                 typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
                 container.appendChild(typingDiv);
                 container.scrollTop = container.scrollHeight;
                 await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
                 typingDiv.remove();
                 const localReply = await this.assistant.chat(msg);
                 const rdiv = document.createElement('div');
                 rdiv.className = 'assistant-message';
                 rdiv.textContent = localReply;
                 container.appendChild(rdiv);
                 container.scrollTop = container.scrollHeight;
            }
            else if (!navigator.onLine) {
                const ediv = document.createElement('div');
                ediv.className = 'assistant-message error-message';
                ediv.textContent = "You're offline. Please check your internet connection.";
                container.appendChild(ediv);
            }
            // All other non-recoverable errors
            else {
                const ediv = document.createElement('div');
                ediv.className = 'assistant-message error-message';
                ediv.textContent = `Something went wrong: ${msgText || 'Unknown error'}. Please try again.`;
                container.appendChild(ediv);
            }
            container.scrollTop = container.scrollHeight;
        }
    }

    async saveApiKey() {
        await this.validateAndSaveKey('api-key-input', 'settings-error', () => {
            this.showToast('API Key saved!');
            document.getElementById('api-key-input').value = '';
            document.getElementById('settings-modal').classList.remove('active');
            document.getElementById('modal-backdrop').classList.remove('active');
        });
    }

    async exportData() {
        const data = await this.db.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linen-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async clearAll() {
        if (!confirm('Are you sure you want to clear ALL data (memories and settings)? This cannot be undone.')) return;
        await this.db.clearAllMemories();
        await this.db.setSetting('gemini-api-key', null);
        await this.db.setSetting('onboarding-complete', false);
        window.location.reload();
    }
    async startNewChat() {
        // Clear only the current conversation (messages on screen)
        // Keep all saved history and memories intact
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        // Clear current session memory in assistant
        if (this.assistant && this.assistant.clearSession) {
            this.assistant.clearSession();
        }

        this.showToast('New chat started! 💬');

        // Start with greeting
        this.sendChat('[INITIAL_GREETING]');
    }

    async clearChatHistory() {
        if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) return;
        await this.db.clearConversations();
        this.loadChatHistory();
        this.showToast('Chat history cleared.');
    }

    async submitSuggestion() {
        const suggestionText = document.getElementById('suggestion-text').value.trim();
        const statusEl = document.getElementById('suggestion-status');
        const submitBtn = document.getElementById('submit-suggestion');

        if (!suggestionText) {
            statusEl.textContent = 'Please enter a suggestion.';
            statusEl.style.color = '#ff6b6b';
            return;
        }

        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        statusEl.textContent = '';

        try {
            // Send suggestion to formspree endpoint
            const response = await fetch('https://formspree.io/f/xaqdnyzw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: suggestionText,
                    timestamp: new Date().toISOString(),
                    _replyto: 'feedback'
                })
            });

            if (response.ok) {
                // Clear the textarea
                document.getElementById('suggestion-text').value = '';

                // Show success message
                statusEl.textContent = 'Thank you! Your suggestion has been received. 🙏';
                statusEl.style.color = '#4a9eff';

                // Reset button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Suggestion';

                // Clear success message after 3 seconds
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 3000);

                console.log('Linen: Suggestion submitted successfully');
            } else {
                throw new Error('Failed to submit suggestion');
            }
        } catch (e) {
            console.error('Linen: Error submitting suggestion:', e);

            // Show error message
            statusEl.textContent = 'Error sending suggestion. Please try again.';
            statusEl.style.color = '#ff6b6b';

            // Reset button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Suggestion';
        }
    }

    async loadMemories(filter = '') {
        const memories = await this.db.getAllMemories();
        const memoriesList = document.getElementById('memories-list');
        memoriesList.innerHTML = '';

        const filtered = memories.filter(mem => {
            const s = filter.toLowerCase();
            if (!s) return true;
            return (mem.title && mem.title.toLowerCase().includes(s)) ||
                (mem.text && mem.text.toLowerCase().includes(s)) ||
                (mem.preview && mem.preview.toLowerCase().includes(s)) ||
                (mem.tags && mem.tags.some(tag => tag.toLowerCase().includes(s)));
        });

        if (filtered.length === 0) {
            memoriesList.innerHTML = '<p class="empty-state">No memories yet.</p>';
            return;
        }

        filtered.forEach(mem => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            // Add click event listener to view full memory
            card.addEventListener('click', () => this.showMemoryModal(mem));

            const title = mem.title || 'Conversation';
            const preview = mem.preview || mem.text || 'No preview available';
            const date = new Date(mem.date).toLocaleDateString();

            card.innerHTML = `
                <h3 class="memory-card-title">${title}</h3>
                <p class="memory-card-preview">${preview}</p>
                <p class="memory-meta">
                    ${mem.emotion ? `<span class="emotion">${mem.emotion}</span>` : ''}
                    ${mem.tags?.length ? `<span class="tags">${mem.tags.map(t => `#${t}`).join(' ')}</span>` : ''}
                    <span class="date">${date}</span>
                </p>
                <div class="memory-card-actions">
                    <button class="edit-memory" data-id="${mem.id}" aria-label="Edit Memory">Edit</button>
                    <button class="delete-memory" data-id="${mem.id}" aria-label="Delete Memory">Delete</button>
                </div>
            `;
            memoriesList.appendChild(card);
        });

        memoriesList.querySelectorAll('.delete-memory').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent card click event
                if (confirm('Are you sure you want to delete this memory?')) {
                    await this.db.deleteMemory(parseInt(e.target.dataset.id));
                    this.loadMemories(document.getElementById('memory-search').value);
                }
            });
        });

        memoriesList.querySelectorAll('.edit-memory').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent card click event
                const memoryId = parseInt(e.target.dataset.id);
                const memory = filtered.find(m => m.id === memoryId);
                if (memory) {
                    this.showEditMemoryModal(memory);
                }
            });
        });
    }

    toggleVoiceInput() {
        if (this._voiceInputActive) {
            this.stopVoiceInput();
        } else {
            this.startVoiceInput();
        }
    }

    startVoiceInput() {
        this._voiceInputActive = true;
        console.log("Linen: Starting voice input");

        this.voiceManager.startListening(
            (transcript, isInterim) => {
                // In new messenger UI, voice input is handled directly
                // Just log for now
                console.log("Linen: Voice transcript:", transcript, isInterim);
            },
            (error) => {
                console.error('Voice input error:', error);
                this.showToast(`Voice input error: ${error}`);
                this.stopVoiceInput();
            }
        );
    }

    stopVoiceInput() {
        this._voiceInputActive = false;
        console.log("Linen: Stopping voice input");
        this.voiceManager.stopListening();
    }

    async analyzeForEvents(userMessage) {
        // Check if the message contains temporal references that suggest an event
        const eventKeywords = [
            'birthday', 'anniversary', 'appointment', 'meeting', 'flight',
            'reservation', 'deadline', 'exam', 'event', 'concert', 'wedding',
            'graduation', 'doctor', 'dentist', 'interview', 'presentation'
        ];

        const hasEventKeyword = eventKeywords.some(keyword =>
            userMessage.toLowerCase().includes(keyword)
        );

        // Check for temporal references
        const temporalPatterns = /tomorrow|next (week|weekend|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in \d+ (days?|weeks?|months?)/i;
        const hasTemporalRef = temporalPatterns.test(userMessage);

        if (hasEventKeyword && hasTemporalRef) {
            // Found a potential event - ask permission if not already done
            if (!this._eventPermissionAsked) {
                await this.requestEventPermission();
            }

            // Parse the event from the message
            const eventInfo = this.eventManager.parseEventFromText(userMessage);
            if (eventInfo.detected && this.eventManager.hasPermission) {
                // Extract title from the message
                const title = this.extractEventTitle(userMessage);
                if (title) {
                    await this.eventManager.createReminder({
                        title: title,
                        description: userMessage,
                        date: eventInfo.date
                    });
                    console.log('Linen: Reminder created for:', title);
                }
            }
        }
    }

    extractEventTitle(text) {
        // Simple extraction of event title from user message
        // e.g., "granny's birthday next weekend" -> "Granny's Birthday"

        const eventKeywords = [
            'birthday', 'anniversary', 'appointment', 'meeting', 'flight',
            'reservation', 'deadline', 'exam', 'event', 'concert', 'wedding',
            'graduation', 'doctor', 'dentist', 'interview', 'presentation'
        ];

        for (const keyword of eventKeywords) {
            const regex = new RegExp(`(.+?)\\s+${keyword}`, 'i');
            const match = text.match(regex);
            if (match) {
                return match[1].trim() + ' ' + keyword.charAt(0).toUpperCase() + keyword.slice(1);
            }
        }

        // If no match, just return first 50 characters
        return text.substring(0, 50);
    }

    async requestEventPermission() {
        this._eventPermissionAsked = true;

        // Check if notifications are already supported
        if (!('Notification' in window)) {
            this.showToast('Your browser does not support reminders.');
            return;
        }

        // Show custom permission request
        const backdrop = document.getElementById('modal-backdrop');
        const modal = document.createElement('div');
        modal.className = 'modal permission-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>📅 Enable Reminders?</h2>
                <p>I can create reminders for important dates and events mentioned in our conversation. Would you like me to set up reminders?</p>
                <p style="font-size: 0.9rem; color: #999; margin-top: 1rem;">Example: You mention "granny's birthday next weekend" and I'll remind you Friday to not forget! 🎂</p>
                <div class="modal-actions">
                    <button id="enable-reminders" class="btn btn-primary">Enable Reminders</button>
                    <button id="disable-reminders" class="btn btn-secondary">Not Now</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        backdrop.classList.add('active');
        modal.classList.add('active');

        return new Promise((resolve) => {
            document.getElementById('enable-reminders').addEventListener('click', async () => {
                const granted = await this.eventManager.requestPermission();
                modal.remove();
                backdrop.classList.remove('active');
                if (granted) {
                    this.showToast('Reminders enabled! ✓');
                }
                resolve(granted);
            });

            document.getElementById('disable-reminders').addEventListener('click', () => {
                modal.remove();
                backdrop.classList.remove('active');
                resolve(false);
            });
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.innerHTML = `
            <span>${message}</span>
            <button class="close-toast">×</button>
        `;
        toast.classList.add('show');

        const closeButton = toast.querySelector('.close-toast');
        if (closeButton) {
            closeButton.onclick = () => {
                toast.classList.remove('show');
                toast.innerHTML = ''; // Clear content after hiding
            };
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    try {
        window.addEventListener('appinstalled', () => {
            window.app.analytics.trackPWAInstall();
        });
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js').then(reg => {
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                            window.location.reload();
                        }
                    });
                });
            }).catch(err => console.error('SW registration failed:', err));
        }
        window.app = new Linen();
        window.app.init();
    } catch (e) {
        console.error('Fatal error:', e);
    }
});