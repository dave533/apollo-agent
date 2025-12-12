import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class KnowledgeBase {
  constructor(baseDir = '.apollo-knowledge') {
    this.baseDir = baseDir;
    this.memories = new Map();
    this.categories = {
      intel: 'intelligence',      // Gathered information about the task/system
      context: 'context',         // Project context, structure, patterns
      decisions: 'decisions',     // Decisions made and reasoning
      findings: 'findings',       // Discovery results
      references: 'references',   // Important file paths, commands, etc
      symbols: 'symbols'          // Cached code symbols and structure
    };
  }

  async initialize() {
    try {
      await mkdir(this.baseDir, { recursive: true });
      
      // Create category subdirectories
      for (const category of Object.values(this.categories)) {
        await mkdir(path.join(this.baseDir, category), { recursive: true });
      }

      // Load existing memories
      await this.loadAll();
    } catch (error) {
      console.error('Failed to initialize knowledge base:', error);
    }
  }

  async store(name, content, category = 'intel', metadata = {}) {
    const categoryPath = this.categories[category] || this.categories.intel;
    const timestamp = new Date().toISOString();
    
    const memory = {
      name,
      category,
      content,
      metadata: {
        ...metadata,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    };

    // Store in memory
    this.memories.set(name, memory);

    // Persist to disk
    const filePath = path.join(this.baseDir, categoryPath, `${name}.json`);
    await writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');

    return memory;
  }

  async retrieve(name) {
    if (this.memories.has(name)) {
      return this.memories.get(name);
    }

    // Try to load from disk if not in memory
    for (const category of Object.values(this.categories)) {
      try {
        const filePath = path.join(this.baseDir, category, `${name}.json`);
        const data = await readFile(filePath, 'utf-8');
        const memory = JSON.parse(data);
        this.memories.set(name, memory);
        return memory;
      } catch (error) {
        // Continue to next category
      }
    }

    return null;
  }

  async update(name, content, metadata = {}) {
    const existing = await this.retrieve(name);
    if (!existing) {
      throw new Error(`Memory '${name}' not found`);
    }

    existing.content = content;
    existing.metadata.updatedAt = new Date().toISOString();
    existing.metadata = { ...existing.metadata, ...metadata };

    // Update in memory
    this.memories.set(name, existing);

    // Persist to disk
    const categoryPath = this.categories[existing.category] || this.categories.intel;
    const filePath = path.join(this.baseDir, categoryPath, `${name}.json`);
    await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

    return existing;
  }

  async delete(name) {
    const memory = await this.retrieve(name);
    if (!memory) return false;

    // Remove from memory
    this.memories.delete(name);

    // Delete from disk
    const categoryPath = this.categories[memory.category] || this.categories.intel;
    const filePath = path.join(this.baseDir, categoryPath, `${name}.json`);
    
    try {
      await promisify(fs.unlink)(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async listByCategory(category) {
    const memories = [];
    for (const [name, memory] of this.memories.entries()) {
      if (memory.category === category) {
        memories.push({ name, ...memory.metadata });
      }
    }
    return memories;
  }

  async listAll() {
    const list = {};
    for (const category of Object.keys(this.categories)) {
      list[category] = await this.listByCategory(category);
    }
    return list;
  }

  async search(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [name, memory] of this.memories.entries()) {
      if (
        name.toLowerCase().includes(lowerQuery) ||
        memory.content.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(memory.metadata).toLowerCase().includes(lowerQuery)
      ) {
        results.push({ name, ...memory });
      }
    }

    return results;
  }

  async loadAll() {
    for (const category of Object.values(this.categories)) {
      const categoryPath = path.join(this.baseDir, category);
      
      try {
        const files = await readdir(categoryPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(categoryPath, file);
            const data = await readFile(filePath, 'utf-8');
            const memory = JSON.parse(data);
            this.memories.set(memory.name, memory);
          }
        }
      } catch (error) {
        // Category directory might not exist yet
      }
    }
  }

  getStats() {
    const stats = {
      total: this.memories.size,
      byCategory: {}
    };

    for (const category of Object.keys(this.categories)) {
      stats.byCategory[category] = Array.from(this.memories.values())
        .filter(m => m.category === category).length;
    }

    return stats;
  }

  // Quick access methods for common operations
  async storeIntel(name, content, metadata = {}) {
    return this.store(name, content, 'intel', metadata);
  }

  async storeContext(name, content, metadata = {}) {
    return this.store(name, content, 'context', metadata);
  }

  async storeDecision(name, content, metadata = {}) {
    return this.store(name, content, 'decisions', metadata);
  }

  async storeFinding(name, content, metadata = {}) {
    return this.store(name, content, 'findings', metadata);
  }

  async storeReference(name, content, metadata = {}) {
    return this.store(name, content, 'references', metadata);
  }
}
