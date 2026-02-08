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
            }
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('memories')) {
                    const store = db.createObjectStore('memories', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('date', 'date', {unique: false});
                }
                if (!db.objectStoreNames.contains('conversations')) 
                    db.createObjectStore('conversations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', {keyPath: 'key'});
                }
                }
            });
    }
    async addMemory(mem) {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['memories'], 'readwrite');
            const s = t.objectStore('memories');
            const req = s.add(mem);
            req.onsuccess = () => r(req.result);
            req.onerror = () => j(req.error);
        });
    }
    async getAllMemories() {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['memories'], 'readonly');
            const s = t.objectStore('memories');
            const req = s.getAll();
            req.onsuccess = () => r(req.result.sort((a, b) => b.date - a.date));
            req.onerror = () => j(req.error);
        });
    }
    async deleteMemory(id) {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['memories'], 'readwrite');
            const s = t.objectStore('memories');
            const req = s.delete(id);
            req.onsuccess = () => r();
            req.onerror = () => j(req.error);
        });
    }
    async addConversation(msg) {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['conversations'], 'readwrite');
            const s = t.objectStore('conversations');
            const req = s.add(msg);
            req.onsuccess = () => r(req.result);
            req.onerror = () => j(req.error);
        });
    }
    async getConversations() {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['conversations'], 'readonly');
            const s = t.objectStore('conversations');
            const req = s.getAll();
            req.onsuccess = () => r(req.result.sort((a, b) => a.date - b.date));
            req.onerror = () => j(req.error);
        });
    }
    async getSetting(key) {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['settings'], 'readonly');
            const s = t.objectStore('settings');
            const req = s.get(key);
            req.onsuccess = () => r(req.result
                ?.value || null);
            req.onerror = () => j(req.error);
        });
    }
    async setSetting(key, val) {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction(['settings'], 'readwrite');
            const s = t.objectStore('settings');
            const req = s.put({key, value: val});
            req.onsuccess = () => r();
            req.onerror = () => j(req.error);
        });
    }
    async clearAllMemories() {
        return new Promise((r, j) => {
            const t = this
                .db
                .transaction([
                    'memories', 'conversations'
                ], 'readwrite');
            t
                .objectStore('memories')
                .clear();
            t
                .objectStore('conversations')
                .clear();
            t.oncomplete = () => r();
            t.onerror = () => j(t.error);
        });
    }
    async exportData() {
        const m = await this.getAllMemories();
        const c = await this.getConversations();
        return JSON.stringify({
            memories: m,
            conversations: c
        }, null, 2);
    }
}

class GeminiAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gemini-2.0-flash';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    }
    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) 
            throw new Error('API key not configured.');
        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant. You are warm, genuine, and proactive.
COMPANION: greet, celebrate wins, check struggles.
MEMORY ASSISTANT: help recall past events.
MENTAL HEALTH: notice distress, suggest grounding, refer crisis lines.
REMINDERS: help with upcoming events.
Tone: warm, concise, match user.
Context: use memories naturally.`;
        const messages = [
            ...conversationContext, {
                role: 'user',
                parts: [
                    {
                        text: `${memoryContext}\n\nUser: ${msg}`
                    }
                ]
            }
        ];
        try {
            const res = await fetch(`${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: messages,
                    systemInstruction: {
                        parts: [
                            {
                                text: systemPrompt
                            }
                        ]
                    },
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                })
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error
                    ?.message || 'API request failed');
            }
            const data = await res.json();
            const reply = data.candidates
                ?.[0]
                    ?.content
                        ?.parts
                            ?.[0]
                                ?.text;
            if (!reply) 
                throw new Error('No response from assistant');
            return reply;
        } catch (e) {
            document.getElementById(loadingId)
                ?.remove();
            throw e;
        }
    }
    buildMemoryContext(mems) {
        if (!mems || mems.length === 0) 
            return 'No memories yet.';
        let c = 'Recent memories:\n';
        mems
            .slice(0, 25)
            .forEach(m => {
                const d = new Date(m.date).toLocaleDateString();
                const em = m.emotion
                    ? ` (felt ${m.emotion})`
                    : '';
                const tags = m.tags
                    ?.length
                        ? ` [${m
                            .tags
                            .join(',')}]`
                        : '';
                c += `- ${d}: ${m
                    .text
                    .substring(0, 250)}${m
                    .text
                    .length > 250
                    ? '...'
                    : ''}${em}${tags}\n`;
            });
        return c;
    }
    buildConversationContext(chats) {
        if (!chats || chats.length === 0) 
            return [];
        return chats
            .slice(-10)
            .map(m => ({
                role: m.sender === 'user'
                    ? 'user'
                    : 'model',
                parts: [
                    {
                        text: m.text
                    }
                ]
            }));
    }
}

class Linen {
    constructor() {
        this.db = new LinenDB();
        this.assistant = null;
        this.currentView = 'capture-view';
        this.selectedEmotion = '';
        this.init();
    }
    async init() {
        await this
            .db
            .init();
        const apiKey = await this
            .db
            .getSetting('gemini-api-key');
        if (apiKey) 
            this.assistant = new GeminiAssistant(apiKey);
        this.bindEvents();
        this.updateMemoryCount();
        // Set capture-view nav button as active on page load
        document
            .querySelector('[data-view="capture-view"]')
            .classList
            .add('active');
    }
    bindEvents() {
        document
            .querySelectorAll('.bottom-nav button')
            .forEach(b => b.addEventListener('click', e => {
                this.switchView(e.target.dataset.view);
            }));
        document
            .querySelectorAll('.emotion-button')
            .forEach(button => {
                button.addEventListener('click', (e) => {
                    this.selectedEmotion = e.target.dataset.emotion;
                    document
                        .querySelectorAll('.emotion-button')
                        .forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                });
            });
        document
            .getElementById('save-memory')
            .addEventListener('click', () => this.saveMemory());
        document
            .getElementById('chat-send')
            .addEventListener('click', () => this.sendChat());
        document
            .getElementById('save-api-key')
            .addEventListener('click', () => this.saveApiKey());
        document
            .getElementById('export-data')
            .addEventListener('click', () => this.exportData());
        document
            .getElementById('clear-data')
            .addEventListener('click', () => this.clearAll());
        document
            .getElementById('memory-search')
            .addEventListener('input', (e) => this.loadMemories(e.target.value));
    }
    switchView(viewId) {
        document
            .querySelectorAll('.view')
            .forEach(v => v.classList.remove('active'));
        document
            .querySelector(`#${viewId}`)
            .classList
            .add('active');
        document
            .querySelectorAll('.bottom-nav button')
            .forEach(b => b.classList.remove('active'));
        document
            .querySelector(`[data-view="${viewId}"]`)
            .classList
            .add('active');

        if (viewId === 'memories-view') {
            this.loadMemories();
        }
    }
    async saveMemory() {
        const text = document
            .getElementById('memory-text')
            .value
            .trim();
        const tags = document
            .getElementById('memory-tags')
            .value
            .split(',')
            .map(t => t.trim())
            .filter(t => t);
        const emotion = this.selectedEmotion;
        if (!text) 
            return;
        await this
            .db
            .addMemory({
                text,
                tags,
                emotion,
                date: Date.now()
            });
        document
            .getElementById('memory-text')
            .value = '';
        document
            .getElementById('memory-tags')
            .value = '';
        this.selectedEmotion = '';
        this.updateMemoryCount();
    }
    async sendChat() {
        const input = document.getElementById('chat-input');
        const msg = input
            .value
            .trim();
        if (!msg || !this.assistant) 
            return;
        input.value = '';
        const mems = await this
            .db
            .getAllMemories();
        const convs = await this
            .db
            .getConversations();
        const container = document.getElementById('chat-messages');

        // Display user message
        const userDiv = document.createElement('div');
        userDiv.className = 'user-message';
        userDiv.textContent = msg;
        container.appendChild(userDiv);

        const id = 'loading-msg';
        const div = document.createElement('div');
        div.id = id;
        div.className = 'assistant-message';
        div.textContent = 'Thinking...';
        container.appendChild(div);
        try {
            const reply = await this
                .assistant
                .chat(msg, convs, mems, id);
            document.getElementById(id)
                ?.remove();
            const rdiv = document.createElement('div');
            rdiv.className = 'assistant-message';
            rdiv.textContent = reply;
            container.appendChild(rdiv);
            await this
                .db
                .addConversation({
                    text: msg,
                    sender: 'user',
                    date: Date.now()
                });
            await this
                .db
                .addConversation({
                    text: reply,
                    sender: 'assistant',
                    date: Date.now()
                });
        } catch (e) {
            document.getElementById(id)
                ?.remove();
        }
    }
    async saveApiKey() {
        const key = document
            .getElementById('api-key-input')
            .value
            .trim();
        if (!key) 
            return;
        await this
            .db
            .setSetting('gemini-api-key', key);
        this.assistant = new GeminiAssistant(key);
        document
            .getElementById('api-key-input')
            .value = '';
    }
    async exportData() {
        const data = await this
            .db
            .exportData();
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linen-data-${Date.now()}.json`;
        document
            .body
            .appendChild(a);
        a.click();
        document
            .body
            .removeChild(a);
    }
    async clearAll() {
        await this
            .db
            .clearAllMemories();
        this.updateMemoryCount();
        document
            .getElementById('memories-list')
            .innerHTML = 'No memories yet.';
    }
    async updateMemoryCount() {
        const memories = await this
            .db
            .getAllMemories();
        const countElement = document.getElementById('memory-count');
        if (countElement) {
            countElement.textContent = memories.length.toString();
        }
    }
    async loadMemories(filter = '') {
        const memories = await this
            .db
            .getAllMemories();
        const memoriesList = document.getElementById('memories-list');
        memoriesList.innerHTML = ''; // Clear existing memories

        const filteredMemories = memories.filter(mem => {
            const searchText = filter.toLowerCase();
            return mem.text.toLowerCase().includes(searchText) ||
                   mem.tags.some(tag => tag.toLowerCase().includes(searchText));
        });

        if (filteredMemories.length === 0) {
            memoriesList.innerHTML = '<p>No memories yet.</p>';
            return;
        }

        filteredMemories.forEach(mem => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.innerHTML = `
                <p>${mem.text}</p>
                <p class="memory-meta">
                    ${mem.emotion ? `<span class="emotion">${mem.emotion}</span>` : ''}
                    ${mem.tags.length ? `<span class="tags">${mem.tags.map(tag => `#${tag}`).join(' ')}</span>` : ''}
                    <span class="date">${new Date(mem.date).toLocaleDateString()}</span>
                </p>
                <button class="delete-memory" data-id="${mem.id}">Delete</button>
            `;
            memoriesList.appendChild(card);
        });

        document.querySelectorAll('.delete-memory').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                await this.db.deleteMemory(id);
                this.loadMemories();
                this.updateMemoryCount();
            });
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator
            .serviceWorker
            .register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered! Scope:', registration.scope);

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                                // New service worker activated, reload page to load new content
                                console.log('New Service Worker activated. Reloading page...');
                                window.location.reload();
                            } else if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker installed, but waiting. Send skipWaiting message.
                                console.log('New Service Worker installed. Sending SKIP_WAITING...');
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    window.app = new Linen();
});