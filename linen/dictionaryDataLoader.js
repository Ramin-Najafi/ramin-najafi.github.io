/**
 * Dictionary Data Loader — Async Data Management for Dictionary Engine
 * Handles fetching, caching, and incremental loading with progress tracking
 */

class DictionaryDataLoader {
    static async fetchDictionary(url = '/linen/dictionaries/core-dictionary.json') {
        try {
            console.log('DictionaryDataLoader: Fetching dictionary from', url);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`DictionaryDataLoader: Successfully loaded ${data.words?.length || 0} words`);
            return data;
        } catch (error) {
            console.error('DictionaryDataLoader: Failed to fetch dictionary', error);
            throw error;
        }
    }

    /**
     * Load dictionary incrementally (for large dictionaries)
     * Yields progress events
     */
    static async *loadIncrementally(url, batchSize = 100) {
        const data = await this.fetchDictionary(url);
        const words = data.words || [];

        for (let i = 0; i < words.length; i += batchSize) {
            const batch = words.slice(i, i + batchSize);
            yield {
                batch,
                progress: (i + batch.length) / words.length,
                loaded: i + batch.length,
                total: words.length
            };
        }
    }

    /**
     * Validate dictionary data structure
     */
    static validateDictionary(data) {
        if (!data || !Array.isArray(data.words)) {
            throw new Error('Invalid dictionary structure: missing words array');
        }

        const errors = [];
        data.words.forEach((word, idx) => {
            if (!word.word) errors.push(`Word ${idx} missing 'word' field`);
            if (!word.definition) errors.push(`Word ${idx} missing 'definition' field`);
        });

        if (errors.length > 0) {
            console.warn('Dictionary validation warnings:', errors);
        }

        return errors.length === 0;
    }

    /**
     * Compress dictionary data for storage
     * Uses JSON with reduced field names
     */
    static compressDictionary(data) {
        if (!data || !data.words) return null;

        // Compress to minimal representation
        return data.words.map(w => ({
            w: w.word,
            d: w.definition,
            p: w.pos || 'n',
            f: w.frequency || 0,
            s: w.synonyms || [],
            a: w.antonyms || [],
            r: w.related || []
        }));
    }

    /**
     * Decompress dictionary data
     */
    static decompressDictionary(compressed) {
        if (!Array.isArray(compressed)) return null;

        return {
            words: compressed.map(c => ({
                word: c.w,
                definition: c.d,
                pos: c.p,
                frequency: c.f,
                synonyms: c.s,
                antonyms: c.a,
                related: c.r
            }))
        };
    }

    /**
     * Calculate storage size estimate
     */
    static estimateSize(data) {
        if (!data || !data.words) return 0;

        const jsonString = JSON.stringify(data);
        return {
            uncompressed: jsonString.length,
            estimatedCompressed: Math.round(jsonString.length * 0.4), // ~40% with gzip
            wordCount: data.words.length,
            avgPerWord: Math.round(jsonString.length / data.words.length)
        };
    }

    /**
     * Check if dictionary is available offline
     */
    static async isAvailableOffline(lindenDB) {
        try {
            const cached = await lindenDB.getSetting('dictionary-loaded');
            return cached === 'true';
        } catch (error) {
            return false;
        }
    }

    /**
     * Warm up dictionary cache in background
     */
    static async warmCache(lindenDB, dictionaryEngine) {
        try {
            // Pre-load most common words to IndexedDB
            const commonWords = [
                'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
                'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
                'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
                'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
                'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
                'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
                'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
                'take', 'people', 'into', 'year', 'your', 'good', 'some',
                'could', 'them', 'see', 'other', 'than', 'then', 'now',
                'look', 'only', 'come', 'its', 'over', 'think', 'also',
                'back', 'after', 'use', 'two', 'how', 'our', 'work',
                'first', 'well', 'way', 'even', 'new', 'want', 'because',
                'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was'
            ];

            const warmupData = [];
            for (const word of commonWords) {
                const definition = dictionaryEngine.lookup(word);
                if (definition) {
                    warmupData.push({ word, ...definition });
                }
            }

            // Store warm cache
            if (warmupData.length > 0) {
                await lindenDB.setSetting('common-words-cache', JSON.stringify(warmupData));
            }

            console.log(`DictionaryDataLoader: Warmed cache with ${warmupData.length} common words`);
        } catch (error) {
            console.warn('DictionaryDataLoader: Cache warming failed (non-critical)', error);
        }
    }

    /**
     * Get dictionary statistics
     */
    static getStatistics(data) {
        if (!data || !data.words) {
            return { totalWords: 0, categories: {} };
        }

        const stats = {
            totalWords: data.words.length,
            categories: {},
            frequencyDistribution: { high: 0, medium: 0, low: 0 }
        };

        data.words.forEach(word => {
            const pos = word.pos || 'unknown';
            stats.categories[pos] = (stats.categories[pos] || 0) + 1;

            if (word.frequency >= 8) stats.frequencyDistribution.high++;
            else if (word.frequency >= 6) stats.frequencyDistribution.medium++;
            else stats.frequencyDistribution.low++;
        });

        return stats;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DictionaryDataLoader;
}
