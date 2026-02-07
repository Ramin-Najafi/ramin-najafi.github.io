/**
 * PERSONAL BUTLER - Application Logic
 * Manages memories, storage, and UI interactions
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
            const request = indexedDB.open('linen-db', 1);

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
                    store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                }
            };
        });
    }

    // Add a new memory
    async addMemory(memory) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            const request = store.add(memory);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get all memories
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

    // Delete a memory
    async deleteMemory(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Export all data
    async exportData() {
        const memories = await this.getAllMemories();
        return JSON.stringify(memories, null, 2);
    }

    // Clear all memories
    async clearAllMemories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// ============================================
// MAIN APP
// ============================================

class Linen {
    constructor() {
        this.db = new LinenDB();
        this.currentView = 'capture';
        this.selectedEmotion = '';
        this.init();
    }

    async init() {
        await this.db.init();
        this.setupEventListeners();
        this.registerServiceWorker();
        await this.loadMemories();
        this.updateMemoryCount();
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
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

        // Recall search
        document.getElementById('recall-input').addEventListener('input', (e) => this.handleRecall(e.target.value));

        // Settings
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('clear-data').addEventListener('click', () => this.confirmClearData());
    }

    // ============================================
    // VIEW MANAGEMENT
    // ============================================

    switchView(element) {
        const viewName = element.dataset.view;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const viewElement = document.getElementById(`${viewName}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        this.currentView = viewName;

        // Clear search when switching away from recall
        if (viewName !== 'recall') {
            document.getElementById('recall-input').value = '';
        }
    }

    // ============================================
    // CAPTURE FUNCTIONALITY
    // ============================================

    async handleCapture(e) {
        e.preventDefault();

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

            // Clear form
            document.getElementById('capture-form').reset();
            this.selectedEmotion = '';
            document.querySelectorAll('.emotion-btn').forEach(btn => {
                btn.classList.remove('selected');
            });

            await this.updateMemoryCount();
        } catch (error) {
            this.showToast('Error saving memory');
            console.error(error);
        }
    }

    selectEmotion(button) {
        // Toggle selection
        if (button.classList.contains('selected')) {
            button.classList.remove('selected');
            this.selectedEmotion = '';
        } else {
            document.querySelectorAll('.emotion-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            button.classList.add('selected');
            this.selectedEmotion = button.dataset.emotion;
        }
    }

    // ============================================
    // RECALL FUNCTIONALITY
    // ============================================

    async handleRecall(query) {
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

    // ============================================
    // MEMORY DISPLAY
    // ============================================

    async loadMemories() {
        const memoriesList = document.getElementById('memories-list');
        const memories = await this.db.getAllMemories();

        memoriesList.innerHTML = '';

        if (memories.length === 0) {
            memoriesList.innerHTML = `
                <div class="empty-state">
                    <p>Your memories will appear here</p>
                    <span>Start by capturing something in the Capture tab</span>
                </div>
            `;
            return;
        }

        memories.forEach(memory => {
            memoriesList.appendChild(this.createMemoryCard(memory));
        });
    }

    createMemoryCard(memory) {
        const card = document.createElement('div');
        card.className = 'memory-card';

        const emotionEmoji = this.getEmotionEmoji(memory.emotion);
        const dateString = new Date(memory.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
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
    // MEMORY MANAGEMENT
    // ============================================

    async updateMemoryCount() {
        const memories = await this.db.getAllMemories();
        document.getElementById('memory-count').textContent = memories.length;
    }

    async exportData() {
        try {
            const data = await this.db.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `butler-memories-${new Date().getTime()}.json`;
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
        if (confirm('Are you sure? This will delete all memories permanently.') &&
            confirm('This cannot be undone. Are you absolutely sure?')) {
            this.clearAllMemories();
        }
    }

    async clearAllMemories() {
        try {
            await this.db.clearAllMemories();
            await this.loadMemories();
            await this.updateMemoryCount();
            this.showToast('All memories cleared');
        } catch (error) {
            this.showToast('Error clearing memories');
            console.error(error);
        }
    }

    // ============================================
    // UI UTILITIES
    // ============================================

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

    // ============================================
    // SERVICE WORKER
    // ============================================

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
