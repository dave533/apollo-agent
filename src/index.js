#!/usr/bin/env node

import dotenv from 'dotenv';
import { ApolloAgent } from './agent/apollo-agent.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

dotenv.config();

async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  const projectPath = args.find(a => !a.startsWith('-')) || process.cwd();

  const agent = new ApolloAgent({ projectPath });

  try {
    await agent.initialize();

    // Show status
    const status = agent.getStatus();
    console.log(chalk.gray(`\n📊 Status: LLM=${status.llm.model}, Tools=${status.toolCount}`));
    console.log(chalk.gray(`   Serena: ${status.mcp.serena ? '✓' : '✗'}, Sequential Thinking: ${status.mcp.sequentialThinking ? '✓' : '✗'}\n`));

    let continueRunning = true;

    while (continueRunning) {
      const { taskInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'taskInput',
          message: chalk.bold.cyan('🚀 Task (or "exit" to quit):'),
        }
      ]);

      const input = taskInput.trim().toLowerCase();

      if (input === 'exit' || input === 'quit') {
        continueRunning = false;
        continue;
      }

      if (input === 'status') {
        const s = agent.getStatus();
        console.log(chalk.blue(JSON.stringify(s, null, 2)));
        continue;
      }

      if (input === 'clear') {
        agent.clearHistory();
        continue;
      }

      if (input === 'tasks' || input === 'show tasks') {
        agent.viewTasks();
        continue;
      }

      if (input === 'complete' || input === 'complete task') {
        agent.completeCurrentTask();
        continue;
      }

      if (input === 'reset tasks' || input === 'clear tasks') {
        agent.taskManager.reset();
        console.log(chalk.green('\u2713 Task list reset'));
        continue;
      }

      if (input === 'knowledge' || input === 'memories' || input === 'kb') {
        await agent.viewKnowledge();
        continue;
      }

      if (input.startsWith('knowledge ') || input.startsWith('kb ')) {
        const category = input.split(' ')[1];
        await agent.viewKnowledge(category);
        continue;
      }

      if (input.startsWith('view ')) {
        const name = input.substring(5).trim();
        await agent.viewKnowledgeDetail(name);
        continue;
      }

      if (input === 'symbols' || input === 'index') {
        agent.viewSymbolIndex();
        continue;
      }

      if (input.startsWith('index ')) {
        const files = input.substring(6).trim().split(' ');
        await agent.indexFiles(files);
        continue;
      }

      if (input.startsWith('search ')) {
        const symbolName = input.substring(7).trim();
        const results = await agent.searchSymbolsInIndex(symbolName);
        if (results.length > 0) {
          console.log(chalk.cyan(`\n Found ${results.length} symbol(s):\n`));
          results.forEach(r => {
            console.log(chalk.white(`  ${r.name}`) + chalk.gray(` (${r.kind}) in `) + chalk.yellow(r.filePath));
            if (r.namePath) console.log(chalk.gray(`    Path: ${r.namePath}`));
          });
          console.log();
        }
        continue;
      }

      if (input === 'help' || input === '?') {
        console.log(chalk.cyan('\n📚 Available Commands:'));
        console.log(chalk.gray('  exit/quit') + ' - Exit the agent');
        console.log(chalk.gray('  status') + ' - Show agent status');
        console.log(chalk.gray('  clear') + ' - Clear conversation history');
        console.log(chalk.gray('  tasks') + ' - Show current task list');
        console.log(chalk.gray('  complete') + ' - Mark current task as complete');
        console.log(chalk.gray('  reset tasks') + ' - Clear all tasks');
        console.log(chalk.gray('  knowledge') + ' - List all knowledge entries');
        console.log(chalk.gray('  knowledge <category>') + ' - List knowledge by category');
        console.log(chalk.gray('  view <name>') + ' - View detailed knowledge entry');
        console.log(chalk.gray('  symbols/index') + ' - Show symbol index statistics');
        console.log(chalk.gray('  index <file1> <file2>') + ' - Index specific files');
        console.log(chalk.gray('  search <symbol>') + ' - Search for symbols in index');
        console.log(chalk.gray('  help') + ' - Show this help\n');
        continue;
      }

      if (!taskInput.trim()) {
        console.log(chalk.yellow('Please enter a valid task or "help" for commands.'));
        continue;
      }

      try {
        await agent.processTask(taskInput);
      } catch (error) {
        console.log(chalk.red(`Error: ${error.message}`));

        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: 'Continue with another task?',
            default: true
          }
        ]);

        if (!retry) {
          continueRunning = false;
        }
      }
    }

  } catch (error) {
    console.error(chalk.red('Fatal error:'), error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await agent.shutdown();
  }
}

main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

