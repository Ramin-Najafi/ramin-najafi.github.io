/**
 * LINEN - Personal Memory App with AI Assistant
 * Uses Google Gemini API for conversational memory understanding
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

                // Create memories store
                if (!db.objectStoreNames.contains('memories')) {
                    const store = db.createObjectStore('memories', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('emotion', 'emotion', { unique: false });
                }

                // Create conversations store
                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }

                // Create settings store
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

    // Utility
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
// GEMINI API INTEGRATION
// ============================================

class GeminiAssistant {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gemini-1.5-flash';
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async chat(userMessage, conversationHistory, memories, loadingId) {
        if (!this.apiKey) {
            throw new Error('API key not configured. Please add your Gemini API key in Settings.');
        }

        // Build context from memories
        const memoryContext = this.buildMemoryContext(memories);
        const conversationContext = this.buildConversationContext(conversationHistory);

        const systemPrompt = `You are a thoughtful, empathetic personal assistant. Your role is to:
- Listen and remember what users share
- Help them notice patterns in their life
- Support their decision-making without judgment
- Be honest and caring, never dismissive
- Ask clarifying questions when helpful
- Surface insights from their memories when relevant

You have access to their memories and past conversations. Use this context to give personalized, meaningful responses.
Never be preachy or judgmental. Be genuine and supportive.`;

        const messages = [
            ...conversationContext,
            {
                role: 'user',
                parts: [{ text: `${memoryContext}\n\nUser: ${userMessage}` }] // FIX: Changed 'content' to 'parts'
            }
        ];

        try {
            const response = await fetch(
                `${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: messages,
                        systemInstruction: {
                            parts: [{ text: systemPrompt }]
                        },
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024
                        }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();
            const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!assistantMessage) {
                throw new Error('No response from assistant');
            }

            return assistantMessage;
        } catch (error) {
            const loadingMessageElement = document.getElementById(loadingId);
            if (loadingMessageElement) {
                loadingMessageElement.remove();
            }
            this.addChatMessage(`Sorry, I encountered an error: ${error.message}`, 'assistant');
            console.error(error);
        }
    }

    buildMemoryContext(memories) {
        if (!memories || memories.length === 0) {
            return 'No memories yet.';
        }

        const recentMemories = memories.slice(0, 10);
        let context = 'Recent memories:\n';

        recentMemories.forEach(mem => {
            const date = new Date(mem.date).toLocaleDateString();
            const emotion = mem.emotion ? ` (felt ${mem.emotion})` : '';
            const tags = mem.tags?.length ? ` [${mem.tags.join(', ')}]` : '';
            context += `- ${date}: ${mem.text.substring(0, 100)}...${emotion}${tags}\n`;
        });

        return context;
    }

    buildConversationContext(conversationHistory) {
        if (!conversationHistory || conversationHistory.length === 0) {
            return [];
        }

        // Return last 10 exchanges for context
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
        {
            text: "Had a great conversation with John about the project. Feeling excited about the new direction we're taking.",
            emotion: "excited",
            tags: "work, john, decision"
        },
        {
            text: "Spent the afternoon coding, debugging a tricky CSS layout. Felt a bit stressed but proud once it was solved.",
            emotion: "proud",
            tags: "coding, css, debugging"
        },
        {
            text: "Decided to start learning React today. Feeling a mix of excitement and confusion with all the new concepts.",
            emotion: "confused",
            tags: "react, learning, frontend"
        },
        {
            text: "Finished reading a book on mindful productivity. Feeling grateful for new insights and a clearer focus.",
            emotion: "grateful",
            tags: "book, productivity, self-improvement"
        }
    ];

    async init() {
        await this.db.init();
        const apiKey = await this.db.getSetting('gemini-api-key');
        if (apiKey) {
            this.assistant = new GeminiAssistant(apiKey);
        }

        this.setupEventListeners();
        this.registerServiceWorker();
        await this.loadMemories();
        await this.loadConversations();
        await this.updateMemoryCount();

        // Show tutorial if no API key is set
        if (!apiKey) { // Use the already fetched apiKey
            document.getElementById('tutorial-overlay').style.display = 'flex';
            // Also, switch to settings view if tutorial is shown
            this.switchView(document.querySelector('.nav-item[data-view="settings"]'));
        }
    }

    // ============================================
    // MOBILE SIDEBAR / HAMBURGER MENU
    // ============================================

    toggleMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.getElementById('linen-hamburger');
        const body = document.body;

        sidebar.classList.toggle('open');
        hamburger.classList.toggle('open');
        body.classList.toggle('sidebar-open');
    }

    closeMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.getElementById('linen-hamburger');
        const body = document.body;

        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            hamburger.classList.remove('open');
            body.classList.remove('sidebar-open');
        }
    }


    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Hamburger Menu
        const hamburger = document.getElementById('linen-hamburger');
        if (hamburger) {
            hamburger.addEventListener('click', () => this.toggleMobileSidebar());
        }

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            const hamburger = document.getElementById('linen-hamburger');

            if (sidebar && hamburger && sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) &&
                !hamburger.contains(e.target)) {
                this.closeMobileSidebar();
            }
        });
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.closest('.nav-item')));
        });

        // Capture form
        document.getElementById('capture-form').addEventListener('submit', (e) => this.handleCapture(e));

        // Emotion selector
        document.querySelectorAll('.emotion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectEmotion(e.target.closest('.emotion-btn')));
        });

        // Chat
        document.getElementById('chat-send').addEventListener('click', () => this.handleChatSubmit());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatSubmit();
        });

        // Memory search
        document.getElementById('memory-search').addEventListener('input', (e) => this.handleMemorySearch(e.target.value));

        // Settings
        document.getElementById('save-api-key').addEventListener('click', () => this.saveApiKey());
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('clear-data').addEventListener('click', () => this.confirmClearData());

        // Tutorial
        document.getElementById('tutorial-ok').addEventListener('click', () => {
            document.getElementById('tutorial-overlay').style.display = 'none';
        });

        // PWA Install Tutorials
        document.getElementById('select-ios')?.addEventListener('click', () => {
            document.getElementById('os-select-modal').style.display = 'none';
            document.getElementById('ios-tutorial-modal').style.display = 'flex';
        });

        document.getElementById('select-android')?.addEventListener('click', () => {
            document.getElementById('os-select-modal').style.display = 'none';
            document.getElementById('android-tutorial-modal').style.display = 'flex';
        });

        document.getElementById('ios-tutorial-ok')?.addEventListener('click', () => {
            document.getElementById('ios-tutorial-modal').style.display = 'none';
            localStorage.setItem('linen_pwa_install_tutorial_shown', 'true');
        });

        document.getElementById('android-tutorial-ok')?.addEventListener('click', () => {
            document.getElementById('android-tutorial-modal').style.display = 'none';
            localStorage.setItem('linen_pwa_install_tutorial_shown', 'true');
        });
    }

    // ============================================
    // VIEW MANAGEMENT
    // ============================================

    switchView(element) {
        const viewName = element.dataset.view;

        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

        const viewElement = document.getElementById(`${viewName}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        this.currentView = viewName;
        
        // Close sidebar if mobile and open
        if (window.innerWidth <= 768) {
            this.closeMobileSidebar();
        }
    }

    // ============================================
    // CAPTURE
    // ============================================

    async handleCapture(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        const text = document.getElementById('memory-text').value.trim();
        const tagsInput = document.getElementById('memory-tags').value.trim();
        const emotion = this.selectedEmotion;

        if (!text) {
            this.showToast('Please write something before saving');
            return;
        }

        const tags = tagsInput
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);

        const memory = {
            text,
            tags,
            emotion,
            date: new Date().getTime(),
            created: new Date().toLocaleString()
        };

        try {
            await this.db.addMemory(memory);
            this.showToast('Memory saved 💭');

            document.getElementById('capture-form').reset();
            this.selectedEmotion = '';
            document.querySelectorAll('.emotion-btn').forEach(btn => btn.classList.remove('selected'));

            await this.updateMemoryCount();
        } catch (error) {
            this.showToast('Error saving memory');
            console.error(error);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    selectEmotion(button) {
        if (button.classList.contains('selected')) {
            button.classList.remove('selected');
            this.selectedEmotion = '';
        } else {
            document.querySelectorAll('.emotion-btn').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            this.selectedEmotion = button.dataset.emotion;
        }
    }

    // ============================================
    // CHAT
    // ============================================

    async handleChatSubmit() {
        const input = document.getElementById('chat-input');
        const userMessage = input.value.trim();

        if (!userMessage) return;

        if (!this.assistant) {
            this.showToast('Please configure Gemini API key in Settings');
            return;
        }

        // Add user message to chat
        this.addChatMessage(userMessage, 'user');
        input.value = '';

        // Show loading indicator
        const loadingId = this.addChatMessage('Thinking...', 'assistant', true);
        const contextInfo = document.getElementById('chat-context-info');

        try {
            const memories = await this.db.getAllMemories();
            const conversations = await this.db.getConversations();

            if (contextInfo) {
                contextInfo.textContent = `Reading ${memories.length} memories for context...`;
            }

            const assistantResponse = await this.assistant.chat(
                userMessage,
                conversations,
                memories,
                loadingId
            );

            // Remove loading message
            document.getElementById(loadingId)?.remove();

            // Add assistant response
            this.addChatMessage(assistantResponse, 'assistant');

            if (contextInfo) {
                contextInfo.textContent = `Assistant has access to ${memories.length} memories`;
            }


            // Save conversation
            await this.db.addConversation({
                text: userMessage,
                sender: 'user',
                date: new Date().getTime()
            });

            await this.db.addConversation({
                text: assistantResponse,
                sender: 'assistant',
                date: new Date().getTime()
            });

            // Auto-scroll to bottom
            const messagesContainer = document.getElementById('chat-messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            // Fix: loadingId must be removed in catch
            const loadingMessageElement = document.getElementById(loadingId);
            if (loadingMessageElement) {
                loadingMessageElement.remove();
            }
            this.addChatMessage(`Sorry, I encountered an error: ${error.message}`, 'assistant');
            console.error(error);
        }
    }

    addChatMessage(text, sender, isLoading = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        const messageId = 'msg-' + Date.now();
        messageDiv.id = messageId;
        messageDiv.className = `message ${sender}-message`;
        messageDiv.innerHTML = `<p>${this.escapeHTML(text)}</p>`;

        messagesContainer.appendChild(messageDiv);
        return messageId;
    }

    async loadConversations() {
        try {
            const conversations = await this.db.getConversations();
            const messagesContainer = document.getElementById('chat-messages');

            // Clear existing messages except greeting
            const existing = messagesContainer.querySelectorAll('.message');
            if (existing.length > 1) {
                existing.forEach(msg => msg.remove());
            }

            // Reload conversations
            conversations.forEach(msg => {
                this.addChatMessage(msg.text, msg.sender);
            });
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }

    // ============================================
    // MEMORIES
    // ============================================

    async loadMemories() {
        const memoriesList = document.getElementById('memories-list');
        const memories = await this.db.getAllMemories();

        memoriesList.innerHTML = '';

        if (memories.length === 0) {
            const randomIndex = Math.floor(Math.random() * Linen.exampleMemories.length);
            const example = Linen.exampleMemories[randomIndex];
            
            memoriesList.innerHTML = `
                <div class="empty-state">
                    <p>No memories yet</p>
                    <span>Tap the Capture tab to save your first thought, decision, or feeling</span>
                    <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px; text-align: left;">
                        <div style="font-size: 0.875rem; color: #6b6b6b; margin-bottom: 8px;">Example:</div>
                        <div style="color: #2a2a2a;">"${example.text}"</div>
                        <div style="margin-top: 8px; font-size: 0.85rem; color: #a0a0a0;">${this.getEmotionEmoji(example.emotion)} ${example.emotion} · ${example.tags}</div>
                    </div>
                </div>
            `;
            return;
        }

        memories.forEach(memory => {
            memoriesList.appendChild(this.createMemoryCard(memory));
        });
    }

    async handleMemorySearch(query) {
        const memoriesList = document.getElementById('memories-list');
        const memories = await this.db.getAllMemories();

        if (!query.trim()) {
            await this.loadMemories();
            return;
        }

        const queryLower = query.toLowerCase();
        const filtered = memories.filter(memory => {
            const textMatch = memory.text.toLowerCase().includes(queryLower);
            const tagMatch = memory.tags.some(tag => tag.toLowerCase().includes(queryLower));
            return textMatch || tagMatch;
        });

        if (filtered.length === 0) {
            memoriesList.innerHTML = `
                <div class="empty-state">
                    <p>No memories found</p>
                    <span>Try different keywords</span>
                </div>
            `;
        } else {
            memoriesList.innerHTML = '';
            filtered.forEach(memory => {
                memoriesList.appendChild(this.createMemoryCard(memory));
            });
        }
    }

    createMemoryCard(memory) {
        const card = document.createElement('div');
        card.className = 'memory-card';

        const emotionEmoji = this.getEmotionEmoji(memory.emotion);
        const dateString = new Date(memory.date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let tagsHTML = '';
        if (memory.tags && memory.tags.length > 0) {
            tagsHTML = `
                <div class="memory-tags">
                    ${memory.tags.map(tag => `<span class="tag">${this.escapeHTML(tag)}</span>`).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="memory-header">
                <span class="memory-date">${dateString}</span>
                <span class="memory-emotion">${emotionEmoji}</span>
            </div>
            <div class="memory-text">${this.escapeHTML(memory.text)}</div>
            ${tagsHTML}
            <div class="memory-actions">
                <button class="memory-btn" onclick="app.deleteMemory(${memory.id})">Delete</button>
            </div>
        `;

        return card;
    }

    getEmotionEmoji(emotion) {
        const emojis = {
            grateful: '😌',
            stressed: '😰',
            excited: '🤩',
            confused: '🤔',
            proud: '😊',
            regret: '😔'
        };
        return emojis[emotion] || '💭';
    }

    async deleteMemory(id) {
        if (confirm('Delete this memory?')) {
            try {
                await this.db.deleteMemory(id);
                await this.loadMemories();
                await this.updateMemoryCount();
                this.showToast('Memory deleted');
            } catch (error) {
                this.showToast('Error deleting memory');
                console.error(error);
            }
        }
    }

    // ============================================
    // SETTINGS
    // ============================================

    async saveApiKey() {
        const keyInput = document.getElementById('api-key-input');
        const apiKey = keyInput.value.trim();

        if (!apiKey) {
            this.showToast('Please enter an API key');
            return;
        }
        
        // Validate API key format (basic check)
        if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
            this.showToast('Invalid API key format. Should start with AIza');
            return;
        }

        try {
            await this.db.setSetting('gemini-api-key', apiKey);
            this.assistant = new GeminiAssistant(apiKey);
            keyInput.value = '';
            this.showToast('API key saved ✓');
            localStorage.setItem('linen_tutorial_shown', 'true'); // General tutorial dismissed
            document.getElementById('tutorial-overlay').style.display = 'none';

            // Check if PWA install tutorial needs to be shown
            if (!localStorage.getItem('linen_pwa_install_tutorial_shown')) {
                this.showPWAInstallTutorial();
            }
        } catch (error) {
            this.showToast('Error saving API key');
            console.error(error);
        }
    }

    async exportData() {
        try {
            const data = await this.db.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `linen-data-${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Data exported');
        } catch (error) {
            this.showToast('Error exporting data');
            console.error(error);
        }
    }

    confirmClearData() {
        if (confirm('Delete all memories and conversations?') &&
            confirm('This cannot be undone. Are you sure?')) {
            this.clearAllData();
        }
    }

    async clearAllData() {
        try {
            await this.db.clearAllMemories();
            await this.loadMemories();
            await this.loadConversations();
            await this.updateMemoryCount();
            this.showToast('All data cleared');
        } catch (error) {
            this.showToast('Error clearing data');
            console.error(error);
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    showPWAInstallTutorial() {
        document.getElementById('os-select-modal').style.display = 'flex';
    }

    async updateMemoryCount() {
        const memories = await this.db.getAllMemories();
        document.getElementById('memory-count').textContent = memories.length;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered');
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }
}

// ============================================
// INITIALIZE APP
// ============================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new Linen();
});