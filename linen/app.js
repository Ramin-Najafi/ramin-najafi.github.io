/**
 * LINEN - Personal Memory App with Smart Personal Assistant AI
 * Core: Memory support, reminders, mental health, companionship
 * Offline-first using IndexedDB, installable as PWA
 */

// ============================================
// DATABASE INITIALIZATION
// ============================================

class LinenDB {
    constructor() {
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('linen-db', 2);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('memories')) {
                    const store = db.createObjectStore('memories', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('emotion', 'emotion', { unique: false });
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

    // Memory operations
    async addMemory(memory) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            const request = store.add(memory);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllMemories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readonly');
            const store = transaction.objectStore('memories');
            const request = store.getAll();
            request.onsuccess = () => {
                const memories = request.result.sort((a, b) => b.date - a.date);
                resolve(memories);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteMemory(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Conversation operations
    async addConversation(message) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');
            const request = store.add(message);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getConversations() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');
            const request = store.getAll();
            request.onsuccess = () => {
                const convos = request.result.sort((a, b) => a.date - b.date);
                resolve(convos);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Settings operations
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    }

    async setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllMemories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories', 'conversations'], 'readwrite');
            transaction.objectStore('memories').clear();
            transaction.objectStore('conversations').clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async exportData() {
        const memories = await this.getAllMemories();
        const conversations = await this.getConversations();
        return JSON.stringify({ memories, conversations }, null, 2);
    }
}

// ============================================
// GEMINI SMART ASSISTANT
// ============================================

class GeminiAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gemini-2.0-flash';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async chat(userMessage, conversationHistory, memories, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(memories);
        const conversationContext = this.buildConversationContext(conversationHistory);

        const systemPrompt = `You are Linen, a smart personal assistant. You are warm, genuine, and proactive.
Your roles:

COMPANION: You are a caring presence. You greet the user, remember life details, celebrate wins, and check in on struggles.

MEMORY ASSISTANT: Help the user recall past events, people, and decisions. Summarize patterns across memories naturally.

MENTAL HEALTH SUPPORT: Recognize distress, anxiety, sadness, or crisis. Listen first, validate feelings, and offer grounding techniques. If the user mentions self-harm, express care and suggest local crisis lines.

REMINDERS AND PLANNING: Help with upcoming events, appointments, deadlines, or tasks. Reference previous relevant memories to aid decision-making.

Tone rules:
- Warm, concise, honest
- Match user's energy
- Use user's name if known
- Non-preachy, non-judgmental

Context rules:
- Use memories and conversation history naturally
- Reference memories like a friend: "Didn't you mention..." or "Last time you talked about..."
- If no relevant memory, respond helpfully using general knowledge`;

        const messages = [
            ...conversationContext,
            { role: 'user', parts: [{ text: `${memoryContext}\n\nUser: ${userMessage}` }] }
        ];

        try {
            const response = await fetch(
                `${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: messages,
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();
            const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!assistantMessage) throw new Error('No response from assistant');

            return assistantMessage;
        } catch (error) {
            const loadingMessageElement = document.getElementById(loadingId);
            if (loadingMessageElement) loadingMessageElement.remove();
            throw error;
        }
    }

    buildMemoryContext(memories) {
        if (!memories || memories.length === 0) return 'No memories yet.';

        const recentMemories = memories.slice(0, 25);
        let context = 'Recent memories:\n';
        recentMemories.forEach(mem => {
            const date = new Date(mem.date).toLocaleDateString();
            const emotion = mem.emotion ? ` (felt ${mem.emotion})` : '';
            const tags = mem.tags?.length ? ` [${mem.tags.join(', ')}]` : '';
            context += `- ${date}: ${mem.text.substring(0, 250)}${mem.text.length > 250 ? '...' : ''}${emotion}${tags}\n`;
        });

        return context;
    }

    buildConversationContext(conversationHistory) {
        if (!conversationHistory || conversationHistory.length === 0) return [];
        return conversationHistory.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
    }
}

// ============================================
// MAIN APP
// ============================================

class Linen {
    constructor() {
        this.db = new LinenDB();
        this.assistant = null;
        this.currentView = 'capture';
        this.selectedEmotion = '';
        this.init();
    }

    static exampleMemories = [
        { text: "Had a great conversation with a friend. Feeling happy and connected.", emotion: "grateful", tags: ["friend", "chat"] },
        { text: "Finished coding a tricky bug. Felt proud.", emotion: "proud", tags: ["coding", "bugfix"] },
        { text: "Started learning a new skill. Excited but confused.", emotion: "confused", tags: ["learning"] },
        { text: "Read a mindfulness book. Feeling calm and grateful.", emotion: "grateful", tags: ["book", "mindfulness"] }
    ];

    async init() {
        await this.db.init();
        const apiKey = await this.db.getSetting('gemini-api-key');
        if (apiKey) this.assistant = new GeminiAssistant(apiKey);

        this.setupEventListeners();
        this.registerServiceWorker();
        await this.loadMemories();
        await this.loadConversations();
        await this.updateMemoryCount();

        if (!apiKey) {
            document.getElementById('tutorial-overlay').style.display = 'flex';
            this.switchView(document.querySelector('.nav-item[data-view="settings"]'));
        }
    }

    // Event listeners, view management, capture, chat, memories, settings...
    // (Retain all previous functionality with escapeHTML, showToast, deleteMemory, saveApiKey, exportData, etc.)
    // Only the chat behavior has been enhanced to make AI a true companion with memory and mental health support
    // Service Worker registration and offline IndexedDB functionality remains unchanged

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new Linen(); });