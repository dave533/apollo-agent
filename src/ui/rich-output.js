import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import ora from 'ora';

export class RichOutput {
  constructor() {
    this.spinner = null;
  }

  header(text, options = {}) {
    const box = boxen(chalk.bold.cyan(text), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
      ...options
    });
    console.log(box);
  }

  section(title, content = null) {
    console.log('\n' + chalk.bold.blue('━'.repeat(60)));
    console.log(chalk.bold.white(`  ${title}`));
    console.log(chalk.bold.blue('━'.repeat(60)));
    if (content) {
      console.log(content);
    }
  }

  block(title, content, type = 'info') {
    const colors = {
      info: 'blue',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      thinking: 'magenta'
    };

    const color = colors[type] || 'blue';
    const box = boxen(content, {
      title: chalk.bold[color](title),
      padding: 1,
      margin: { top: 2, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: color
    });
    console.log(box);
  }

  thinkingBlock(step, content) {
    this.block(`🧠 Thinking: ${step}`, content, 'thinking');
  }

  toolExecution(toolName, args, result) {
    console.log('\n' + chalk.bold.cyan('┌─ Tool Execution ') + chalk.cyan('─'.repeat(43)));
    console.log(chalk.cyan('│ ') + chalk.bold.white('Tool: ') + chalk.yellow(toolName));
    
    if (args && Object.keys(args).length > 0) {
      console.log(chalk.cyan('│ ') + chalk.bold.white('Arguments:'));
      Object.entries(args).forEach(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(chalk.cyan('│   ') + chalk.gray(`${key}: `) + chalk.white(JSON.stringify(displayValue)));
      });
    }

    console.log(chalk.cyan('│ ') + chalk.bold.white('Result:'));
    const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
    const resultLines = resultStr.split('\n').slice(0, 10);
    resultLines.forEach(line => {
      console.log(chalk.cyan('│   ') + chalk.white(line));
    });
    if (resultStr.split('\n').length > 10) {
      console.log(chalk.cyan('│   ') + chalk.gray('... (truncated)'));
    }
    console.log(chalk.cyan('└' + '─'.repeat(59)));
  }

  table(headers, rows) {
    const table = new Table({
      head: headers.map(h => chalk.bold.cyan(h)),
      style: {
        head: [],
        border: ['cyan']
      }
    });

    rows.forEach(row => table.push(row));
    console.log(table.toString());
  }

  taskBreakdown(analysis) {
    this.section('📋 Task Analysis');
    
    console.log(chalk.bold.white('\nOriginal Task:'));
    console.log(chalk.gray('  ' + analysis.originalTask));

    console.log(chalk.bold.white('\nComplexity: ') + this.complexityBadge(analysis.estimatedComplexity));

    if (analysis.globalTasks.length > 0) {
      console.log(chalk.bold.white('\nGlobal Tasks:'));
      analysis.globalTasks.forEach((task, idx) => {
        console.log(chalk.cyan(`  ${idx + 1}. `) + chalk.white(task.name) + chalk.gray(` [${task.status}]`));
        
        if (analysis.subTasks[task.id]) {
          analysis.subTasks[task.id].forEach(sub => {
            console.log(chalk.gray(`     ├─ ${sub.name}`) + chalk.gray(` [${sub.status}]`));
          });
        }
      });
    }

    if (analysis.clarifications.length > 0) {
      console.log(chalk.bold.yellow('\n⚠️  Clarifications Needed:'));
      analysis.clarifications.forEach((q, idx) => {
        console.log(chalk.yellow(`  ${idx + 1}. ${q}`));
      });
    }

    if (analysis.dependencies.length > 0) {
      console.log(chalk.bold.white('\nDependencies:'));
      analysis.dependencies.forEach(dep => {
        console.log(chalk.gray(`  ${dep.task} depends on ${dep.dependsOn.join(', ')}`));
      });
    }
  }

  complexityBadge(complexity) {
    const badges = {
      simple: chalk.bgGreen.black(' SIMPLE '),
      moderate: chalk.bgYellow.black(' MODERATE '),
      complex: chalk.bgRed.white(' COMPLEX '),
      unknown: chalk.bgGray.white(' UNKNOWN ')
    };
    return badges[complexity] || badges.unknown;
  }

  success(message) {
    console.log(chalk.green('✓  ') + chalk.white(message));
  }

  error(message) {
    console.log(chalk.red('✗  ') + chalk.white(message));
  }

  warning(message) {
    console.log(chalk.yellow('⚠  ') + chalk.white(message));
  }

  info(message) {
    console.log('\n' + chalk.blue('ℹ  ') + chalk.white(message));
  }


  taskList(tasks, progress = null) {
    console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('              📋 TASK LIST              ') + chalk.bold.cyan('               ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝'));

    if (progress) {
      const bar = this.progressBar(progress.percentage);
      console.log(`\n${bar} ${chalk.bold.white(progress.percentage + '%')} ${chalk.gray(`(${progress.completed}/${progress.total})`)}`);
      console.log(chalk.gray(`  In Progress: ${progress.inProgress} │ Pending: ${progress.pending} │ Failed: ${progress.failed}`));
    }

    console.log();
    tasks.forEach((task, idx) => {
      const icon = this.getTaskIcon(task.status);
      const color = this.getTaskColor(task.status);
      const number = chalk.gray(`${String(task.id).padStart(2, ' ')}.`);
      
      let line = `  ${number} ${icon} ${chalk[color](task.name)}`;
      
      if (task.priority === 'high') {
        line += chalk.red(' [HIGH]');
      }
      
      if (task.status === 'in-progress' && task.startedAt) {
        const elapsed = Math.round((Date.now() - new Date(task.startedAt)) / 1000);
        line += chalk.gray(` (${elapsed}s)`);
      }

      console.log(line);

      if (task.dependencies && task.dependencies.length > 0) {
        console.log(chalk.gray(`      └─ depends on: ${task.dependencies.join(', ')}`));
      }

      if (task.error) {
        console.log(chalk.red(`      └─ error: ${task.error}`));
      }
    });
    console.log();
  }

  getTaskIcon(status) {
    const icons = {
      'pending': chalk.gray('○'),
      'in-progress': chalk.cyan('◐'),
      'completed': chalk.green('●'),
      'failed': chalk.red('✖'),
      'skipped': chalk.yellow('⊘')
    };
    return icons[status] || chalk.gray('○');
  }

  getTaskColor(status) {
    const colors = {
      'pending': 'gray',
      'in-progress': 'cyan',
      'completed': 'green',
      'failed': 'red',
      'skipped': 'yellow'
    };
    return colors[status] || 'white';
  }

  progressBar(percentage, width = 40) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `[${bar}]`;
  }

  knowledgeList(memories, category = null) {
    const title = category ? `📚 Knowledge: ${category.toUpperCase()}` : '📚 ALL KNOWLEDGE';
    console.log('\n' + chalk.bold.magenta('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white(`  ${title.padEnd(57, ' ')}`  ) + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚═══════════════════════════════════════════════════════════╝\n'));

    if (!memories || memories.length === 0) {
      console.log(chalk.gray('  No knowledge entries found.\n'));
      return;
    }

    memories.forEach((memory, idx) => {
      const icon = this.getCategoryIcon(memory.category);
      const date = memory.updatedAt ? new Date(memory.updatedAt).toLocaleString() : 'N/A';
      
      console.log(`  ${icon} ${chalk.bold.white(memory.name)}`);
      console.log(chalk.gray(`     Category: ${memory.category} │ Updated: ${date}`));
      
      if (memory.metadata && memory.metadata.tags) {
        console.log(chalk.gray(`     Tags: ${memory.metadata.tags.join(', ')}`));
      }
      console.log();
    });
  }

  getCategoryIcon(category) {
    const icons = {
      intel: '🔍',
      context: '📝',
      decisions: '🤔',
      findings: '💡',
      references: '🔖'
    };
    return icons[category] || '📄';
  }

  knowledgeDetail(memory) {
    console.log('\n' + chalk.bold.magenta('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white(`  📄 ${memory.name.padEnd(53, ' ')}`  ) + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚═══════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.bold.white('Category: ') + chalk.cyan(memory.category));
    if (memory.metadata) {
      console.log(chalk.bold.white('Created: ') + chalk.gray(new Date(memory.metadata.createdAt).toLocaleString()));
      console.log(chalk.bold.white('Updated: ') + chalk.gray(new Date(memory.metadata.updatedAt).toLocaleString()));
      
      if (memory.metadata.tags) {
        console.log(chalk.bold.white('Tags: ') + chalk.yellow(memory.metadata.tags.join(', ')));
      }
    }

    console.log('\n' + chalk.bold.white('Content:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(memory.content);
    console.log(chalk.gray('─'.repeat(60)) + '\n');
  }

  plan(planDescription, tasks) {
    console.log('\n' + chalk.bold.yellow('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.yellow('║') + chalk.bold.white('              🎯 EXECUTION PLAN              ') + chalk.bold.yellow('              ║'));
    console.log(chalk.bold.yellow('╚═══════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.bold.white('Objective:'));
    console.log(chalk.gray('  ' + planDescription) + '\n');

    console.log(chalk.bold.white('Tasks to Execute:'));
    tasks.forEach((task, idx) => {
      const priority = task.priority === 'high' ? chalk.red(' [HIGH]') : '';
      console.log(chalk.cyan(`  ${idx + 1}.`) + ` ${task.name || task}${priority}`);
      
      if (task.dependencies && task.dependencies.length > 0) {
        console.log(chalk.gray(`     └─ After: ${task.dependencies.join(', ')}`));
      }
    });
    console.log();
  }

  startSpinner(text) {
    this.spinner = ora({
      text: chalk.cyan(text),
      color: 'cyan'
    }).start();
  }

  updateSpinner(text) {
    if (this.spinner) {
      this.spinner.text = chalk.cyan(text);
    }
  }

  stopSpinner(success = true, text = null) {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(text ? chalk.green(text) : undefined);
      } else {
        this.spinner.fail(text ? chalk.red(text) : undefined);
      }
      this.spinner = null;
    }
  }
}

