import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

/**
 * SymbolIndex - Intelligent caching system for code symbols
 * 
 * Benefits:
 * - Avoids repeated Serena MCP calls for same files
 * - Stores symbol hierarchies (classes, methods, functions)
 * - Automatically detects file changes and invalidates cache
 * - Provides fast lookup without MCP overhead
 * - Persists across agent sessions
 */
export class SymbolIndex {
  constructor(knowledgeBase) {
    this.kb = knowledgeBase;
    this.cache = new Map(); // In-memory cache: filePath -> symbolData
    this.fileHashes = new Map(); // filePath -> hash (for change detection)
    this.indexMetadata = {
      lastFullScan: null,
      filesIndexed: 0,
      symbolsCount: 0
    };
  }

  /**
   * Initialize the symbol index from persisted data
   */
  async initialize() {
    try {
      // Load index metadata
      const metadata = await this.kb.retrieve('_symbol_index_metadata');
      if (metadata) {
        this.indexMetadata = JSON.parse(metadata.content);
      }

      // Load file hashes
      const hashes = await this.kb.retrieve('_symbol_file_hashes');
      if (hashes) {
        const hashData = JSON.parse(hashes.content);
        this.fileHashes = new Map(Object.entries(hashData));
      }

      // Load cached symbols into memory
      await this.loadCacheFromKB();
    } catch (error) {
      // First time initialization - no cached data yet
      this.indexMetadata = {
        lastFullScan: null,
        filesIndexed: 0,
        symbolsCount: 0
      };
    }
  }

  /**
   * Load all cached symbols from knowledge base into memory
   */
  async loadCacheFromKB() {
    const symbols = await this.kb.listByCategory('symbols');
    
    for (const symbolEntry of symbols) {
      if (!symbolEntry.name.startsWith('_symbol_')) continue;
      
      const memory = await this.kb.retrieve(symbolEntry.name);
      if (memory) {
        const data = JSON.parse(memory.content);
        this.cache.set(data.filePath, data);
      }
    }
  }

  /**
   * Index a single file's symbols
   * @param {string} filePath - Relative path to file
   * @param {Array} symbols - Symbol data from Serena
   * @param {string} projectPath - Project root path
   */
  async indexFile(filePath, symbols, projectPath) {
    const fullPath = path.join(projectPath, filePath);
    
    // Calculate file hash for change detection
    const hash = await this.calculateFileHash(fullPath);
    
    const symbolData = {
      filePath,
      hash,
      symbols,
      indexedAt: new Date().toISOString(),
      symbolCount: this.countSymbols(symbols)
    };

    // Store in memory cache
    this.cache.set(filePath, symbolData);
    this.fileHashes.set(filePath, hash);

    // Persist to knowledge base
    const memoryName = this.getMemoryName(filePath);
    await this.kb.store(
      memoryName,
      JSON.stringify(symbolData, null, 2),
      'symbols',
      {
        filePath,
        symbolCount: symbolData.symbolCount,
        tags: ['symbol-index', 'auto-generated']
      }
    );

    // Update metadata
    this.indexMetadata.filesIndexed++;
    this.indexMetadata.symbolsCount += symbolData.symbolCount;
    await this.saveMetadata();

    return symbolData;
  }

  /**
   * Get symbols for a file (from cache or mark as needing refresh)
   * @param {string} filePath - Relative path to file
   * @param {string} projectPath - Project root path
   * @returns {Object|null} - Cached symbol data or null if needs refresh
   */
  async getSymbols(filePath, projectPath) {
    if (!this.cache.has(filePath)) {
      return null; // Not indexed yet
    }

    const cached = this.cache.get(filePath);
    const fullPath = path.join(projectPath, filePath);

    // Check if file has been modified
    const hasChanged = await this.hasFileChanged(fullPath, cached.hash);
    
    if (hasChanged) {
      return null; // Cache is stale, needs re-indexing
    }

    return cached;
  }

  /**
   * Check if a file needs to be re-indexed
   * @param {string} filePath - Relative path
   * @param {string} projectPath - Project root
   * @returns {boolean} - True if file changed or not indexed
   */
  async needsReindexing(filePath, projectPath) {
    if (!this.cache.has(filePath)) {
      return true; // Not indexed yet
    }

    const cached = this.cache.get(filePath);
    const fullPath = path.join(projectPath, filePath);
    
    return await this.hasFileChanged(fullPath, cached.hash);
  }

  /**
   * Search for symbols by name across all indexed files
   * @param {string} symbolName - Name to search for
   * @param {Object} options - Search options
   * @returns {Array} - Matching symbols with file paths
   */
  searchSymbols(symbolName, options = {}) {
    const results = [];
    const lowerName = symbolName.toLowerCase();
    const { kind, exactMatch = false } = options;

    for (const [filePath, data] of this.cache.entries()) {
      const matches = this.findSymbolsInTree(
        data.symbols, 
        lowerName, 
        filePath,
        { kind, exactMatch }
      );
      results.push(...matches);
    }

    return results;
  }

  /**
   * Find symbols in a symbol tree (recursive)
   */
  findSymbolsInTree(symbols, searchName, filePath, options, parentPath = '') {
    const results = [];

    for (const symbol of symbols) {
      const symbolName = symbol.name.toLowerCase();
      const fullPath = parentPath ? `${parentPath}/${symbol.name}` : symbol.name;

      // Check if matches
      const matches = options.exactMatch 
        ? symbolName === searchName
        : symbolName.includes(searchName);

      if (matches) {
        // Filter by kind if specified
        if (!options.kind || symbol.kind === options.kind) {
          results.push({
            ...symbol,
            filePath,
            namePath: fullPath
          });
        }
      }

      // Search children recursively
      if (symbol.children && symbol.children.length > 0) {
        const childMatches = this.findSymbolsInTree(
          symbol.children,
          searchName,
          filePath,
          options,
          fullPath
        );
        results.push(...childMatches);
      }
    }

    return results;
  }

  /**
   * Get symbols by file extension
   */
  getFilesByExtension(extension) {
    const files = [];
    for (const [filePath, data] of this.cache.entries()) {
      if (filePath.endsWith(extension)) {
        files.push({ filePath, symbolCount: data.symbolCount, indexedAt: data.indexedAt });
      }
    }
    return files;
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      ...this.indexMetadata,
      cacheSize: this.cache.size,
      categories: this.getCategoryStats()
    };
  }

  getCategoryStats() {
    const stats = {};
    
    for (const data of this.cache.values()) {
      this.countSymbolsByKind(data.symbols, stats);
    }

    return stats;
  }

  countSymbolsByKind(symbols, stats) {
    for (const symbol of symbols) {
      stats[symbol.kind] = (stats[symbol.kind] || 0) + 1;
      
      if (symbol.children) {
        this.countSymbolsByKind(symbol.children, stats);
      }
    }
  }

  /**
   * Invalidate cache for a specific file
   */
  async invalidate(filePath) {
    this.cache.delete(filePath);
    this.fileHashes.delete(filePath);

    const memoryName = this.getMemoryName(filePath);
    await this.kb.delete(memoryName);

    this.indexMetadata.filesIndexed = Math.max(0, this.indexMetadata.filesIndexed - 1);
    await this.saveMetadata();
  }

  /**
   * Clear entire index
   */
  async clear() {
    // Delete all symbol memories
    const symbols = await this.kb.listByCategory('symbols');
    for (const symbolEntry of symbols) {
      await this.kb.delete(symbolEntry.name);
    }

    this.cache.clear();
    this.fileHashes.clear();
    this.indexMetadata = {
      lastFullScan: null,
      filesIndexed: 0,
      symbolsCount: 0
    };
    
    await this.saveMetadata();
  }

  // Helper methods

  getMemoryName(filePath) {
    // Convert file path to safe memory name
    return '_symbol_' + filePath.replace(/[\/\.]/g, '_');
  }

  async calculateFileHash(fullPath) {
    try {
      const content = await readFile(fullPath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async hasFileChanged(fullPath, cachedHash) {
    const currentHash = await this.calculateFileHash(fullPath);
    return currentHash !== cachedHash;
  }

  countSymbols(symbols) {
    let count = symbols.length;
    for (const symbol of symbols) {
      if (symbol.children) {
        count += this.countSymbols(symbol.children);
      }
    }
    return count;
  }

  async saveMetadata() {
    await this.kb.store(
      '_symbol_index_metadata',
      JSON.stringify(this.indexMetadata, null, 2),
      'symbols',
      { tags: ['metadata', 'auto-generated'] }
    );

    // Save file hashes
    const hashObj = Object.fromEntries(this.fileHashes);
    await this.kb.store(
      '_symbol_file_hashes',
      JSON.stringify(hashObj, null, 2),
      'symbols',
      { tags: ['metadata', 'auto-generated'] }
    );
  }

  /**
   * Export index for debugging/inspection
   */
  export() {
    return {
      metadata: this.indexMetadata,
      files: Array.from(this.cache.keys()),
      stats: this.getStats()
    };
  }
}
