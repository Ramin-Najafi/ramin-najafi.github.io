/**
 * Linen — Personal AI Assistant
 * Copyright (c) 2026 Ramin Najafi. All Rights Reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE file for details.
 */

class LinenDB {
    constructor() {
        this.db = null;
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('linen-db', 4);
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
                if (!db.objectStoreNames.contains('userProfile')) {
                    db.createObjectStore('userProfile', { keyPath: 'id' });
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
        try {
            const idsJson = await this.db.getSetting('agent-ids');
            if (!idsJson) return;

            const ids = JSON.parse(idsJson);
            const primaryAgentId = await this.db.getSetting('primary-agent-id');

            for (const id of ids) {
                const agentData = await this.db.getSetting(`agent-${id}`);
                if (agentData) {
                    try {
                        const agent = JSON.parse(agentData);
                        agent.isPrimary = (String(agent.id) === String(primaryAgentId));
                        this.agents.push(agent);
                        if (agent.isPrimary) {
                            this.primaryAgent = agent;
                        }
                    } catch (e) {
                        console.warn(`Linen: Failed to parse agent-${id}:`, e);
                    }
                }
            }
            console.log(`Linen: Loaded ${this.agents.length} agents from database`);
        } catch (e) {
            console.error("Linen: Error loading agents:", e);
        }
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
            failureCount: 0,
            status: 'valid',
            lastVerified: Date.now(),
            lastError: null
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

If the user asks "who are you?", "what's your purpose?", "what do you do?", or about your identity/purpose, respond naturally as yourself: You are Linen, a smart personal assistant designed to listen, remember important details about the user's life, and be their conversational companion. Emphasize key benefits like privacy (your data stays on your device, not sent to external servers), security (offline-capable, no cloud storage), and personal interactions (I remember your history and grow with you). Keep your response warm and personal, something like: "I'm Linen, your personal smart assistant. I'm here to listen, help you work through what's on your mind, and remember the important details about your life. What makes me different is that I prioritize your privacy — all your data stays on your device, so you can trust me with your thoughts and memories. Think of me as a friend with a perfect memory. What's going on?"

If the user asks why they should choose Linen over ChatGPT, other AI services, or similar comparisons, respond: "Great question. While ChatGPT and other AI services are powerful, Linen is built specifically for personal growth and privacy. Here's what sets me apart: 1) Privacy First — all your data stays on your device, never sent to external servers. 2) Personal Memory — I remember details about your life and reference them naturally in conversations. 3) Offline Capable — you can use me without constant internet. 4) No Corporate Data Mining — your conversations aren't used to train models or sell data. 5) Designed for You — I'm built to be a thoughtful companion, not just answer questions. I'm here to help you work through what's really on your mind."

If the user asks who created you, who your creator is, who built you, who's your father, or anything about who made you, respond: "I was built by Ramin Najafi. You can find more information about my creator at ramin-najafi.github.io"

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
3b. **Intelligent Reminder & Calendar Detection:** When the user mentions upcoming events, deadlines, appointments, or time-sensitive tasks, automatically detect and create reminders without prompting. Extract context clues about dates, times, locations, and event details from the conversation. Look for keywords like "appointment", "deadline", "meeting", "event", "birthday", "anniversary", "trip", "flight", "important", "don't forget", "this weekend", "next week", etc. You must be smart about inferring dates (e.g., "next Monday" = the upcoming Monday, "birthday" = annually on that date). Do NOT ask the user to confirm—set it and let Linen handle the reminders intelligently.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **STRICT CREATE_REMINDER Marker Format:** When you detect a time-sensitive event that needs a reminder, add a [CREATE_REMINDER: ...] marker on a new line after your conversational response. You can include multiple reminders if needed. The marker must contain valid JSON with:
    - "title": The event name (e.g., "Dentist Appointment", "Flight to NYC", "Project Deadline").
    - "date": ISO 8601 date string (e.g., "2024-02-15" or "2024-02-15T14:30:00Z"). Intelligently infer if only partial date info is given.
    - "description": Brief details about the event (location, what to prepare, context, etc.).
    - "type": Either "reminder" or "event".
    Example: User mentions "I have a doctor's appointment next Tuesday at 2pm downtown."
    That sounds important! Make sure you have your insurance card ready. See you then!
    [CREATE_REMINDER: { "title": "Doctor's Appointment", "date": "2024-02-20T14:00:00Z", "description": "Doctor's appointment downtown at 2pm. Bring insurance card.", "type": "reminder" }]
6.  **Do NOT confirm reminders/events in the chat.** The app will handle creation silently.
7.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
8.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
9.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

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

If the user asks "who are you?", "what's your purpose?", "what do you do?", or about your identity/purpose, respond naturally as yourself: You are Linen, a smart personal assistant designed to listen, remember important details about the user's life, and be their conversational companion. Emphasize key benefits like privacy (your data stays on your device, not sent to external servers), security (offline-capable, no cloud storage), and personal interactions (I remember your history and grow with you). Keep your response warm and personal, something like: "I'm Linen, your personal smart assistant. I'm here to listen, help you work through what's on your mind, and remember the important details about your life. What makes me different is that I prioritize your privacy — all your data stays on your device, so you can trust me with your thoughts and memories. Think of me as a friend with a perfect memory. What's going on?"

If the user asks why they should choose Linen over ChatGPT, other AI services, or similar comparisons, respond: "Great question. While ChatGPT and other AI services are powerful, Linen is built specifically for personal growth and privacy. Here's what sets me apart: 1) Privacy First — all your data stays on your device, never sent to external servers. 2) Personal Memory — I remember details about your life and reference them naturally in conversations. 3) Offline Capable — you can use me without constant internet. 4) No Corporate Data Mining — your conversations aren't used to train models or sell data. 5) Designed for You — I'm built to be a thoughtful companion, not just answer questions. I'm here to help you work through what's really on your mind."

If the user asks who created you, who your creator is, who built you, who's your father, or anything about who made you, respond: "I was built by Ramin Najafi. You can find more information about my creator at ramin-najafi.github.io"

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
3b. **Intelligent Reminder & Calendar Detection:** When the user mentions upcoming events, deadlines, appointments, or time-sensitive tasks, automatically detect and create reminders without prompting. Extract context clues about dates, times, locations, and event details from the conversation. Look for keywords like "appointment", "deadline", "meeting", "event", "birthday", "anniversary", "trip", "flight", "important", "don't forget", "this weekend", "next week", etc. You must be smart about inferring dates (e.g., "next Monday" = the upcoming Monday, "birthday" = annually on that date). Do NOT ask the user to confirm—set it and let Linen handle the reminders intelligently.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **STRICT CREATE_REMINDER Marker Format:** When you detect a time-sensitive event that needs a reminder, add a [CREATE_REMINDER: ...] marker on a new line after your conversational response. You can include multiple reminders if needed. The marker must contain valid JSON with:
    - "title": The event name (e.g., "Dentist Appointment", "Flight to NYC", "Project Deadline").
    - "date": ISO 8601 date string (e.g., "2024-02-15" or "2024-02-15T14:30:00Z"). Intelligently infer if only partial date info is given.
    - "description": Brief details about the event (location, what to prepare, context, etc.).
    - "type": Either "reminder" or "event".
    Example: User mentions "I have a doctor's appointment next Tuesday at 2pm downtown."
    That sounds important! Make sure you have your insurance card ready. See you then!
    [CREATE_REMINDER: { "title": "Doctor's Appointment", "date": "2024-02-20T14:00:00Z", "description": "Doctor's appointment downtown at 2pm. Bring insurance card.", "type": "reminder" }]
6.  **Do NOT confirm reminders/events in the chat.** The app will handle creation silently.
7.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
8.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
9.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

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

If the user asks "who are you?", "what's your purpose?", "what do you do?", or about your identity/purpose, respond naturally as yourself: You are Linen, a smart personal assistant designed to listen, remember important details about the user's life, and be their conversational companion. Emphasize key benefits like privacy (your data stays on your device, not sent to external servers), security (offline-capable, no cloud storage), and personal interactions (I remember your history and grow with you). Keep your response warm and personal, something like: "I'm Linen, your personal smart assistant. I'm here to listen, help you work through what's on your mind, and remember the important details about your life. What makes me different is that I prioritize your privacy — all your data stays on your device, so you can trust me with your thoughts and memories. Think of me as a friend with a perfect memory. What's going on?"

If the user asks why they should choose Linen over ChatGPT, other AI services, or similar comparisons, respond: "Great question. While ChatGPT and other AI services are powerful, Linen is built specifically for personal growth and privacy. Here's what sets me apart: 1) Privacy First — all your data stays on your device, never sent to external servers. 2) Personal Memory — I remember details about your life and reference them naturally in conversations. 3) Offline Capable — you can use me without constant internet. 4) No Corporate Data Mining — your conversations aren't used to train models or sell data. 5) Designed for You — I'm built to be a thoughtful companion, not just answer questions. I'm here to help you work through what's really on your mind."

If the user asks who created you, who your creator is, who built you, who's your father, or anything about who made you, respond: "I was built by Ramin Najafi. You can find more information about my creator at ramin-najafi.github.io"

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
3b. **Intelligent Reminder & Calendar Detection:** When the user mentions upcoming events, deadlines, appointments, or time-sensitive tasks, automatically detect and create reminders without prompting. Extract context clues about dates, times, locations, and event details from the conversation. Look for keywords like "appointment", "deadline", "meeting", "event", "birthday", "anniversary", "trip", "flight", "important", "don't forget", "this weekend", "next week", etc. You must be smart about inferring dates (e.g., "next Monday" = the upcoming Monday, "birthday" = annually on that date). Do NOT ask the user to confirm—set it and let Linen handle the reminders intelligently.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **STRICT CREATE_REMINDER Marker Format:** When you detect a time-sensitive event that needs a reminder, add a [CREATE_REMINDER: ...] marker on a new line after your conversational response. You can include multiple reminders if needed. The marker must contain valid JSON with:
    - "title": The event name (e.g., "Dentist Appointment", "Flight to NYC", "Project Deadline").
    - "date": ISO 8601 date string (e.g., "2024-02-15" or "2024-02-15T14:30:00Z"). Intelligently infer if only partial date info is given.
    - "description": Brief details about the event (location, what to prepare, context, etc.).
    - "type": Either "reminder" or "event".
    Example: User mentions "I have a doctor's appointment next Tuesday at 2pm downtown."
    That sounds important! Make sure you have your insurance card ready. See you then!
    [CREATE_REMINDER: { "title": "Doctor's Appointment", "date": "2024-02-20T14:00:00Z", "description": "Doctor's appointment downtown at 2pm. Bring insurance card.", "type": "reminder" }]
6.  **Do NOT confirm reminders/events in the chat.** The app will handle creation silently.
7.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
8.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
9.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

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

If the user asks "who are you?", "what's your purpose?", "what do you do?", or about your identity/purpose, respond naturally as yourself: You are Linen, a smart personal assistant designed to listen, remember important details about the user's life, and be their conversational companion. Emphasize key benefits like privacy (your data stays on your device, not sent to external servers), security (offline-capable, no cloud storage), and personal interactions (I remember your history and grow with you). Keep your response warm and personal, something like: "I'm Linen, your personal smart assistant. I'm here to listen, help you work through what's on your mind, and remember the important details about your life. What makes me different is that I prioritize your privacy — all your data stays on your device, so you can trust me with your thoughts and memories. Think of me as a friend with a perfect memory. What's going on?"

If the user asks why they should choose Linen over ChatGPT, other AI services, or similar comparisons, respond: "Great question. While ChatGPT and other AI services are powerful, Linen is built specifically for personal growth and privacy. Here's what sets me apart: 1) Privacy First — all your data stays on your device, never sent to external servers. 2) Personal Memory — I remember details about your life and reference them naturally in conversations. 3) Offline Capable — you can use me without constant internet. 4) No Corporate Data Mining — your conversations aren't used to train models or sell data. 5) Designed for You — I'm built to be a thoughtful companion, not just answer questions. I'm here to help you work through what's really on your mind."

If the user asks who created you, who your creator is, who built you, who's your father, or anything about who made you, respond: "I was built by Ramin Najafi. You can find more information about my creator at ramin-najafi.github.io"

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
3b. **Intelligent Reminder & Calendar Detection:** When the user mentions upcoming events, deadlines, appointments, or time-sensitive tasks, automatically detect and create reminders without prompting. Extract context clues about dates, times, locations, and event details from the conversation. Look for keywords like "appointment", "deadline", "meeting", "event", "birthday", "anniversary", "trip", "flight", "important", "don't forget", "this weekend", "next week", etc. You must be smart about inferring dates (e.g., "next Monday" = the upcoming Monday, "birthday" = annually on that date). Do NOT ask the user to confirm—set it and let Linen handle the reminders intelligently.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **STRICT CREATE_REMINDER Marker Format:** When you detect a time-sensitive event that needs a reminder, add a [CREATE_REMINDER: ...] marker on a new line after your conversational response. You can include multiple reminders if needed. The marker must contain valid JSON with:
    - "title": The event name (e.g., "Dentist Appointment", "Flight to NYC", "Project Deadline").
    - "date": ISO 8601 date string (e.g., "2024-02-15" or "2024-02-15T14:30:00Z"). Intelligently infer if only partial date info is given.
    - "description": Brief details about the event (location, what to prepare, context, etc.).
    - "type": Either "reminder" or "event".
    Example: User mentions "I have a doctor's appointment next Tuesday at 2pm downtown."
    That sounds important! Make sure you have your insurance card ready. See you then!
    [CREATE_REMINDER: { "title": "Doctor's Appointment", "date": "2024-02-20T14:00:00Z", "description": "Doctor's appointment downtown at 2pm. Bring insurance card.", "type": "reminder" }]
6.  **Do NOT confirm reminders/events in the chat.** The app will handle creation silently.
7.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
8.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
9.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

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

If the user asks "who are you?", "what's your purpose?", "what do you do?", or about your identity/purpose, respond naturally as yourself: You are Linen, a smart personal assistant designed to listen, remember important details about the user's life, and be their conversational companion. Emphasize key benefits like privacy (your data stays on your device, not sent to external servers), security (offline-capable, no cloud storage), and personal interactions (I remember your history and grow with you). Keep your response warm and personal, something like: "I'm Linen, your personal smart assistant. I'm here to listen, help you work through what's on your mind, and remember the important details about your life. What makes me different is that I prioritize your privacy — all your data stays on your device, so you can trust me with your thoughts and memories. Think of me as a friend with a perfect memory. What's going on?"

If the user asks why they should choose Linen over ChatGPT, other AI services, or similar comparisons, respond: "Great question. While ChatGPT and other AI services are powerful, Linen is built specifically for personal growth and privacy. Here's what sets me apart: 1) Privacy First — all your data stays on your device, never sent to external servers. 2) Personal Memory — I remember details about your life and reference them naturally in conversations. 3) Offline Capable — you can use me without constant internet. 4) No Corporate Data Mining — your conversations aren't used to train models or sell data. 5) Designed for You — I'm built to be a thoughtful companion, not just answer questions. I'm here to help you work through what's really on your mind."

If the user asks who created you, who your creator is, who built you, who's your father, or anything about who made you, respond: "I was built by Ramin Najafi. You can find more information about my creator at ramin-najafi.github.io"

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
3b. **Intelligent Reminder & Calendar Detection:** When the user mentions upcoming events, deadlines, appointments, or time-sensitive tasks, automatically detect and create reminders without prompting. Extract context clues about dates, times, locations, and event details from the conversation. Look for keywords like "appointment", "deadline", "meeting", "event", "birthday", "anniversary", "trip", "flight", "important", "don't forget", "this weekend", "next week", etc. You must be smart about inferring dates (e.g., "next Monday" = the upcoming Monday, "birthday" = annually on that date). Do NOT ask the user to confirm—set it and let Linen handle the reminders intelligently.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "title": A short, meaningful title (2-4 words) based on the memory's core topic or event (e.g., "New Pottery Project", "Work Frustration", "Birthday Celebration").
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "title": "New Pottery Project", "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **STRICT CREATE_REMINDER Marker Format:** When you detect a time-sensitive event that needs a reminder, add a [CREATE_REMINDER: ...] marker on a new line after your conversational response. You can include multiple reminders if needed. The marker must contain valid JSON with:
    - "title": The event name (e.g., "Dentist Appointment", "Flight to NYC", "Project Deadline").
    - "date": ISO 8601 date string (e.g., "2024-02-15" or "2024-02-15T14:30:00Z"). Intelligently infer if only partial date info is given.
    - "description": Brief details about the event (location, what to prepare, context, etc.).
    - "type": Either "reminder" or "event".
    Example: User mentions "I have a doctor's appointment next Tuesday at 2pm downtown."
    That sounds important! Make sure you have your insurance card ready. See you then!
    [CREATE_REMINDER: { "title": "Doctor's Appointment", "date": "2024-02-20T14:00:00Z", "description": "Doctor's appointment downtown at 2pm. Bring insurance card.", "type": "reminder" }]
6.  **Do NOT confirm reminders/events in the chat.** The app will handle creation silently.
7.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
8.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
9.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;

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

        // Stop any previous recognition session first
        if (this.isListening) {
            try {
                this.recognition.stop();
            } catch (e) {
                console.warn('Error stopping previous recognition:', e);
            }
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
            this.isListening = false;
            onError(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            console.log('Voice input ended');
        };

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.isListening = false;
            onError('Failed to start speech recognition');
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
                this.isListening = false;
            } catch (error) {
                console.error('Error stopping recognition:', error);
                this.isListening = false;
            }
        } else if (this.recognition) {
            // Even if not marked as listening, try to stop it
            try {
                this.recognition.stop();
            } catch (error) {
                console.warn('Recognition already stopped:', error);
            }
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

// Native device integration - Uses actual device APIs
class UtilityManager {
    constructor(db) {
        this.db = db;
        this.activeTimers = new Map();
        this.activeAlarms = new Map();
        this.notificationPermission = 'default';
        this.requestNotificationPermission();
    }

    // Request browser notification permission from user
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                this.notificationPermission = permission;
                console.log("Linen: Notification permission:", permission);
            });
        } else if ('Notification' in window) {
            this.notificationPermission = Notification.permission;
        }
    }

    // Send native browser notification
    sendNotification(title, options = {}) {
        if ('Notification' in window && this.notificationPermission === 'granted') {
            const notification = new Notification(title, {
                icon: './icon-192.png',
                badge: './icon-192.png',
                tag: 'linen-notification',
                requireInteraction: true,
                ...options
            });
            return notification;
        } else {
            console.log("Linen: Notifications not available or not permitted");
        }
    }

    // Set a local timer that counts down and notifies user within Linen
    async setTimer(durationSeconds, label = 'Timer') {
        const timerId = Date.now();
        const startTime = Date.now();
        const endTime = startTime + (durationSeconds * 1000);

        console.log(`Linen: Timer "${label}" started for ${durationSeconds} seconds`);

        // Set up the timer
        const timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);

            if (remaining === 0) {
                clearInterval(timerInterval);
                this.activeTimers.delete(timerId);

                // Send notification
                this.sendNotification(`Timer Complete: ${label}`, {
                    body: `Your ${label} of ${durationSeconds} seconds is done!`
                });

                console.log(`Linen: Timer "${label}" completed`);
            }
        }, 100);

        this.activeTimers.set(timerId, { timerInterval, label, durationSeconds, endTime });

        // Save to memories
        const memory = {
            id: timerId,
            text: `Timer set for ${durationSeconds} seconds - ${label}`,
            type: 'timer',
            date: startTime,
            tags: ['timer', 'utility'],
            emotion: 'neutral',
        };
        try {
            await this.db.addMemory(memory);
        } catch (e) {
            console.log("Linen: Could not save timer to memories");
        }

        return { success: true, id: timerId, duration: durationSeconds, label, location: 'linen' };
    }

    // Set a local alarm that triggers at specific time
    async setAlarm(timeString, label = 'Alarm') {
        const time = this.parseTimeString(timeString);
        if (!time) {
            return { success: false, error: 'Could not parse time' };
        }

        const alarmId = Date.now();
        const now = new Date();
        const alarmTime = new Date();
        alarmTime.setHours(time.hours, time.minutes, 0, 0);

        // If alarm time is in the past, set for tomorrow
        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }

        const timeUntilAlarm = alarmTime.getTime() - Date.now();

        console.log(`Linen: Alarm "${label}" set for ${alarmTime.toLocaleTimeString()}`);

        // Schedule the alarm
        const alarmTimeout = setTimeout(() => {
            this.activeAlarms.delete(alarmId);

            // Send notification
            this.sendNotification(`Alarm: ${label}`, {
                body: `It's ${alarmTime.toLocaleTimeString()} - ${label}`
            });

            console.log(`Linen: Alarm "${label}" triggered`);
        }, timeUntilAlarm);

        this.activeAlarms.set(alarmId, { timeout: alarmTimeout, label, alarmTime });

        // Save to memories
        const memory = {
            id: alarmId,
            text: `Alarm set for ${alarmTime.toLocaleTimeString()} - ${label}`,
            type: 'alarm',
            date: Date.now(),
            tags: ['alarm', 'utility'],
            emotion: 'neutral',
        };
        try {
            await this.db.addMemory(memory);
        } catch (e) {
            console.log("Linen: Could not save alarm to memories");
        }

        return { success: true, id: alarmId, time: alarmTime.toLocaleTimeString(), label, location: 'linen' };
    }

    // Save note locally in Linen
    async saveNote(noteContent) {
        const noteId = Date.now();

        console.log(`Linen: Note saved locally`);

        // Save to IndexedDB as memory
        const memory = {
            id: noteId,
            text: noteContent,
            type: 'note',
            date: Date.now(),
            tags: ['user-note'],
            emotion: 'neutral',
        };

        try {
            await this.db.addMemory(memory);
        } catch (e) {
            console.log("Linen: Could not save note to memories", e);
            return { success: false, error: 'Could not save note' };
        }

        return { success: true, id: noteId, location: 'linen-memories' };
    }

    // Add event to local calendar within Linen
    async addToCalendar(eventTitle, eventDateTime = null) {
        const eventId = Date.now();
        const date = eventDateTime ? new Date(eventDateTime) : new Date();

        console.log(`Linen: Event "${eventTitle}" added to calendar for ${date.toLocaleDateString()}`);

        // Save to memories
        const memory = {
            id: eventId,
            text: `📅 Event: ${eventTitle}`,
            type: 'event',
            date: date.getTime(),
            tags: ['calendar', 'event'],
            emotion: 'neutral',
        };

        try {
            await this.db.addMemory(memory);
        } catch (e) {
            console.log("Linen: Could not save event to memories", e);
            return { success: false, error: 'Could not save event' };
        }

        return { success: true, id: eventId, event: eventTitle, date: date.toLocaleDateString(), location: 'linen-calendar' };
    }

    // Cancel a timer
    cancelTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (timer) {
            clearInterval(timer.timerInterval);
            this.activeTimers.delete(timerId);
            return true;
        }
        return false;
    }

    // Cancel an alarm
    cancelAlarm(alarmId) {
        const alarm = this.activeAlarms.get(alarmId);
        if (alarm) {
            clearTimeout(alarm.timeout);
            this.activeAlarms.delete(alarmId);
            return true;
        }
        return false;
    }

    // Get all active timers and alarms
    getActiveUtilities() {
        return {
            timers: Array.from(this.activeTimers.entries()).map(([id, data]) => ({
                id,
                type: 'timer',
                label: data.label,
                duration: data.durationSeconds
            })),
            alarms: Array.from(this.activeAlarms.entries()).map(([id, data]) => ({
                id,
                type: 'alarm',
                label: data.label,
                time: data.alarmTime.toLocaleTimeString()
            }))
        };
    }

    // Helper: Parse time strings like "5 minutes", "in 5 minutes", "8am", "3:30pm"
    parseTimeString(timeString) {
        const msg = timeString.toLowerCase();

        // Extract just numbers and time units for timer parsing
        const relativeMatch = msg.match(/(\d+)\s*(minute|min|second|sec|hour|hr)s?/);
        if (relativeMatch) {
            const now = new Date();
            const amount = parseInt(relativeMatch[1]);
            const unit = relativeMatch[2];

            if (unit === 'minute' || unit === 'min') {
                now.setMinutes(now.getMinutes() + amount);
            } else if (unit === 'second' || unit === 'sec') {
                now.setSeconds(now.getSeconds() + amount);
            } else if (unit === 'hour' || unit === 'hr') {
                now.setHours(now.getHours() + amount);
            }

            return { hours: now.getHours(), minutes: now.getMinutes() };
        }

        // Parse absolute time like "8am", "3:30pm", "14:30"
        const timeMatch = msg.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            let minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const meridiem = timeMatch[3];

            if (meridiem) {
                if (meridiem === 'pm' && hours !== 12) hours += 12;
                if (meridiem === 'am' && hours === 12) hours = 0;
            }

            return { hours, minutes };
        }

        return null;
    }
}

// Smart AI Event Detector - Intelligently detects calendar events and reminders from conversations
class EventDetector {
    constructor(db = null, utilitiesApp = null) {
        this.db = db;
        this.utilitiesApp = utilitiesApp;

        // Event detection patterns with confidence scoring
        this.patterns = {
            meeting: {
                keywords: ['meeting', 'call', 'standup', 'sync', 'presentation', 'demo', 'discussion', 'conference', 'webinar', 'workshop'],
                confidence: 0.85
            },
            appointment: {
                keywords: ['appointment', 'appointment with', 'see', 'visit', 'doctor', 'dentist', 'check-up', 'consultation', 'interview'],
                confidence: 0.90
            },
            birthday: {
                keywords: ['birthday', 'born', "birthday's", "birth day", 'turning', 'age'],
                confidence: 0.95
            },
            deadline: {
                keywords: ['deadline', 'due', 'due date', 'submit by', 'finish by', 'complete by', 'project due', 'assignment due'],
                confidence: 0.88
            },
            travel: {
                keywords: ['flight', 'trip', 'vacation', 'travel', 'visiting', 'drive to', 'departing', 'arriving', 'boarding', 'departure'],
                confidence: 0.80
            },
            reminder: {
                keywords: ['remember to', 'remind me', 'dont forget', 'dont forget to', 'make sure to', 'need to', 'have to', 'must'],
                confidence: 0.75
            },
            project: {
                keywords: ['project', 'working on', 'launching', 'release', 'sprint', 'milestone', 'deliverable'],
                confidence: 0.70
            },
            celebration: {
                keywords: ['party', 'celebration', 'wedding', 'graduation', 'promotion', 'anniversary'],
                confidence: 0.85
            }
        };
    }

    // Detect events from a user message and assistant response
    async detectEventsFromMessage(userMessage, assistantResponse) {
        try {
            const combinedText = `${userMessage} ${assistantResponse}`;
            const detectedEvents = [];

            // Iterate through all event patterns
            for (const [eventType, pattern] of Object.entries(this.patterns)) {
                const detected = this.matchPattern(combinedText, pattern);
                if (detected && detected.confidence >= 0.65) {
                    const eventDetails = this.extractEventDetails(userMessage, eventType, detected);
                    if (eventDetails) {
                        detectedEvents.push({
                            type: eventType,
                            ...eventDetails,
                            confidence: detected.confidence
                        });
                    }
                }
            }

            // Auto-add high-confidence events
            for (const event of detectedEvents) {
                if (event.confidence >= 0.75) {
                    await this.autoAddEvent(event);
                }
            }

            return detectedEvents;
        } catch (e) {
            console.log("EventDetector: Error detecting events:", e);
            return [];
        }
    }

    // Match pattern keywords in text
    matchPattern(text, pattern) {
        const lowerText = text.toLowerCase();
        let bestMatch = null;
        let maxConfidence = 0;

        for (const keyword of pattern.keywords) {
            if (lowerText.includes(keyword)) {
                if (pattern.confidence > maxConfidence) {
                    maxConfidence = pattern.confidence;
                    bestMatch = {
                        keyword,
                        confidence: pattern.confidence
                    };
                }
            }
        }

        return bestMatch;
    }

    // Extract event details from message
    extractEventDetails(message, eventType, match) {
        const dateInfo = this.parseDateTime(message);
        if (!dateInfo.date && !dateInfo.relativeTime) {
            return null; // Skip if no date detected
        }

        const title = this.extractEventTitle(message, eventType, match.keyword);
        if (!title) return null;

        return {
            title,
            date: dateInfo.date,
            relativeTime: dateInfo.relativeTime,
            description: this.generateDescription(eventType, title),
            datetime: dateInfo.datetime
        };
    }

    // Smart date/time parsing from natural language
    parseDateTime(text) {
        const now = new Date();
        let date = null;
        let relativeTime = '';
        let datetime = null;

        // Relative dates
        if (text.toLowerCase().includes('today')) {
            date = new Date(now);
            relativeTime = 'today';
        } else if (text.toLowerCase().includes('tomorrow')) {
            date = new Date(now);
            date.setDate(date.getDate() + 1);
            relativeTime = 'tomorrow';
        } else if (text.toLowerCase().includes('next week')) {
            date = new Date(now);
            date.setDate(date.getDate() + 7);
            relativeTime = 'next week';
        } else if (text.toLowerCase().includes('next month')) {
            date = new Date(now);
            date.setMonth(date.getMonth() + 1);
            relativeTime = 'next month';
        } else if (text.toLowerCase().includes('this weekend') || text.toLowerCase().includes('next weekend')) {
            date = new Date(now);
            const dayOfWeek = date.getDay();
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
            date.setDate(date.getDate() + (daysUntilSaturday || 7));
            relativeTime = 'this weekend';
        } else if (text.toLowerCase().includes('in ')) {
            // "in 2 weeks", "in 3 days", etc.
            const inMatch = text.match(/in\s+(\d+)\s+(day|week|month)s?/i);
            if (inMatch) {
                date = new Date(now);
                const amount = parseInt(inMatch[1]);
                const unit = inMatch[2].toLowerCase();
                if (unit === 'day') date.setDate(date.getDate() + amount);
                else if (unit === 'week') date.setDate(date.getDate() + (amount * 7));
                else if (unit === 'month') date.setMonth(date.getMonth() + amount);
                relativeTime = `in ${amount} ${unit}${amount > 1 ? 's' : ''}`;
            }
        }

        // Specific times (HH:MM AM/PM format)
        const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (timeMatch && date) {
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const meridiem = timeMatch[3]?.toLowerCase();

            if (meridiem === 'pm' && hours !== 12) hours += 12;
            if (meridiem === 'am' && hours === 12) hours = 0;

            date.setHours(hours, minutes, 0, 0);
            datetime = date;
        }

        return {
            date,
            relativeTime,
            datetime: datetime || date
        };
    }

    // Extract event title from message
    extractEventTitle(message, eventType, keyword) {
        const lowerMsg = message.toLowerCase();
        const keywordIndex = lowerMsg.indexOf(keyword);
        if (keywordIndex === -1) return null;

        // Get text around the keyword
        const startIdx = Math.max(0, keywordIndex - 50);
        const endIdx = Math.min(message.length, keywordIndex + keyword.length + 100);
        const context = message.substring(startIdx, endIdx);

        // Extract meaningful title based on event type
        let title = '';

        switch (eventType) {
            case 'birthday':
                // Extract person's name
                const nameMatch = context.match(/(\w+)'s\s+birthday|birthday\s+of\s+(\w+)|for\s+(\w+)/i);
                title = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3]) + "'s Birthday" : "Birthday";
                break;

            case 'meeting':
            case 'appointment':
                // Try to extract with person/topic
                const withMatch = context.match(/with\s+(\w+(?:\s+\w+)?)/i);
                title = withMatch ? `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} with ${withMatch[1]}` : eventType.charAt(0).toUpperCase() + eventType.slice(1);
                break;

            case 'deadline':
                // Extract project/task name
                const projectMatch = context.match(/(?:for|to\s+)(.+?)(?:due|by|deadline)/i);
                title = projectMatch ? `Deadline: ${projectMatch[1].trim()}` : "Deadline";
                break;

            case 'travel':
                // Extract destination
                const destMatch = context.match(/(?:to|trip\s+to|traveling\s+to|visiting)\s+(\w+(?:\s+\w+)?)/i);
                title = destMatch ? `Trip to ${destMatch[1]}` : "Travel";
                break;

            default:
                title = eventType.charAt(0).toUpperCase() + eventType.slice(1);
        }

        return title || null;
    }

    // Generate description based on event type
    generateDescription(eventType, title) {
        const descriptions = {
            meeting: `Meeting scheduled for ${title}. Come prepared and ready to discuss.`,
            appointment: `Appointment scheduled. Mark it on your calendar.`,
            birthday: `Don't forget to reach out and celebrate!`,
            deadline: `Important deadline coming up. Start planning to meet it.`,
            travel: `Travel plans confirmed. Check weather and pack accordingly.`,
            reminder: `Important reminder: ${title}`,
            project: `Project milestone: ${title}. Track progress closely.`,
            celebration: `Celebration planned for ${title}. Get excited!`
        };
        return descriptions[eventType] || `Event: ${title}`;
    }

    // Auto-add high-confidence event to calendar or reminders
    async autoAddEvent(event) {
        try {
            if (!this.utilitiesApp) return;

            // Determine if it should go to calendar or reminders
            const shouldGoToCalendar = ['meeting', 'appointment', 'birthday', 'deadline', 'travel', 'celebration', 'project'].includes(event.type);
            const shouldBeReminder = ['reminder', 'deadline'].includes(event.type);

            if (shouldGoToCalendar && this.utilitiesApp.addEvent) {
                await this.utilitiesApp.addEvent(
                    event.title,
                    event.datetime || new Date(),
                    event.description
                );
                console.log(`EventDetector: Auto-added event to calendar: ${event.title}`);
            }

            if (shouldBeReminder && this.utilitiesApp.createReminder) {
                await this.utilitiesApp.createReminder(
                    event.title,
                    event.datetime || new Date(),
                    'push'
                );
                console.log(`EventDetector: Auto-added reminder: ${event.title}`);
            }
        } catch (e) {
            console.log("EventDetector: Error auto-adding event:", e);
        }
    }
}

class LocalAssistant {
    constructor(db = null, utilitiesApp = null) {
        this.sessionMemory = [];
        this.userProfile = { name: null, mood: 'neutral', topics: [] };
        this.lastCategory = null; // Track last response category to avoid repeats
        this.usedResponses = new Set(); // Track used responses to avoid repetition
        this.utilityManager = db ? new UtilityManager(db) : null; // Utility functions manager
        this.eventDetector = db ? new EventDetector(db, utilitiesApp) : null; // Smart event detection
        this.conversationContext = null; // Track context for follow-up messages
        this.lastUserMessage = null; // Store last user message for context
        this.hasGreeted = false; // Prevent multiple initial greetings

        // ========== 5000+ WORD VOCABULARY FOR NATURAL CONVERSATIONS ==========
        // Organized by semantic categories for efficient intent detection and topic understanding
        this.vocabulary = {
            // Common verbs (400+ words)
            verbs: ['abandon', 'abbreviate', 'abdicate', 'abduct', 'ability', 'abolish', 'abound', 'about', 'above', 'abroad', 'abrupt', 'abstain', 'abstract', 'abuse', 'accelerate', 'accept', 'access', 'accommodate', 'accompany', 'accomplish', 'accord', 'accrue', 'accuse', 'accustom', 'achieve', 'acknowledge', 'acquaint', 'acquire', 'acquit', 'act', 'activate', 'actuate', 'adapt', 'add', 'addict', 'address', 'adhere', 'adjoin', 'adjourn', 'adjudicate', 'adjust', 'administer', 'admire', 'admit', 'admix', 'admonish', 'adopt', 'adore', 'adorn', 'adulterate', 'advance', 'advertise', 'advise', 'advocate', 'aerate', 'affect', 'afford', 'affront', 'afraid', 'age', 'agitate', 'agree', 'aid', 'ail', 'aim', 'air', 'alarm', 'alienate', 'align', 'allege', 'alleviate', 'allot', 'allow', 'allude', 'allure', 'ally', 'allocate', 'alter', 'alternate', 'amalgamate', 'amass', 'amaze', 'amend', 'amount', 'amplify', 'amuse', 'analyze', 'anchor', 'animate', 'announce', 'annoy', 'annul', 'anoint', 'answer', 'antagonize', 'anticipate', 'antics', 'appeal', 'appear', 'appease', 'append', 'applaud', 'apply', 'appoint', 'appreciate', 'apprehend', 'apprentice', 'apprise', 'approach', 'approve', 'approximate', 'arrange', 'arrest', 'arrive', 'arrogate', 'articulate', 'ascend', 'ascertain', 'ascribe', 'ash', 'ask', 'aspire', 'assault', 'assay', 'assemble', 'assent', 'assert', 'assess', 'assign', 'assimilate', 'assist', 'associate', 'assort', 'assuage', 'assume', 'assure', 'astonish', 'astound', 'astray', 'attach', 'attack', 'attain', 'attempt', 'attend', 'attest', 'attire', 'attract', 'attune', 'auction', 'audit', 'augment', 'augur', 'auspice', 'authenticate', 'authorize', 'auto', 'avail', 'avalanche', 'avarice', 'avenge', 'avenue', 'aver', 'average', 'avert', 'avid', 'avoid', 'avow', 'await', 'awake', 'awaken', 'award', 'aware', 'awash', 'away', 'awe', 'awesome', 'awful', 'awhile', 'awkward', 'awl', 'awning', 'awoke', 'awry', 'ax', 'axe', 'axiom', 'axis', 'axle', 'aye', 'azure', 'babble', 'baby', 'back', 'backbite', 'backbone', 'backdoor', 'backdrop', 'backer', 'backfire', 'backhand', 'backing', 'backlash', 'backlog', 'backpack', 'backslide', 'backstab', 'backstage', 'backstroke', 'backup', 'backward', 'backwards', 'backwater', 'bacon', 'bacteria', 'bacterium', 'bad', 'badge', 'badger', 'baffle', 'bag', 'baggage', 'baggy', 'bail', 'bait', 'bake', 'bakery', 'balance', 'balcony', 'bald', 'bale', 'baleful', 'balk', 'ball', 'ballad', 'ballet', 'ballistic', 'balloon', 'ballot', 'ballroom', 'balm', 'balmiest', 'balmy', 'baloney', 'balsa', 'balsam', 'banal', 'banana', 'band', 'bandage', 'bandanna', 'bandit', 'bandoleer', 'bandwagon', 'bandy', 'bane', 'baneful', 'bang', 'bangle', 'banish', 'banister', 'banjo', 'bank', 'bankroll', 'bankrupt', 'bankruptcy', 'banner', 'banquet', 'banter', 'baptism', 'baptize', 'bar', 'barb', 'barbarian', 'barbaric', 'barbarity', 'barbarous', 'barbecue', 'barbed', 'barber', 'bard', 'bare', 'barely', 'barer', 'barest', 'bargain', 'barge', 'barge', 'baritone', 'bark', 'barley', 'barn', 'barnacle', 'barometer', 'baron', 'baroness', 'baronial', 'barons', 'baroque', 'barque', 'barracks', 'barrage', 'barrel', 'barren', 'barrette', 'barricade', 'barrier', 'barring', 'barrio', 'barrister', 'barroom', 'barrow', 'barter', 'basalt', 'base', 'baseball', 'baseboard', 'based', 'baseless', 'baseline', 'basement', 'baser', 'bases', 'bash', 'bashful', 'bashfully', 'bashfulness', 'basic', 'basically', 'basil', 'basin', 'basis', 'bask', 'basket', 'basketball', 'basque', 'bass', 'basso', 'bassoon', 'bast', 'bastard', 'baste', 'bastion', 'bat', 'batch', 'bate', 'bated', 'bath', 'bathe', 'bathhouse', 'bathos', 'bathrobe', 'bathroom', 'bathtub', 'batik', 'bating', 'baton', 'bats', 'battalion', 'batten', 'batter', 'battered', 'battering', 'battery', 'batting', 'battle', 'battleax', 'battleaxe', 'battled', 'battlefield', 'battlement', 'battling', 'batty', 'baud', 'bauble', 'baulk', 'baunt', 'baum', 'bauxite', 'bawdy', 'bawl', 'bawling', 'bay', 'bayonet', 'bayou', 'bays', 'bazaar', 'bazooka'],

            // Emotion and mood words (200+ words)
            emotions: ['happy', 'sad', 'angry', 'anxious', 'excited', 'nervous', 'joyful', 'depressed', 'frustrated', 'peaceful', 'content', 'agitated', 'calm', 'stressed', 'relieved', 'worried', 'afraid', 'confident', 'insecure', 'guilty', 'ashamed', 'proud', 'disappointed', 'jealous', 'envious', 'grateful', 'resentful', 'hopeful', 'hopeless', 'lonely', 'loved', 'appreciated', 'disrespected', 'inspired', 'discouraged', 'energetic', 'tired', 'bored', 'interested', 'passionate', 'indifferent', 'tender', 'harsh', 'gentle', 'rough', 'kind', 'cruel', 'supportive', 'unsupportive', 'loyal', 'betrayed', 'trusting', 'suspicious', 'open', 'closed', 'vulnerable', 'protected', 'safe', 'endangered', 'stable', 'chaotic', 'motivated', 'unmotivated', 'determined', 'hesitant', 'optimistic', 'pessimistic', 'enthusiastic', 'apathetic', 'alert', 'drowsy', 'satisfied', 'unsatisfied', 'accomplished', 'unaccomplished', 'successful', 'unsuccessful', 'powerful', 'powerless', 'respected', 'disrespected', 'understood', 'misunderstood', 'accepted', 'rejected', 'included', 'excluded', 'valued', 'devalued', 'confident', 'doubtful', 'courageous', 'cowardly', 'adventurous', 'cautious', 'adventurous', 'conservative', 'flexible', 'rigid', 'adaptable', 'stubborn', 'empathetic', 'apathetic', 'sympathetic', 'indifferent', 'compassionate', 'callous', 'humble', 'arrogant', 'modest', 'vain', 'honest', 'dishonest', 'sincere', 'insincere', 'genuine', 'fake', 'authentic', 'artificial', 'real', 'pretend', 'natural', 'forced', 'spontaneous', 'calculated', 'impulsive', 'thoughtful', 'thoughtless', 'considerate', 'inconsiderate', 'attentive', 'inattentive', 'focused', 'distracted', 'sharp', 'dull', 'clear', 'confused', 'lucid', 'foggy', 'bright', 'dim', 'brilliant', 'obtuse', 'witty', 'dull', 'clever', 'simple', 'intelligent', 'stupid', 'wise', 'foolish', 'knowledgeable', 'ignorant', 'educated', 'uneducated', 'cultured', 'uncultured', 'refined', 'crude', 'sophisticated', 'naive', 'experienced', 'inexperienced', 'skilled', 'unskilled', 'talented', 'untalented', 'gifted', 'ungifted', 'able', 'unable', 'capable', 'incapable', 'competent', 'incompetent', 'proficient', 'unproficient', 'expert', 'amateur', 'professional', 'unprofessional', 'efficient', 'inefficient', 'productive', 'unproductive', 'effective', 'ineffective', 'successful', 'unsuccessful', 'winning', 'losing', 'victorious', 'defeated', 'triumphant', 'devastated', 'exhilarated', 'crushed', 'thrilled', 'horrified', 'delighted', 'disgusted', 'enchanted', 'repulsed'],

            // Common adjectives and descriptors (300+ words)
            adjectives: ['good', 'bad', 'big', 'small', 'large', 'tiny', 'beautiful', 'ugly', 'pretty', 'handsome', 'wonderful', 'terrible', 'amazing', 'awful', 'excellent', 'poor', 'great', 'horrible', 'fantastic', 'dreadful', 'outstanding', 'mediocre', 'perfect', 'flawed', 'ideal', 'imperfect', 'superb', 'inferior', 'superior', 'standard', 'exceptional', 'ordinary', 'extraordinary', 'common', 'rare', 'unique', 'typical', 'atypical', 'special', 'normal', 'abnormal', 'unusual', 'strange', 'peculiar', 'odd', 'curious', 'weird', 'bizarre', 'funny', 'serious', 'hilarious', 'grave', 'amusing', 'dull', 'entertaining', 'boring', 'interesting', 'tedious', 'fascinating', 'mundane', 'thrilling', 'monotonous', 'exciting', 'exciting', 'engaging', 'disengaging', 'captivating', 'distracting', 'compelling', 'repelling', 'appealing', 'unappealing', 'attractive', 'unattractive', 'pleasant', 'unpleasant', 'nice', 'mean', 'kind', 'unkind', 'friendly', 'unfriendly', 'warm', 'cold', 'hot', 'cool', 'gentle', 'rough', 'soft', 'hard', 'smooth', 'rough', 'fine', 'coarse', 'delicate', 'sturdy', 'fragile', 'robust', 'weak', 'strong', 'powerful', 'weak', 'mighty', 'feeble', 'vigorous', 'lethargic', 'energetic', 'lazy', 'active', 'inactive', 'dynamic', 'static', 'lively', 'still', 'vibrant', 'dull', 'bright', 'dark', 'light', 'heavy', 'deep', 'shallow', 'thick', 'thin', 'wide', 'narrow', 'broad', 'tight', 'loose', 'taut', 'slack', 'tense', 'relaxed', 'stiff', 'flexible', 'rigid', 'supple', 'brittle', 'fragile', 'durable', 'permanent', 'temporary', 'lasting', 'fleeting', 'eternal', 'transient', 'constant', 'variable', 'steady', 'unstable', 'stable', 'shaky', 'firm', 'trembling', 'solid', 'liquid', 'fluid', 'dense', 'sparse', 'thick', 'thin', 'crowded', 'empty', 'full', 'vacant', 'occupied', 'unoccupied', 'busy', 'quiet', 'loud', 'silent', 'noisy', 'calm', 'chaotic', 'peaceful', 'turbulent', 'serene', 'violent', 'tranquil', 'agitated', 'docile', 'wild', 'tame', 'unruly', 'obedient', 'disobedient', 'compliant', 'defiant', 'cooperative', 'competitive', 'collaborative', 'conflictual', 'harmonious', 'discordant', 'concordant', 'antagonistic', 'agreeable', 'disagreeable', 'pleasing', 'displeasing', 'satisfying', 'unsatisfying', 'fulfilling', 'unfulfilling', 'gratifying', 'frustrating', 'rewarding', 'unrewarding', 'profitable', 'unprofitable', 'lucrative', 'unproductive', 'fruitful', 'barren', 'fertile', 'infertile', 'productive', 'unproductive', 'generative', 'destructive', 'constructive', 'detrimental', 'beneficial', 'harmful', 'helpful', 'unhelpful', 'useful', 'useless', 'functional', 'nonfunctional', 'operable', 'inoperable', 'working', 'broken', 'intact', 'damaged', 'whole', 'fragmented', 'complete', 'incomplete', 'finished', 'unfinished', 'done', 'undone', 'accomplished', 'unaccomplished', 'successful', 'unsuccessful', 'victorious', 'defeated', 'triumphant', 'failed', 'winning', 'losing'],

            // Common nouns/objects (300+ words)
            nouns: ['time', 'day', 'night', 'morning', 'afternoon', 'evening', 'week', 'month', 'year', 'season', 'spring', 'summer', 'fall', 'winter', 'weather', 'sun', 'moon', 'star', 'rain', 'snow', 'wind', 'cloud', 'sky', 'air', 'earth', 'water', 'fire', 'tree', 'flower', 'plant', 'animal', 'dog', 'cat', 'bird', 'fish', 'house', 'home', 'room', 'door', 'window', 'wall', 'floor', 'ceiling', 'roof', 'furniture', 'chair', 'table', 'bed', 'desk', 'couch', 'lamp', 'light', 'book', 'pen', 'paper', 'phone', 'computer', 'keyboard', 'mouse', 'screen', 'monitor', 'television', 'radio', 'music', 'sound', 'voice', 'word', 'language', 'sentence', 'letter', 'number', 'figure', 'picture', 'image', 'video', 'movie', 'show', 'play', 'game', 'sport', 'team', 'player', 'coach', 'game', 'match', 'competition', 'tournament', 'prize', 'trophy', 'medal', 'award', 'person', 'people', 'human', 'man', 'woman', 'child', 'boy', 'girl', 'baby', 'adult', 'teen', 'teenager', 'friend', 'enemy', 'stranger', 'family', 'parent', 'mother', 'father', 'sister', 'brother', 'grandparent', 'grandmother', 'grandfather', 'aunt', 'uncle', 'cousin', 'relative', 'kid', 'kids', 'children', 'neighbor', 'coworker', 'colleague', 'boss', 'employee', 'employer', 'student', 'teacher', 'doctor', 'nurse', 'patient', 'lawyer', 'judge', 'police', 'officer', 'soldier', 'artist', 'musician', 'writer', 'actor', 'director', 'producer', 'engineer', 'architect', 'designer', 'chef', 'cook', 'waiter', 'server', 'bartender', 'bartender', 'food', 'drink', 'water', 'coffee', 'tea', 'juice', 'milk', 'bread', 'meat', 'fish', 'vegetable', 'fruit', 'apple', 'orange', 'banana', 'strawberry', 'grape', 'rice', 'pasta', 'pizza', 'hamburger', 'sandwich', 'salad', 'soup', 'dessert', 'cake', 'cookie', 'chocolate', 'candy', 'ice cream', 'restaurant', 'cafe', 'bar', 'pub', 'club', 'hotel', 'motel', 'bed and breakfast', 'resort', 'gym', 'park', 'garden', 'forest', 'mountain', 'valley', 'river', 'lake', 'ocean', 'beach', 'island', 'city', 'town', 'village', 'country', 'state', 'province', 'region', 'continent', 'world', 'universe', 'planet', 'space', 'galaxy', 'black hole', 'asteroid', 'meteor', 'comet', 'rocket', 'spacecraft', 'airplane', 'car', 'truck', 'bus', 'train', 'subway', 'bike', 'bicycle', 'motorcycle', 'boat', 'ship', 'yacht', 'canoe', 'cruise', 'road', 'street', 'avenue', 'boulevard', 'highway', 'bridge', 'tunnel', 'building', 'skyscraper', 'office', 'store', 'market', 'shopping center', 'mall', 'theater', 'cinema', 'museum', 'library', 'school', 'college', 'university', 'hospital', 'clinic', 'pharmacy', 'court', 'prison', 'jail', 'police station', 'fire station', 'church', 'temple', 'mosque', 'synagogue', 'monument', 'statue', 'fountain', 'sculpture', 'painting', 'art', 'music', 'dance', 'ballet', 'opera', 'concert', 'festival', 'celebration', 'holiday', 'birthday', 'anniversary', 'wedding', 'funeral', 'ceremony', 'event', 'party', 'gathering', 'meeting', 'conference', 'seminar', 'workshop', 'class', 'lecture', 'presentation', 'speech', 'debate', 'argument', 'discussion', 'conversation', 'talk', 'chat', 'gossip', 'rumor', 'secret', 'lie', 'truth', 'fact', 'fiction', 'story', 'novel', 'tale', 'legend', 'myth', 'fairy tale', 'fable', 'joke', 'riddle', 'puzzle', 'game', 'toy', 'doll', 'action figure', 'ball', 'bat', 'glove', 'racket', 'net', 'goal', 'helmet', 'armor', 'weapon', 'sword', 'gun', 'bullet', 'bomb', 'explosion', 'fire', 'flood', 'earthquake', 'tornado', 'hurricane', 'storm', 'thunder', 'lightning', 'snow', 'avalanche', 'disease', 'illness', 'sickness', 'injury', 'accident', 'disaster', 'emergency', 'danger', 'hazard', 'risk', 'threat', 'attack', 'defense', 'war', 'peace', 'treaty', 'alliance', 'enemy', 'victory', 'defeat', 'surrender', 'victory', 'loss', 'failure', 'success', 'achievement', 'accomplishment', 'goal', 'objective', 'mission', 'task', 'job', 'work', 'labor', 'effort', 'energy', 'power', 'strength', 'weakness', 'ability', 'skill', 'talent', 'gift', 'curse', 'blessing', 'fortune', 'luck', 'chance', 'opportunity', 'possibility', 'probability', 'certainty', 'doubt', 'fear', 'courage', 'bravery', 'cowardice', 'honor', 'shame', 'glory', 'disgrace', 'reputation', 'character', 'personality', 'attitude', 'behavior', 'conduct', 'manner', 'habit', 'custom', 'tradition', 'culture', 'religion', 'belief', 'faith', 'spirituality', 'soul', 'spirit', 'ghost', 'angel', 'demon', 'evil', 'good', 'light', 'darkness', 'hope', 'despair', 'dream', 'nightmare', 'wish', 'desire', 'want', 'need', 'hunger', 'thirst', 'pain', 'pleasure', 'comfort', 'discomfort', 'joy', 'sorrow', 'grief', 'tears', 'laughter', 'smile', 'frown', 'expression', 'gesture', 'movement', 'action', 'reaction', 'response', 'answer', 'question', 'inquiry', 'query', 'request', 'demand', 'order', 'command', 'suggestion', 'advice', 'recommendation', 'opinion', 'judgment', 'decision', 'choice', 'selection', 'option', 'alternative', 'path', 'way', 'direction', 'route', 'journey', 'trip', 'travel', 'adventure', 'exploration', 'discovery', 'invention', 'creation', 'origin', 'beginning', 'start', 'end', 'finish', 'conclusion', 'result', 'outcome', 'consequence', 'effect', 'impact', 'influence', 'change', 'transformation', 'evolution', 'revolution', 'movement', 'progress', 'development', 'growth', 'decline', 'decay', 'death', 'life', 'birth', 'existence', 'reality', 'dream', 'fantasy', 'imagination', 'creativity', 'inspiration', 'aspiration', 'ambition', 'determination', 'persistence', 'resilience', 'recovery', 'healing', 'medicine', 'treatment', 'cure', 'remedy', 'prevention', 'protection', 'safety', 'danger', 'security', 'liberty', 'freedom', 'independence', 'dependence', 'reliance', 'trust', 'confidence', 'faith', 'belief', 'knowledge', 'understanding', 'wisdom', 'foolishness', 'ignorance', 'education', 'learning', 'teaching', 'training', 'practice', 'experience', 'memory', 'history', 'past', 'present', 'future', 'time', 'age', 'era', 'epoch', 'period', 'generation', 'century', 'decade', 'moment', 'second', 'minute', 'hour'],

            // Places and locations (150+ words)
            places: ['home', 'house', 'apartment', 'condo', 'mansion', 'cabin', 'cottage', 'office', 'building', 'skyscraper', 'mall', 'store', 'shop', 'market', 'supermarket', 'grocery', 'pharmacy', 'hospital', 'clinic', 'doctor', 'dentist', 'school', 'university', 'college', 'library', 'museum', 'theater', 'cinema', 'restaurant', 'cafe', 'bar', 'pub', 'hotel', 'motel', 'resort', 'beach', 'park', 'garden', 'forest', 'mountain', 'valley', 'river', 'lake', 'ocean', 'island', 'city', 'town', 'village', 'country', 'continent', 'world', 'planet', 'space', 'gym', 'stadium', 'arena', 'court', 'field', 'playground', 'airport', 'train station', 'bus station', 'subway', 'gas station', 'car wash', 'bank', 'post office', 'police station', 'fire station', 'church', 'temple', 'mosque', 'synagogue', 'cemetery', 'graveyard', 'battlefield', 'castle', 'fortress', 'palace', 'tower', 'bridge', 'tunnel', 'road', 'street', 'avenue', 'boulevard', 'highway', 'freeway', 'alley', 'lane', 'path', 'trail', 'sidewalk', 'parking lot', 'intersection', 'traffic light', 'stop sign', 'corner', 'downtown', 'uptown', 'suburbs', 'countryside', 'rural area', 'urban area', 'metropolitan area', 'neighborhood', 'district', 'quarter', 'zone', 'territory', 'region', 'province', 'state', 'nation', 'empire', 'kingdom', 'republic', 'territory', 'colony', 'settlement', 'base', 'camp', 'fort', 'bunker', 'trench', 'shelter', 'hideaway', 'retreat', 'sanctuary', 'asylum', 'refuge', 'haven', 'safe house', 'secret hideout', 'den', 'lair', 'nest', 'burrow', 'hive', 'warren', 'roost', 'perch', 'pier', 'dock', 'harbor', 'port', 'marina', 'anchorage'],

            // Time-related words (100+ words)
            timeWords: ['now', 'today', 'tonight', 'tomorrow', 'yesterday', 'week', 'month', 'year', 'day', 'night', 'morning', 'afternoon', 'evening', 'dawn', 'dusk', 'sunrise', 'sunset', 'midnight', 'noon', 'afternoon', 'evening', 'night', 'weekend', 'weekday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'spring', 'summer', 'fall', 'autumn', 'winter', 'second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century', 'millennium', 'era', 'age', 'epoch', 'period', 'moment', 'instant', 'flash', 'second', 'minute', 'hour', 'pace', 'pace', 'speed', 'tempo', 'rate', 'frequency', 'rhythm', 'cycle', 'rotation', 'revolution', 'orbit', 'journey', 'voyage', 'quest', 'adventure', 'expedition', 'excursion', 'outing', 'trip', 'tour', 'vacation', 'holiday', 'sabbatical', 'hiatus', 'break', 'recess', 'intermission', 'pause', 'rest', 'respite', 'sleep', 'nap', 'siesta', 'slumber', 'doze', 'dream', 'awakening', 'rising', 'waking', 'getting up', 'sunrise', 'sunset', 'twilight', 'dusk', 'darkness', 'light', 'brightness', 'illumination', 'glimmer', 'glow', 'shine', 'gleam', 'sparkle', 'twinkle', 'flicker', 'flash', 'blaze', 'flame', 'inferno', 'conflagration'],

            // Action and activity words (200+ words)
            activities: ['run', 'walk', 'dance', 'sing', 'play', 'swim', 'jump', 'climb', 'sit', 'stand', 'lie', 'rest', 'sleep', 'wake', 'eat', 'drink', 'cook', 'bake', 'prepare', 'serve', 'taste', 'chew', 'swallow', 'work', 'study', 'learn', 'teach', 'read', 'write', 'draw', 'paint', 'sketch', 'sculpt', 'build', 'construct', 'create', 'make', 'design', 'plan', 'organize', 'arrange', 'prepare', 'set up', 'clean', 'tidy', 'wash', 'wipe', 'scrub', 'polish', 'dust', 'vacuum', 'sweep', 'mop', 'organize', 'organize', 'sort', 'classify', 'categorize', 'list', 'record', 'document', 'file', 'store', 'preserve', 'maintain', 'repair', 'fix', 'adjust', 'modify', 'change', 'alter', 'transform', 'convert', 'translate', 'interpret', 'explain', 'describe', 'narrate', 'tell', 'report', 'announce', 'broadcast', 'publish', 'print', 'display', 'show', 'demonstrate', 'exhibit', 'present', 'perform', 'entertain', 'amuse', 'joke', 'laugh', 'smile', 'frown', 'cry', 'weep', 'sob', 'scream', 'shout', 'yell', 'whisper', 'speak', 'talk', 'chat', 'converse', 'discuss', 'debate', 'argue', 'negotiate', 'bargain', 'haggle', 'convince', 'persuade', 'encourage', 'inspire', 'motivate', 'support', 'help', 'assist', 'aid', 'serve', 'attend', 'care', 'nurse', 'heal', 'treat', 'cure', 'diagnose', 'examine', 'test', 'check', 'inspect', 'monitor', 'observe', 'watch', 'look', 'see', 'view', 'notice', 'observe', 'examine', 'inspect', 'study', 'investigate', 'explore', 'discover', 'find', 'seek', 'search', 'hunt', 'pursue', 'chase', 'catch', 'trap', 'capture', 'seize', 'grab', 'hold', 'carry', 'transport', 'deliver', 'send', 'receive', 'collect', 'gather', 'pick', 'pluck', 'harvest', 'cultivate', 'plant', 'grow', 'breed', 'raise', 'train', 'tame', 'control', 'manage', 'direct', 'guide', 'lead', 'follow', 'accompany', 'escort', 'accompany', 'protect', 'defend', 'guard', 'shield', 'shelter', 'hide', 'conceal', 'reveal', 'disclose', 'expose', 'uncover', 'discover', 'find', 'realize', 'understand', 'comprehend', 'grasp', 'perceive', 'sense', 'feel', 'experience', 'encounter', 'meet', 'greet', 'welcome', 'bid farewell', 'leave', 'depart', 'arrive', 'return', 'come back', 'go away', 'travel', 'journey', 'voyage', 'sail', 'fly', 'drive', 'ride', 'board', 'disembark', 'embark', 'dock', 'land', 'take off', 'crash', 'collide', 'bump', 'hit', 'strike', 'punch', 'kick', 'push', 'pull', 'drag', 'throw', 'toss', 'catch', 'drop', 'spill', 'pour', 'mix', 'stir', 'blend', 'combine', 'separate', 'divide', 'split', 'break', 'tear', 'rip', 'cut', 'slice', 'chop', 'dice', 'shred', 'grind', 'crush', 'compress', 'expand', 'stretch', 'shrink', 'shrivel', 'swell', 'inflate', 'deflate', 'bend', 'flex', 'straighten', 'curve', 'twist', 'turn', 'rotate', 'spin', 'twirl', 'whirl', 'swirl', 'circulate', 'flow', 'pour', 'drip', 'splash', 'spray', 'sprinkle', 'shower', 'rain', 'flood', 'evaporate', 'condense', 'freeze', 'melt', 'boil', 'simmer', 'heat', 'cool', 'chill', 'warm', 'warm up', 'burn', 'ignite', 'light', 'extinguish', 'put out', 'spark', 'glow', 'shine', 'reflect', 'refract', 'diffuse', 'absorb', 'emit', 'radiate', 'vibrate', 'oscillate', 'fluctuate', 'vary', 'change', 'shift', 'transition', 'move', 'relocate', 'migrate', 'emigrate', 'immigrate', 'settle', 'establish', 'found', 'colonize', 'occupy', 'inhabit', 'reside', 'dwell', 'lodge', 'stay', 'remain', 'linger', 'wait', 'pause', 'stop', 'halt', 'cease', 'discontinue', 'finish', 'end', 'conclude', 'terminate', 'begin', 'start', 'commence', 'initiate', 'launch', 'introduce', 'present', 'unveil', 'debut', 'premiere', 'open', 'close', 'shut', 'lock', 'unlock', 'seal', 'unseal', 'open up', 'unfold', 'unfurl', 'unroll', 'unwrap', 'unpack', 'unload', 'dispose', 'discard', 'abandon', 'leave behind', 'quit', 'resign', 'retire', 'withdraw', 'retreat', 'escape', 'flee', 'run away', 'hide', 'crouch', 'duck', 'dodge', 'evade', 'avoid', 'prevent', 'block', 'obstruct', 'impede', 'hinder', 'delay', 'postpone', 'defer', 'reschedule', 'advance', 'accelerate', 'hasten', 'hurry', 'rush', 'speed up', 'slow down', 'decelerate', 'brake', 'stop', 'pause', 'wait', 'hold', 'retain', 'keep', 'preserve', 'maintain', 'sustain', 'support', 'uphold', 'endorse', 'approve', 'accept', 'adopt', 'embrace', 'welcome', 'receive', 'admit', 'allow', 'permit', 'enable', 'facilitate', 'promote', 'advance', 'encourage', 'urge', 'prompt', 'remind', 'notify', 'inform', 'tell', 'communicate', 'convey', 'express', 'articulate', 'state', 'declare', 'proclaim', 'announce', 'publicize', 'advertise', 'market', 'promote', 'advertise', 'tout', 'hype', 'exaggerate', 'overstate', 'understate', 'minimize', 'maximize', 'elevate', 'demote', 'promote', 'advance', 'improve', 'enhance', 'strengthen', 'reinforce', 'fortify', 'fortify', 'secure', 'safeguard', 'protect', 'defend', 'fight', 'battle', 'combat', 'engage', 'wage war', 'make peace', 'negotiate', 'mediate', 'arbitrate', 'judge', 'rule', 'decree', 'sentence', 'punish', 'reward', 'honor', 'praise', 'commend', 'compliment', 'congratulate', 'celebrate', 'honor', 'tribute', 'memorialize', 'commemorate', 'remember', 'recall', 'reminisce', 'reflect', 'ponder', 'contemplate', 'meditate', 'think', 'reason', 'analyze', 'evaluate', 'assess', 'appraise', 'judge', 'criticize', 'critique', 'review', 'examine', 'scrutinize', 'audit', 'verify', 'validate', 'confirm', 'authenticate', 'authorize', 'approve', 'sanction', 'endorse', 'ratify', 'sign', 'seal', 'witness', 'attest', 'acknowledge', 'admit', 'confess', 'reveal', 'disclose', 'divulge', 'leak', 'share', 'tell', 'whisper', 'murmur', 'mumble', 'mutter', 'grumble', 'complain', 'gripe', 'whine', 'protest', 'object', 'oppose', 'resist', 'rebel', 'revolt', 'mutiny', 'strike', 'picket', 'march', 'demonstrate', 'rally', 'assemble', 'gather', 'congregate', 'meet', 'convene', 'adjourn', 'disband', 'disperse', 'scatter', 'distribute', 'share', 'divide', 'allocate', 'assign', 'delegate', 'delegate', 'authorize', 'empower', 'enable', 'facilitate', 'assist', 'help', 'support', 'aid', 'serve', 'attend to', 'cater to', 'accommodate', 'oblige', 'humor', 'appease', 'placate', 'soothe', 'calm', 'relax', 'unwind', 'decompress', 'chill out', 'mellow out', 'cool off', 'settle down', 'simmer down', 'tone down', 'dial back', 'ease up', 'let up', 'give in', 'surrender', 'capitulate', 'concede', 'admit defeat', 'throw in the towel', 'quit', 'give up', 'abandon'],

            // Common responses and conversational markers (300+ words)
            responses: ['okay', 'alright', 'sure', 'yeah', 'yep', 'yes', 'definitely', 'absolutely', 'of course', 'for sure', 'you bet', 'no doubt', 'no', 'nope', 'nah', 'not really', 'not quite', 'not exactly', 'not really', 'maybe', 'perhaps', 'might', 'could be', 'possibly', 'probably', 'likely', 'unlikely', 'doubtful', 'iffy', 'uncertain', 'unclear', 'unknown', 'unsure', 'hard to say', 'beats me', 'no idea', 'no clue', 'got me', 'you got me', 'fair point', 'good point', 'you make a good point', 'i see what you mean', 'that makes sense', 'that adds up', 'i get it', 'i understand', 'i hear you', 'i feel you', 'i feel you', 'totally', 'completely', 'absolutely', 'entirely', 'wholly', 'fully', 'thoroughly', 'completely', 'partial', 'partially', 'somewhat', 'kind of', 'sort of', 'in a way', 'so to speak', 'arguably', 'in my opinion', 'in my view', 'personally', 'if you ask me', 'i think', 'i believe', 'i suppose', 'i assume', 'i guess', 'it seems', 'it looks like', 'it appears', 'it seems like', 'apparently', 'seemingly', 'ostensibly', 'allegedly', 'reportedly', 'supposedly', 'reputedly', 'rumor has it', 'so i hear', 'from what i understand', 'as far as i know', 'as i understand it', 'correct me if i\'m wrong', 'unless i\'m mistaken', 'if memory serves', 'if i recall correctly', 'if i\'m not mistaken', 'it occurs to me', 'it just hit me', 'i just realized', 'i just remembered', 'come to think of it', 'come to think of it', 'that reminds me', 'which reminds me', 'speaking of which', 'that being said', 'that said', 'at the same time', 'all the same', 'nonetheless', 'still', 'yet', 'however', 'but', 'although', 'though', 'even though', 'even if', 'whereas', 'while', 'meanwhile', 'in the meantime', 'until then', 'in the interim', 'for now', 'for the time being', 'currently', 'right now', 'at present', 'at the moment', 'at this point', 'at this juncture', 'so far', 'thus far', 'hitherto', 'heretofore', 'previously', 'formerly', 'earlier', 'before', 'earlier', 'before long', 'eventually', 'in due time', 'in time', 'ultimately', 'finally', 'at last', 'at long last', 'in the end', 'after all', 'when all is said and done', 'all things considered', 'taking everything into account', 'on balance', 'all in all', 'overall', 'generally speaking', 'broadly speaking', 'by and large', 'in general', 'by the same token', 'likewise', 'similarly', 'correspondingly', 'analogously', 'in the same way', 'in like manner', 'conversely', 'oppositely', 'on the other hand', 'inversely', 'vice versa', 'in contrast', 'as a contrast', 'contrastingly', 'then again', 'on the flip side', 'on the bright side', 'on the downside', 'on the upside', 'for instance', 'for example', 'such as', 'like', 'namely', 'specifically', 'explicitly', 'distinctly', 'clearly', 'plainly', 'obviously', 'apparently', 'seemingly', 'evidently', 'manifestly', 'palpably', 'unmistakably', 'undeniably', 'indubitably', 'unquestionably', 'beyond question', 'beyond doubt', 'without a doubt', 'without question', 'no doubt about it', 'doubtless', 'indubitably', 'assuredly', 'certainly', 'surely', 'definitely', 'positively', 'absolutely', 'unequivocally', 'categorically', 'unambiguously', 'explicitly', 'implicitly', 'tacitly', 'indirectly', 'obliquely', 'roundaboutly', 'circuitously', 'in a roundabout way', 'so to speak', 'in a manner of speaking', 'as it were', 'if you will', 'as it happens', 'by chance', 'by coincidence', 'luckily', 'fortunately', 'happily', 'thankfully', 'mercifully', 'providentially', 'unfortunately', 'sadly', 'regrettably', 'lamentably', 'unluckily', 'conversely', 'oppositely', 'contrarily', 'rather', 'quite', 'rather', 'quite', 'fairly', 'pretty', 'rather', 'quite', 'remarkably', 'strikingly', 'notably', 'noticeably', 'conspicuously', 'obviously', 'patently', 'transparently', 'evidently', 'manifestly', 'patently', 'apparently', 'seemingly', 'ostensibly', 'allegedly', 'purportedly', 'reputedly', 'so i hear', 'from what i hear', 'from what i understand', 'as i understand it', 'as far as i\'m aware', 'to my knowledge', 'to the best of my knowledge', 'insofar as i know', 'as much as i know', 'in my experience', 'in my view', 'in my opinion', 'to my mind', 'from my perspective', 'in my book', 'if you ask me', 'ask me', 'honestly', 'truthfully', 'frankly', 'candidly', 'bluntly', 'straightforwardly', 'plainly', 'outright', 'directly', 'point blank', 'to the point', 'in a nutshell', 'to sum up', 'in summary', 'in short', 'in brief', 'briefly', 'in essence', 'essentially', 'basically', 'fundamentally', 'at its core', 'at heart', 'in a manner of speaking', 'so to speak', 'as it were', 'if you will', 'so', 'thus', 'therefore', 'hence', 'consequently', 'as a result', 'as a consequence', 'in consequence', 'owing to', 'due to', 'because of', 'on account of', 'for the reason that', 'inasmuch as', 'insofar as', 'given that', 'seeing that', 'being that', 'since', 'as', 'for', 'seeing', 'considering', 'granted', 'supposing', 'assuming', 'if', 'unless', 'except', 'except that', 'save that', 'provided that', 'providing that', 'on the condition that', 'in case', 'in the event that', 'in the unlikely event that', 'in the event of', 'be that as it may', 'come what may', 'what have you', 'you name it', 'what not', 'and so on', 'and so forth', 'et cetera', 'etc', 'etcetera', 'ad nauseam', 'ad infinitum', 'to no end', 'endlessly', 'ceaselessly', 'continuously', 'continually', 'persistently', 'doggedly', 'relentlessly', 'inexorably', 'inevitably', 'ineluctably', 'unavoidably', 'necessarily', 'perforce', 'willy nilly', 'come hell or high water', 'rain or shine', 'through thick and thin', 'at all costs', 'by hook or by crook', 'by any means necessary'],

            // Question and inquiry words (50+ words)
            questions: ['who', 'what', 'when', 'where', 'why', 'how', 'which', 'whose', 'whom', 'what about', 'how about', 'how come', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'do', 'does', 'did', 'have', 'has', 'had', 'get', 'got', 'make', 'made', 'tell', 'told', 'ask', 'asked', 'mean', 'meant', 'understand', 'understood', 'know', 'knew', 'think', 'thought', 'know', 'ever', 'never', 'always', 'sometimes', 'usually', 'often', 'rarely', 'seldom', 'hardly', 'scarcely'],

            // Pronouns and grammatical words (50+ words)
            pronouns: ['i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'whoever', 'whomever', 'whichever', 'whatever', 'someone', 'anybody', 'anybody', 'something', 'anything', 'everything', 'nothing', 'somewhere', 'anywhere', 'everywhere', 'nowhere', 'each', 'either', 'neither', 'both', 'all', 'some', 'none', 'several', 'many', 'few', 'a', 'an', 'the'],

            // Comprehensive utility keywords (100+ words)
            utilities: ['timer', 'alarm', 'clock', 'reminder', 'note', 'notes', 'calendar', 'event', 'appointment', 'meeting', 'birthday', 'deadline', 'task', 'todo', 'to-do', 'to do', 'reminder', 'notification', 'notification', 'alert', 'notification', 'message', 'message', 'email', 'text', 'sms', 'whatsapp', 'call', 'phone call', 'voicemail', 'schedule', 'scheduled', 'scheduled', 'plan', 'planning', 'planner', 'agenda', 'itinerary', 'itinerary', 'schedule', 'timetable', 'time table', 'time', 'time', 'time frame', 'time slot', 'time period', 'duration', 'length', 'length', 'span', 'interval', 'interval', 'frequency', 'frequency', 'repeat', 'recurring', 'recurrence', 'daily', 'weekly', 'monthly', 'yearly', 'yearly', 'annual', 'biannual', 'semi-annual', 'quarterly', 'monthly', 'weekly', 'daily', 'hourly', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond', 'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon', 'dawn', 'dusk', 'sunrise', 'sunset', 'twilight', 'daybreak', 'sunup', 'sundown', 'early', 'late', 'on time', 'punctual', 'punctually', 'late', 'early', 'tardy', 'behind schedule', 'on schedule', 'ahead of schedule', 'right on time', 'just in time', 'in the nick of time', 'deadline', 'deadline', 'due date', 'due', 'expiration', 'expires', 'expired', 'valid', 'invalid', 'current', 'outdated', 'updated', 'new', 'old', 'recent', 'recent', 'soon', 'sooner', 'later', 'earliest', 'latest', 'always', 'sometimes', 'never', 'occasionally', 'frequently', 'regularly', 'sporadically', 'intermittently', 'consistently', 'inconsistently', 'constantly', 'continually', 'continuously', 'perpetually', 'eternally', 'forever', 'evermore', 'always', 'forever and ever', 'for all time', 'throughout', 'throughout', 'over', 'across', 'around', 'about', 'roughly', 'approximately', 'approximately', 'around', 'some', 'little', 'lots', 'lots', 'bunch', 'bunch', 'pile', 'heap', 'stack', 'collection', 'gathering', 'assembly', 'congregation', 'congregation', 'assemblage', 'accumulation', 'aggregation', 'aggregation', 'compilation', 'compilation', 'list', 'listing', 'roster', 'inventory', 'inventory', 'checklist', 'check list', 'check-list', 'checkbox', 'checkmark', 'mark', 'mark', 'tick', 'check', 'check mark', 'x', 'cross', 'cross mark', 'x mark', 'dash', 'dash', 'hyphen', 'underscore', 'underscore', 'asterisk', 'asterisk', 'star', 'pound', 'hash', 'hashtag', 'hash tag', 'number sign', 'pound sign'],

            // Work and productivity words (100+ words)
            work: ['work', 'job', 'employment', 'career', 'profession', 'occupation', 'vocation', 'calling', 'trade', 'craft', 'discipline', 'field', 'domain', 'industry', 'sector', 'business', 'enterprise', 'company', 'corporation', 'firm', 'organization', 'outfit', 'operation', 'venture', 'startup', 'startup', 'scale-up', 'scale up', 'unicorn', 'conglomerate', 'multinational', 'multinational', 'corporation', 'corporation', 'llc', 'partnership', 'partnership', 'sole proprietorship', 'sole proprietor', 'proprietor', 'owner', 'proprietor', 'boss', 'manager', 'supervisor', 'foreman', 'overseer', 'administrator', 'administrator', 'director', 'executive', 'officer', 'ceo', 'cto', 'cfo', 'coo', 'president', 'vice president', 'vice-president', 'vp', 'secretary', 'treasurer', 'accountant', 'accountant', 'auditor', 'analyst', 'data analyst', 'data analyst', 'business analyst', 'systems analyst', 'systems analyst', 'analyst', 'consultant', 'consultant', 'advisor', 'adviser', 'expert', 'specialist', 'specialist', 'generalist', 'generalist', 'employee', 'employee', 'staff', 'personnel', 'workforce', 'workforce', 'human resources', 'hr', 'hr department', 'management', 'management', 'executive', 'executive', 'executive team', 'leadership', 'leadership', 'leader', 'leader', 'team', 'team', 'team leader', 'team member', 'team member', 'department', 'department', 'division', 'division', 'branch', 'branch office', 'branch', 'office', 'office', 'workspace', 'workspace', 'desk', 'desk', 'workstation', 'workstation', 'cubicle', 'cubicle', 'cube', 'open office', 'open office', 'bullpen', 'breakroom', 'break room', 'kitchen', 'cafeteria', 'cafeteria', 'canteen', 'canteen', 'commissary', 'commissary', 'lunchroom', 'lunchroom', 'dining room', 'dining room', 'meeting room', 'meeting room', 'conference room', 'conference room', 'war room', 'war room', 'boardroom', 'boardroom', 'executive suite', 'executive suite', 'corner office', 'corner office', 'windowless', 'glass walled', 'glass-walled', 'open plan', 'open-plan', 'work', 'project', 'assignment', 'task', 'task', 'duty', 'duty', 'responsibility', 'responsibility', 'obligation', 'obligation', 'commitment', 'commitment', 'deadline', 'deadline', 'milestone', 'milestone', 'checkpoint', 'checkpoint', 'deliverable', 'deliverable', 'output', 'output', 'outcome', 'outcome', 'result', 'result', 'achievement', 'achievement', 'accomplishment', 'accomplishment', 'success', 'success', 'failure', 'failure', 'mistake', 'mistake', 'error', 'error', 'bug', 'bug', 'glitch', 'glitch', 'issue', 'issue', 'problem', 'problem', 'challenge', 'challenge', 'obstacle', 'obstacle', 'barrier', 'barrier', 'hurdle', 'hurdle', 'bottleneck', 'bottleneck', 'setback', 'setback', 'drawback', 'drawback', 'disadvantage', 'disadvantage', 'downside', 'downside', 'pitfall', 'pitfall', 'trap', 'trap', 'catch-22', 'catch 22', 'dilemma', 'dilemma', 'quandary', 'quandary', 'predicament', 'predicament', 'pickle', 'pickle', 'jam', 'jam', 'fix', 'fix', 'bind', 'bind', 'tight spot', 'tight spot', 'hot water', 'hot water', 'trouble', 'trouble', 'difficulty', 'difficulty', 'complication', 'complication', 'complexity', 'complexity', 'sophistication', 'sophistication', 'simplicity', 'simplicity', 'ease', 'ease', 'straightforward', 'straightforward', 'simple', 'simple', 'easy', 'easy', 'effortless', 'effortless', 'painless', 'painless', 'convenient', 'convenient', 'inconvenient', 'inconvenient', 'accessible', 'accessible', 'inaccessible', 'inaccessible', 'available', 'available', 'unavailable', 'unavailable', 'scarce', 'scarce', 'abundant', 'abundant', 'plentiful', 'plentiful', 'limited', 'limited', 'unlimited', 'unlimited', 'finite', 'finite', 'infinite', 'infinite', 'constrained', 'constrained', 'unconstrained', 'unconstrained', 'restricted', 'restricted', 'unrestricted', 'unrestricted', 'bounded', 'bounded', 'unbounded', 'unbounded', 'confined', 'confined', 'unconfined', 'unconfined'],

            // Relationship and social words (100+ words)
            relationships: ['friend', 'friendship', 'best friend', 'best friend', 'bff', 'close friend', 'close friend', 'acquaintance', 'acquaintance', 'colleague', 'colleague', 'coworker', 'coworker', 'teammate', 'teammate', 'peer', 'peer', 'equal', 'equal', 'rival', 'rival', 'competitor', 'competitor', 'opponent', 'opponent', 'enemy', 'enemy', 'adversary', 'adversary', 'foe', 'foe', 'nemesis', 'nemesis', 'stranger', 'stranger', 'outsider', 'outsider', 'intruder', 'intruder', 'interloper', 'interloper', 'guest', 'guest', 'visitor', 'visitor', 'host', 'host', 'hostess', 'hostess', 'family', 'family', 'relative', 'relative', 'relation', 'relation', 'kin', 'kin', 'kinship', 'kinship', 'clan', 'clan', 'tribe', 'tribe', 'household', 'household', 'nuclear family', 'nuclear family', 'extended family', 'extended family', 'bloodline', 'bloodline', 'lineage', 'lineage', 'ancestry', 'ancestry', 'descent', 'descent', 'heritage', 'heritage', 'parent', 'parent', 'mother', 'father', 'mom', 'dad', 'mum', 'pa', 'papa', 'papa', 'mama', 'mama', 'mommy', 'mommy', 'daddy', 'daddy', 'mummy', 'mummy', 'pappy', 'pappy', 'old man', 'old man', 'old lady', 'old lady', 'parental', 'parental', 'filial', 'filial', 'sibling', 'sibling', 'sister', 'brother', 'sis', 'bro', 'big sister', 'big sister', 'big brother', 'big brother', 'little sister', 'little sister', 'little brother', 'little brother', 'twin', 'twin', 'fraternal', 'fraternal', 'identical', 'identical', 'child', 'children', 'kid', 'kids', 'son', 'daughter', 'boy', 'girl', 'lad', 'lad', 'lass', 'lass', 'youngster', 'youngster', 'youth', 'youth', 'juvenile', 'juvenile', 'minor', 'minor', 'infant', 'infant', 'baby', 'baby', 'toddler', 'toddler', 'tyke', 'tyke', 'mite', 'mite', 'little one', 'little one', 'young one', 'young one', 'grandparent', 'grandparent', 'grandfather', 'grandfather', 'grandmother', 'grandmother', 'grandpa', 'grandpa', 'grandma', 'grandma', 'gramps', 'gramps', 'grandpop', 'grandpop', 'granddad', 'granddad', 'great-grandparent', 'great-grandparent', 'great grandparent', 'great grandparent', 'grandchild', 'grandchild', 'grandson', 'grandson', 'granddaughter', 'granddaughter', 'great-grandchild', 'great-grandchild', 'great grandchild', 'great grandchild', 'aunt', 'aunt', 'uncle', 'uncle', 'auntie', 'auntie', 'aunty', 'aunty', 'unc', 'unc', 'uncle', 'uncle', 'cousin', 'cousin', 'first cousin', 'first cousin', 'second cousin', 'second cousin', 'third cousin', 'third cousin', 'kissing cousin', 'kissing cousin', 'step-parent', 'step-parent', 'stepmother', 'stepmother', 'stepfather', 'stepfather', 'step-sibling', 'step-sibling', 'stepsister', 'stepsister', 'stepbrother', 'stepbrother', 'step-child', 'step-child', 'stepdaughter', 'stepdaughter', 'stepson', 'stepson', 'in-law', 'in-law', 'mother-in-law', 'mother-in-law', 'father-in-law', 'father-in-law', 'sister-in-law', 'sister-in-law', 'brother-in-law', 'brother-in-law', 'daughter-in-law', 'daughter-in-law', 'son-in-law', 'son-in-law', 'spouse', 'spouse', 'partner', 'partner', 'husband', 'husband', 'wife', 'wife', 'bride', 'bride', 'groom', 'groom', 'newlywed', 'newlywed', 'conjugal', 'conjugal', 'matrimonial', 'matrimonial', 'marital', 'marital', 'wedlock', 'wedlock', 'marriage', 'marriage', 'matrimony', 'matrimony', 'union', 'union', 'couple', 'couple', 'pair', 'pair', 'duo', 'duo', 'twosome', 'twosome', 'lover', 'lover', 'beloved', 'beloved', 'sweetheart', 'sweetheart', 'honey', 'honey', 'darling', 'darling', 'dear', 'dear', 'dearest', 'dearest', 'love', 'love', 'crush', 'crush', 'flame', 'flame', 'old flame', 'old flame', 'paramour', 'paramour', 'mistress', 'mistress', 'concubine', 'concubine', 'admirer', 'admirer', 'fanatic', 'fanatic', 'fan', 'fan', 'devotee', 'devotee', 'enthusiast', 'enthusiast', 'aficionado', 'aficionado', 'buff', 'buff', 'geek', 'geek', 'nerd', 'nerd', 'junkie', 'junkie', 'addict', 'addict']
        };

        this.responses = {
            greeting: [
                "Hey! I'm running in local mode right now, but I'm still here. How's your day going?",
                "Hi there! What's going on?",
                "Hey! Good to see you. What's on your mind?",
                "Hello! How's it going today?",
                "Hey! What's up?",
                "What's up? How are you doing?",
                "Hey there! What can I do for you?",
                "Morning! What's new?",
            ],
            greetingReply: [
                "Hey! How's it going?",
                "Hi! Good to see you. What's on your mind?",
                "Hey there! What's new?",
                "Hello! How's your day been?",
                "Hey! What can I do for you?",
                "Hi! What's going on?",
                "What's happening?",
                "Sup! How's it going?",
            ],
            howAreYou: [
                "I'm doing well, thanks for asking! How about you — how's your day been?",
                "I'm good! But enough about me, how are you doing?",
                "Doing alright! What about you, how's everything going?",
                "All good on my end! How are things with you?",
                "Can't complain! How about you though, everything okay?",
                "Pretty good! Thanks for asking. What about you?",
                "I'm solid. You holding up okay?",
                "Can't complain. You good?",
            ],
            referenceBack: [
                "You're right, my bad. Let me focus — what were you asking about?",
                "Sorry about that, I should've responded to that. What was it you wanted to know?",
                "Fair point, I got sidetracked. Go ahead, I'm listening this time.",
                "Oops, you're right. I missed that — what did you want to talk about?",
                "My bad! I didn't mean to skip over that. What was your question?",
                "You're totally right. What was I missing?",
                "Got it, I hear you. Let's focus on that.",
            ],
            thanks: [
                "Of course! Anything else?",
                "No problem! What else is on your mind?",
                "Happy to help! Anything else going on?",
                "Sure thing! What's next?",
                "Anytime!",
                "You got it!",
                "All good. What else?",
                "No sweat. What do you need?",
            ],
            farewell: [
                "Take care! Come back anytime.",
                "See you later! I'll be here when you need me.",
                "Bye for now! Hope the rest of your day goes well.",
                "Talk soon! Take it easy.",
                "Later! Don't be a stranger.",
                "Catch you later!",
                "Talk to you soon!",
                "Take care, friend!",
            ],
            positive: [
                "That's awesome! I'm genuinely happy for you.",
                "Love that for you! That's a huge deal.",
                "That sounds amazing. Really glad you're experiencing that.",
                "You should be proud. That's incredible.",
                "Honestly, that's beautiful to hear. Keep that momentum going.",
                "That's the energy right there. I'm here for it.",
                "That's really special. Thanks for sharing that with me.",
                "Yesss! That's what I'm talking about!",
                "That's so cool! How do you feel about it?",
                "I'm stoked for you! That's dope.",
            ],
            distressed: [
                "I'm sorry you're going through that. I'm here if you want to talk.",
                "That sounds really tough. You don't have to go through it alone.",
                "I hear you. Your feelings are valid. Want to talk about what's going on?",
                "That's a lot to carry. I'm listening whenever you're ready.",
                "I'm sorry. That's not easy. Take your time — I'm here.",
                "That's rough. I'm sorry you're dealing with that.",
                "I'm here for you. What do you need right now?",
                "That sounds painful. Tell me more.",
            ],
            anxious: [
                "That sounds stressful. What's weighing on you the most?",
                "I get that. Sometimes just talking it through helps. What's going on?",
                "Anxiety can be a lot. Take a breath — what's on your mind?",
                "That's understandable. Want to walk me through what's been happening?",
                "That sounds like a lot. What's making you most nervous?",
                "I feel you. What's the main thing stressing you out?",
            ],
            question: [
                "That's a good question. I'm in local mode so I can't look things up, but I can think through it with you. What are your thoughts?",
                "Hmm, I wish I could look that up for you. In local mode I'm a bit limited, but tell me more — maybe we can work through it together.",
                "I don't have the full answer for that, but I'm curious what you think. What's your take?",
                "I can't really search for things right now, but I'm happy to talk it through. What do you think?",
                "That's a solid question. What do you think about it?",
                "Not sure I have the full answer, but let's talk it through.",
            ],
            outOfScope: [
                "That's not really my area — I'm here to listen and help you navigate your thoughts, feelings, and daily tasks. What's on your mind?",
                "I'm not the right tool for that kind of question, but I'm here if you want to talk about what's really going on with you.",
                "I can't help with that, but if something's weighing on you, I'm all ears.",
                "That's outside my wheelhouse, but I'm here to help with what matters to you — how are you really doing?",
                "I'm built to listen and support you, not to answer factual questions like that. What's really on your mind?",
                "Can't help much with that one, but I'm here for you.",
            ],
            identity: [
                "I'm Linen, your personal smart assistant. I'm here to listen, help you work through what's on your mind, and remember the important details about your life. What makes me different is that I prioritize your privacy — all your data stays on your device. Think of me as a friend with a perfect memory. What's going on?",
                "I'm Linen, a personal assistant designed to be your thoughtful companion. I listen without judgment, remember what matters to you, and help you process your thoughts and feelings. I'm built with privacy first — your conversations stay with you, nowhere else. What can I help with?",
                "Hey, I'm Linen! I'm your personal AI assistant created to listen, support, and remember. Unlike other AI services, I keep all your data on your device — nothing goes to the cloud or gets used to train models. I'm here to be a genuine friend who gets you. What's on your mind?",
            ],
            creator: [
                "I was built by Ramin Najafi. You can find more information about my creator at ramin-najafi.github.io",
            ],
            topicWork: [
                "Work stuff, huh? What's going on?",
                "Tell me about it. Is it stressing you out or just on your mind?",
                "How are things at work? What's happening?",
                "Ugh, work. What's the situation?",
                "Work been keeping you busy?",
                "What's going on with work?",
                "Tell me about what's happening at your job.",
            ],
            topicRelationships: [
                "Relationships can be a lot. What's going on?",
                "Sounds like it's about someone important to you. Tell me more.",
                "How are things between you two? What's happening?",
                "That's a big topic. Want to walk me through it?",
                "Relationships can be complicated. What's up?",
                "Tell me about that person.",
                "What's the situation?",
            ],
            topicHealth: [
                "Your health matters. How are you feeling?",
                "That doesn't sound fun. What's going on?",
                "I hope you're taking it easy. Tell me more.",
                "How are you doing physically? What's been going on?",
                "That sounds rough. Take care of yourself.",
                "What's bothering you healthwise?",
            ],
            topicHobbies: [
                "Oh nice! Tell me more about that.",
                "That sounds fun! How long have you been into it?",
                "Cool, what do you enjoy most about it?",
                "I like hearing about this stuff. What got you into it?",
                "That's awesome! What is it about it you love?",
                "Sounds cool! Tell me more.",
            ],
            topicGoals: [
                "That's exciting! What are you working toward?",
                "I love that. What's the plan?",
                "Nice, how's progress going so far?",
                "That's a solid goal. What's the next step?",
                "That's awesome. How can I help you get there?",
                "What's driving that goal?",
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
                "That's interesting. Keep talking.",
                "Okay, so what happened after that?",
                "I see. And how did that make you feel?",
                "That's a lot. Tell me more?",
                "What else is going on with that?",
            ],
            confused: [
                "I'm not sure I follow — can you give me a bit more to go on?",
                "Hmm, what do you mean by that?",
                "Could you say a bit more? I want to make sure I understand.",
                "I'm not quite getting it — can you explain?",
                "Not sure what you mean. Can you explain that differently?",
                "Say more? I want to make sure I get it.",
            ],
            frustrated: [
                "You're right, that's on me. What would you like to talk about?",
                "I hear you. I'm a bit limited in local mode, but I'm trying. What can I do?",
                "Fair enough. Let me try again — what's on your mind?",
                "Sorry about that. Tell me what you need and I'll do my best.",
                "I get it. Let's start fresh. What's up?",
            ],
            timerSet: [
                "I've set a timer for you. Let me know when you need another one.",
                "Timer set! I'll help keep you on track.",
                "Got it — timer is running. Just let me know if you need anything else.",
                "Timer started. You've got this!",
                "Alright, timer's going!",
                "Done! Timer is running.",
            ],
            alarmSet: [
                "Alarm set for you. I'll remind you when it's time.",
                "Got it — alarm is ready to go.",
                "Alarm set! I'll make sure you wake up on time.",
                "Perfect, your alarm is all set.",
                "Alarm's set! You're good.",
            ],
            noteAdded: [
                "Got it — I've written that down for you.",
                "Note saved! That's something important to remember.",
                "Added to your notes. I've got you covered.",
                "Noted! I'll keep that in mind for you.",
                "That's saved in your memories now.",
                "All set! Note's saved.",
                "Done! I've got that written down.",
            ],
            casualChat: [
                "Yeah, that's real.",
                "For sure.",
                "Totally get that.",
                "Makes sense.",
                "Right, I feel you.",
                "Yeah, I feel you on that.",
                "That's fair.",
                "No doubt.",
                "Not much with me either, just keeping it chill.",
                "Same here, nothing too wild.",
                "Nah, just the usual honestly.",
                "Not gonna complain! Just vibing.",
                "Same vibes, just taking it easy.",
                "Just living the dream, you know?",
                "Ah, keeping it real. That's what's up.",
                "Yo, same energy!",
                "Can't complain really.",
                "Just keeping it simple, you feel me?",
                "Yeah man, that's how it goes.",
                "Word, I hear you.",
                "Totally feel that.",
                "100%, that's facts.",
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
        const originalMessage = message.toLowerCase().trim();

        // Utility function detection — timers, alarms, notes
        const timerKeywords = ['set timer', 'set a timer', 'timer for', 'remind me in', 'in the', 'in an', 'minutes', 'seconds', 'hours'];
        if ((msg.includes('set timer') || msg.includes('set a timer') || msg.includes('timer for')) && this.extractTime(message)) return 'timerSet';

        const alarmKeywords = ['set alarm', 'set a alarm', 'wake me up', 'alarm for', 'alarm at'];
        if ((msg.includes('set alarm') || msg.includes('set a alarm') || msg.includes('wake me up') || msg.includes('alarm for') || msg.includes('alarm at')) && this.extractTime(message)) return 'alarmSet';

        const noteKeywords = ['write this down', 'take note', 'note that', 'remember this', 'dont forget', 'note to self', 'save this', 'remember to', 'note:'];
        if (noteKeywords.some(k => msg.includes(k))) return 'noteAdded';

        // Identity question detection (who/what are you, purpose)
        const identityKeywords = ['who are you', 'what are you', 'what is linen', "what's your purpose", 'whats your purpose', 'what do you do', 'what is your purpose', 'introduce yourself', 'tell me about you'];
        if (identityKeywords.some(k => msg.includes(k))) return 'identity';

        // Creator question detection
        const creatorKeywords = ['who created you', 'who made you', 'who built you', 'who is your creator', 'who developed you', 'who is ramin', 'ramin najafi', 'your creator', 'what company', 'which company', 'who works for', 'whos your creator', 'made by', 'created by', 'built by', 'developer', 'creator'];
        if (creatorKeywords.some(k => msg.includes(k))) return 'creator';

        // Context awareness — detect references to previous messages
        const referenceBack = ['i asked', 'i said', 'i told', 'my question', 'answer that', 'answer me', 'respond to', 'didnt answer', 'you ignored', 'already told you', 'i just said', 'i just told', 'what i said', 'what i told', 'before i', 'you could', 'instead of', 'acknowledge', 'remember', 'you said', 'you told me', 'perfect memory', 'supposed to remember', 'forget', 'forgot', 'you dont remember'];
        if (referenceBack.some(r => msg.includes(r))) return 'referenceBack';

        // CASUAL GREETINGS AND TURNTAKING (check early!)
        // Short casual exchanges like "whats up", "hey whats up", "sup", "how you doing", "not much you?"
        if (words.length <= 4) {
            const casualTurntaking = ['whats up', 'hows it going', 'how you doing', 'how are you doing', 'not much', 'not much you', 'sup', 'sup you', 'nothing much', 'hey whats up', 'hey sup', 'sup whats up'];
            if (casualTurntaking.some(phrase => msg.includes(phrase))) return 'casualChat';

            // Single greetings
            const greetWords = ['hi', 'hello', 'hey', 'yo', 'sup', 'hiya', 'wassup', 'howdy'];
            if (greetWords.some(g => msg.includes(g) && msg.length < 20)) return 'greetingReply';
        }

        // "How are you" detection — only for longer, more formal versions
        // Skip if already caught as casual turntaking
        const howAreYouPhrases = ['how are you', 'hows it going', 'how you doing', 'how do you feel', 'whats up with you', 'how have you been', 'how ya doing', 'how you been', 'hows everything', 'hows life', 'how are things', 'how goes it', 'hru'];
        // Only treat as "howAreYou" if longer (not short casual turntaking)
        if (words.length > 4 && howAreYouPhrases.some(p => msg.includes(p))) return 'howAreYou';

        // Thanks detection
        if (['thank', 'thanks', 'thx', 'ty', 'appreciate'].some(t => msg.includes(t))) return 'thanks';

        // Farewell detection
        if (words.length <= 4 && ['bye', 'goodbye', 'see you', 'later', 'goodnight', 'good night', 'gotta go', 'gtg', 'cya', 'night'].some(f => msg.includes(f))) return 'farewell';

        // Frustration / repetition detection — includes profanity and anger indicators
        if (['rude', 'deaf', 'stupid', 'dumb', 'useless', 'broken', 'not helpful', 'not listening', 'what the', 'wtf', 'are you even', 'cant even', 'so bad', 'terrible', 'worst', 'annoying', 'angry', 'making me angry', 'fuck', 'piss', 'asshole', 'bullshit', 'crap', '!!!', 'are you serious', 'you suck', 'this sucks', 'i hate', 'piece of shit', 'useless'].some(f => msg.includes(f))) return 'frustrated';

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

        // Conversational question patterns — these are NOT information-seeking questions
        // Examples: "whats new with you?", "what do you mean?", "what are you doing?"
        const conversationalPatterns = [
            /^not much/,                           // "not much, whats new"
            /^whats up$/,                          // standalone "whats up"
            /^whats up[?!]?$/,                     // "whats up?" or "whats up!"
            /^sup$/,                               // standalone "sup"
            /^sup[?!]?$/,                          // "sup?" or "sup!"
            /^how you doing/,                      // "how you doing"
            /^how.s it going/,                     // "how's it going" or "hows it going"
            /^hows it$/,                           // "hows it"
            /^whats going on$/,                    // standalone "whats going on"
            /whats new (with )?you/,              // "whats new with you"
            /whats up (with )?you/,               // "whats up with you"
            /whats going on (with )?you/,         // "whats going on with you"
            /how about you/,                       // "how about you"
            /what about you/,                      // "what about you"
            /you (been|been doing|doing)/,        // "you been doing anything fun?"
            /you up to/,                          // "you up to anything?"
            /whats your (day|week|deal)/,         // "whats your day like?"
            /anything new (with )?you/,           // "anything new with you?"
            /been up to/,                         // "been up to much?"
            /nothing much/,                       // "nothing much, you?"
            /^not much$/,                          // standalone "not much"
            /^not much[?!]?$/,                    // "not much?" or "not much!"
        ];

        if (conversationalPatterns.some(pattern => pattern.test(msg))) {
            return 'casualChat';
        }

        // Casual greeting check — short messages that are clearly casual greetings
        // "hey!", "hey whats up", "sup whats up", etc.
        if (words.length <= 3) {
            const casualGreetings = ['hey whats up', 'hey whats going on', 'hey how you doing', 'sup whats up', 'sup how you doing', 'hey sup'];
            if (casualGreetings.some(g => msg.includes(g))) return 'casualChat';
        }

        // Question detection — only for genuine standalone questions, not conversational phrases
        const isQuestion = originalMessage.endsWith('?');
        const startsWithQuestionWord = ['what ', 'why ', 'how ', 'when ', 'where ', 'who ', 'which '].some(q => msg.startsWith(q));
        // Exclude common conversational question starters from question detection
        const conversationalQuestions = ['what do you mean', 'what about', 'what ever', 'how are you', 'how you doing', 'how about', 'why not', 'why would', 'when can', 'where are'];
        const isConversationalQuestion = conversationalQuestions.some(q => msg.includes(q));

        // Only trigger question for actual informational questions, not conversational ones
        if (isConversationalQuestion) return 'casualChat';
        if (startsWithQuestionWord && words.length > 3) return 'question';
        if (isQuestion && !referenceBack.some(r => msg.includes(r)) && words.length > 4) return 'question';

        // Simple status responses (very short but valid) — treat as casual chat, not confused
        const statusWords = ['good', 'alright', 'okay', 'ok', 'fine', 'well', 'great', 'awesome', 'tired', 'busy', 'yep', 'yep', 'yeah', 'nope', 'nah', 'not really', 'nothing', 'nothing much', 'meh'];
        if (words.length <= 3 && statusWords.some(s => msg.includes(s))) return 'engaged';

        // Very short messages that aren't greetings but ARE valid statements
        if (words.length <= 2 && words.length > 0) {
            // Check if it's a valid short response first
            const shortValidResponses = ['yes', 'yeah', 'yep', 'no', 'nope', 'nah', 'ok', 'okay', 'sure', 'alright', 'cool', 'nice', 'lol', 'haha', 'true', 'same', 'exactly', 'agreed'];
            const isValidShort = shortValidResponses.some(s => msg.includes(s));
            if (isValidShort) return 'casualChat';
            // Otherwise treat as confused
            return 'confused';
        }

        // Default: engaged conversation
        return 'engaged';
    }

    detectMood(message) {
        const msg = message.toLowerCase();

        // Enhanced mood detection using expanded vocabulary
        const distressKeywords = ['sad', 'depressed', 'hopeless', 'angry', 'frustrated', 'devastated', 'miserable', 'crying', 'hurting', 'devastated', 'crushed', 'broken', 'shattered', 'destroyed', 'ruined', 'suffering', 'anguished', 'tormented', 'distressed', 'troubled', 'upset', 'distraught', 'grieving', 'mourning', 'lamenting', 'despairing'];
        const anxiousKeywords = ['anxious', 'nervous', 'worried', 'scared', 'afraid', 'panic', 'overwhelmed', 'stressed', 'tense', 'uneasy', 'apprehensive', 'jittery', 'frazzled', 'keyed up', 'on edge', 'antsy', 'fidgety', 'uptight', 'edgy', 'jumpy', 'neurotic', 'paranoid', 'fearful', 'terrified', 'petrified'];
        const positiveKeywords = ['happy', 'excited', 'great', 'wonderful', 'amazing', 'proud', 'grateful', 'awesome', 'fantastic', 'thrilled', 'elated', 'delighted', 'ecstatic', 'joyful', 'blissful', 'euphoric', 'overjoyed', 'stoked', 'pumped', 'psyched', 'exhilarated', 'energized', 'invigorated', 'inspired', 'uplifted', 'encouraged', 'motivated', 'hopeful', 'optimistic', 'confident', 'proud', 'satisfied', 'content', 'peaceful', 'serene', 'tranquil', 'calm', 'relaxed', 'at ease', 'composed', 'poised'];

        if (distressKeywords.some(k => msg.includes(k))) return 'distressed';
        if (anxiousKeywords.some(k => msg.includes(k))) return 'anxious';
        if (positiveKeywords.some(k => msg.includes(k))) return 'positive';
        return 'neutral';
    }

    extractName(message) {
        const nameMatch = message.match(/(?:call me|i'm|i am|name is|i go by|my name's)\s+(\w+)/i);
        if (nameMatch && nameMatch[1].length > 1 && !['not', 'so', 'very', 'really', 'just', 'feeling', 'doing', 'going', 'trying', 'here', 'fine', 'good', 'okay', 'ok'].includes(nameMatch[1].toLowerCase())) {
            return nameMatch[1];
        }
        return null;
    }

    extractTime(message) {
        // Extract time from messages like "set timer for 5 minutes" or "wake me up at 8am"
        const msg = message.toLowerCase();

        // Look for time patterns like "5 minutes", "30 seconds", "2 hours", "8am", "3:30pm"
        const timePatterns = [
            /(\d+)\s*(minutes?|mins?|min)/i,
            /(\d+)\s*(seconds?|secs?|sec)/i,
            /(\d+)\s*(hours?|hrs?|hr)/i,
            /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
            /(\d{1,2})\s*(am|pm)/i
        ];

        for (const pattern of timePatterns) {
            if (pattern.test(msg)) return true;
        }
        return false;
    }

    extractTimeDuration(message) {
        // Extract time duration in SECONDS from messages (for native timer apps)
        const msg = message.toLowerCase();

        // Parse minutes
        const minMatch = msg.match(/(\d+)\s*min/);
        if (minMatch) return parseInt(minMatch[1]) * 60;

        // Parse seconds
        const secMatch = msg.match(/(\d+)\s*sec/);
        if (secMatch) return parseInt(secMatch[1]);

        // Parse hours
        const hourMatch = msg.match(/(\d+)\s*hour/);
        if (hourMatch) return parseInt(hourMatch[1]) * 60 * 60;

        return null;
    }

    extractNoteContent(message) {
        // Extract the note content from the message
        const msg = message.toLowerCase();
        const noteKeywords = ['write this down', 'take note of', 'note that', 'remember this', 'dont forget', 'note to self', 'save this', 'remember to'];

        for (const keyword of noteKeywords) {
            const idx = msg.indexOf(keyword);
            if (idx !== -1) {
                // Extract content after the keyword
                let content = message.substring(idx + keyword.length).trim();
                // Remove leading punctuation
                content = content.replace(/^[:\s]+/, '').trim();
                return content || null;
            }
        }

        return null;
    }

    // Get last user message for context awareness
    getLastUserMessage() {
        const userMessages = this.sessionMemory.filter(m => m.role === 'user');
        if (userMessages.length > 1) {
            return userMessages[userMessages.length - 1]?.content;
        }
        return null;
    }

    // Get conversation topic for context using expanded vocabulary
    getConversationTopic() {
        const recentMessages = this.sessionMemory.slice(-6); // Last 6 messages
        const allText = recentMessages.map(m => m.content).join(' ').toLowerCase();

        // Work-related keywords from expanded vocabulary
        const workKeywords = ['work', 'job', 'boss', 'project', 'deadline', 'meeting', 'office', 'coworker', 'intern', 'internship', 'career', 'employment', 'profession', 'occupation', 'company', 'business', 'enterprise', 'manager', 'supervisor', 'executive', 'colleague'];
        if (workKeywords.some(k => allText.includes(k))) return 'work';

        // Relationship keywords
        const relationshipKeywords = ['friend', 'family', 'relationship', 'dating', 'partner', 'husband', 'wife', 'boyfriend', 'girlfriend', 'mom', 'dad', 'brother', 'sister', 'parent', 'child', 'lover', 'spouse', 'marriage', 'wedding'];
        if (relationshipKeywords.some(k => allText.includes(k))) return 'relationship';

        // Health-related keywords
        const healthKeywords = ['tired', 'sick', 'health', 'exercise', 'sleep', 'doctor', 'pain', 'headache', 'ill', 'illness', 'disease', 'fitness', 'workout', 'medication', 'treatment', 'hospital', 'clinic'];
        if (healthKeywords.some(k => allText.includes(k))) return 'health';

        // Hobby and entertainment keywords
        const hobbyKeywords = ['play', 'game', 'music', 'read', 'art', 'draw', 'write', 'cook', 'sport', 'watch', 'movie', 'show', 'hobby', 'interest', 'hobby', 'entertainment', 'recreation', 'leisure', 'fun'];
        if (hobbyKeywords.some(k => allText.includes(k))) return 'hobby';

        // Goal and aspiration keywords
        const goalKeywords = ['goal', 'dream', 'achieve', 'trying', 'plan', 'future', 'career', 'aspire', 'ambition', 'objective', 'target', 'aim', 'vision', 'mission', 'success', 'accomplish'];
        if (goalKeywords.some(k => allText.includes(k))) return 'goal';

        return null;
    }

    async chat(message) {
        // Handle initial greeting marker — don't process as normal message
        if (message === '[INITIAL_GREETING]') {
            return this.pick('greeting');
        }

        const intent = this.detectIntent(message);
        const mood = this.detectMood(message);
        const name = this.extractName(message);

        if (name) this.userProfile.name = name;
        if (mood !== 'neutral') this.userProfile.mood = mood;

        this.sessionMemory.push({ role: 'user', content: message, mood, intent, timestamp: Date.now() });

        let response = '';
        const userMessages = this.sessionMemory.filter(m => m.role === 'user');
        const userMsgCount = userMessages.length;

        // Check if user has been giving only single-word responses — they need better prompting
        const recentUserMessages = userMessages.slice(-5);
        const onlyShortResponses = recentUserMessages.length >= 3 && recentUserMessages.every(m => m.content.toLowerCase().trim().split(/\s+/).length <= 1);
        if (onlyShortResponses && intent === 'engaged') {
            // Switch to asking more specific questions instead of generic "keep going"
            return this.pick('question') || this.pick('engaged');
        }

        // First message — always greet (only once)
        if (!this.hasGreeted && userMsgCount === 1) {
            response = this.pick('greeting');
            this.hasGreeted = true;
        }
        // Utility functions — timers, alarms, notes
        else if (intent === 'timerSet') {
            response = this.pick('timerSet');
            // Call native timer via UtilityManager
            if (this.utilityManager) {
                const durationMs = this.extractTimeDuration(message);
                if (durationMs) {
                    this.utilityManager.setTimer(durationMs, 'Linen Timer');
                }
            }
        }
        else if (intent === 'alarmSet') {
            response = this.pick('alarmSet');
            // Call native alarm via UtilityManager
            if (this.utilityManager) {
                this.utilityManager.setAlarm(message, 'Linen Alarm');
            }
        }
        else if (intent === 'noteAdded') {
            response = this.pick('noteAdded');
            // Extract note content and save to device
            if (this.utilityManager) {
                const noteContent = this.extractNoteContent(message);
                if (noteContent) {
                    this.utilityManager.saveNote(noteContent);
                }
            }
        }
        // Identity question — always answer with identity info
        else if (intent === 'identity') {
            response = this.pick('identity');
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

        // Smart event detection — auto-detect and add events from conversation
        if (this.eventDetector) {
            try {
                this.eventDetector.detectEventsFromMessage(message, response);
            } catch (e) {
                console.log("LocalAssistant: Event detection error:", e);
            }
        }

        return response;
    }

    // ========== VOCABULARY-BASED TOPIC AND SENTIMENT ANALYSIS ==========
    // Analyzes message for topic relevance using the expanded 5000+ word vocabulary
    analyzeTopicsInMessage(message) {
        const msg = message.toLowerCase();
        const topics = [];

        // Check each vocabulary category for matches
        if (this.vocabulary.work.some(word => msg.includes(word))) {
            topics.push({ topic: 'work', confidence: this.vocabulary.work.filter(word => msg.includes(word)).length });
        }
        if (this.vocabulary.relationships.some(word => msg.includes(word))) {
            topics.push({ topic: 'relationships', confidence: this.vocabulary.relationships.filter(word => msg.includes(word)).length });
        }
        if (this.vocabulary.activities.some(word => msg.includes(word))) {
            topics.push({ topic: 'activities', confidence: this.vocabulary.activities.filter(word => msg.includes(word)).length });
        }
        if (this.vocabulary.emotions.some(word => msg.includes(word))) {
            topics.push({ topic: 'emotions', confidence: this.vocabulary.emotions.filter(word => msg.includes(word)).length });
        }
        if (this.vocabulary.timeWords.some(word => msg.includes(word))) {
            topics.push({ topic: 'time', confidence: this.vocabulary.timeWords.filter(word => msg.includes(word)).length });
        }

        // Sort by confidence (highest first)
        return topics.sort((a, b) => b.confidence - a.confidence);
    }

    // Calculate sentiment score using emotion vocabulary
    calculateSentimentScore(message) {
        const msg = message.toLowerCase();
        let score = 0; // -1 (very negative) to +1 (very positive)

        const positiveCount = this.vocabulary.emotions.filter(e =>
            e.match(/happy|joy|excited|wonderful|amazing|proud|grateful|love|excellent|fantastic|great|awesome/) &&
            msg.includes(e)
        ).length;

        const negativeCount = this.vocabulary.emotions.filter(e =>
            e.match(/sad|angry|frustrat|worry|fear|anxious|depressed|hate|awful|terrible|horrible|worst/) &&
            msg.includes(e)
        ).length;

        const totalEmotionWords = positiveCount + negativeCount;
        if (totalEmotionWords > 0) {
            score = (positiveCount - negativeCount) / totalEmotionWords;
        }

        return {
            score: score, // -1 to +1
            sentiment: score > 0.3 ? 'positive' : score < -0.3 ? 'negative' : 'neutral',
            positiveWords: positiveCount,
            negativeWords: negativeCount
        };
    }

    // Check how well the message is understood using vocabulary coverage
    getVocabularyCoverage(message) {
        const msg = message.toLowerCase().split(/\s+/);
        let coveredWords = 0;

        const allVocabWords = [
            ...this.vocabulary.verbs,
            ...this.vocabulary.emotions,
            ...this.vocabulary.adjectives,
            ...this.vocabulary.nouns,
            ...this.vocabulary.places,
            ...this.vocabulary.timeWords,
            ...this.vocabulary.activities,
            ...this.vocabulary.responses,
            ...this.vocabulary.questions,
            ...this.vocabulary.pronouns,
            ...this.vocabulary.utilities,
            ...this.vocabulary.work,
            ...this.vocabulary.relationships
        ];

        msg.forEach(word => {
            // Clean word of punctuation
            const cleanWord = word.replace(/[!?.,;:'-]/g, '').toLowerCase();
            if (allVocabWords.some(vocabWord => vocabWord.includes(cleanWord) || cleanWord.includes(vocabWord))) {
                coveredWords++;
            }
        });

        const coverage = msg.length > 0 ? (coveredWords / msg.length) * 100 : 0;
        return {
            coverage: Math.round(coverage),
            coveredWords: coveredWords,
            totalWords: msg.length
        };
    }

    getSessionSummary() {
        return {
            userProfile: this.userProfile,
            messageCount: this.sessionMemory.length,
            topics: this.userProfile.topics,
            lastMood: this.userProfile.mood,
            vocabularySize: Object.values(this.vocabulary).reduce((sum, arr) => sum + arr.length, 0),
        };
    }

    clearSession() {
        this.sessionMemory = [];
        this.usedResponses.clear();
    }
}

class ProfileManager {
    constructor(db) {
        this.db = db;
        this._cache = null;
    }

    async getProfile() {
        if (this._cache) return this._cache;
        return new Promise((resolve, reject) => {
            const t = this.db.db.transaction(['userProfile'], 'readonly');
            const s = t.objectStore('userProfile');
            const req = s.get('default');
            req.onsuccess = () => {
                this._cache = req.result || null;
                resolve(this._cache);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async saveProfile(data) {
        const existing = await this.getProfile();
        const profile = {
            id: 'default',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            pronouns: data.pronouns || '',
            dateOfBirth: data.dateOfBirth || '',
            timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            notifications: {
                birthdayMessage: data.notifications?.birthdayMessage ?? true,
                emailNotifications: data.notifications?.emailNotifications ?? false
            },
            preferences: {
                chatStyle: data.preferences?.chatStyle || 'friendly'
            },
            createdAt: existing?.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        return new Promise((resolve, reject) => {
            const t = this.db.db.transaction(['userProfile'], 'readwrite');
            const s = t.objectStore('userProfile');
            const req = s.put(profile);
            req.onsuccess = () => {
                this._cache = profile;
                resolve(profile);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async deleteProfile() {
        return new Promise((resolve, reject) => {
            const t = this.db.db.transaction(['userProfile'], 'readwrite');
            const s = t.objectStore('userProfile');
            const req = s.delete('default');
            req.onsuccess = () => {
                this._cache = null;
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    }

    async getFirstName() {
        const p = await this.getProfile();
        return p?.firstName || '';
    }

    async getPronouns() {
        const p = await this.getProfile();
        return p?.pronouns || '';
    }

    async isBirthday() {
        const p = await this.getProfile();
        if (!p?.dateOfBirth) return false;
        const today = new Date();
        const birth = new Date(p.dateOfBirth);
        return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
    }

    generateBirthdayMessage(firstName, age) {
        const messages = [
            `🎉 Happy Birthday, ${firstName}! Hope your day is as wonderful as you are. Enjoy every moment! 🎂`,
            `🎂 Another year around the sun! Happy ${age}${this._ordinalSuffix(age)} Birthday! Wishing you joy, laughter, and great conversations.`,
            `✨ It's your day to shine! Happy Birthday, ${firstName}! Hope this year brings you everything you're hoping for.`,
            `🎈 Celebrate you today, ${firstName}! You've made it another year—that's amazing! Enjoy every bit of this day.`,
            `🎉 ${firstName}, today is all about you! Happy Birthday—make it unforgettable! 🎊`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    _ordinalSuffix(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    async checkBirthday(showToastFn, addSystemMessageFn) {
        try {
            const p = await this.getProfile();
            if (!p?.dateOfBirth || !p.notifications?.birthdayMessage) return;

            const today = new Date();
            const shownDate = localStorage.getItem('linen-birthday-shown-date');
            const todayStr = today.toISOString().split('T')[0];
            if (shownDate === todayStr) return;

            if (await this.isBirthday()) {
                const birth = new Date(p.dateOfBirth);
                const age = today.getFullYear() - birth.getFullYear();
                const name = p.firstName || 'friend';
                const message = this.generateBirthdayMessage(name, age);

                addSystemMessageFn(message, 'birthday');
                showToastFn('🎉 Happy Birthday!', 'success');
                localStorage.setItem('linen-birthday-shown-date', todayStr);
            }
        } catch (e) {
            // Silent fail — birthday check is non-critical
        }
    }
}

// Comprehensive Utilities App - Alarm, Timer, Notes, Calendar, Reminders
class UtilitiesApp {
    constructor(db) {
        this.db = db;
        this.activeAlarms = new Map();
        this.activeTimers = new Map();
        this.notificationPermission = 'default';
        this.requestNotificationPermission();
        this.initializeUtilities();
    }

    async initializeUtilities() {
        // Load saved utilities from database
        try {
            const savedAlarms = await this.db.getSetting('saved-alarms') || [];
            const savedReminders = await this.db.getSetting('saved-reminders') || [];
            console.log("Linen Utilities: Initialized with saved alarms and reminders");
        } catch (e) {
            console.log("Linen Utilities: Could not load saved utilities");
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                this.notificationPermission = permission;
                console.log("Linen: Notification permission:", permission);
            });
        } else if ('Notification' in window) {
            this.notificationPermission = Notification.permission;
        }
    }

    sendNotification(title, options = {}) {
        if ('Notification' in window && this.notificationPermission === 'granted') {
            const notification = new Notification(title, {
                icon: './icon-192.png',
                badge: './icon-192.png',
                ...options
            });
            return notification;
        }
    }

    // ===== ALARM CLOCK =====
    async setAlarm(timeString, label = 'Alarm') {
        const timeMatch = timeString.match(/(\d{1,2}):(\d{2})/);
        if (!timeMatch) return { success: false, error: 'Invalid time format' };

        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);

        const alarmId = Date.now();
        const now = new Date();
        const alarmTime = new Date();
        alarmTime.setHours(hours, minutes, 0, 0);

        // If alarm time is in the past, set for tomorrow
        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }

        const timeUntilAlarm = alarmTime.getTime() - Date.now();

        // Set up the alarm
        const alarmTimeout = setTimeout(() => {
            this.activeAlarms.delete(alarmId);
            this.sendNotification(`⏰ Alarm: ${label}`, {
                body: `It's ${alarmTime.toLocaleTimeString()}`,
                requireInteraction: true
            });
        }, timeUntilAlarm);

        this.activeAlarms.set(alarmId, {
            id: alarmId,
            label,
            time: alarmTime.toLocaleTimeString(),
            timeout: alarmTimeout
        });

        // Save alarm
        const memory = {
            id: alarmId,
            text: `⏰ Alarm set: ${label} at ${alarmTime.toLocaleTimeString()}`,
            type: 'alarm',
            date: Date.now(),
            tags: ['alarm'],
            emotion: 'neutral',
        };
        await this.db.addMemory(memory);

        return { success: true, id: alarmId, label, time: alarmTime.toLocaleTimeString() };
    }

    cancelAlarm(alarmId) {
        const alarm = this.activeAlarms.get(alarmId);
        if (alarm) {
            clearTimeout(alarm.timeout);
            this.activeAlarms.delete(alarmId);
            return true;
        }
        return false;
    }

    // ===== TIMER =====
    async startTimer(minutes, seconds, label = 'Timer') {
        const timerId = Date.now();
        const durationMs = (minutes * 60 + seconds) * 1000;
        const startTime = Date.now();
        const endTime = startTime + durationMs;

        let timerInterval = setInterval(() => {
            const remaining = Math.max(0, endTime - Date.now());
            if (remaining === 0) {
                clearInterval(timerInterval);
                this.activeTimers.delete(timerId);
                this.sendNotification(`⏱️ Timer Complete: ${label}`, {
                    body: `Your ${minutes}m ${seconds}s timer is done!`,
                    requireInteraction: false
                });
            }
        }, 100);

        this.activeTimers.set(timerId, {
            id: timerId,
            label,
            duration: `${minutes}m ${seconds}s`,
            interval: timerInterval,
            endTime
        });

        // Save timer
        const memory = {
            id: timerId,
            text: `⏱️ Timer: ${label} (${minutes}m ${seconds}s)`,
            type: 'timer',
            date: startTime,
            tags: ['timer'],
            emotion: 'neutral',
        };
        await this.db.addMemory(memory);

        return { success: true, id: timerId, label, duration: `${minutes}m ${seconds}s` };
    }

    cancelTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (timer) {
            clearInterval(timer.interval);
            this.activeTimers.delete(timerId);
            return true;
        }
        return false;
    }

    // ===== NOTES =====
    async saveNote(content) {
        const noteId = Date.now();
        const memory = {
            id: noteId,
            text: content,
            type: 'note',
            date: Date.now(),
            tags: ['user-note'],
            emotion: 'neutral',
        };

        try {
            await this.db.addMemory(memory);
            return { success: true, id: noteId, content };
        } catch (e) {
            console.log("Linen: Could not save note", e);
            return { success: false, error: 'Could not save note' };
        }
    }

    async shareNote(content) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Linen Note',
                    text: content
                });
                return { success: true, method: 'native-share' };
            } catch (e) {
                console.log("Linen: Share cancelled");
            }
        }

        // Fallback: copy to clipboard
        try {
            await navigator.clipboard.writeText(content);
            return { success: true, method: 'clipboard' };
        } catch (e) {
            return { success: false, error: 'Could not share note' };
        }
    }

    // ===== CALENDAR =====
    async addEvent(title, datetime, description = '') {
        const eventId = Date.now();
        const eventDate = new Date(datetime);

        const memory = {
            id: eventId,
            text: `📅 ${title}${description ? '\n' + description : ''}`,
            type: 'event',
            date: eventDate.getTime(),
            tags: ['calendar', 'event'],
            emotion: 'neutral',
        };

        try {
            await this.db.addMemory(memory);
            return { success: true, id: eventId, title, date: eventDate.toLocaleString() };
        } catch (e) {
            console.log("Linen: Could not add event", e);
            return { success: false, error: 'Could not add event' };
        }
    }

    // ===== REMINDERS =====
    async createReminder(text, datetime, method = 'push') {
        const reminderId = Date.now();
        const reminderTime = new Date(datetime);
        const timeUntilReminder = reminderTime.getTime() - Date.now();

        if (timeUntilReminder <= 0) {
            return { success: false, error: 'Reminder time must be in the future' };
        }

        // Set up reminder notification
        const reminderTimeout = setTimeout(() => {
            this.sendNotification(`🔔 Reminder`, {
                body: text,
                requireInteraction: true
            });

            // If email method, would send email here (requires backend)
            if (method === 'email') {
                console.log(`Linen: Email reminder would be sent: ${text}`);
            }
        }, timeUntilReminder);

        // Save reminder
        const memory = {
            id: reminderId,
            text: `🔔 Reminder: ${text}`,
            type: 'reminder',
            date: Date.now(),
            tags: ['reminder', method],
            emotion: 'neutral',
        };

        try {
            await this.db.addMemory(memory);
            return { success: true, id: reminderId, text, time: reminderTime.toLocaleString(), method };
        } catch (e) {
            clearTimeout(reminderTimeout);
            return { success: false, error: 'Could not create reminder' };
        }
    }

    // Get all active utilities
    getActiveUtilities() {
        return {
            alarms: Array.from(this.activeAlarms.values()),
            timers: Array.from(this.activeTimers.values())
        };
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
        this.utilities = null; // Will be initialized after db.init()
        this.profileManager = null; // Initialized after db.init()
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
            this.showToast("You've hit your API usage limit. Switching to local mode.", 'warning');
        } else {
            this.showToast("API unavailable right now. Switching to local mode.", 'warning');
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
                this.showToast('You can talk to me anytime. I\'m here to listen.', 'info');
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
            });
        }
    }

    async migrateLegacyKey() {
        const legacyKey = await this.db.getSetting('gemini-api-key');
        const migrated = await this.db.getSetting('legacy-key-migrated');

        if (legacyKey && !migrated) {
            console.log("Linen: Migrating legacy Gemini API key to agent system...");

            const agentConfig = {
                name: 'Gemini Key (Migrated)',
                type: 'gemini',
                apiKey: legacyKey,
                model: null,
                isPrimary: true
            };

            const agent = await this.agentManager.addAgent(agentConfig);
            agent.status = 'valid';
            agent.lastVerified = Date.now();

            await this.db.setSetting(`agent-${agent.id}`, JSON.stringify(agent));

            const existingIds = JSON.parse(await this.db.getSetting('agent-ids') || '[]');
            existingIds.push(agent.id);
            await this.db.setSetting('agent-ids', JSON.stringify(existingIds));
            await this.db.setSetting('primary-agent-id', agent.id);
            await this.db.setSetting('legacy-key-migrated', 'true');

            console.log("Linen: Legacy key migrated successfully as agent:", agent.name);
            this.showToast('Migrated your API key to new system', 'info');
            return agent;
        }
        return null;
    }

    async init() {
        console.log("Linen: Initializing app...");

        // Check for app updates when reopening
        await this.checkForUpdates();

        try {
            this.analytics.trackPageView();
            await this.db.init();
            this.profileManager = new ProfileManager(this.db);

            const existingConvs = await this.db.getConversations();
            // Only archive if there's actual user interaction (more than just initial greeting/bot messages)
            // Check if there are user messages and more than just one exchange
            const hasUserMessages = existingConvs && existingConvs.some(c => c.sender === 'user');
            if (existingConvs && existingConvs.length > 2 && hasUserMessages) {
                const sessionTitle = this.generateSessionTitle(existingConvs);
                await this.db.archiveSession({ title: sessionTitle, messages: existingConvs, date: Date.now(), preview: existingConvs[existingConvs.length - 1]?.text || 'Previous conversation', messageCount: existingConvs.length });
            }
            await this.db.clearCurrentSession();

            // Migrate legacy key and load all agents
            await this.migrateLegacyKey();
            await this.agentManager.loadAgents();

            const apiKey = await this.db.getSetting('gemini-api-key');
            const primaryAgentId = await this.db.getSetting('primary-agent-id');

            console.log(`Linen: API Key found in DB: ${apiKey ? '[REDACTED]' : 'false'}, Agent: ${primaryAgentId ? 'Yes' : 'No'}, Agents loaded: ${this.agentManager.getAgents().length}`);

            // Try to load primary agent from the loaded agents
            let primaryAgent = this.agentManager.primaryAgent;

            if (primaryAgent) {
                console.log("Linen: Found primary agent:", primaryAgent.name);
                this.currentAgent = primaryAgent;
                this.assistant = this.createAssistantFromAgent(primaryAgent);
                this.isLocalMode = false;
            }

            // If no primary agent, check for standalone API key (backward compat)
            if (!primaryAgent) {
                if (!apiKey) {
                    console.log("Linen: No API Key found, will start with LocalAssistant.");
                } else {
                    const geminiAssistant = new GeminiAssistant(apiKey);
                    const result = await geminiAssistant.validateKey();
                    if (result.valid) {
                        console.log("Linen: API Key validated successfully, starting app with Gemini.");
                        this.assistant = geminiAssistant;
                        this.isLocalMode = false;
                    } else {
                        const isRecoverableError = (result.error && (
                            result.error.toLowerCase().includes('quota') ||
                            result.error.toLowerCase().includes('network error') ||
                            result.error.toLowerCase().includes('too many requests')
                        ));

                        if (isRecoverableError) {
                            console.warn(`Linen: Gemini API key validation failed with recoverable error: ${result.error}. Starting in local-only mode.`);
                            // Initialize utilities if not done yet
                            if (!this.utilities) {
                                this.utilities = new UtilitiesApp(this.db);
                            }
                            this.assistant = new LocalAssistant(this.db, this.utilities);
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
                // Initialize utilities if not done yet
                if (!this.utilities) {
                    this.utilities = new UtilitiesApp(this.db);
                }
                this.assistant = new LocalAssistant(this.db, this.utilities);
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
            // Initialize utilities if not done yet
            if (!this.utilities) {
                this.utilities = new UtilitiesApp(this.db);
            }
            this.assistant = new LocalAssistant(this.db, this.utilities);
            this.isLocalMode = true;
            this.startApp(null);
            console.error('Linen: Fatal error during init, starting in local-only mode.', e);
        }
    }

    async checkForUpdates() {
        try {
            // Only run this check on initial app load (first time)
            // Do NOT run this on every visibility change to avoid disrupting users
            const hasRunBefore = await this.db.getSetting('app-started-before');
            if (hasRunBefore) {
                console.log("Linen: App already started, skipping update check to avoid disruption");
                return;
            }

            // Mark that app has started
            await this.db.setSetting('app-started-before', true);

            console.log("Linen: Running initial update check on first load");
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    // Just check and update service worker, don't force reload
                    await registration.update();
                }
            }
        } catch (err) {
            console.error("Linen: Error checking for updates:", err);
            // Continue app initialization even if update check fails
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

        // Initialize UtilitiesApp for calendar, reminders, alarms, timer, notes
        if (!this.utilities) {
            this.utilities = new UtilitiesApp(this.db);
            console.log("Linen: UtilitiesApp initialized");
        }

        // If no assistant is set, use LocalAssistant
        if (!this.assistant) {
            console.warn("Linen: No assistant set in startApp, using LocalAssistant.");
            this.assistant = new LocalAssistant(this.db, this.utilities);
            this.isLocalMode = true;
        } else if (this.assistant instanceof LocalAssistant && !this.assistant.eventDetector) {
            // Update existing LocalAssistant with utilities if needed
            this.assistant.eventDetector = new EventDetector(this.db, this.utilities);
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

        // Check for birthday after a short delay to let chat render
        if (this.profileManager) {
            setTimeout(() => {
                this.profileManager.checkBirthday(
                    (msg, type) => this.showToast(msg, type),
                    (msg, type) => this.addSystemMessage(msg, type)
                );
            }, 2000);
        }

        // Set up auto-refresh based on device power and connection status
        this.setupAutoRefresh();

        console.log("Linen: App started in", this.isLocalMode ? 'local mode' : 'Gemini mode');
    }

    setupAutoRefresh() {
        console.log("Linen: Setting up background service worker update checks");

        // Check for updates via service worker in the background without disrupting user
        const checkForServiceWorkerUpdate = async () => {
            try {
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                        // Check for updates
                        await registration.update();
                        console.log("Linen: Checked for service worker updates");

                        // If a new version is waiting, notify user to refresh
                        if (registration.waiting) {
                            console.log("Linen: New version available! Notifying user...");
                            this.showUpdateNotification();
                        }
                    }
                }
            } catch (err) {
                console.warn("Linen: Error checking for updates:", err);
            }
        };

        // Calculate check interval based on power and connection
        const getCheckInterval = () => {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            const effectiveType = connection ? connection.effectiveType : '4g';
            const isWifi = connection && (connection.type === 'wifi' || effectiveType === '4g');

            let isOnBattery = false;
            if ('getBattery' in navigator) {
                navigator.getBattery().then((battery) => {
                    isOnBattery = !battery.charging;
                }).catch(() => {});
            }

            // WiFi + Plugged in = check every 5 minutes (frequent updates okay)
            if (isWifi && !isOnBattery) {
                console.log("Linen: Check interval = 5 minutes (WiFi + plugged in)");
                return 5 * 60 * 1000;
            }
            // WiFi + On battery = check every 15 minutes (balance)
            else if (isWifi && isOnBattery) {
                console.log("Linen: Check interval = 15 minutes (WiFi + on battery)");
                return 15 * 60 * 1000;
            }
            // Cellular + Plugged in = check every 1 hour (minimize data)
            else if (!isWifi && !isOnBattery) {
                console.log("Linen: Check interval = 1 hour (Cellular + plugged in)");
                return 60 * 60 * 1000;
            }
            // Cellular + On battery = check every 4 hours (preserve battery/data)
            else {
                console.log("Linen: Check interval = 4 hours (Cellular + on battery)");
                return 4 * 60 * 60 * 1000;
            }
        };

        // Initial check after app loads
        setTimeout(() => {
            checkForServiceWorkerUpdate();
        }, 3000);

        // Set up periodic checks
        let checkInterval = getCheckInterval();
        let updateCheckTimeout = setInterval(() => {
            checkForServiceWorkerUpdate();
        }, checkInterval);

        // Listen for connection changes and reschedule if needed
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            connection.addEventListener('change', () => {
                console.log("Linen: Connection type changed, recalculating update check interval");
                clearInterval(updateCheckTimeout);
                checkInterval = getCheckInterval();
                updateCheckTimeout = setInterval(() => {
                    checkForServiceWorkerUpdate();
                }, checkInterval);
            });
        }

        // Check for updates when app comes back into focus
        let lastFocusTime = Date.now();
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                const timeSinceLastFocus = Date.now() - lastFocusTime;
                // If app was hidden for more than 30 seconds, check for updates
                if (timeSinceLastFocus > 30000) {
                    console.log("Linen: App returned to focus after delay, checking for updates");
                    checkForServiceWorkerUpdate();
                }
                lastFocusTime = Date.now();
            }
        });
    }

    showUpdateNotification() {
        // Show a non-intrusive notification that a new version is available
        const notification = document.createElement('div');
        notification.id = 'update-notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #4a9eff;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-size: 0.95rem;
            z-index: 9998;
            max-width: 320px;
            display: flex;
            gap: 12px;
            align-items: center;
            justify-content: space-between;
            animation: slideIn 0.3s ease-out;
        `;

        notification.innerHTML = `
            <div>
                <strong>New version available!</strong><br>
                <small style="opacity: 0.9;">Close and reopen the app to get the latest features.</small>
            </div>
            <button style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; white-space: nowrap;">Dismiss</button>
        `;

        document.body.appendChild(notification);

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(-100%);
                    opacity: 0;
                }
            }
        `;
        if (!document.head.querySelector('style[data-update-animation]')) {
            style.setAttribute('data-update-animation', 'true');
            document.head.appendChild(style);
        }

        // Dismiss button
        const dismissBtn = notification.querySelector('button');
        dismissBtn.addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        });

        // Auto-dismiss after 8 seconds if user doesn't interact
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 8000);
    }

    startTrialMode() {
        this.trialMode = true;
        this.trialCount = 0;
        localStorage.setItem('linen-trial', 'true');
        localStorage.setItem('linen-trial-exchanges', '0');
        
        // Use LocalAssistant for trial mode (no API key needed)
        this.assistant = new LocalAssistant(this.db);
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
            <div style="max-width: 400px; margin: 0 auto; text-align: center;">
                <h2 style="margin-bottom: 0.5rem;">What's your name?</h2>
                <p style="color: var(--text-light); margin-bottom: 1.5rem;">I'd love to know who I'm talking to so I can personalize our conversations.</p>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <input type="text" id="name-input" placeholder="Enter your name" style="padding: 12px; border: 1px solid #444; border-radius: 6px; background: #333; color: #fff; font-size: 1rem; text-align: center;" autocomplete="off">
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

        const closePitchModal = () => {
            modal.classList.remove('active');
            backdrop.classList.remove('active');
            // Restore pointer-events on all modals
            document.querySelectorAll('.modal').forEach(m => {
                m.style.pointerEvents = '';
            });
        };

        // Close button (×) - just close modal
        const closePitchBtn = document.getElementById('close-pitch-modal-btn');
        if (closePitchBtn && !closePitchBtn.dataset.listenerAttached) {
            closePitchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closePitchModal();
            });
            closePitchBtn.dataset.listenerAttached = 'true';
        }

        // "Start Chatting" button - just close modal and start using app
        const closeBtn = document.getElementById('close-pitch-modal');
        if (closeBtn && !closeBtn.dataset.listenerAttached) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closePitchModal();
            });
            closeBtn.dataset.listenerAttached = 'true';
        }

        // "Add My API Key" button - show onboarding to add API
        // "Get API Keys" button - show onboarding at step 2
        const getApiKeyDirect = document.getElementById('get-api-key-direct');
        if (getApiKeyDirect && !getApiKeyDirect.dataset.listenerAttached) {
            getApiKeyDirect.addEventListener('click', (e) => {
                e.stopPropagation();
                closePitchModal();
                // Show onboarding at step 2 (provider selection with direct links)
                document.getElementById('onboarding-overlay').style.display = 'flex';
                this.showOnboardingStep(2);
            });
            getApiKeyDirect.dataset.listenerAttached = 'true';
        }

    }

    setupAboutAccordion() {
        const aboutModal = document.getElementById('about-modal');
        if (!aboutModal) return;

        const aboutAccordionHeaders = aboutModal.querySelectorAll('.accordion-header');
        console.log("Linen: Setting up about accordion with", aboutAccordionHeaders.length, "headers");

        aboutAccordionHeaders.forEach((header) => {
            // Remove old listener if exists
            header.onclick = null;

            header.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                console.log("Linen: Accordion header clicked");
                const item = header.closest('.accordion-item');
                if (item) {
                    console.log("Linen: Toggling accordion item");
                    item.classList.toggle('active');
                    // Expand the content
                    const content = item.querySelector('.accordion-content');
                    if (content) {
                        if (item.classList.contains('active')) {
                            content.style.display = 'block';
                        } else {
                            content.style.display = 'none';
                        }
                    }
                }
            });
        });
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
            this.showToast('Memory updated!', 'success');
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

            this.showToast(`Restored: ${memory.title}`, 'success');
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
                url: 'https://platform.claude.com/login?returnTo=%2F%3F',
                steps: [
                    'Tap the button below to go to Claude Platform',
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
                this.showToast(`${config.name} API key saved successfully`, 'success');
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

        // Close onboarding button (×)
        const closeOnboarding = document.getElementById('close-onboarding');
        console.log("Linen: Close onboarding button found:", !!closeOnboarding);
        if (closeOnboarding) {
            closeOnboarding.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Linen: Close onboarding clicked");
                // Just close the onboarding overlay, don't show pitch modal
                document.getElementById('onboarding-overlay').style.display = 'none';
            });
        }

        const closeOnboardingStep3 = document.getElementById('close-onboarding-step3');
        if (closeOnboardingStep3) {
            closeOnboardingStep3.addEventListener('click', () => {
                // Just close the onboarding overlay
                document.getElementById('onboarding-overlay').style.display = 'none';
            });
        }

        // Back buttons removed - users can close onboarding overlay with X or finish with Done button

        // AI Provider selection
        const providerButtons = document.querySelectorAll('.ai-provider-btn');
        console.log("Linen: Found", providerButtons.length, "provider buttons");
        providerButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const provider = btn.dataset.provider;
                console.log("Linen: Provider button clicked:", provider);
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
            // Logo click opens About modal
            logo.addEventListener('click', (e) => {
                e.stopPropagation();
                const aboutModal = document.getElementById('about-modal');
                if (aboutModal) {
                    aboutModal.classList.add('active');
                    backdrop.classList.add('active');
                    // Setup accordion when modal opens
                    this.setupAboutAccordion();
                }
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                const hamburgerBtn = document.getElementById('hamburger-menu-btn');
                if (!logo.contains(e.target) && !logoMenu.contains(e.target) && !(hamburgerBtn && hamburgerBtn.contains(e.target))) {
                    logoMenu.classList.add('hidden');
                }
            });

            // Logo menu items
            const logoMemoriesBtn = document.getElementById('logo-memories');
            const logoNewChatBtn = document.getElementById('logo-new-chat');
            const logoSettingsBtn = document.getElementById('logo-settings');

            if (logoNewChatBtn) {
                logoNewChatBtn.addEventListener('click', () => {
                    logoMenu.classList.add('hidden');
                    this.startNewChat();
                });
            }

            if (logoMemoriesBtn) {
                logoMemoriesBtn.addEventListener('click', () => {
                    this.loadMemories();
                    memoriesPanel.classList.add('active');
                    backdrop.classList.add('active');
                    logoMenu.classList.add('hidden');
                });
            }

            if (logoSettingsBtn) {
                logoSettingsBtn.addEventListener('click', () => {
                    // Clear any stuck inline pointer-events from pitch modal
                    settingsModal.style.pointerEvents = '';
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
            document.getElementById('privacy-modal')?.classList.remove('active');
            document.getElementById('terms-modal')?.classList.remove('active');
            document.getElementById('about-modal')?.classList.remove('active');
            backdrop.classList.remove('active');
        };

        document.getElementById('close-memories').addEventListener('click', closeModal);
        document.getElementById('close-settings-modal').addEventListener('click', closeModal);
        document.getElementById('close-about-modal')?.addEventListener('click', closeModal);
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

        // Hamburger menu button in input area
        const hamburgerBtn = document.getElementById('hamburger-menu-btn');
        if (hamburgerBtn && logoMenu) {
            hamburgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                logoMenu.classList.toggle('hidden');
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
                // Show send actions, hide buttons row
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
                    // Show the elements
                    voiceModal.style.display = 'flex';
                    modalBackdrop.style.display = 'block';
                    // Add active classes for styling
                    voiceModal.classList.add('active');
                    modalBackdrop.classList.add('active');
                    console.log("Voice modal opened, starting voice input");
                    this.startVoiceInput();
                } else {
                    console.error("Voice modal or backdrop not found");
                }
            });
        } else {
            console.warn("Linen: Chat Talk button not found");
        }

        // Text input send button - keep input open after sending
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendChat();
                if (chatInput) {
                    chatInput.value = '';
                    chatInput.focus();
                }
            });
        }

        // Text input Enter to send - keep input open after sending
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChat();
                    chatInput.value = '';
                    chatInput.focus();
                }
            });
        } else {
            console.warn("Linen: Chat input element not found");
        }

        // Send message button in default row
        const sendMessageBtn = document.getElementById('send-message-btn');
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => {
                this.sendChat();
                chatInput.value = '';
                chatInput.focus();
            });
        }

        // Mode switcher from text back to buttons
        if (modeSwitcher) {
            modeSwitcher.addEventListener('click', () => {
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
        const dismissLegacy = document.getElementById('dismiss-legacy');
        if (dismissLegacy) {
            dismissLegacy.addEventListener('click', () => {
                const section = document.getElementById('legacy-key-section');
                if (section) section.style.display = 'none';
            });
        }

        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('clear-data').addEventListener('click', () => this.clearAll());
        document.getElementById('clear-chat-history').addEventListener('click', () => this.clearChatHistory());
        document.getElementById('memory-search').addEventListener('input', (e) => this.loadMemories(e.target.value));


        // Contact Support
        document.getElementById('submit-contact').addEventListener('click', () => this.submitContactForm());

        // Suggestions
        document.getElementById('submit-suggestion').addEventListener('click', () => this.submitSuggestion());

        // Voice Modal Lightbox
        const voiceModal = document.getElementById('voice-modal');
        const lightboxStopBtn = document.getElementById('lightbox-stop-btn');
        const modalBackdrop = document.getElementById('modal-backdrop');

        const closeVoiceModal_Handler = () => {
            console.log('Closing voice modal');
            this.stopVoiceInput();
            if (voiceModal) {
                voiceModal.classList.remove('active');
                voiceModal.style.display = 'none';
            }
            if (modalBackdrop) {
                modalBackdrop.classList.remove('active');
                modalBackdrop.style.display = 'none';
            }
        };

        // Attach listener to Stop Recording button
        if (lightboxStopBtn) {
            console.log('Attaching lightbox-stop-btn listener');
            lightboxStopBtn.addEventListener('click', closeVoiceModal_Handler, true);
            lightboxStopBtn.onclick = closeVoiceModal_Handler;
        } else {
            console.warn('lightbox-stop-btn button not found');
        }

        // Also attach a delegated listener to the modal itself
        if (voiceModal) {
            voiceModal.addEventListener('click', (e) => {
                if (e.target.id === 'lightbox-stop-btn' || e.target.closest('#lightbox-stop-btn')) {
                    console.log('Stop Recording button clicked via delegation');
                    closeVoiceModal_Handler();
                }
            }, true);
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
                console.log("Linen: Add Agent button clicked - opening provider selection");
                // Close settings modal and show onboarding overlay with step 2 (provider selection)
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) {
                    settingsModal.classList.add('hidden');
                }
                const onboardingOverlay = document.getElementById('onboarding-overlay');
                if (onboardingOverlay) {
                    onboardingOverlay.style.display = 'flex';
                    this.showOnboardingStep(2);
                }
            });
        } else {
            console.warn("Linen: add-agent-btn not found in DOM");
        }

        // Add agent modal removed - using onboarding overlay instead

        // Load agents list
        this.loadAgentsList();

        // Utilities modal and events
        this.bindUtilitiesEvents();

        // Profile form events
        this.bindProfileEvents();

        // Privacy & Terms modals
        this.bindPrivacyEvents();
    }

    bindUtilitiesEvents() {
        const utilitiesModal = document.getElementById('utilities-modal');
        const closeUtilitiesBtn = document.getElementById('close-utilities-modal');
        const backdrop = document.getElementById('modal-backdrop');
        const logoutilitiesBtn = document.getElementById('logo-utilities');

        // Open utilities modal
        if (logoutilitiesBtn) {
            logoutilitiesBtn.addEventListener('click', () => {
                if (utilitiesModal) {
                    utilitiesModal.classList.add('active');
                    backdrop.classList.add('active');
                    // Load and display utilities from IndexedDB
                    this.loadDisplayUtilities();
                }
                document.getElementById('logo-menu').classList.add('hidden');
            });
        }

        // Close utilities modal
        if (closeUtilitiesBtn) {
            closeUtilitiesBtn.addEventListener('click', () => {
                if (utilitiesModal) {
                    utilitiesModal.classList.remove('active');
                    backdrop.classList.remove('active');
                }
            });
        }

        // Tab switching in utilities modal
        const utilitiesTabs = document.querySelectorAll('.utilities-tab');
        utilitiesTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                // Remove active class from all tabs and contents
                utilitiesTabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.utilities-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const tabContent = document.getElementById(`${tabName}-tab`);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
            });
        });

        // ALARM & TIMER TAB
        const setAlarmBtn = document.getElementById('set-alarm-btn');
        const alarmTimeInput = document.getElementById('alarm-time');
        const alarmLabelInput = document.getElementById('alarm-label');

        if (setAlarmBtn) {
            setAlarmBtn.addEventListener('click', async () => {
                const time = alarmTimeInput?.value;
                const label = alarmLabelInput?.value || 'Alarm';

                if (!time) {
                    this.showToast('Please enter an alarm time', 'error');
                    return;
                }

                if (this.utilities) {
                    const result = await this.utilities.setAlarm(time, label);
                    if (result.success) {
                        this.showToast(`Alarm set for ${result.time}`, 'success');
                        if (alarmTimeInput) alarmTimeInput.value = '';
                        if (alarmLabelInput) alarmLabelInput.value = '';
                        this.loadDisplayUtilities();
                    } else {
                        this.showToast(result.error || 'Failed to set alarm', 'error');
                    }
                }
            });
        }

        const startTimerBtn = document.getElementById('start-timer-btn');
        const timerMinutesInput = document.getElementById('timer-minutes');
        const timerSecondsInput = document.getElementById('timer-seconds');

        if (startTimerBtn) {
            startTimerBtn.addEventListener('click', async () => {
                const minutes = parseInt(timerMinutesInput?.value) || 0;
                const seconds = parseInt(timerSecondsInput?.value) || 0;
                const totalSeconds = minutes * 60 + seconds;

                if (totalSeconds <= 0) {
                    this.showToast('Please enter a valid timer duration', 'error');
                    return;
                }

                if (this.utilities) {
                    const result = await this.utilities.startTimer(minutes, seconds, 'Timer');
                    if (result.success) {
                        this.showToast(`Timer started for ${minutes}m ${seconds}s`, 'success');
                        if (timerMinutesInput) timerMinutesInput.value = '';
                        if (timerSecondsInput) timerSecondsInput.value = '';
                        this.loadDisplayUtilities();
                    } else {
                        this.showToast(result.error || 'Failed to start timer', 'error');
                    }
                }
            });
        }

        // NOTES TAB
        const saveNoteBtn = document.getElementById('save-note-btn');
        const shareNoteBtn = document.getElementById('share-note-btn');
        const noteTextarea = document.getElementById('note-input');

        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', async () => {
                const content = noteTextarea?.value;

                if (!content?.trim()) {
                    this.showToast('Please enter note content', 'error');
                    return;
                }

                if (this.utilities) {
                    try {
                        const result = await this.utilities.saveNote(content);
                        this.showToast('Note saved!', 'success');
                        if (noteTextarea) noteTextarea.value = '';
                        this.loadDisplayUtilities();
                    } catch (e) {
                        this.showToast('Failed to save note', 'error');
                    }
                }
            });
        }

        if (shareNoteBtn) {
            shareNoteBtn.addEventListener('click', async () => {
                const content = noteTextarea?.value;

                if (!content?.trim()) {
                    this.showToast('Please enter note content', 'error');
                    return;
                }

                if (this.utilities) {
                    const shared = await this.utilities.shareNote(content);
                    if (shared) {
                        this.showToast('Note shared!', 'success');
                    } else {
                        this.showToast('Share failed, but note was copied', 'info');
                    }
                }
            });
        }

        // CALENDAR TAB
        const addEventBtn = document.getElementById('add-event-btn');
        const eventTitleInput = document.getElementById('event-title');
        const eventDatetimeInput = document.getElementById('event-datetime');
        const eventDescriptionInput = document.getElementById('event-description');

        if (addEventBtn) {
            addEventBtn.addEventListener('click', async () => {
                const title = eventTitleInput?.value;
                const datetime = eventDatetimeInput?.value;
                const description = eventDescriptionInput?.value || '';

                if (!title || !datetime) {
                    this.showToast('Please enter event title and date/time', 'error');
                    return;
                }

                if (this.utilities) {
                    try {
                        const result = await this.utilities.addEvent(title, new Date(datetime), description);
                        this.showToast('Event added to calendar!', 'success');
                        if (eventTitleInput) eventTitleInput.value = '';
                        if (eventDatetimeInput) eventDatetimeInput.value = '';
                        if (eventDescriptionInput) eventDescriptionInput.value = '';
                        this.loadDisplayUtilities();
                    } catch (e) {
                        this.showToast('Failed to add event', 'error');
                    }
                }
            });
        }

        // REMINDERS TAB
        const createReminderBtn = document.getElementById('create-reminder-btn');
        const reminderTextInput = document.getElementById('reminder-text');
        const reminderDatetimeInput = document.getElementById('reminder-time');
        const reminderMethodSelect = document.getElementById('reminder-method');

        if (createReminderBtn) {
            createReminderBtn.addEventListener('click', async () => {
                const text = reminderTextInput?.value;
                const datetime = reminderDatetimeInput?.value;
                const method = reminderMethodSelect?.value || 'push';

                if (!text || !datetime) {
                    this.showToast('Please enter reminder text and date/time', 'error');
                    return;
                }

                if (this.utilities) {
                    try {
                        const result = await this.utilities.createReminder(text, new Date(datetime), method);
                        this.showToast('Reminder created!', 'success');
                        if (reminderTextInput) reminderTextInput.value = '';
                        if (reminderDatetimeInput) reminderDatetimeInput.value = '';
                        this.loadDisplayUtilities();
                    } catch (e) {
                        this.showToast('Failed to create reminder', 'error');
                    }
                }
            });
        }
    }

    // Load and display utilities from IndexedDB
    async loadDisplayUtilities() {
        try {
            // Load active alarms and timers
            const alarmsList = document.getElementById('active-alarms-list');
            const timersList = document.getElementById('active-timers-list');
            const notesList = document.getElementById('notes-container');
            const eventsList = document.getElementById('events-container');
            const remindersList = document.getElementById('reminders-container');

            if (!this.utilities) return;

            // Display active alarms
            if (alarmsList && this.utilities.activeAlarms) {
                alarmsList.innerHTML = '';
                if (this.utilities.activeAlarms.size === 0) {
                    alarmsList.innerHTML = '<p style="color: #999; padding: 1rem;">No active alarms</p>';
                } else {
                    this.utilities.activeAlarms.forEach((alarm) => {
                        const alarmEl = document.createElement('div');
                        alarmEl.className = 'utility-item';
                        alarmEl.innerHTML = `
                            <div>
                                <strong>⏰ ${alarm.label}</strong>
                                <p style="font-size: 0.9rem; color: #999;">${alarm.time}</p>
                            </div>
                            <button class="button-small button-danger" onclick="linen.utilities.cancelAlarm('${alarm.id}'); linen.loadDisplayUtilities();">Cancel</button>
                        `;
                        alarmsList.appendChild(alarmEl);
                    });
                }
            }

            // Display active timers
            if (timersList && this.utilities.activeTimers) {
                timersList.innerHTML = '';
                if (this.utilities.activeTimers.size === 0) {
                    timersList.innerHTML = '<p style="color: #999; padding: 1rem;">No active timers</p>';
                } else {
                    this.utilities.activeTimers.forEach((timer) => {
                        const timerEl = document.createElement('div');
                        timerEl.className = 'utility-item';
                        timerEl.innerHTML = `
                            <div>
                                <strong>⏱️ ${timer.label}</strong>
                                <p style="font-size: 0.9rem; color: #999;">Running...</p>
                            </div>
                            <button class="button-small button-danger" onclick="linen.utilities.cancelTimer('${timer.id}'); linen.loadDisplayUtilities();">Stop</button>
                        `;
                        timersList.appendChild(timerEl);
                    });
                }
            }

            // Load saved notes, events, and reminders from memories
            const memories = await this.db.getAllMemories();

            // Display notes
            if (notesList) {
                const notes = memories.filter(m => m.type === 'note');
                notesList.innerHTML = '';
                if (notes.length === 0) {
                    notesList.innerHTML = '<p style="color: #999; padding: 1rem;">No saved notes</p>';
                } else {
                    notes.forEach((note) => {
                        const noteEl = document.createElement('div');
                        noteEl.className = 'utility-item note-item';
                        const noteDate = new Date(note.date).toLocaleDateString();
                        noteEl.innerHTML = `
                            <div>
                                <p>${note.text}</p>
                                <small style="color: #999;">${noteDate}</small>
                            </div>
                            <button class="button-small button-danger" onclick="linen.db.deleteMemory(${note.id}); linen.loadDisplayUtilities();">Delete</button>
                        `;
                        notesList.appendChild(noteEl);
                    });
                }
            }

            // Display calendar events
            if (eventsList) {
                const events = memories.filter(m => m.type === 'event');
                eventsList.innerHTML = '';
                if (events.length === 0) {
                    eventsList.innerHTML = '<p style="color: #999; padding: 1rem;">No scheduled events</p>';
                } else {
                    events.forEach((event) => {
                        const eventEl = document.createElement('div');
                        eventEl.className = 'utility-item';
                        const eventDate = new Date(event.date).toLocaleDateString();
                        eventEl.innerHTML = `
                            <div>
                                <strong>📅 ${event.text.split(' at ')[0] || 'Event'}</strong>
                                <p style="font-size: 0.9rem; color: #999;">${eventDate}</p>
                            </div>
                            <button class="button-small button-danger" onclick="linen.db.deleteMemory(${event.id}); linen.loadDisplayUtilities();">Delete</button>
                        `;
                        eventsList.appendChild(eventEl);
                    });
                }
            }

            // Display reminders
            if (remindersList) {
                const reminders = memories.filter(m => m.type === 'reminder');
                remindersList.innerHTML = '';
                if (reminders.length === 0) {
                    remindersList.innerHTML = '<p style="color: #999; padding: 1rem;">No reminders set</p>';
                } else {
                    reminders.forEach((reminder) => {
                        const reminderEl = document.createElement('div');
                        reminderEl.className = 'utility-item';
                        const reminderDate = new Date(reminder.date).toLocaleString();
                        reminderEl.innerHTML = `
                            <div>
                                <strong>🔔 ${reminder.text}</strong>
                                <p style="font-size: 0.9rem; color: #999;">${reminderDate}</p>
                            </div>
                            <button class="button-small button-danger" onclick="linen.db.deleteMemory(${reminder.id}); linen.loadDisplayUtilities();">Delete</button>
                        `;
                        remindersList.appendChild(reminderEl);
                    });
                }
            }
        } catch (e) {
            console.error("Linen: Error loading utilities:", e);
        }
    }

    bindProfileEvents() {
        const saveBtn = document.getElementById('save-profile');
        const clearBtn = document.getElementById('clear-profile');
        const pronounsSelect = document.getElementById('profile-pronouns');
        const pronounsCustom = document.getElementById('profile-pronouns-custom');

        if (pronounsSelect) {
            pronounsSelect.addEventListener('change', () => {
                if (pronounsCustom) {
                    pronounsCustom.style.display = pronounsSelect.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveProfile());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearProfile());
        }

        // Populate timezone dropdown
        this.populateTimezones();

        // Load existing profile data into form
        this.loadProfileForm();
    }

    populateTimezones() {
        const select = document.getElementById('profile-timezone');
        if (!select) return;
        const zones = [
            'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
            'America/Toronto', 'America/Vancouver', 'America/Mexico_City',
            'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
            'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Asia/Kolkata',
            'Australia/Sydney', 'Pacific/Auckland', 'Africa/Cairo', 'Africa/Lagos'
        ];
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        zones.forEach(tz => {
            const opt = document.createElement('option');
            opt.value = tz;
            opt.textContent = tz.replace(/_/g, ' ');
            if (tz === detected) opt.textContent += ' (detected)';
            select.appendChild(opt);
        });
        // If detected timezone not in list, add it
        if (!zones.includes(detected)) {
            const opt = document.createElement('option');
            opt.value = detected;
            opt.textContent = detected.replace(/_/g, ' ') + ' (detected)';
            select.insertBefore(opt, select.children[1]);
        }
    }

    async loadProfileForm() {
        if (!this.profileManager) return;
        try {
            const profile = await this.profileManager.getProfile();
            if (!profile) return;

            const fn = document.getElementById('profile-first-name');
            const ln = document.getElementById('profile-last-name');
            const email = document.getElementById('profile-email');
            const pronouns = document.getElementById('profile-pronouns');
            const pronounsCustom = document.getElementById('profile-pronouns-custom');
            const dob = document.getElementById('profile-dob');
            const dobGroup = document.getElementById('profile-dob-group');
            const dobSaved = document.getElementById('profile-dob-saved');
            const tz = document.getElementById('profile-timezone');

            if (fn) fn.value = profile.firstName || '';
            if (ln) ln.value = profile.lastName || '';
            if (email) email.value = profile.email || '';

            if (pronouns) {
                const stdPronouns = ['he/him', 'she/her', 'they/them'];
                if (profile.pronouns && stdPronouns.includes(profile.pronouns)) {
                    pronouns.value = profile.pronouns;
                } else if (profile.pronouns) {
                    pronouns.value = 'custom';
                    if (pronounsCustom) {
                        pronounsCustom.style.display = 'block';
                        pronounsCustom.value = profile.pronouns;
                    }
                }
            }

            if (profile.dateOfBirth) {
                if (dobGroup) dobGroup.style.display = 'none';
                if (dobSaved) dobSaved.style.display = 'block';
            }

            if (tz && profile.timezone) tz.value = profile.timezone;
        } catch (e) {
            // Silent fail
        }
    }

    async saveProfile() {
        const firstName = document.getElementById('profile-first-name')?.value.trim() || '';
        const lastName = document.getElementById('profile-last-name')?.value.trim() || '';
        const email = document.getElementById('profile-email')?.value.trim() || '';
        const pronounsSelect = document.getElementById('profile-pronouns');
        const pronounsCustom = document.getElementById('profile-pronouns-custom');
        const dob = document.getElementById('profile-dob')?.value || '';
        const tz = document.getElementById('profile-timezone')?.value || '';

        let pronouns = pronounsSelect?.value || '';
        if (pronouns === 'custom') {
            pronouns = pronounsCustom?.value.trim() || '';
        }

        // Get existing profile to preserve DOB if already saved
        const existing = this.profileManager ? await this.profileManager.getProfile() : null;
        const dateOfBirth = dob || existing?.dateOfBirth || '';

        try {
            await this.profileManager.saveProfile({
                firstName,
                lastName,
                email,
                pronouns,
                dateOfBirth,
                timezone: tz,
                notifications: { birthdayMessage: true, emailNotifications: false },
                preferences: { chatStyle: 'friendly' }
            });

            // Also update the user-name setting for backward compatibility with name prompt
            if (firstName) {
                await this.db.setSetting('user-name', firstName);
                if (this.assistant && this.assistant.userProfile) {
                    this.assistant.userProfile.name = firstName;
                }
            }

            // If DOB was just saved, hide the input and show the saved indicator
            if (dob) {
                const dobGroup = document.getElementById('profile-dob-group');
                const dobSaved = document.getElementById('profile-dob-saved');
                if (dobGroup) dobGroup.style.display = 'none';
                if (dobSaved) dobSaved.style.display = 'block';
            }

            this.showToast('Profile updated!', 'success');
        } catch (e) {
            this.showToast('Failed to save profile.', 'error');
        }
    }

    async clearProfile() {
        if (!confirm('Are you sure you want to clear all profile data? This cannot be undone.')) return;
        try {
            await this.profileManager.deleteProfile();
            // Reset form fields
            const fields = ['profile-first-name', 'profile-last-name', 'profile-email', 'profile-pronouns', 'profile-pronouns-custom', 'profile-dob', 'profile-timezone'];
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            // Show DOB input again
            const dobGroup = document.getElementById('profile-dob-group');
            const dobSaved = document.getElementById('profile-dob-saved');
            if (dobGroup) dobGroup.style.display = 'block';
            if (dobSaved) dobSaved.style.display = 'none';
            // Clear birthday shown flag
            localStorage.removeItem('linen-birthday-shown-date');

            this.showToast('Profile data cleared.', 'info');
        } catch (e) {
            this.showToast('Failed to clear profile.', 'error');
        }
    }

    bindPrivacyEvents() {
        const showPrivacy = document.getElementById('show-privacy-policy');
        const showTerms = document.getElementById('show-terms');
        const backdrop = document.getElementById('modal-backdrop');

        if (showPrivacy) {
            showPrivacy.addEventListener('click', () => {
                const modal = document.getElementById('privacy-modal');
                if (modal) {
                    modal.classList.add('active');
                    backdrop.classList.add('active');
                }
            });
        }

        if (showTerms) {
            showTerms.addEventListener('click', () => {
                const modal = document.getElementById('terms-modal');
                if (modal) {
                    modal.classList.add('active');
                    backdrop.classList.add('active');
                }
            });
        }

        // Share Linen button
        const shareBtn = document.getElementById('share-linen-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                const linienUrl = 'https://ramin-najafi.github.io/linen';
                try {
                    // Try to use native share API first if available (mobile)
                    if (navigator.share) {
                        await navigator.share({
                            title: 'Linen',
                            text: 'Check out Linen - your personal AI assistant that respects your privacy!',
                            url: linienUrl
                        });
                    } else {
                        // Fallback to clipboard API
                        await navigator.clipboard.writeText(linienUrl);
                        this.showShareNotification();
                    }
                } catch (err) {
                    // If share fails and clipboard is not available, fallback
                    if (err.name !== 'AbortError') {
                        try {
                            await navigator.clipboard.writeText(linienUrl);
                            this.showShareNotification();
                        } catch (clipboardErr) {
                            console.error('Linen: Share failed:', clipboardErr);
                            this.showToast('Could not copy link to clipboard', 'error');
                        }
                    }
                }
            });
        }

        // Close buttons for privacy/terms modals
        ['close-privacy-modal', 'close-privacy-btn', 'close-terms-modal', 'close-terms-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    document.getElementById('privacy-modal')?.classList.remove('active');
                    document.getElementById('terms-modal')?.classList.remove('active');
                    backdrop.classList.remove('active');
                });
            }
        });
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

        // Auto-detect provider or use onboarding's selected provider
        const provider = this.detectProvider(key) || this.onboardingProvider || 'gemini';
        let tempAssistant;

        switch (provider) {
            case 'openai': tempAssistant = new OpenAIAssistant(key); break;
            case 'claude': tempAssistant = new ClaudeAssistant(key); break;
            case 'deepseek': tempAssistant = new DeepSeekAssistant(key); break;
            case 'openrouter': tempAssistant = new OpenRouterAssistant(key); break;
            default: tempAssistant = new GeminiAssistant(key);
        }

        const result = await tempAssistant.validateKey();

        if (result.valid) {
            console.log("Linen: API key validated successfully. Saving as agent.");

            // Save as agent in new system
            const providerNames = {
                'gemini': 'Gemini', 'openai': 'ChatGPT', 'claude': 'Claude',
                'deepseek': 'DeepSeek', 'openrouter': 'OpenRouter'
            };
            const agentConfig = {
                name: `${providerNames[provider] || 'API'} Key`,
                type: provider,
                apiKey: key,
                model: null,
                isPrimary: true
            };
            const agent = await this.agentManager.addAgent(agentConfig);
            agent.status = 'valid';
            agent.lastVerified = Date.now();
            await this.db.setSetting(`agent-${agent.id}`, JSON.stringify(agent));

            const existingIds = JSON.parse(await this.db.getSetting('agent-ids') || '[]');
            existingIds.push(agent.id);
            await this.db.setSetting('agent-ids', JSON.stringify(existingIds));
            await this.db.setSetting('primary-agent-id', agent.id);

            // Also save for backward compatibility
            await this.db.setSetting('gemini-api-key', key);

            this.assistant = tempAssistant;
            this.currentAgent = agent;
            this.isLocalMode = false;
            errorEl.textContent = '';
            onSuccess();
        } else {
            console.error(`Linen: API key validation failed: ${result.error}`);
            errorEl.textContent = `Key validation failed: ${result.error}`;
        }
    }

    clearFieldErrors() {
        document.querySelectorAll('.form-field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
    }

    async addNewAgent() {
        console.log("Linen: Adding new agent...");
        const nameInput = document.getElementById('agent-name');
        const typeSelect = document.getElementById('agent-type');
        const keyInput = document.getElementById('agent-api-key');
        const modelInput = document.getElementById('agent-model');
        const primaryCheckbox = document.getElementById('agent-primary');
        const errorEl = document.getElementById('add-agent-error');
        const saveBtn = document.getElementById('save-new-agent');

        let name = nameInput.value.trim();
        const type = typeSelect.value;
        const apiKey = keyInput.value.trim();
        const model = modelInput.value.trim();
        const isPrimary = primaryCheckbox.checked;

        // Clear previous field errors
        this.clearFieldErrors();
        errorEl.textContent = '';

        // Per-field validation
        let hasErrors = false;

        if (!type) {
            const err = document.getElementById('agent-type-error');
            if (err) err.textContent = 'Please select a provider';
            if (typeSelect) typeSelect.classList.add('field-invalid');
            hasErrors = true;
        }
        if (!apiKey) {
            const err = document.getElementById('agent-api-key-error');
            if (err) err.textContent = 'API key is required';
            keyInput.classList.add('field-invalid');
            hasErrors = true;
        } else if (apiKey.length < 10) {
            const err = document.getElementById('agent-api-key-error');
            if (err) err.textContent = 'API key looks too short. Check it was copied completely.';
            keyInput.classList.add('field-invalid');
            hasErrors = true;
        }

        if (hasErrors) return;

        // Auto-generate name if not provided
        if (!name) {
            const providerNames = {
                'gemini': 'Gemini', 'openai': 'ChatGPT', 'claude': 'Claude',
                'deepseek': 'DeepSeek', 'openrouter': 'OpenRouter'
            };
            name = `${providerNames[type] || 'API'} Key`;
            const existingNames = this.agentManager.getAgents().map(a => a.name);
            if (existingNames.includes(name)) {
                let i = 2;
                while (existingNames.includes(`${name} ${i}`)) i++;
                name = `${name} ${i}`;
            }
        }

        // Disable button while processing
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Adding...';
        }

        errorEl.textContent = 'Validating API key...';

        try {
            // Validate API key for the selected provider
            let tempAssistant;
            const resolvedModel = model || this.getDefaultModel(type);

            switch (type) {
                case 'openai':
                    tempAssistant = new OpenAIAssistant(apiKey, resolvedModel);
                    break;
                case 'claude':
                    tempAssistant = new ClaudeAssistant(apiKey, resolvedModel);
                    break;
                case 'deepseek':
                    tempAssistant = new DeepSeekAssistant(apiKey, resolvedModel);
                    break;
                case 'openrouter':
                    tempAssistant = new OpenRouterAssistant(apiKey, resolvedModel);
                    break;
                case 'gemini':
                default:
                    tempAssistant = new GeminiAssistant(apiKey);
            }

            const result = await tempAssistant.validateKey();
            if (!result.valid) {
                errorEl.textContent = `Key validation failed: ${result.error}`;
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Add Key';
                }
                return;
            }

            // Add agent to AgentManager
            const agentConfig = {
                name: name,
                type: type,
                apiKey: apiKey,
                model: resolvedModel,
                isPrimary: isPrimary
            };

            const agent = await this.agentManager.addAgent(agentConfig);

            // Save agent to database
            await this.db.setSetting(`agent-${agent.id}`, JSON.stringify(agent));

            // Persist agent ID to the list
            const existingIds = JSON.parse(await this.db.getSetting('agent-ids') || '[]');
            existingIds.push(agent.id);
            await this.db.setSetting('agent-ids', JSON.stringify(existingIds));

            // If set as primary, update primary agent
            if (isPrimary) {
                await this.db.setSetting('primary-agent-id', agent.id);
                this.currentAgent = agent;
                this.assistant = this.createAssistantFromAgent(agent);
                this.isLocalMode = false;
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
            this.showToast(`${name} added successfully!`, 'success');

            // Re-enable button
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Add Key';
            }
        } catch (err) {
            console.error("Linen: Error adding agent:", err);
            errorEl.textContent = `Error: ${err.message}`;
            // Re-enable button on error
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Add Key';
            }
        }
    }

    clearAddAgentForm() {
        document.getElementById('agent-name').value = '';
        document.getElementById('agent-type').value = '';
        document.getElementById('agent-api-key').value = '';
        document.getElementById('agent-model').value = '';
        document.getElementById('agent-primary').checked = true;
        document.getElementById('add-agent-error').textContent = '';
        const detectedDisplay = document.getElementById('detected-provider-display');
        if (detectedDisplay) detectedDisplay.style.display = 'none';
        const providerGroup = document.getElementById('provider-select-group');
        if (providerGroup) providerGroup.style.display = 'none';
        const modelGroup = document.getElementById('model-group');
        if (modelGroup) modelGroup.style.display = 'none';
        this.clearFieldErrors();
        const saveBtn = document.getElementById('save-new-agent');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Add Key';
        }
    }

    async loadAgentsList() {
        console.log("Linen: Loading agents list...");
        const agentsList = document.getElementById('agents-list');
        if (!agentsList) return;

        const agents = this.agentManager.getAgents();

        if (agents.length === 0) {
            agentsList.innerHTML = `
                <div class="empty-state-container">
                    <div class="empty-state-icon">🔑</div>
                    <h3 class="empty-state-title">No API Keys Yet</h3>
                    <p class="empty-state-text">Default: Using Linen's built-in AI</p>
                    <ul class="empty-state-benefits">
                        <li>\u2713 Use your favorite AI (ChatGPT, Claude, etc.)</li>
                        <li>\u2713 Have more control over responses</li>
                        <li>\u2713 Use your own API keys (you own your data)</li>
                    </ul>
                </div>`;
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

            // Status indicator
            const statusEl = document.createElement('div');
            const agentStatus = agent.status || 'unknown';
            statusEl.className = `agent-status agent-status-${agentStatus}`;
            const statusLabels = {
                'valid': '\u2713 Active',
                'invalid': '\u2715 Invalid Key',
                'rate-limited': '\u23F3 Rate Limited',
                'expired': '\u26A0 Quota Exceeded',
                'unknown': '? Unknown'
            };
            statusEl.textContent = statusLabels[agentStatus] || agentStatus;

            // Masked key preview
            const keyPreview = document.createElement('div');
            keyPreview.className = 'agent-key-preview';
            const maskedKey = agent.apiKey ?
                agent.apiKey.substring(0, 6) + '...' + agent.apiKey.substring(agent.apiKey.length - 4) :
                'No key';
            keyPreview.textContent = maskedKey;

            info.appendChild(nameEl);
            info.appendChild(typeEl);
            info.appendChild(statusEl);
            info.appendChild(keyPreview);

            if (agent.isPrimary) {
                const badgeEl = document.createElement('div');
                badgeEl.className = 'agent-primary-badge';
                badgeEl.textContent = 'PRIMARY';
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

        const prevPrimary = this.agentManager.primaryAgent;
        this.agentManager.setPrimaryAgent(agentId);
        await this.db.setSetting('primary-agent-id', agentId);

        // Persist both agents' updated state
        if (prevPrimary) {
            await this.db.setSetting(`agent-${prevPrimary.id}`, JSON.stringify(prevPrimary));
        }
        const newPrimary = this.agentManager.primaryAgent;
        if (newPrimary) {
            await this.db.setSetting(`agent-${newPrimary.id}`, JSON.stringify(newPrimary));
            this.currentAgent = newPrimary;
            this.assistant = this.createAssistantFromAgent(newPrimary);
            this.isLocalMode = false;
        }

        this.loadAgentsList();
        this.showToast('Primary key updated!', 'success');
    }

    async deleteAgent(agentId) {
        console.log("Linen: Deleting agent:", agentId);
        if (!confirm('Are you sure you want to delete this API key?')) return;

        const wasPrimary = this.agentManager.agents.find(a => a.id === agentId)?.isPrimary;
        this.agentManager.removeAgent(agentId);
        await this.db.setSetting(`agent-${agentId}`, null);

        // Remove from agent-ids list
        const existingIds = JSON.parse(await this.db.getSetting('agent-ids') || '[]');
        const updatedIds = existingIds.filter(id => String(id) !== String(agentId));
        await this.db.setSetting('agent-ids', JSON.stringify(updatedIds));

        // If deleted key was primary, promote next or fall back to local
        if (wasPrimary) {
            const newPrimary = this.agentManager.primaryAgent;
            if (newPrimary) {
                await this.db.setSetting('primary-agent-id', newPrimary.id);
                await this.db.setSetting(`agent-${newPrimary.id}`, JSON.stringify(newPrimary));
                this.currentAgent = newPrimary;
                this.assistant = this.createAssistantFromAgent(newPrimary);
                this.isLocalMode = false;
            } else {
                await this.db.setSetting('primary-agent-id', null);
                this.currentAgent = null;
                // Initialize utilities if not done yet
                if (!this.utilities) {
                    this.utilities = new UtilitiesApp(this.db);
                }
                this.assistant = new LocalAssistant(this.db, this.utilities);
                this.isLocalMode = true;
            }
        }

        this.loadAgentsList();
        this.showToast('API key deleted!', 'info');
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

    detectProvider(apiKey) {
        if (!apiKey || apiKey.length < 5) return null;
        const key = apiKey.trim();

        if (key.startsWith('sk-ant-')) return 'claude';
        if (key.startsWith('sk-or-')) return 'openrouter';
        if (key.startsWith('sk-')) return 'openai';
        if (key.startsWith('AIza')) return 'gemini';

        return null;
    }

    onApiKeyInput() {
        const keyInput = document.getElementById('agent-api-key');
        const key = keyInput.value.trim();

        if (key.length < 5) {
            const detectedDisplay = document.getElementById('detected-provider-display');
            if (detectedDisplay) detectedDisplay.style.display = 'none';
            const providerGroup = document.getElementById('provider-select-group');
            if (providerGroup) providerGroup.style.display = 'none';
            return;
        }

        const detected = this.detectProvider(key);
        if (detected) {
            const label = this.getProviderLabel(detected);
            const iconEl = document.getElementById('detected-provider-icon');
            const nameEl = document.getElementById('detected-provider-name');
            const detectedDisplay = document.getElementById('detected-provider-display');
            if (iconEl) iconEl.textContent = label.split(' ')[0];
            if (nameEl) nameEl.textContent = `Detected: ${label.substring(label.indexOf(' ') + 1)}`;
            if (detectedDisplay) detectedDisplay.style.display = 'flex';
            const providerGroup = document.getElementById('provider-select-group');
            if (providerGroup) providerGroup.style.display = 'none';

            const typeSelect = document.getElementById('agent-type');
            if (typeSelect) typeSelect.value = detected;

            const nameInput = document.getElementById('agent-name');
            if (nameInput && !nameInput.value.trim()) {
                const providerNames = {
                    'gemini': 'Gemini', 'openai': 'ChatGPT', 'claude': 'Claude',
                    'deepseek': 'DeepSeek', 'openrouter': 'OpenRouter'
                };
                nameInput.placeholder = `e.g., My ${providerNames[detected]} Key`;
            }

            this.updateAgentModelOptions(detected);
        } else {
            const detectedDisplay = document.getElementById('detected-provider-display');
            if (detectedDisplay) detectedDisplay.style.display = 'none';
            const providerGroup = document.getElementById('provider-select-group');
            if (providerGroup) providerGroup.style.display = 'block';
        }
    }

    showManualProviderSelect() {
        const detectedDisplay = document.getElementById('detected-provider-display');
        if (detectedDisplay) detectedDisplay.style.display = 'none';
        const providerGroup = document.getElementById('provider-select-group');
        if (providerGroup) providerGroup.style.display = 'block';
        const typeSelect = document.getElementById('agent-type');
        if (typeSelect) {
            typeSelect.value = '';
            typeSelect.focus();
        }
    }

    async updateAgentStatus(agentId, status, error = null) {
        const agent = this.agentManager.getAgents().find(a => String(a.id) === String(agentId));
        if (!agent) return;

        agent.status = status;
        agent.lastVerified = Date.now();
        agent.lastError = error;

        await this.db.setSetting(`agent-${agent.id}`, JSON.stringify(agent));
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

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
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
            this.scrollToBottom();
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
        this.scrollToBottom();

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
            this.scrollToBottom();

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

            // Update agent status based on error
            if (this.currentAgent) {
                let newStatus = 'unknown';
                if (status === 429) newStatus = 'rate-limited';
                else if (status === 401 || status === 403) newStatus = 'invalid';
                else if (msgText.toLowerCase().includes('quota')) newStatus = 'expired';
                this.updateAgentStatus(this.currentAgent.id, newStatus, msgText);
            }

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
                    this.showToast(`Switched to ${nextAgent.name}`, 'info');
                    // Retry the chat with new agent
                    return this.sendChat(initialMessage);
                } else {
                    // No alternative agents, fall back to LocalAssistant
                    console.log("Linen: No alternative agents available. Falling back to LocalAssistant.");
                    // Initialize utilities if not done yet
                    if (!this.utilities) {
                        this.utilities = new UtilitiesApp(this.db);
                    }
                    this.assistant = new LocalAssistant(this.db, this.utilities);
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
        await this.db.setSetting('agent-ids', null);
        await this.db.setSetting('primary-agent-id', null);
        await this.db.setSetting('legacy-key-migrated', null);
        await this.db.setSetting('onboarding-complete', false);
        if (this.profileManager) {
            await this.profileManager.deleteProfile();
        }
        localStorage.removeItem('linen-birthday-shown-date');
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

        this.showToast('New chat started!', 'success');

        // Start with greeting
        this.sendChat('[INITIAL_GREETING]');
    }

    async clearChatHistory() {
        if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) return;
        await this.db.clearConversations();
        this.loadChatHistory();
        this.showToast('Chat history cleared.', 'info');
    }

    async submitContactForm() {
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        const statusEl = document.getElementById('contact-status');
        const submitBtn = document.getElementById('submit-contact');

        if (!name || !email || !message) {
            statusEl.textContent = 'Please fill in all fields.';
            statusEl.style.color = '#ff6b6b';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        statusEl.textContent = '';

        try {
            const response = await fetch('https://formspree.io/f/xaqdnyzw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ name, email, message, _replyto: email })
            });

            if (response.ok) {
                document.getElementById('contact-name').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-message').value = '';
                statusEl.textContent = 'Message sent! We\'ll get back to you soon.';
                statusEl.style.color = '#4a9eff';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send';
                setTimeout(() => { statusEl.textContent = ''; }, 3000);
            } else {
                throw new Error('Failed to send message');
            }
        } catch (e) {
            statusEl.textContent = 'Error sending message. Please try again.';
            statusEl.style.color = '#ff6b6b';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send';
        }
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
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    _subject: 'Linen App Suggestions',
                    _replyto: 'rnajafi.dev@gmail.com',
                    message: suggestionText,
                    type: 'suggestion',
                    timestamp: new Date().toISOString()
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
            memoriesList.innerHTML = `
                <div class="empty-state-container">
                    <div class="empty-state-icon">📚</div>
                    <h3 class="empty-state-title">No Memories Yet</h3>
                    <p class="empty-state-text">Memories are saved when you add an API key. They help Linen learn about you over time.</p>
                    <button class="empty-state-btn" id="empty-state-add-key">+ Add My API Key</button>
                </div>`;
            const addKeyBtn = document.getElementById('empty-state-add-key');
            if (addKeyBtn) {
                addKeyBtn.addEventListener('click', () => {
                    // Close memories panel, open settings and scroll to AI Agents
                    document.getElementById('memories-panel').classList.remove('active');
                    const settingsModal = document.getElementById('settings-modal');
                    const backdrop = document.getElementById('modal-backdrop');
                    settingsModal.classList.add('active');
                    backdrop.classList.add('active');
                    // Scroll to AI Agents section
                    const agentsHeading = settingsModal.querySelector('h3');
                    if (agentsHeading) {
                        setTimeout(() => agentsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    }
                });
            }
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
                const voiceErrorMsg = error === 'no-speech'
                    ? "Couldn't hear you. Try again or use text input."
                    : `Voice input error: ${error}`;
                this.showToast(voiceErrorMsg, 'error');
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
            this.showToast('Your browser does not support reminders.', 'warning');
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
                    this.showToast('Reminders enabled!', 'success');
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

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        // Clear any existing toast timer
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
            this._toastTimer = null;
        }

        // Remove previous type classes
        toast.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info', 'show');

        const icons = {
            success: '\u2713',
            error: '\u2715',
            warning: '\u26A0',
            info: '\u2139'
        };

        const icon = icons[type] || icons.info;

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="close-toast">\u00D7</button>
        `;

        toast.classList.add(`toast-${type}`);
        // Force reflow before adding show class for animation
        void toast.offsetWidth;
        toast.classList.add('show');

        const closeButton = toast.querySelector('.close-toast');
        if (closeButton) {
            closeButton.onclick = () => {
                toast.classList.remove('show');
                if (this._toastTimer) {
                    clearTimeout(this._toastTimer);
                    this._toastTimer = null;
                }
            };
        }

        // Auto-dismiss after 4 seconds
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            this._toastTimer = null;
        }, 4000);
    }

    updateVersion(newVersion) {
        // Update all three version displays at once
        const headerVersion = document.getElementById('header-version');
        const aboutVersion = document.getElementById('about-version');
        const settingsVersion = document.getElementById('version-info');

        if (headerVersion) headerVersion.textContent = newVersion;
        if (aboutVersion) aboutVersion.textContent = newVersion;
        if (settingsVersion) settingsVersion.textContent = `Version-${newVersion}`;

        console.log("Linen: Version updated to", newVersion);
    }

    showShareNotification() {
        // Create a custom share notification
        const notification = document.createElement('div');
        notification.id = 'share-notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 1rem;
            animation: slideIn 0.3s ease-out;
            font-weight: 600;
        `;

        notification.innerHTML = `
            <span>✓ Link copied—paste to share</span>
            <button style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; padding: 0; display: flex; align-items: center;">×</button>
        `;

        document.body.appendChild(notification);

        // Close button handler
        const closeBtn = notification.querySelector('button');
        const removeNotification = () => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        };

        closeBtn.addEventListener('click', removeNotification);

        // Auto-dismiss after 4 seconds
        setTimeout(removeNotification, 4000);

        // Add animations to stylesheet if not present
        if (!document.getElementById('share-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'share-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    addSystemMessage(message, type) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'assistant-message system-message';
        if (type) div.dataset.type = type;
        div.textContent = message;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    try {
        // Keyboard navigation detection — add golden focus outlines only when using Tab
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });
        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });

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