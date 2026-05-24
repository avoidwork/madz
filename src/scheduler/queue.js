/**
 * Schedule queue that enforces max_concurrent and FIFO processing.
 */
export class ScheduleQueue {
  #queue = [];
  #running = 0;
  #maxConcurrent;

  /**
   * @param {number} maxConcurrent - Maximum concurrent runs (default: 1)
   */
  constructor(maxConcurrent = 1) {
    this.#maxConcurrent = maxConcurrent;
  }

  /**
   * Enqueue a scheduled task.
   * @param {Object} task - The task to queue
   * @returns {{ queued: boolean, position: number }}
   */
  enqueue(task) {
    this.#queue.push(task);
    this.#drain();
    return { queued: true, position: this.#queue.length };
  }

  /**
   * Mark a running task as complete.
   * @param {string} taskId - Task identifier
   */
  complete(taskId) {
    this.#queue = this.#queue.filter((t) => t !== taskId);
    this.#running = Math.max(0, this.#running - 1);
    this.#drain();
  }

  /**
   * Check if the scheduler is running a task.
   * @returns {boolean}
   */
  isRunning() {
    return this.#running > 0;
  }

  /**
   * Get the queue length.
   * @returns {number}
   */
  getLength() {
    return this.#queue.length;
  }

  /**
   * Peek at the next queued task without removing it.
   * @returns {Object | null}
   */
  peek() {
    return this.#queue[0] || null;
  }

  /**
   * Get the front task for execution.
   * @returns {Object | null}
   */
  dequeue() {
    const task = this.#queue[0];
    if (task && this.#running < this.#maxConcurrent) {
      this.#queue.shift();
      this.#running++;
      return task;
    }
    return null;
  }

  /**
   * Clear all queued tasks.
   */
  clear() {
    this.#queue = [];
    this.#running = 0;
  }

  #drain() {
    // Auto-drain after state change
  }
}
