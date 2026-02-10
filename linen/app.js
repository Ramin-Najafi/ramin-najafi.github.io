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
        const systemPrompt = `You are Linen, a smart personal assistant. Your primary function is to be a conversational partner that remembers important details about the user's life.

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists. Use actual emoji characters in your conversational responses when appropriate.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **STRICT SAVE_MEMORY Marker Format:** When you identify a memory, you MUST conclude your conversational response with a single, perfectly formatted [SAVE_MEMORY: ...] marker on a new line. The entire marker, including brackets and valid JSON, MUST be the very last thing in your response. Do NOT add any text or characters after the closing bracket.
    The JSON inside MUST contain:
    - "text": A concise summary of what to remember.
    - "tags": An array of relevant keywords (e.g., ["work", "project", "feeling"]).
    - "emotion": A single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    Example: Your response text.
    [SAVE_MEMORY: { "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
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

class LocalAssistant {
    constructor() {
        this.sessionMemory = []; // Conversation history for this session
        this.userProfile = {
            name: null,
            mood: 'neutral',
            topics: [], // Topics user talks about
            preferences: {}
        };
        this.responses = {
            greeting: [
                "Hey! I'm Linen, your local assistant. I'm here to listen and chat. What's on your mind?",
                "Hi there! I'm running locally right now, but I'm still here to talk with you. What would you like to discuss?",
                "Welcome! I'm in local mode, but don't worry—I'm still a good listener. Tell me what's going on.",
            ],
            listening: [
                "That sounds important. Tell me more.",
                "I'm here and listening. Keep going.",
                "I hear you. What else?",
                "That makes sense. How are you feeling about it?",
            ],
            support: [
                "I'm here for you. You're not alone in this.",
                "That's a lot to handle. You're doing great dealing with it.",
                "I appreciate you sharing that with me.",
                "Your feelings are valid. What do you need right now?",
            ],
            reflection: [
                "So what I'm hearing is that...",
                "If I understand correctly, you're...",
                "It sounds like you...",
            ],
            positive: [
                "That's wonderful! I'm happy for you.",
                "That's great to hear!",
                "You should feel proud of that.",
                "That's a great way to think about it.",
            ],
            closing: [
                "I'm always here if you need to talk.",
                "Feel free to come back anytime you want to chat.",
                "Remember, you've got this.",
                "Take care of yourself.",
            ]
        };
    }

    // Detect what the user is talking about
    detectTopic(message) {
        const msg = message.toLowerCase();
        const topics = {
            work: ['work', 'job', 'boss', 'project', 'deadline', 'meeting', 'office'],
            health: ['tired', 'sick', 'sleep', 'exercise', 'health', 'doctor', 'pain'],
            relationships: ['friend', 'family', 'partner', 'mom', 'dad', 'brother', 'sister', 'girlfriend', 'boyfriend', 'love'],
            mental_health: ['stressed', 'anxious', 'depressed', 'sad', 'overwhelmed', 'scared', 'worried'],
            goals: ['want', 'goal', 'dream', 'learn', 'achieve', 'trying', 'plan'],
            hobbies: ['hobby', 'play', 'music', 'read', 'game', 'art', 'write', 'draw', 'cook'],
        };

        const detected = [];
        for (const [topic, keywords] of Object.entries(topics)) {
            if (keywords.some(k => msg.includes(k))) {
                detected.push(topic);
            }
        }
        return detected.length > 0 ? detected[0] : null;
    }

    // Detect user's emotional tone
    detectMood(message) {
        const msg = message.toLowerCase();
        
        const moods = {
            distressed: ['sad', 'depressed', 'hopeless', 'suicidal', 'crisis', 'emergency', 'angry', 'furious', 'frustrated', 'devastated'],
            anxious: ['anxious', 'nervous', 'worried', 'scared', 'afraid', 'panic'],
            positive: ['happy', 'excited', 'great', 'wonderful', 'amazing', 'proud', 'grateful'],
            neutral: []
        };

        for (const [mood, keywords] of Object.entries(moods)) {
            if (keywords.some(k => msg.includes(k))) {
                return mood;
            }
        }
        return 'neutral';
    }

    // Extract user's name if mentioned
    extractName(message) {
        const nameMatch = message.match(/(?:call me|i'm|i am|name is|i go by)\s+(\w+)/i);
        if (nameMatch) {
            return nameMatch[1];
        }
        return null;
    }

    // Generate a contextual response
    async chat(message) {
        // Update user profile
        const topic = this.detectTopic(message);
        const mood = this.detectMood(message);
        const name = this.extractName(message);

        if (topic && !this.userProfile.topics.includes(topic)) {
            this.userProfile.topics.push(topic);
        }
        if (mood !== 'neutral') {
            this.userProfile.mood = mood;
        }
        if (name) {
            this.userProfile.name = name;
        }

        // Add to session memory
        this.sessionMemory.push({
            role: 'user',
            content: message,
            mood: mood,
            topic: topic,
            timestamp: Date.now()
        });

        // Generate response based on mood and context
        let response = '';

        // Initial greeting
        if (this.sessionMemory.length === 1) {
            response = this.responses.greeting[Math.floor(Math.random() * this.responses.greeting.length)];
        }
        // Distressed user - prioritize support
        else if (mood === 'distressed') {
            response = this.responses.support[Math.floor(Math.random() * this.responses.support.length)];
            // Add follow-up question
            if (message.length < 30) {
                response += " What's troubling you?";
            } else {
                response += " How are you feeling right now?";
            }
        }
        // Anxious user - normalize and support
        else if (mood === 'anxious') {
            response = "It's natural to feel that way. ";
            response += this.responses.listening[Math.floor(Math.random() * this.responses.listening.length)]?.toLowerCase();
        }
        // Positive mood - celebrate
        else if (mood === 'positive') {
            response = this.responses.positive[Math.floor(Math.random() * this.responses.positive.length)];
        }
        // Neutral/normal conversation
        else {
            // Reflect back what they said
            if (Math.random() > 0.5 && message.length > 20) {
                const reflection = this.responses.reflection[Math.floor(Math.random() * this.responses.reflection.length)];
                // Create a shortened reflection
                const keywords = message.split(' ').filter(w => w.length > 4).slice(0, 3).join(' ');
                response = `${reflection} ${keywords}. `;
                response += this.responses.listening[Math.floor(Math.random() * this.responses.listening.length)];
            } else {
                response = this.responses.listening[Math.floor(Math.random() * this.responses.listening.length)];
            }
        }

        // Store the assistant's response
        this.sessionMemory.push({
            role: 'assistant',
            content: response,
            timestamp: Date.now()
        });

        return response;
    }

    // Get session summary (for context handoff to Gemini later if API comes back)
    getSessionSummary() {
        const summary = {
            userProfile: this.userProfile,
            messageCount: this.sessionMemory.length,
            topics: this.userProfile.topics,
            lastMood: this.userProfile.mood,
            conversationLength: this.sessionMemory.length
        };
        return summary;
    }

    // Clear session (when switching to Gemini)
    clearSession() {
        this.sessionMemory = [];
    }
}
class Linen {
    constructor() {
        this.db = new LinenDB();
        this.analytics = new Analytics();
        this.assistant = null; // Will be GeminiAssistant or LocalAssistant
        this.isLocalMode = false;
        this._onboardingBound = false;
        this._eventsBound = false;
        this.trialMode = false;
        this.trialCount = 0;
        this.currentSessionTitle = null;
        this.isNewSession = true;
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
            if (existingConvs && existingConvs.length > 0) {
                const sessionTitle = this.generateSessionTitle(existingConvs);
                await this.db.archiveSession({ title: sessionTitle, messages: existingConvs, date: Date.now(), preview: existingConvs[existingConvs.length - 1]?.text || 'Previous conversation', messageCount: existingConvs.length });
            }
            await this.db.clearCurrentSession();
            
            const apiKey = await this.db.getSetting('gemini-api-key');
            const hasSeenPitch = localStorage.getItem('linen-pitch-shown');
            
            if (!apiKey && !hasSeenPitch) {
                localStorage.setItem('linen-pitch-shown', 'true');
                this.showPitchModal();
                return;
            }
            
            // rest of init code continues...
            console.log(`Linen: API Key found in DB: ${apiKey ? '[REDACTED]' : 'false'}`);

            if (!apiKey) {
                console.log("Linen: No API Key found, showing onboarding.");
                this.showOnboarding();
            } else {
                const geminiAssistant = new GeminiAssistant(apiKey);
                const result = await geminiAssistant.validateKey();
                if (result.valid) {
                    console.log("Linen: API Key validated successfully, starting app with Gemini.");
                    this.assistant = geminiAssistant;
                    this.isLocalMode = false;
                    this.startApp(apiKey);
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
                        this.startApp(apiKey); // Start app without showing onboarding
                        this.showToast(`Gemini API unavailable: ${result.error}. Using local assistant.`);
                    } else {
                        console.warn(`Linen: Saved API key invalid: ${result.error}. Showing onboarding.`);
                        this.showOnboarding(`Your saved API key is invalid: ${result.error}`);
                    }
                }
            }
        } catch (e) {
            console.error('Linen: Init error:', e);
            // If init fails, always offer local mode if possible, otherwise show onboarding.
            this.assistant = new LocalAssistant();
            this.isLocalMode = true;
            this.startApp(null); // Start in local mode without API key
            this.showToast(`Linen failed to initialize: ${e.message}. Using local assistant.`);
            console.error('Linen: Fatal error during init, starting in local-only mode.', e);
        }
    }

    async startApp(apiKey) {
        console.log("Linen: Starting app with API Key.");
        this.assistant = new GeminiAssistant(apiKey);
        document.getElementById('onboarding-overlay').style.display = 'none';
        document.getElementById('re-enter-key-modal').classList.remove('active');
        document.getElementById('modal-backdrop').classList.remove('active');
        this.bindEvents();
        await this.loadChatHistory();
        console.log("Linen: App started.");
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

    showPitchModal() {
        const modal = document.getElementById('pitch-modal');
        const backdrop = document.getElementById('modal-backdrop');
        if (!modal) {
            console.warn("Pitch modal not found in HTML");
            return;
        }
        
        modal.classList.add('active');
        backdrop.classList.add('active');
        
        const tryFreeBtn = document.getElementById('try-free-btn');
        const addKeyBtn = document.getElementById('add-api-key-btn');
        
        if (tryFreeBtn) {
            tryFreeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
                this.startTrialMode();
            });
        }
        
        if (addKeyBtn) {
            addKeyBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
                this.showOnboarding();
            });
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
        modal.innerHTML = `<div class="memory-modal-content"><button class="close-modal" id="close-memory-modal">×</button><h2>${title}</h2><p class="memory-modal-date">${date}</p><div class="memory-messages-container">${messagesHtml}</div></div>`;
        modal.classList.add('active');
        backdrop.classList.add('active');
        document.getElementById('close-memory-modal').addEventListener('click', () => {
            modal.classList.remove('active');
            backdrop.classList.remove('active');
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                modal.classList.remove('active');
                backdrop.classList.remove('active');
            }
        });
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

    showOnboardingStep(stepNum) {
        document.querySelectorAll('#onboarding-wizard .step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${stepNum}`).classList.add('active');
        document.querySelectorAll('.step-indicator .dot').forEach((dot, i) => {
            dot.classList.toggle('active', i <= stepNum - 1);
        });
    }

    bindOnboardingEvents() {
        if (this._onboardingBound) return;
        this._onboardingBound = true;

        document.getElementById('get-started').addEventListener('click', () => this.showOnboardingStep(2));

        const saveKey = () => this.validateAndSaveKey('onboarding-api-key', 'onboarding-error', async () => {
            const done = await this.db.getSetting('onboarding-complete');
            if (done) {
                this.startApp(this.assistant.apiKey);
            } else {
                this.showOnboardingStep(3);
            }
        });

        document.getElementById('save-onboarding-api-key').addEventListener('click', saveKey);
        document.getElementById('onboarding-api-key').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveKey(); }
        });

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
        if (this._eventsBound) return;
        this._eventsBound = true;

        // Re-enter key modal
        const reEnterSave = () => this.validateAndSaveKey('re-enter-api-key', 're-enter-error', () => this.startApp(this.assistant.apiKey));
        document.getElementById('save-re-enter-api-key').addEventListener('click', reEnterSave);
        document.getElementById('re-enter-api-key').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); reEnterSave(); }
        });

        // Memories panel
        const memoriesPanel = document.getElementById('memories-panel');
        const settingsModal = document.getElementById('settings-modal');
        const backdrop = document.getElementById('modal-backdrop');

        document.getElementById('memories-button').addEventListener('click', () => {
            this.loadMemories();
            memoriesPanel.classList.add('active');
            backdrop.classList.add('active');
        });

        document.getElementById('settings-button').addEventListener('click', () => {
            settingsModal.classList.add('active');
            backdrop.classList.add('active');
        });

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

        // Chat
        const chatInput = document.getElementById('chat-input');
        document.getElementById('chat-send').addEventListener('click', () => this.sendChat());
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChat();
            }
        });

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

        // Quick Capture
        document.getElementById('quick-capture-btn').addEventListener('click', () => {
            document.getElementById('quick-capture-modal').classList.add('active');
            backdrop.classList.add('active');
        });
        document.getElementById('close-quick-capture').addEventListener('click', () => {
            document.getElementById('quick-capture-modal').classList.remove('active');
            backdrop.classList.remove('active');
        });
        document.getElementById('save-quick-capture').addEventListener('click', async () => {
            const title = document.getElementById('quick-capture-title').value.trim();
            const text = document.getElementById('quick-capture-text').value.trim();
            if (!text) {
                this.showToast('Please enter something to save.');
                return;
            }
            await this.db.addMemory({ title: title || text.substring(0, 30), text: text, tags: ['quick-capture'], date: Date.now() });
            document.getElementById('quick-capture-title').value = '';
            document.getElementById('quick-capture-text').value = '';
            document.getElementById('quick-capture-modal').classList.remove('active');
            backdrop.classList.remove('active');
            this.showToast('Thought saved!');
        });

        // Mood Check
        document.getElementById('mood-check-btn').addEventListener('click', () => {
            document.getElementById('mood-check-modal').classList.add('active');
            backdrop.classList.add('active');
        });
        document.getElementById('close-mood-check').addEventListener('click', () => {
            document.getElementById('mood-check-modal').classList.remove('active');
            backdrop.classList.remove('active');
        });
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const mood = e.target.dataset.mood;
                const moodText = e.target.textContent;
                await this.db.addMemory({ title: `Mood check-in: ${moodText}`, text: `Feeling: ${moodText} ${mood}`, tags: ['mood-check'], emotion: moodText.toLowerCase(), date: Date.now() });
                document.getElementById('mood-check-modal').classList.remove('active');
                backdrop.classList.remove('active');
                this.showToast(`Mood saved: ${mood}`);
            });
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
        div.textContent = 'Thinking...';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        let reply = '';
        try {
            const mems = await this.db.getAllMemories();
            const convs = await this.db.getConversations();

            // If in local mode, directly use local assistant
            if (this.isLocalMode) {
                console.log("Linen: Currently in local mode. Using LocalAssistant.");
                reply = await this.assistant.chat(msg);
            } else {
                // Try GeminiAssistant
                console.log("Linen: Attempting to use GeminiAssistant.");
                if (!initialMessage && this.assistant.detectCrisis(msg)) {
                    this.showCrisisModal();
                }
                reply = await this.assistant.chat(msg, convs, mems, id);
            }

            document.getElementById(id)?.remove();

            // Parse and strip memory markers (only if using GeminiAssistant)
            if (!this.isLocalMode) {
                const memoryMarker = /\[SAVE_MEMORY:\s*(.*?)\]/s;
                const match = reply.match(memoryMarker);
                if (match) {
                    reply = reply.replace(memoryMarker, '').trim();
                    try {
                        const memData = JSON.parse(match[1]);
                        await this.db.addMemory({ ...memData, date: Date.now() });
                    } catch (e) {
                        console.error('Failed to parse memory:', e);
                    }
                }
            }

            // Filter happy emojis from replies to distressed users
            if (!this.isLocalMode && !initialMessage) {
                reply = this.filterEmojis(reply, msg);
            }

            const rdiv = document.createElement('div');
            rdiv.className = 'assistant-message';
            rdiv.textContent = reply;
            container.appendChild(rdiv);
            container.scrollTop = container.scrollHeight;

            if (!initialMessage) {
                await this.db.addConversation({ text: msg, sender: 'user', date: Date.now() });
            }
            await this.db.addConversation({ text: reply, sender: 'assistant', date: Date.now() });

            if (this.trialMode) {
                this.trialCount++;
                if (this.trialCount >= 3) {
                    const backdrop = document.getElementById('modal-backdrop');
                    const limitModal = document.getElementById('trial-limit-modal');
                    if (limitModal) {
                        limitModal.classList.add('active');
                        backdrop.classList.add('active');
                    }
                }
            }

        } catch (e) {
            document.getElementById(id)?.remove();
            const msgText = e.message || '';
            const status = e.status || 0;
        
            console.error(`Linen: sendChat failed (Status: ${status}, Message: ${msgText}). Attempting fallback to LocalAssistant.`, e);
        
            // Determine if we should fall back to LocalAssistant
            const canFallback = (status === 0 && !navigator.onLine) || // Offline
                                (status === 429) || // Rate limited
                                (status === 403 && msgText.toLowerCase().includes('quota')) || // Quota exceeded
                                (msgText.includes('API key not configured')); // No API key
        
            if (canFallback && !this.isLocalMode) {
                console.log("Linen: Falling back to LocalAssistant.");
                this.assistant = new LocalAssistant();
                this.isLocalMode = true;
                const localReply = await this.assistant.chat(msg);
                const rdiv = document.createElement('div');
                rdiv.className = 'assistant-message';
                rdiv.textContent = localReply;
                container.appendChild(rdiv);
                container.scrollTop = container.scrollHeight;
                
                // Show toast based on why we switched
                if (msgText.includes('API key not configured') || this.trialMode) {
                    this.showToast("Using local assistant for free trial.");
                } else {
                    this.showToast("API temporarily unavailable. Using local assistant.");
                }
                if (!initialMessage) {
                    await this.db.addConversation({ text: msg, sender: 'user', date: Date.now() });
                }
                await this.db.addConversation({ text: localReply, sender: 'assistant', date: Date.now() });

            } else if (canFallback && this.isLocalMode) {
                 // Already in local mode, just respond with local assistant's reply
                 console.log("Linen: Already in local mode. LocalAssistant responding to error.");
                 const localReply = await this.assistant.chat(msg);
                 const rdiv = document.createElement('div');
                 rdiv.className = 'assistant-message error-message';
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
    async clearChatHistory() {
        if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) return;
        await this.db.clearConversations();
        this.loadChatHistory();
        this.showToast('Chat history cleared.');
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
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click event
                // TODO: Implement edit functionality (e.g., show an edit modal)
                alert('Edit functionality coming soon!');
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