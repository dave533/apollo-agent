# Apollo Agent - Feature Documentation

## Overview

Apollo is now a proper AI agent with systematic task management, knowledge gathering, and execution planning capabilities.

## New Features

### 1. **Task Management System** 📋

Apollo now creates and tracks execution plans with visible task lists.

#### How it works:
1. When you give Apollo a task, it enters a **Planning Phase**
2. It analyzes the task and creates a structured plan with subtasks
3. Shows you the plan and asks for confirmation
4. Tracks progress as it works through each task
5. **Doesn't finish until all tasks are complete**

#### Task Display:
```
╔═══════════════════════════════════════════════════════════╗
║              📋 TASK LIST                                  ║
╚═══════════════════════════════════════════════════════════╝

[████████████████████████░░░░░░░░░░] 60% (3/5)
  In Progress: 1 │ Pending: 1 │ Failed: 0

   1. ● Gather system information [completed]
   2. ● Check Zen Browser in Downloads [completed]
   3. ◐ Extract and install Zen Browser [in-progress] (15s)
   4. ○ Install VS Code update [pending]
   5. ○ Verify installations [pending]
```

#### Task Commands:
- `tasks` - View current task list and progress
- Tasks are automatically created during planning phase

### 2. **Knowledge Base System** 📚

Apollo now stores important information it gathers, making it a true intelligence-gathering agent.

#### Categories:
- **intel** 🔍 - Gathered intelligence about tasks/systems
- **context** 📝 - Project context, structure, patterns
- **decisions** 🤔 - Decisions made and reasoning
- **findings** 💡 - Discovery results
- **references** 🔖 - Important file paths, commands, etc.

#### Knowledge Commands:
```bash
knowledge              # List all knowledge entries
knowledge intel        # List knowledge by category
view task-requirements # View detailed knowledge entry
```

#### Example Output:
```
╔═══════════════════════════════════════════════════════════╗
║  📚 Knowledge: INTEL                                       ║
╚═══════════════════════════════════════════════════════════╝

  🔍 task-requirements
     Category: intel │ Updated: 12/12/2025, 5:48:00 AM
     Tags: installation, system-setup

  🔍 system-info
     Category: intel │ Updated: 12/12/2025, 5:49:15 AM
```

### 3. **Planning Phase** 🎯

Before executing, Apollo now:
1. **Analyzes** the task using AI
2. **Identifies** information needed
3. **Creates** a step-by-step plan
4. **Shows you** the plan
5. **Waits** for your confirmation

Example:
```
╔═══════════════════════════════════════════════════════════╗
║              🎯 EXECUTION PLAN                             ║
╚═══════════════════════════════════════════════════════════╝

Objective:
  Install Zen Browser and VS Code from Downloads folder

Tasks to Execute:
  1. Verify files exist in Downloads
  2. Extract Zen Browser archive
  3. Move Zen to /opt/ directory
  4. Create desktop entry for Zen
  5. Extract VS Code update
  6. Update VS Code installation
  7. Verify both applications work

? Proceed with this plan? (Y/n)
```

### 4. **Improved sudo Handling** 🔐

The previous issue where sudo commands would timeout is now fixed:
- Apollo automatically detects `sudo` commands
- Uses interactive mode to allow password prompts
- Shows you the command before running it
- Waits for you to enter the password

### 5. **Agent Behavior** 🤖

Apollo now acts like a proper agent:

#### Intelligence Gathering:
- Collects information before acting
- Stores findings in knowledge base
- References stored knowledge instead of re-gathering

#### Systematic Execution:
- Follows the plan step-by-step
- Tracks which tasks are complete
- Doesn't stop until all tasks are done
- Reports progress continuously

#### Progress Tracking:
- Real-time progress bar
- Status updates for each task
- Time tracking for in-progress tasks
- Clear indication of what's next

### 6. **Enhanced UI** 🎨

New visual elements:
- Progress bars with percentage
- Color-coded task status (○ pending, ◐ in-progress, ● complete, ✖ failed)
- Category icons for knowledge entries
- Structured plan displays
- Detailed task breakdowns

## Commands Reference

### Agent Commands:
```bash
exit/quit              # Exit Apollo
status                 # Show agent status
clear                  # Clear conversation history
help/?                 # Show help
```

### Task Management:
```bash
tasks                  # Show current task list
```

### Knowledge Management:
```bash
knowledge              # List all knowledge
knowledge <category>   # List by category (intel/context/decisions/findings/references)
view <name>           # View detailed knowledge entry
```

## Usage Examples

### Example 1: Installing Software
```
? Task: install the latest version of neovim from source

🧠 Planning Phase
Analyzing task and creating execution plan...

🎯 EXECUTION PLAN
Objective: Install neovim from source

Tasks:
  1. Gather prerequisites (git, make, cmake)
  2. Clone neovim repository
  3. Build neovim
  4. Install neovim
  5. Verify installation

? Proceed with this plan? Yes

📋 TASK LIST
[████░░░░░░░░] 20% (1/5)
  1. ● Gather prerequisites [completed]
  2. ◐ Clone neovim repository [in-progress]
  ...
```

### Example 2: Viewing Knowledge
```
? Task: knowledge

📚 ALL KNOWLEDGE

  🔍 system-architecture
     Category: intel │ Updated: 12/12/2025
  
  📝 project-structure
     Category: context │ Updated: 12/12/2025
  
  🤔 build-system-choice
     Category: decisions │ Updated: 12/12/2025

? Task: view system-architecture

📄 system-architecture
Category: intel
Created: 12/12/2025, 5:30:00 AM
Updated: 12/12/2025, 5:45:00 AM

Content:
────────────────────────────────────────────────────────────
System: Arch Linux
Shell: bash
Package Manager: pacman
...
────────────────────────────────────────────────────────────
```

## Configuration

### Knowledge Base Location
Knowledge is stored in `.apollo-knowledge/` in your project directory:
```
.apollo-knowledge/
  intelligence/
  context/
  decisions/
  findings/
  references/
```

### Task Persistence
Tasks are saved to the session and persist across conversation turns.

## API Usage

If using Apollo programmatically:

```javascript
const agent = new ApolloAgent({ projectPath: '/path/to/project' });
await agent.initialize();

// View tasks
agent.viewTasks();

// View knowledge
await agent.viewKnowledge('intel');
await agent.viewKnowledgeDetail('task-requirements');

// Store knowledge
await agent.storeKnowledge('finding-name', 'content here', 'findings');

// Edit knowledge
await agent.editKnowledge('finding-name', 'updated content');

// Complete current task manually
agent.completeCurrentTask('result data');
```

## Best Practices

### For Users:
1. **Let Apollo plan** - The planning phase helps ensure nothing is missed
2. **Check the plan** - Review the proposed tasks before confirming
3. **Use commands** - Type `help` to see all available commands
4. **View progress** - Use `tasks` to see what's happening
5. **Review knowledge** - Use `knowledge` to see what Apollo has learned

### For Apollo (automated):
1. **Always plan first** - Use the planning phase for complex tasks
2. **Store findings** - Save important information to knowledge base
3. **Reference knowledge** - Check existing knowledge before re-gathering
4. **Track progress** - Keep task list updated
5. **Don't give up** - Complete all tasks before finishing

## Troubleshooting

### Issue: Tasks not showing
- Make sure the planning phase completed
- Type `tasks` to manually view task list

### Issue: Knowledge not saved
- Check `.apollo-knowledge/` directory exists
- Verify write permissions

### Issue: Planning phase fails
- Apollo will fallback to ad-hoc execution
- You can still manually track progress

## Migration Notes

Existing Apollo users:
- All previous features still work
- New features are opt-in through planning confirmation
- No breaking changes to existing workflows
- Sessions now include task and knowledge data
