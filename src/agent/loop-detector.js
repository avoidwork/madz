/**
 * Loop detection pipeline that combines sentence detection with sliding window tracking.
 *
 * Monitors streaming text for repetitive sentences and emits loop_detected events
 * when a sentence appears more than the threshold times within the sliding window.
 */

import { SentenceDetector } from './sentence-detector.js';
import { SlidingWindowTracker } from './sliding-window-tracker.js';

const DEFAULT_THRESHOLD = 3; // Trigger when sentence appears >3 times

/**
 * LoopDetector combines sentence detection with sliding window tracking
 * to detect repetitive patterns in streaming text.
 */
export class LoopDetector {
  /**
   * Create a new LoopDetector.
   * @param {Object} [options] - Configuration options.
   * @param {number} [options.threshold=3] - Number of occurrences to trigger loop detection.
   * @param {number} [options.windowDuration=30000] - Sliding window duration in ms.
   * @param {Function} [options.onLoop] - Callback invoked when a loop is detected.
   */
  constructor(options = {}) {
    this._threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this._onLoop = options.onLoop ?? (() => {});
    this._detector = new SentenceDetector();
    this._tracker = new SlidingWindowTracker(options.windowDuration);
  }

  /**
   * Process a text chunk through the loop detection pipeline.
   *
   * @param {string} chunk - The text chunk to process.
   * @returns {Array<{type: string}>} Array of events emitted (may include loop_detected).
   */
  processChunk(chunk) {
    if (!chunk || typeof chunk !== 'string') {
      return [];
    }

    const events = [];
    const sentences = this._detector.addChunk(chunk);

    for (const sentence of sentences) {
      const frequency = this._tracker.addSentence(sentence);

      // Trigger if frequency exceeds threshold
      if (frequency > this._threshold) {
        events.push({ type: 'loop_detected' });
        // Invoke callback
        this._onLoop(sentence, frequency);
      }
    }

    return events;
  }

  /**
   * Flush any remaining buffered text and check for loops.
   *
   * @returns {Array<{type: string}>} Array of events emitted.
   */
  flush() {
    const sentences = this._detector.flush();
    const events = [];

    for (const sentence of sentences) {
      const frequency = this._tracker.addSentence(sentence);

      if (frequency > this._threshold) {
        events.push({ type: 'loop_detected' });
        this._onLoop(sentence, frequency);
      }
    }

    return events;
  }

  /**
   * Reset the detector state.
   */
  reset() {
    this._detector.reset();
    this._tracker.clear();
  }

  /**
   * Get the current threshold value.
   * @returns {number}
   */
  get threshold() {
    return this._threshold;
  }

  /**
   * Get the current window size.
   * @returns {number}
   */
  get windowSize() {
    return this._tracker.size;
  }
}