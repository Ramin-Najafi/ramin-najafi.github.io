/**
 * LINEN - Simplified Memory App with Gemini Assistant
 * Handles: Memories, Chat, Settings, Bottom Navigation
 * IndexedDB offline-first
 */

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
                    const store = db.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('emotion', 'emotion', { unique: false });
                }

                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    addMemory(memory) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('memories', 'readwrite');
            const store = tx.objectStore('memories');
            const req = store.add(memory);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    getAllMemories() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('memories', 'readonly');
            const store = tx.objectStore('memories');
            const req = store.getAll();
            req.onsuccess = () => {
                const memories = req.result.sort((a, b) => b.date - a.date);
                resolve(memories);
            };
            req.onerror = () => reject(req.error);
        });
    }

    clearAllMemories() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['memories', 'conversations'], 'readwrite');
            tx.objectStore('memories').clear();
            tx.objectStore('conversations').clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const req = store.put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    getSetting(key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result?.value || null);
            req.onerror = () => reject(req.error);
        });
    }
}

// ==============================
// Gemini Assistant
// ==============================
class GeminiAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gemini-2.0-flash';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async chat(userMessage, conversationHistory = [], memories = []) {
        if (!this.apiKey) throw new Error('API key not set.');

        const memoryContext = memories.length
            ? memories.slice(0, 10).map(m => `${new Date(m.date).toLocaleDateString()}: ${m.text}`).join('\n')
            : 'No memories yet.';

        const systemPrompt = `You are Linen, a smart personal assistant. Warm, concise, non-judgmental.
        Use user's memories to answer thoughtfully.`;

        const messages = [
            { role: 'user', parts: [{ text: `${memoryContext}\n\nUser: ${userMessage}` }] }
        ];

        try {
            const response = await fetch(`${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: messages,
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'API request failed');
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'I have no response.';
        } catch (err) {
            console.error(err);
            return 'Error contacting assistant.';
        }
    }
}

// ==============================
// Main App
// ==============================
class LinenApp {
    constructor() {
        this.db = new LinenDB();
        this.assistant = null;
        this.selectedEmotion = '';

        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    async init() {
        await this.db.init();

        const apiKey = await this.db.getSetting('gemini-api-key');
        if (apiKey) this.assistant = new GeminiAssistant(apiKey);

        this.cacheDom();
        this.bindEvents();
        await this.loadMemories();
    }

    cacheDom() {
        this.views = document.querySelectorAll('.view');
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.memoryInput = document.getElementById('memory-text');
        this.saveMemoryBtn = document.getElementById('save-memory');
        this.memoriesList = document.getElementById('memories-list');
        this.chatInput = document.getElementById('chat-input');
        this.chatSend = document.getElementById('chat-send');
        this.apiInput = document.getElementById('api-key-input');
        this.saveApiBtn = document.getElementById('save-api-key');
        this.exportBtn = document.getElementById('export-data');
        this.clearBtn = document.getElementById('clear-data');
        this.emotionButtons = document.querySelectorAll('.emotion-btn');
    }

    bindEvents() {
        // Bottom nav
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view, btn));
        });

        // Save memory
        this.saveMemoryBtn.addEventListener('click', () => this.saveMemory());

        // Chat
        this.chatSend.addEventListener('click', () => this.sendChat());
        this.chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.sendChat(); });

        // Emotion buttons
        this.emotionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedEmotion = btn.dataset.emotion;
                this.emotionButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Settings
        this.saveApiBtn.addEventListener('click', () => this.saveApiKey());
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.clearBtn.addEventListener('click', () => this.clearAllMemories());
    }

    switchView(viewId, btn) {
        this.views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        this.navButtons.forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    async saveMemory() {
        const text = this.memoryInput.value.trim();
        if (!text) return alert('Please write something first.');

        const memory = {
            text,
            date: Date.now(),
            emotion: this.selectedEmotion
        };

        await this.db.addMemory(memory);
        this.memoryInput.value = '';
        this.selectedEmotion = '';
        this.emotionButtons.forEach(b => b.classList.remove('active'));

        await this.loadMemories();
    }

    async loadMemories() {
        const memories = await this.db.getAllMemories();
        this.memoriesList.innerHTML = '';

        if (!memories.length) {
            this.memoriesList.innerHTML = '<p>No memories yet.</p>';
            return;
        }

        memories.forEach(mem => {
            const div = document.createElement('div');
            div.className = 'memory-card';
            div.innerHTML = `<strong>${new Date(mem.date).toLocaleString()}</strong>
                             <p>${mem.text}</p>
                             ${mem.emotion ? `<em>Emotion: ${mem.emotion}</em>` : ''}`;
            this.memoriesList.appendChild(div);
        });
    }

    async sendChat() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.addChatMessage('user', message);
        this.chatInput.value = '';

        const memories = await this.db.getAllMemories();

        const response = this.assistant
            ? await this.assistant.chat(message, [], memories)
            : "Assistant not set. Please add API key in Settings.";

        this.addChatMessage('assistant', response);
    }

    addChatMessage(sender, text) {
        const box = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = sender === 'user' ? 'chat-user' : 'chat-assistant';
        div.textContent = text;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    async saveApiKey() {
        const key = this.apiInput.value.trim();
        if (!key) return alert('Enter a valid API key.');

        await this.db.setSetting('gemini-api-key', key);
        this.assistant = new GeminiAssistant(key);
        alert('API key saved.');
    }

    async exportData() {
        const memories = await this.db.getAllMemories();
        const dataStr = JSON.stringify(memories, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'linen_data.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    async clearAllMemories() {
        if (!confirm('Are you sure? This will delete everything.')) return;
        await this.db.clearAllMemories();
        await this.loadMemories();
        alert('All memories cleared.');
    }
}

// ==============================
// Initialize App
// ==============================
let app = new LinenApp();