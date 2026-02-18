/**
 * Dictionary Engine — Core Dictionary Functionality for Linen
 * Provides fast lookups, fuzzy matching, and etymology/relationships
 * Optimized for local-first operation with minimal memory footprint
 */

class DictionaryEngine {
    constructor() {
        this.dictionary = new Map(); // word -> definition
        this.bloomFilter = null; // Fast negative lookups
        this.index = new Map(); // prefix -> word list (for autocomplete)
        this.relations = new Map(); // word -> {synonyms, antonyms, related}
        this.initialized = false;
        this.loadingProgress = 0;
    }

    /**
     * Initialize the dictionary engine from IndexedDB or network
     */
    async init(lindenDB) {
        try {
            const cached = await lindenDB.getSetting('dictionary-loaded');
            if (cached === 'true') {
                console.log('Dictionary: Loading from cache...');
                await this.loadFromIndexedDB(lindenDB);
            } else {
                console.log('Dictionary: Initializing fresh dictionary data...');
                await this.loadInitialDictionary();
                await this.saveToIndexedDB(lindenDB);
            }
            this.initialized = true;
            console.log(`Dictionary: Initialized with ${this.dictionary.size} words`);
        } catch (error) {
            console.error('Dictionary: Initialization failed', error);
            // Graceful fallback - continue with empty dictionary
            this.initialized = false;
        }
    }

    /**
     * Load initial dictionary from bundled data
     */
    async loadInitialDictionary() {
        try {
            const response = await fetch('/linen/dictionaries/core-dictionary.json');
            const data = await response.json();

            for (const entry of data.words) {
                this.dictionary.set(entry.word, {
                    definition: entry.definition,
                    partOfSpeech: entry.pos || 'noun',
                    frequency: entry.frequency || 0
                });

                if (entry.synonyms) {
                    this.relations.set(entry.word, {
                        synonyms: entry.synonyms || [],
                        antonyms: entry.antonyms || [],
                        related: entry.related || []
                    });
                }
            }

            // Build prefix index for autocomplete
            this.buildPrefixIndex();

            // Initialize Bloom filter for negative lookups
            this.buildBloomFilter();
        } catch (error) {
            console.error('Dictionary: Failed to load initial dictionary', error);
            throw error;
        }
    }

    /**
     * Quick lookup - O(1) operation
     * Returns definition object or null if not found
     */
    lookup(word) {
        if (!this.initialized) return null;

        const normalized = this.normalizeWord(word);
        return this.dictionary.get(normalized) || null;
    }

    /**
     * Bloom filter lookup - O(1) negative lookups
     * Returns false if definitely not in dictionary, true if maybe
     */
    bloomFilterLookup(word) {
        if (!this.bloomFilter) return true; // Fallback to checking
        const normalized = this.normalizeWord(word);
        return this.bloomFilter.has(normalized);
    }

    /**
     * Fuzzy lookup with typo tolerance
     * Uses Levenshtein distance for close matches
     */
    fuzzyLookup(word, maxDistance = 2) {
        if (!this.initialized) return [];

        const normalized = this.normalizeWord(word);
        const candidates = [];

        for (const [dictWord] of this.dictionary) {
            const distance = this.levenshteinDistance(normalized, dictWord);
            if (distance <= maxDistance) {
                candidates.push({
                    word: dictWord,
                    distance: distance,
                    confidence: 1 - (distance / Math.max(normalized.length, dictWord.length))
                });
            }
        }

        return candidates.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Autocomplete suggestions
     * Returns words starting with prefix
     */
    autocomplete(prefix, limit = 10) {
        if (!this.initialized) return [];

        const normalized = this.normalizeWord(prefix);
        const suggestions = this.index.get(normalized.substring(0, 3)) || [];

        return suggestions
            .filter(word => word.startsWith(normalized))
            .slice(0, limit);
    }

    /**
     * Get synonyms for a word
     */
    getSynonyms(word) {
        const normalized = this.normalizeWord(word);
        const relations = this.relations.get(normalized);
        return relations?.synonyms || [];
    }

    /**
     * Get antonyms for a word
     */
    getAntonyms(word) {
        const normalized = this.normalizeWord(word);
        const relations = this.relations.get(normalized);
        return relations?.antonyms || [];
    }

    /**
     * Get related words
     */
    getRelatedWords(word) {
        const normalized = this.normalizeWord(word);
        const relations = this.relations.get(normalized);
        return relations?.related || [];
    }

    /**
     * Batch lookup for performance
     * Returns array of definitions for array of words
     */
    batchLookup(words) {
        return words.map(word => ({
            word,
            definition: this.lookup(word)
        }));
    }

    /**
     * Build prefix index for autocomplete
     */
    buildPrefixIndex() {
        for (const word of this.dictionary.keys()) {
            const prefix = word.substring(0, 3);
            if (!this.index.has(prefix)) {
                this.index.set(prefix, []);
            }
            this.index.get(prefix).push(word);
        }

        // Sort each prefix group for better suggestions
        for (const words of this.index.values()) {
            words.sort();
        }
    }

    /**
     * Build Bloom filter for O(1) negative lookups
     */
    buildBloomFilter() {
        this.bloomFilter = new Set(this.dictionary.keys());
    }

    /**
     * Levenshtein distance for fuzzy matching
     */
    levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * Normalize word for lookup (lowercase, trim)
     */
    normalizeWord(word) {
        return word.toLowerCase().trim();
    }

    /**
     * Load dictionary from IndexedDB
     */
    async loadFromIndexedDB(lindenDB) {
        try {
            const dictData = await lindenDB.getSetting('dictionary-data');
            const relationsData = await lindenDB.getSetting('dictionary-relations');

            if (dictData && relationsData) {
                const parsed = JSON.parse(dictData);
                const relsParsed = JSON.parse(relationsData);

                this.dictionary = new Map(parsed);
                this.relations = new Map(relsParsed);

                this.buildPrefixIndex();
                this.buildBloomFilter();
            }
        } catch (error) {
            console.error('Dictionary: Failed to load from IndexedDB', error);
            throw error;
        }
    }

    /**
     * Save dictionary to IndexedDB
     */
    async saveToIndexedDB(lindenDB) {
        try {
            const dictData = JSON.stringify(Array.from(this.dictionary));
            const relationsData = JSON.stringify(Array.from(this.relations));

            await lindenDB.setSetting('dictionary-data', dictData);
            await lindenDB.setSetting('dictionary-relations', relationsData);
            await lindenDB.setSetting('dictionary-loaded', 'true');
        } catch (error) {
            console.error('Dictionary: Failed to save to IndexedDB', error);
            // Non-critical - continue without persistence
        }
    }

    /**
     * Get dictionary statistics
     */
    getStats() {
        return {
            totalWords: this.dictionary.size,
            totalRelations: this.relations.size,
            initialized: this.initialized,
            indexSize: this.index.size,
            estimatedMemory: `${(this.dictionary.size * 0.1).toFixed(2)} MB` // Rough estimate
        };
    }
}

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DictionaryEngine;
}
