# Symbol Index System - Technical Documentation

## Overview

The Symbol Index is an intelligent caching system that dramatically improves Apollo's performance when working with code symbols. It eliminates the need to repeatedly call Serena MCP for symbol information on files that haven't changed.

## Architecture

### Components

1. **SymbolIndex** (`src/agent/symbol-index.js`)
   - Core indexing engine
   - Manages symbol cache
   - File change detection
   - Search capabilities

2. **KnowledgeBase Integration**
   - Symbols stored in `symbols` category
   - Persists across sessions
   - Metadata tracking

3. **Apollo Integration** (`src/agent/apollo-agent.js`)
   - Transparent caching layer
   - Automatic cache checking
   - Smart cache invalidation

## How It Works

### Indexing Flow

```
User asks for symbols
       ↓
Check cache (hash-based)
       ↓
   Cache hit? ──Yes──→ Return cached symbols (instant)
       ↓ No
Call Serena MCP
       ↓
Store in cache + knowledge base
       ↓
Return symbols
```

### File Change Detection

```javascript
// When file is indexed
1. Calculate MD5 hash of file content
2. Store hash with symbol data
3. Save to knowledge base

// When cache is queried
1. Calculate current file hash
2. Compare with cached hash
3. If different → cache miss
4. If same → cache hit
```

### Storage Structure

```
.apollo-knowledge/
  symbols/
    _symbol_src_index_js.json        # Symbols for src/index.js
    _symbol_src_agent_apollo-agent_js.json
    _symbol_index_metadata.json       # Index statistics
    _symbol_file_hashes.json          # Hash registry
```

## Features

### 1. Automatic Caching

No manual intervention needed. When Apollo calls:

```javascript
await this.mcp.callTool('serena', 'mcp_oraios_serena_get_symbols_overview', {
  relative_path: 'src/index.js',
  depth: 1
});
```

The `getFileSymbols()` wrapper automatically:
- Checks if file is in cache
- Validates hash (file unchanged?)
- Returns cached version OR fetches fresh

### 2. Smart Invalidation

Cache is invalidated when:
- File content changes (detected via MD5 hash)
- User explicitly calls `invalidateSymbolCache()`
- Cache is cleared with `clearSymbolIndex()`

### 3. Fast Search

Search ALL indexed symbols instantly:

```javascript
const results = await agent.searchSymbolsInIndex('MyClass');
// Returns: [{ name: 'MyClass', kind: 5, filePath: 'src/app.js', namePath: 'MyClass' }]
```

### 4. Persistence

- Symbols stored in knowledge base
- Survives agent restarts
- Incremental updates only

### 5. Statistics

Track index health:

```javascript
const stats = symbolIndex.getStats();
// {
//   filesIndexed: 25,
//   symbolsCount: 342,
//   cacheSize: 25,
//   lastFullScan: '2025-12-12T10:30:00Z',
//   categories: { Class: 12, Method: 85, Function: 45, ... }
// }
```

## API Reference

### SymbolIndex Class

#### `initialize()`
Load cached symbols from knowledge base.

#### `indexFile(filePath, symbols, projectPath)`
Index a single file's symbols.

**Parameters:**
- `filePath` - Relative path to file
- `symbols` - Symbol array from Serena
- `projectPath` - Project root path

**Returns:** Symbol data object

#### `getSymbols(filePath, projectPath)`
Get cached symbols for a file.

**Returns:** `{ filePath, hash, symbols, indexedAt, symbolCount }` or `null` if needs refresh

#### `needsReindexing(filePath, projectPath)`
Check if file needs to be re-indexed.

**Returns:** `true` if not indexed or file changed

#### `searchSymbols(symbolName, options)`
Search for symbols across all indexed files.

**Options:**
- `kind` - Filter by LSP symbol kind (e.g., 5 for Class, 12 for Function)
- `exactMatch` - Require exact name match (default: false, uses substring)

**Returns:** Array of matching symbols with file paths

#### `invalidate(filePath)`
Remove a file from the cache.

#### `clear()`
Clear entire index (requires confirmation).

#### `getStats()`
Get index statistics.

### Apollo Agent Methods

#### `getFileSymbols(filePath, options)`
Get symbols for a file (cache-aware).

**Options:**
- `depth` - Symbol tree depth (default: 0)
- `forceRefresh` - Skip cache (default: false)

**Returns:** Symbol array

#### `searchSymbolsInIndex(symbolName, options)`
Search for symbols in the index.

#### `indexFiles(filePaths, depth)`
Batch index multiple files.

#### `viewSymbolIndex()`
Display index statistics.

#### `clearSymbolIndex()`
Clear the entire index (with confirmation).

#### `invalidateSymbolCache(filePaths)`
Invalidate cache for specific files.

## CLI Commands

```bash
symbols / index              # Show index statistics
index src/app.js src/ui.js   # Index specific files
search MyClass               # Search for symbols
```

## Performance Benefits

### Without Caching
```
Get symbols for file A → 500ms (Serena MCP call)
Get symbols for file A again → 500ms (Serena MCP call)
Get symbols for file A again → 500ms (Serena MCP call)
Total: 1500ms
```

### With Caching
```
Get symbols for file A → 500ms (Serena MCP call + cache)
Get symbols for file A again → <1ms (cache hit)
Get symbols for file A again → <1ms (cache hit)
Total: ~502ms (99.8% faster!)
```

### Real-World Impact

For a project with 50 files, repeatedly accessed:
- **Without cache**: 50 × 500ms = 25 seconds per full scan
- **With cache**: 50 × 1ms = 50ms per scan (after first index)
- **Speedup**: 500x faster

## Use Cases

### 1. Repeated File Analysis
When working on a task that requires multiple lookups of the same file's structure:

```javascript
// Task: "Refactor the authentication system"

// First lookup: src/auth/login.js → Calls Serena, caches
// Second lookup: src/auth/login.js → Cache hit, instant
// Third lookup: src/auth/login.js → Cache hit, instant
```

### 2. Project-Wide Symbol Search
Quickly find all occurrences of a symbol across the codebase:

```javascript
search("AuthService")
// Instantly returns all files containing AuthService class/function/variable
// No need to call Serena for each file
```

### 3. Session Persistence
Index survives restarts:

```
Session 1: Index 20 files → 10 seconds
Session 2: Access same 20 files → Instant (cached)
```

### 4. Incremental Development
As you work, index grows automatically:

```
Open file A → Index file A
Open file B → Index file B
...
After 1 hour: 30 files indexed
Next session: All 30 files instantly available
```

## Best Practices

### For Users

1. **Let it index naturally** - Don't manually index everything. Let Apollo index files as it encounters them.

2. **Use search** - When looking for a symbol, use `search MyClass` instead of asking Apollo to search.

3. **Check index stats** - Periodically run `symbols` to see what's cached.

4. **Trust the cache** - Apollo automatically detects file changes. You don't need to manually invalidate.

### For Apollo (Agent)

1. **Always use getFileSymbols()** - Don't call Serena directly. Use the wrapper method.

2. **Let caching happen** - The system is automatic. Just call tools normally.

3. **Store symbols after discovery** - When you get symbols from Serena, they're automatically cached.

4. **Reference the index** - When user asks "find all classes", search the index first before calling Serena.

## Debugging

### Check if file is indexed
```javascript
const cached = await symbolIndex.getSymbols('src/app.js', projectPath);
console.log(cached ? 'Cached' : 'Not indexed');
```

### Check if file needs refresh
```javascript
const needs = await symbolIndex.needsReindexing('src/app.js', projectPath);
console.log(needs ? 'Needs refresh' : 'Cache valid');
```

### View index export
```javascript
const data = symbolIndex.export();
console.log(JSON.stringify(data, null, 2));
```

### Check knowledge base
Files are stored in `.apollo-knowledge/symbols/` as JSON.

## Limitations

1. **Hash-based detection only**
   - Detects content changes, not git changes
   - Moving files doesn't update the index automatically

2. **Memory overhead**
   - All symbols loaded into RAM
   - For huge projects (1000+ files), may use significant memory

3. **No partial invalidation**
   - Changing one method invalidates entire file
   - Future: Could use line-range based invalidation

4. **Storage space**
   - Each indexed file creates a JSON file
   - Large projects may create many files in `.apollo-knowledge/`

## Future Enhancements

### Planned
- [ ] Batch indexing on startup
- [ ] Project-wide scan command
- [ ] Symbol relationships (imports, inheritance)
- [ ] Cross-file symbol resolution
- [ ] Watch mode (auto-reindex on file change)

### Considered
- [ ] Git integration (detect changes via git diff)
- [ ] Partial file invalidation (line ranges)
- [ ] Compression for large symbol trees
- [ ] Remote index sharing (team collaboration)

## Troubleshooting

### Issue: Cache not being used
**Symptom:** Always calls Serena even for unchanged files

**Solutions:**
1. Check if file hash is stored: `symbols` command
2. Verify knowledge base is writable
3. Check for errors in console

### Issue: Stale cache
**Symptom:** Changes to file not reflected in symbols

**Solutions:**
1. File hash should auto-detect changes
2. Manually invalidate: `invalidateSymbolCache(['src/app.js'])`
3. Clear and rebuild: `clearSymbolIndex()`

### Issue: Large memory usage
**Symptom:** Apollo using lots of RAM

**Solutions:**
1. Clear old cache: `clearSymbolIndex()`
2. Limit depth when indexing: `indexFiles(['file.js'], 0)` 
3. Index only needed files, not entire project

## Migration Notes

### Existing Apollo Users

**No breaking changes!** The system is:
- Opt-in through natural usage
- Transparent (you won't notice it)
- Backwards compatible

**What you'll notice:**
- Faster repeated symbol lookups
- New `symbols` command
- New `.apollo-knowledge/symbols/` directory

**What to do:**
- Nothing! Just use Apollo normally
- Optionally run `symbols` to see stats
- Optionally use `search` for fast symbol lookup
