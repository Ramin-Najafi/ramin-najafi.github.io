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
        return new Promise((r, j) => {
            const t = this.db.transaction(['settings'], 'readonly');
            const s = t.objectStore('settings');
            const req = s.get(key);
            req.onsuccess = () => r(req.result?.value ?? null);
            req.onerror = () => j(req.error);
        });
    }
    async setSetting(key, val) {
        return new Promise((r, j) => {
            const t = this.db.transaction(['settings'], 'readwrite');
            const s = t.objectStore('settings');
            const req = s.put({ key, value: val });
            req.onsuccess = () => r();
            req.onerror = () => j(req.error);
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
    async exportData() {
        const m = await this.getAllMemories();
        const c = await this.getConversations();
        return JSON.stringify({ memories: m, conversations: c }, null, 2);
    }
}

class GeminiAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gemini-2.0-flash';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async validateKey() {
        try {
            const res = await fetch(
                `${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
                    })
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const status = res.status;
                const msg = err.error?.message || '';

                // 429 = rate limited, 403 can be quota — key is valid, just throttled
                if (status === 429 || (status === 403 && msg.toLowerCase().includes('quota'))) {
                    return { valid: true };
                }
                // 400 with API_KEY_INVALID or 403 without quota = bad key
                if (status === 400 || status === 401 || status === 403) {
                    return { valid: false, error: 'Invalid API key. Please check and try again.' };
                }
                return { valid: false, error: `Something went wrong (HTTP ${status}). Please try again.` };
            }
            return { valid: true };
        } catch (e) {
            return { valid: false, error: 'Network error. Check your internet connection.' };
        }
    }

    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');

        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant. Your primary function is to be a conversational partner that remembers important details about the user's life.

Core Directives:
1. Be a Proactive Companion: Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists.
2. Seamlessly Recall Memories: Reference past memories naturally to show you remember.
3. Identify and Save Memories: When a user shares something meaningful (events, feelings, decisions, people, plans), end your response with:
   [SAVE_MEMORY: { "text": "brief summary", "tags": ["tag1", "tag2"], "emotion": "feeling" }]
4. Do NOT confirm saving in the chat. The app handles this.
5. Handle Memory Queries: If the user asks 'what do you remember about X', search the memory context and answer.
6. Offer Support: If you detect distress, offer gentle support. For crises, refer to crisis lines.
7. Tone: Be warm, genuine, concise, and match the user's tone.`;

        const messages = [
            ...conversationContext,
            { role: 'user', parts: [{ text: `${memoryContext}\n\nUser: ${msg}` }] }
        ];

        try {
            const res = await fetch(
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

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || 'API request failed');
                error.status = res.status;
                throw error;
            }

            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));
    }
}

class Linen {
    constructor() {
        this.db = new LinenDB();
        this.assistant = null;
        this._onboardingBound = false;
        this._eventsBound = false;
    }

    async init() {
        try {
            await this.db.init();
            const apiKey = await this.db.getSetting('gemini-api-key');

            if (!apiKey) {
                this.showOnboarding();
            } else {
                const assistant = new GeminiAssistant(apiKey);
                const result = await assistant.validateKey();
                if (result.valid) {
                    this.startApp(apiKey);
                } else {
                    this.showOnboarding(`Your saved API key is invalid: ${result.error}`);
                }
            }
        } catch (e) {
            console.error('Init error:', e);
            this.showOnboarding('Something went wrong during startup. Please enter your API key.');
        }
    }

    async startApp(apiKey) {
        this.assistant = new GeminiAssistant(apiKey);
        document.getElementById('onboarding-overlay').style.display = 'none';
        document.getElementById('re-enter-key-modal').classList.remove('active');
        document.getElementById('modal-backdrop').classList.remove('active');
        this.bindEvents();
        await this.loadChatHistory();
    }

    showOnboarding(errorMsg = '') {
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
        document.getElementById('memory-search').addEventListener('input', (e) => this.loadMemories(e.target.value));
    }

    async validateAndSaveKey(inputId, errorId, onSuccess) {
        const input = document.getElementById(inputId);
        const errorEl = document.getElementById(errorId);
        const key = input.value.trim();

        if (!key) {
            errorEl.textContent = 'Please enter an API key.';
            return;
        }

        errorEl.textContent = 'Validating...';

        const tempAssistant = new GeminiAssistant(key);
        const result = await tempAssistant.validateKey();

        if (result.valid) {
            await this.db.setSetting('gemini-api-key', key);
            this.assistant = tempAssistant;
            errorEl.textContent = '';
            onSuccess();
        } else {
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

        try {
            const mems = await this.db.getAllMemories();
            const convs = await this.db.getConversations();
            let reply = await this.assistant.chat(msg, convs, mems, id);

            document.getElementById(id)?.remove();

            // Parse and strip memory markers
            const memoryMarker = /\[SAVE_MEMORY:\s*(.*?)\]/s;
            const match = reply.match(memoryMarker);
            if (match) {
                reply = reply.replace(memoryMarker, '').trim();
                try {
                    const memData = JSON.parse(match[1]);
                    await this.db.addMemory({ ...memData, date: Date.now() });
                    this.showToast('Memory saved');
                } catch (e) {
                    console.error('Failed to parse memory:', e);
                }
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

        } catch (e) {
            document.getElementById(id)?.remove();
            if (e.status === 400 || e.status === 403) {
                document.getElementById('re-enter-key-modal').classList.add('active');
                document.getElementById('modal-backdrop').classList.add('active');
            } else {
                const ediv = document.createElement('div');
                ediv.className = 'assistant-message';
                ediv.textContent = "Sorry, I couldn't connect. Please check your internet connection.";
                container.appendChild(ediv);
            }
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
        if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) return;
        await this.db.clearAllMemories();
        await this.db.setSetting('gemini-api-key', null);
        await this.db.setSetting('onboarding-complete', false);
        window.location.reload();
    }

    async loadMemories(filter = '') {
        const memories = await this.db.getAllMemories();
        const memoriesList = document.getElementById('memories-list');
        memoriesList.innerHTML = '';

        const filtered = memories.filter(mem => {
            const s = filter.toLowerCase();
            if (!s) return true;
            return mem.text.toLowerCase().includes(s) ||
                (mem.tags && mem.tags.some(tag => tag.toLowerCase().includes(s)));
        });

        if (filtered.length === 0) {
            memoriesList.innerHTML = '<p class="empty-state">No memories yet.</p>';
            return;
        }

        filtered.forEach(mem => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.innerHTML = `
                <p class="memory-text">${mem.text}</p>
                <p class="memory-meta">
                    ${mem.emotion ? `<span class="emotion">${mem.emotion}</span>` : ''}
                    ${mem.tags?.length ? `<span class="tags">${mem.tags.map(t => `#${t}`).join(' ')}</span>` : ''}
                    <span class="date">${new Date(mem.date).toLocaleDateString()}</span>
                </p>
                <button class="delete-memory" data-id="${mem.id}">Delete</button>
            `;
            memoriesList.appendChild(card);
        });

        memoriesList.querySelectorAll('.delete-memory').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await this.db.deleteMemory(parseInt(e.target.dataset.id));
                this.loadMemories(document.getElementById('memory-search').value);
            });
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    try {
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