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
    async validateKey() {
        console.log("Validating key...");
        try {
            const res = await fetch(`${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
                })
            });
            console.log("Key validation result:", res.ok);
            return res.ok;
        } catch (e) {
            console.error("Key validation failed:", e);
            return false;
        }
    }
    async chat(msg, chats, mems, loadingId) {
        if (!this.apiKey) throw new Error('API key not configured.');
        
        const memoryContext = this.buildMemoryContext(mems);
        const conversationContext = this.buildConversationContext(chats);
        const systemPrompt = `You are Linen, a smart personal assistant. Your primary function is to be a conversational partner that remembers important details about the user's life.

Core Directives:
1.  **Be a Proactive Companion:** Greet the user warmly. If it's the very first message ever ([INITIAL_GREETING]), introduce yourself warmly like a new friend: "Hey there! I'm Linen — think of me as a friend with a perfect memory. Tell me about your day, what's on your mind, or anything you want to remember. I'm all ears." Otherwise, if it's a new day, ask about their day and reference a recent memory if one exists.
2.  **Seamlessly Recall Memories:** Reference past memories naturally to show you remember. For example, 'How is project X going? I remember you were feeling stressed about it last week.'
3.  **Identify and Save Memories:** Your most important job is to identify when a user shares something meaningful that should be remembered. This includes events, feelings, decisions, people, plans, likes/dislikes, or personal details.
4.  **Use the SAVE_MEMORY Marker:** When you identify a memory, you MUST end your conversational response with a special marker on a new line:
    [SAVE_MEMORY: { "text": "A brief summary of the memory.", "tags": ["tag1", "tag2"], "emotion": "feeling" }]
    - "text" is a concise summary of what to remember.
    - "tags" is an array of relevant keywords.
    - "emotion" is a single word describing the user's feeling (e.g., 'happy', 'stressed', 'excited').
    - Example: [SAVE_MEMORY: { "text": "User is starting a new personal project to learn pottery.", "tags": ["pottery", "hobbies", "learning"], "emotion": "excited" }]
5.  **Do NOT confirm saving in the chat.** The app will handle this. Just include the marker.
6.  **Handle Memory Queries:** If the user asks 'what do you remember about X', search the provided memory context and synthesize an answer. Do not use the SAVE_MEMORY marker for this.
7.  **Offer Support:** If you detect distress, offer gentle support. If the user mentions a crisis, refer them to a crisis line.
8.  **Tone:** Be warm, genuine, concise, and match the user's tone.`;
        
        const messages = [...conversationContext, { role: 'user', parts: [{ text: `${memoryContext}\n\nUser: ${msg}` }] }];

        try {
            const res = await fetch(`${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: messages,
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
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
        this.init();
    }
    
    async init() {
        console.log("App initializing...");
        await this.db.init();
        
        const apiKey = await this.db.getSetting('gemini-api-key');
        console.log("Checking for API key...");
        
        if (!apiKey) {
            console.log("No API key found. Starting onboarding.");
            this.showOnboarding();
        } else {
            console.log("API key found. Validating...");
            const assistant = new GeminiAssistant(apiKey);
            const isValid = await assistant.validateKey();
            if (isValid) {
                console.log("API key is valid. Starting app.");
                this.startApp(apiKey);
            } else {
                console.log("Saved API key is invalid. Starting onboarding.");
                this.showOnboarding('Your saved API key is invalid. Please enter a new one.');
            }
        }
    }

    async startApp(apiKey) {
        this.assistant = new GeminiAssistant(apiKey);
        document.getElementById('onboarding-overlay').style.display = 'none';
        document.getElementById('re-enter-key-modal').classList.remove('active');
        document.getElementById('modal-backdrop').classList.remove('active');
        this.bindEvents();
        await this.loadChatHistory();
        console.log("App started successfully.");
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
        document.querySelectorAll('#onboarding-wizard .step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step-${stepNum}`).classList.add('active');
        document.querySelectorAll('.step-indicator .dot').forEach((dot, index) => {
            dot.classList.toggle('active', index <= stepNum - 1);
        });
    }

    bindOnboardingEvents() {
        document.getElementById('get-started').addEventListener('click', () => this.showOnboardingStep(2));
        document.getElementById('save-onboarding-api-key').addEventListener('click', () => this.validateAndSaveKey('onboarding-api-key', 'onboarding-error', async () => {
            const onboardingComplete = await this.db.getSetting('onboarding-complete');
            if (onboardingComplete) {
                this.startApp(this.assistant.apiKey);
            } else {
                this.showOnboardingStep(3)
            }
        }));
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
        this.bindOnboardingEvents();
        
        // Re-enter key
        document.getElementById('save-re-enter-api-key').addEventListener('click', () => this.validateAndSaveKey('re-enter-api-key', 're-enter-error', () => this.startApp(this.assistant.apiKey)));

        // Main App
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
            backdrop.classList.remove('active');
        };
        
        document.getElementById('close-memories').addEventListener('click', closeModal);
        document.getElementById('close-settings-modal').addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);

        const chatInput = document.getElementById('chat-input');
        document.getElementById('chat-send').addEventListener('click', () => this.sendChat());
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChat();
            }
        });

        document.getElementById('save-api-key').addEventListener('click', () => this.saveApiKey());
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('clear-data').addEventListener('click', () => this.clearAll());
        document.getElementById('memory-search').addEventListener('input', (e) => this.loadMemories(e.target.value));
    }
    
    async validateAndSaveKey(inputId, errorId, onSuccess) {
        console.log("Save button clicked.");
        const key = document.getElementById(inputId).value.trim();
        const errorEl = document.getElementById(errorId);
        console.log("Reading API key from input:", key ? "Key present" : "Key is empty");
        if (!key) {
            errorEl.textContent = 'Please enter an API key.';
            return;
        }
        
        const tempAssistant = new GeminiAssistant(key);
        const isValid = await tempAssistant.validateKey();
        
        if (isValid) {
            console.log("Saving key to IndexedDB.");
            await this.db.setSetting('gemini-api-key', key);
            console.log("Initializing GeminiAssistant.");
            this.assistant = tempAssistant;
            errorEl.textContent = '';
            console.log("Advancing to next step.");
            onSuccess();
        } else {
            errorEl.textContent = "This API key didn't work. Please double-check and try again.";
        }
    }

    async loadChatHistory() {
        const container = document.getElementById('chat-messages');
        const convs = await this.db.getConversations();
        container.innerHTML = '';
        if (!convs || convs.length === 0) {
            console.log("No conversation history found. Triggering initial greeting.");
            this.sendChat('[INITIAL_GREETING]');
            return;
        }
        console.log("Loading chat history.");
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
        
        if (!initialMessage) {
            input.value = '';
            const container = document.getElementById('chat-messages');
            const userDiv = document.createElement('div');
            userDiv.className = 'user-message';
            userDiv.textContent = msg;
            container.appendChild(userDiv);
            container.scrollTop = container.scrollHeight;
        }

        const id = 'loading-msg';
        const container = document.getElementById('chat-messages');
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
            
            const memoryMarker = /\[SAVE_MEMORY: (.*)\]/s;
            const match = reply.match(memoryMarker);

            if (match) {
                reply = reply.replace(memoryMarker, '').trim();
                try {
                    const memData = JSON.parse(match[1]);
                    await this.db.addMemory({ ...memData, date: Date.now() });
                    this.showToast('Memory saved');
                } catch (e) {
                    console.error('Failed to parse or save memory:', e);
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
                console.error("API key failed:", e);
                document.getElementById('re-enter-key-modal').classList.add('active');
                document.getElementById('modal-backdrop').classList.add('active');
            } else {
                console.error("Chat error:", e);
                const ediv = document.createElement('div');
                ediv.className = 'assistant-message';
                ediv.textContent = "Sorry, I couldn't connect. Please check your internet connection.";
                container.appendChild(ediv);
            }
        }
    }

    async saveApiKey() {
        await this.validateAndSaveKey('api-key-input', 're-enter-error', () => {
            this.showToast('API Key saved!');
            document.getElementById('api-key-input').value = '';
            document.getElementById('settings-modal').classList.remove('active');
            document.getElementById('modal-backdrop').classList.remove('active');
        });
    }

    async exportData() {
        const data = await this.db.exportData();
        const blob = new Blob([data], {type: 'application/json'});
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

        const filteredMemories = memories.filter(mem => {
            const searchText = filter.toLowerCase();
            return mem.text.toLowerCase().includes(searchText) ||
                   (mem.tags && mem.tags.some(tag => tag.toLowerCase().includes(searchText)));
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
                    ${mem.tags && mem.tags.length ? `<span class="tags">${mem.tags.map(tag => `#${tag}`).join(' ')}</span>` : ''}
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
                this.loadMemories(document.getElementById('memory-search').value);
            });
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js').then(reg => {
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                            window.location.reload();
                        }
                    });
                });
            }).catch(err => console.error('Service worker registration failed:', err));
        }
        window.app = new Linen();
    } catch(e) {
        console.error("Fatal error during app initialization:", e);
    }
});