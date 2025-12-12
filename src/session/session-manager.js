import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SessionManager {
  constructor(sessionDir = '.sessions') {
    this.sessionDir = path.join(process.cwd(), sessionDir);
    this.currentSession = null;
  }

  async initialize() {
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create session directory:', error);
    }
  }

  async createSession(metadata = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      metadata,
      messages: [],
      context: {
        selectedProject: null,
        currentTasks: [],
        toolHistory: [],
        workingDirectory: process.cwd()
      }
    };

    await this.saveSession();
    return sessionId;
  }

  async loadSession(sessionId) {
    try {
      const sessionPath = path.join(this.sessionDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionPath, 'utf-8');
      this.currentSession = JSON.parse(data);
      return this.currentSession;
    } catch (error) {
      throw new Error(`Failed to load session ${sessionId}: ${error.message}`);
    }
  }

  async saveSession() {
    if (!this.currentSession) {
      throw new Error('No active session to save');
    }

    this.currentSession.updated = new Date().toISOString();
    const sessionPath = path.join(this.sessionDir, `${this.currentSession.id}.json`);
    
    try {
      await fs.writeFile(sessionPath, JSON.stringify(this.currentSession, null, 2));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  async listSessions() {
    try {
      const files = await fs.readdir(this.sessionDir);
      const sessions = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(this.sessionDir, file), 'utf-8');
          const session = JSON.parse(data);
          sessions.push({
            id: session.id,
            created: session.created,
            updated: session.updated,
            messageCount: session.messages.length
          });
        }
      }

      return sessions.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    } catch (error) {
      return [];
    }
  }

  addMessage(role, content) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
  }

  updateContext(updates) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.context = {
      ...this.currentSession.context,
      ...updates
    };
  }

  addToolExecution(toolName, args, result) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.context.toolHistory.push({
      tool: toolName,
      args,
      result,
      timestamp: new Date().toISOString()
    });
  }

  getContext() {
    return this.currentSession?.context || null;
  }

  getMessages() {
    return this.currentSession?.messages || [];
  }

  getCurrentSession() {
    return this.currentSession;
  }

  async deleteSession(sessionId) {
    try {
      const sessionPath = path.join(this.sessionDir, `${sessionId}.json`);
      await fs.unlink(sessionPath);
      if (this.currentSession?.id === sessionId) {
        this.currentSession = null;
      }
    } catch (error) {
      throw new Error(`Failed to delete session ${sessionId}: ${error.message}`);
    }
  }
}

