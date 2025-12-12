import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TerminalTool {
  constructor(options = {}) {
    this.sessions = new Map();
    this.currentDir = process.cwd();
    this.sudoPassword = options.sudoPassword || process.env.SUDO_PASSWORD || null;
    this.sudoMode = options.sudoMode || process.env.SUDO_MODE || 'auto'; // 'auto', 'interactive', 'password', 'nopasswd'
  }

  async execute(command, options = {}) {
    const { session, cwd, timeout = 30000, interactive = false } = options;

    // Check if command requires interactive input (sudo, passwd, etc.)
    const needsSudo = /^sudo\s/.test(command.trim());
    const needsInteractive = interactive || (needsSudo && this.sudoMode === 'interactive');
    
    // Handle sudo commands based on mode
    if (needsSudo && this.sudoMode === 'password' && this.sudoPassword) {
      return await this.executeSudoWithPassword(command, { session, cwd, timeout });
    }
    
    if (needsSudo && this.sudoMode === 'nopasswd') {
      // Add -n flag to ensure it fails fast if password is required
      command = command.replace(/^sudo\s/, 'sudo -n ');
    }
    
    if (needsInteractive) {
      return await this.executeInteractive(command, { session, cwd, timeout });
    }

    try {
      const execOptions = {
        cwd: cwd || this.currentDir,
        timeout,
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, ...options.env }
      };

      const { stdout, stderr } = await execAsync(command, execOptions);
      
      if (session) {
        this.updateSession(session, { command, stdout, stderr, cwd: execOptions.cwd });
      }

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command,
        cwd: execOptions.cwd
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        command,
        cwd: cwd || this.currentDir
      };
    }
  }

  async executeSudoWithPassword(command, options = {}) {
    const { session, cwd, timeout = 60000 } = options;

    return new Promise((resolve, reject) => {
      // Use sudo -S to read password from stdin
      const proc = spawn('bash', ['-c', command.replace(/^sudo\s/, 'sudo -S ')], {
        cwd: cwd || this.currentDir,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Send password immediately
      proc.stdin.write(`${this.sudoPassword}\n`);
      proc.stdin.end();

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill();
        reject(new Error('Command timed out'));
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Filter out sudo password prompt from stderr
        stderr = stderr.replace(/\[sudo\] password for .*?:\s*/g, '');
        
        const result = {
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command,
          cwd: cwd || this.currentDir,
          exitCode: code
        };

        if (session) {
          this.updateSession(session, result);
        }

        resolve(result);
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async executeInteractive(command, options = {}) {
    const { session, cwd, timeout = 60000 } = options;

    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', command], {
        cwd: cwd || this.currentDir,
        env: process.env,
        stdio: 'inherit' // Allow interactive input (password prompts)
      });

      const timeoutId = setTimeout(() => {
        proc.kill();
        reject(new Error('Command timed out'));
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        const result = {
          success: code === 0,
          stdout: '',
          stderr: '',
          command,
          cwd: cwd || this.currentDir,
          exitCode: code,
          interactive: true
        };

        if (session) {
          this.updateSession(session, result);
        }

        resolve(result);
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async pwd(session) {
    const result = await this.execute('pwd', { session });
    if (result.success) {
      this.currentDir = result.stdout;
    }
    return result;
  }

  async ls(path = '.', session) {
    return await this.execute(`ls -la ${path}`, { session });
  }

  async cd(path, session) {
    const result = await this.execute(`cd ${path} && pwd`, { session });
    if (result.success) {
      this.currentDir = result.stdout;
    }
    return result;
  }

  async readFile(filePath, session) {
    return await this.execute(`cat ${filePath}`, { session });
  }

  async writeFile(filePath, content, session) {
    const escapedContent = content.replace(/'/g, "'\\''");
    return await this.execute(`echo '${escapedContent}' > ${filePath}`, { session });
  }

  async installPackage(packageManager, packageName, session) {
    const commands = {
      npm: `npm install ${packageName}`,
      pip: `pip install ${packageName}`,
      apt: `sudo apt-get install -y ${packageName}`,
      brew: `brew install ${packageName}`
    };

    const command = commands[packageManager];
    if (!command) {
      return { success: false, error: `Unknown package manager: ${packageManager}` };
    }

    return await this.execute(command, { session, timeout: 120000 });
  }

  async searchPackage(packageManager, query) {
    const commands = {
      npm: `npm search ${query} --json`,
      pip: `pip search ${query}`
    };

    const command = commands[packageManager];
    if (!command) {
      return { success: false, error: `Package search not supported for: ${packageManager}` };
    }

    return await this.execute(command, { timeout: 60000 });
  }

  createSession(sessionId) {
    this.sessions.set(sessionId, {
      id: sessionId,
      created: new Date(),
      history: [],
      cwd: this.currentDir
    });
    return sessionId;
  }

  updateSession(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push({
        timestamp: new Date(),
        ...data
      });
      if (data.cwd) {
        session.cwd = data.cwd;
      }
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  listSessions() {
    return Array.from(this.sessions.values());
  }

  async interactive(command, onData, onError) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const proc = spawn(cmd, args, {
        cwd: this.currentDir,
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (onData) onData(text, 'stdout');
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (onError) onError(text, 'stderr');
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }
}

