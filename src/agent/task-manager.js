import chalk from 'chalk';

export class TaskManager {
  constructor() {
    this.tasks = [];
    this.taskIdCounter = 1;
    this.currentPlan = null;
  }

  createPlan(description, taskList) {
    this.currentPlan = {
      id: Date.now(),
      description,
      created: new Date(),
      status: 'in-progress'
    };

    this.tasks = taskList.map(task => ({
      id: this.taskIdCounter++,
      name: task.name || task,
      status: 'pending', // pending, in-progress, completed, failed, skipped
      type: task.type || 'task', // task, subtask, intel
      priority: task.priority || 'normal', // high, normal, low
      dependencies: task.dependencies || [],
      result: null,
      error: null,
      startedAt: null,
      completedAt: null
    }));

    return this.currentPlan;
  }

  addTask(task) {
    const newTask = {
      id: this.taskIdCounter++,
      name: task.name || task,
      status: 'pending',
      type: task.type || 'task',
      priority: task.priority || 'normal',
      dependencies: task.dependencies || [],
      result: null,
      error: null,
      startedAt: null,
      completedAt: null
    };
    this.tasks.push(newTask);
    return newTask;
  }

  startTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'in-progress';
      task.startedAt = new Date();
    }
    return task;
  }

  completeTask(taskId, result = null) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
    }
    return task;
  }

  failTask(taskId, error) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error;
    }
    return task;
  }

  skipTask(taskId, reason) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'skipped';
      task.completedAt = new Date();
      task.result = reason;
    }
    return task;
  }

  getNextTask() {
    // Get the next pending task that has all dependencies met
    return this.tasks.find(task => {
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      if (task.dependencies.length === 0) return true;
      
      return task.dependencies.every(depId => {
        const depTask = this.tasks.find(t => t.id === depId);
        return depTask && depTask.status === 'completed';
      });
    });
  }

  getPendingTasks() {
    return this.tasks.filter(t => t.status === 'pending' || t.status === 'in-progress');
  }

  getCompletedTasks() {
    return this.tasks.filter(t => t.status === 'completed');
  }

  getFailedTasks() {
    return this.tasks.filter(t => t.status === 'failed');
  }

  isComplete() {
    return this.tasks.every(t => 
      t.status === 'completed' || 
      t.status === 'skipped' || 
      t.status === 'failed'
    );
  }

  getProgress() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const failed = this.tasks.filter(t => t.status === 'failed').length;
    const inProgress = this.tasks.filter(t => t.status === 'in-progress').length;
    const pending = this.tasks.filter(t => t.status === 'pending').length;

    return {
      total,
      completed,
      failed,
      inProgress,
      pending,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  getSummary() {
    return {
      plan: this.currentPlan,
      tasks: this.tasks,
      progress: this.getProgress()
    };
  }

  reset() {
    this.tasks = [];
    this.taskIdCounter = 1;
    this.currentPlan = null;
  }

  // Export for saving to session
  toJSON() {
    return {
      tasks: this.tasks,
      taskIdCounter: this.taskIdCounter,
      currentPlan: this.currentPlan
    };
  }

  // Import from saved session
  fromJSON(data) {
    this.tasks = data.tasks || [];
    this.taskIdCounter = data.taskIdCounter || 1;
    this.currentPlan = data.currentPlan || null;
  }
}
