/**
 * Schedule queue that enforces max_concurrent and FIFO processing.
 * Tasks are enqueued and must be explicitly dequeued by the caller
 * (e.g. via a worker loop). The queue tracks running tasks separately.
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
	 * @param {Object} task - The task to queue (must have `entryName`)
	 * @returns {{ queued: boolean, position: number }}
	 */
	enqueue(task) {
		if (this.#queue.some((t) => t.entryName === task.entryName)) {
			return { queued: false, position: 0 };
		}
		this.#queue.push(task);
		const waiting = this.#queue.length;
		return { queued: true, position: waiting };
	}

	/**
	 * Mark a running task as complete.
	 * The task must have been dequeued first before this is called.
	 * @param {string} _entryName - The schedule entry name (ignored, kept for API compat)
	 * @returns {boolean} true if running > 0, false otherwise
	 */
	complete(_entryName) {
		if (this.#running <= 0) return false;
		this.#running--;
		return true;
	}

	/**
	 * Check if any task is currently running.
	 * @returns {boolean}
	 */
	isRunning() {
		return this.#running > 0;
	}

	/**
	 * Check if a schedule entry is present in the queue.
	 * @param {string} entryName - The schedule entry name
	 * @returns {boolean}
	 */
	hasEntry(entryName) {
		return this.#queue.some((t) => t.entryName === entryName);
	}

	/**
	 * Get the number of queued (waiting) tasks.
	 * @returns {number}
	 */
	getQueueLength() {
		return this.#queue.length;
	}

	/**
	 * Get number of currently running tasks.
	 * @returns {number}
	 */
	getRunning() {
		return this.#running;
	}

	/**
	 * Peek at the next queued task without removing it.
	 * @returns {Object | null}
	 */
	peek() {
		return this.#queue[0] || null;
	}

	/**
	 * Dequeue the next task if under concurrency limit.
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
	 * Clear all queued and running tasks.
	 */
	clear() {
		this.#queue = [];
		this.#running = 0;
	}

	/**
	 * Get all queued tasks.
	 * @returns {Object[]}
	 */
	getAll() {
		return [...this.#queue];
	}
}
