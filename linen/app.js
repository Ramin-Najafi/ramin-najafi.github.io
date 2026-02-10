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
        // Priority intents — frustration, distress, and referencing back
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
        this.assistant = null; // Will be GeminiAssistant or LocalAssistant
        this.isLocalMode = false;
        this._onboardingBound = false;
        this._eventsBound = false;
        this.trialMode = false;
        this.trialCount = 0;
        this.currentSessionTitle = null;
        this.isNewSession = true;
        this._localModeToastShown = false;
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
                        this.showLocalModeToast(result.error);
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
            this.showLocalModeToast(e.message);
            console.error('Linen: Fatal error during init, starting in local-only mode.', e);
        }
    }

    async startApp(apiKey) {
        console.log("Linen: Starting app.");
        // Only create a new GeminiAssistant if we have an API key AND aren't already in local mode
        if (apiKey && !this.isLocalMode) {
            this.assistant = new GeminiAssistant(apiKey);
        }
        // If no assistant is set at all (shouldn't happen), fallback to local
        if (!this.assistant) {
            console.warn("Linen: No assistant set in startApp, falling back to LocalAssistant.");
            this.assistant = new LocalAssistant();
            this.isLocalMode = true;
        }
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
                if (!initialMessage) {
                    await this.db.addConversation({ text: msg, sender: 'user', date: Date.now() });
                }
                await this.db.addConversation({ text: localReply, sender: 'assistant', date: Date.now() });

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