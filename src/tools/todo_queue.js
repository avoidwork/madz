/**
 * TodoQueue — deterministic, promise-based execution queue for todo tool actions.
 *
 * All todo mutations (create, update, complete, delete) are enqueued and executed
 * sequentially. Each enqueue call returns a promise that resolves with the operation
 * result when the action completes.
 *
 * The queue emits status events via a subscriber callback:
 *   - queued:      action added to queue
 *   - processing:  action began execution
 *   - completed:   action finished successfully
 *   - failed:      action failed with error
 *
 * When a streaming callback is set (via setTodoStreamingCallback), these events
 * are also emitted to the LangGraph stream as `todo_status` events, which the TUI
 * renders inline with the conversation.
 */

const VALID_ACTIONS = ["read", "create", "update", "complete", "delete", "list", "clear"];

/**
 * Global streaming callback — set by the TUI to wire queue events into the stream.
 * @type {((event: object) => void) | null}
 */
let _streamingCallback = null;

/**
 * Set the streaming callback for the todo queue.
 * Called by the TUI to wire queue events into the conversation stream.
 * @param {((event: object) => void) | null} callback - The streaming callback
 */
export function setTodoStreamingCallback(callback) {
	_streamingCallback = callback;
}

/**
 * Create a new TodoQueue instance.
 * @param {object} [options]
 * @param {string} [options.filePath] - Path to the todo JSON file
 * @param {number} [options.maxTodos] - Maximum number of todos allowed
 * @param {(event: TodoQueueEvent) => void} [options.onEvent] - Status event callback
 * @returns {TodoQueue}
 */
export function createTodoQueue(options = {}) {
	return new TodoQueue(options);
}

/**
 * @typedef {Object} TodoQueueEvent
 * @property {"queued" | "processing" | "completed" | "failed"} type
 * @property {string} action - The todo action (create, update, etc.)
 * @property {string} [key] - The todo key (for create/update/complete/delete)
 * @property {string} [content] - The todo content (for create)
 * @property {string} [message] - Human-readable status message
 * @property {Error} [error] - Error object if type is "failed"
 */

/**
 * @typedef {Object} TodoQueueStats
 * @property {number} queued - Actions currently in queue
 * @property {boolean} processing - Whether an action is currently executing
 * @property {number} totalCompleted - Total actions completed since creation
 * @property {number} totalFailed - Total actions failed since creation
 */

class TodoQueue {
	/**
	 * @param {object} [options]
	 * @param {string} [options.filePath] - Path to the todo JSON file
	 * @param {number} [options.maxTodos] - Maximum number of todos allowed
	 * @param {(event: TodoQueueEvent) => void} [options.onEvent] - Status event callback
	 */
	constructor(options = {}) {
		this.filePath = options.filePath || "memory/tools/todo.json";
		this.maxTodos = options.maxTodos;
		this._onEvent = options.onEvent || (() => {});

		// Promise chain: each action appends to the chain
		this._chain = Promise.resolve();

		// Execution state — tracks whether an action is currently running
		this._processing = false;

		// Stats
		this._totalCompleted = 0;
		this._totalFailed = 0;
	}

	/**
	 * Enqueue a todo action. Returns a promise that resolves when the action completes.
	 * @param {object} input - The tool input (action, key, content, etc.)
	 * @returns {Promise<object>} Result of the operation
	 */
	enqueue(input) {
		const { action, key, content } = input;
		const actionLabel = VALID_ACTIONS.includes(action) ? action : "unknown";
		const keyLabel = key ? `'${key}'` : "(unnamed)";

		// Emit queued event
		this._emitEvent({
			type: "queued",
			action: actionLabel,
			key,
			content,
			message: `${actionLabel} ${keyLabel} queued`,
		});

		// Append to the promise chain
		const resultPromise = this._chain.then(async () => {
			// Mark processing — set before emitting so stats are accurate
			this._processing = true;

			// Emit processing event
			this._emitEvent({
				type: "processing",
				action: actionLabel,
				key,
				content,
				message: `Executing ${actionLabel} ${keyLabel}...`,
			});

			try {
				// Execute the actual todo logic
				const { todoImpl } = await import("./todo_logic.js");
				const result = await todoImpl(input, {
					filePath: this.filePath,
					maxTodos: this.maxTodos,
				});

				if (result.ok) {
					this._totalCompleted++;
					this._emitEvent({
						type: "completed",
						action: actionLabel,
						key,
						message: `${actionLabel} ${keyLabel} completed`,
					});
					return result;
				} else {
					this._totalFailed++;
					this._emitEvent({
						type: "failed",
						action: actionLabel,
						key,
						message: `${actionLabel} ${keyLabel} failed: ${result.error}`,
						error: new Error(result.error),
					});
					return result;
				}
			} catch (err) {
				this._totalFailed++;
				this._emitEvent({
					type: "failed",
					action: actionLabel,
					key,
					message: `${actionLabel} ${keyLabel} error: ${err.message}`,
					error: err,
				});
				return { ok: false, error: err.message };
			} finally {
				// Mark not processing — always runs regardless of outcome
				this._processing = false;
			}
		});

		// Append the result promise to the chain so subsequent actions wait for it
		this._chain = resultPromise.catch(() => {
			// Swallow errors at the chain level to prevent blocking
		});

		return resultPromise;
	}

	/**
	 * Emit a status event to both the subscriber callback and the streaming callback.
	 * @param {TodoQueueEvent} event - The event to emit
	 * @private
	 */
	_emitEvent(event) {
		// Call the subscriber callback
		this._onEvent(event);

		// Call the streaming callback if set (for TUI display)
		if (_streamingCallback) {
			_streamingCallback({
				type: "todo_status",
				...event,
			});
		}
	}

	/**
	 * Get current queue statistics.
	 * @returns {TodoQueueStats}
	 */
	getStats() {
		return {
			queued: this._getQueueDepth(),
			processing: !this._chainFulfilled(),
			totalCompleted: this._totalCompleted,
			totalFailed: this._totalFailed,
		};
	}

	/**
	 * Subscribe to status events.
	 * @param {(event: TodoQueueEvent) => void} callback
	 * @returns {() => void} Unsubscribe function
	 */
	subscribe(callback) {
		const prev = this._onEvent;
		this._onEvent = (event) => {
			prev(event);
			callback(event);
		};
		return () => {
			this._onEvent = prev;
		};
	}

	/**
	 * Reset the queue (clear stats and reset chain).
	 */
	reset() {
		this._chain = Promise.resolve();
		this._totalCompleted = 0;
		this._totalFailed = 0;
	}

	// --- Private helpers ---

	/**
	 * Check if the current chain is fulfilled (no action currently executing).
	 * @returns {boolean}
	 * @private
	 */
	_chainFulfilled() {
		return !this._processing;
	}

	/**
	 * Estimate queue depth.
	 * @returns {number}
	 * @private
	 */
	_getQueueDepth() {
		return this._chainFulfilled() ? 0 : 1;
	}
}

export { TodoQueue, VALID_ACTIONS };
