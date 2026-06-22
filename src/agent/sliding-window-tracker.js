/**
 * Sliding window sentence tracker for loop detection.
 *
 * Maintains a 30-second sliding window of recent sentences with timestamps,
 * releases old sentences, and tracks sentence frequency for repetition detection.
 */

const WINDOW_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * SlidingWindowTracker maintains a time-based window of sentences with frequency tracking.
 */
export class SlidingWindowTracker {
  /**
   * Create a new SlidingWindowTracker.
   * @param {number} [windowDuration=30000] - Window duration in milliseconds (default 30s).
   */
  constructor(windowDuration = WINDOW_DURATION_MS) {
    this._windowDuration = windowDuration;
    // Array of { sentence, timestamp, normalized } objects
    this._window = [];
  }

  /**
   * Add a sentence to the sliding window.
   *
   * @param {string} sentence - The sentence to add.
   * @returns {number} The frequency count of this sentence within the window.
   */
  addSentence(sentence) {
    if (!sentence || typeof sentence !== 'string') {
      return 0;
    }

    const normalized = this._normalize(sentence);
    const now = Date.now();

    this._window.push({
      sentence,
      timestamp: now,
      normalized,
    });

    // Expire old sentences
    this._expireOld();

    // Count frequency of this normalized sentence
    return this._countFrequency(normalized);
  }

  /**
   * Get the current frequency of a sentence within the window.
   *
   * @param {string} sentence - The sentence to check.
   * @returns {number} The frequency count.
   */
  getFrequency(sentence) {
    if (!sentence) return 0;
    const normalized = this._normalize(sentence);
    return this._countFrequency(normalized);
  }

  /**
   * Get all sentences currently in the window.
   *
   * @returns {Array<{sentence: string, timestamp: number, normalized: string}>}
   */
  getSentences() {
    return [...this._window];
  }

  /**
   * Get the number of sentences in the window.
   *
   * @returns {number}
   */
  get size() {
    return this._window.length;
  }

  /**
   * Clear the window.
   */
  clear() {
    this._window = [];
  }

  /**
   * Normalize a sentence for comparison (trim whitespace, lowercase).
   *
   * @param {string} sentence - The sentence to normalize.
   * @returns {string} The normalized sentence.
   */
  _normalize(sentence) {
    return sentence.trim().toLowerCase();
  }

  /**
   * Remove sentences older than the window duration.
   */
  _expireOld() {
    const cutoff = Date.now() - this._windowDuration;
    this._window = this._window.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Count occurrences of a normalized sentence in the window.
   *
   * @param {string} normalized - The normalized sentence to count.
   * @returns {number} The frequency count.
   */
  _countFrequency(normalized) {
    return this._window.filter(entry => entry.normalized === normalized).length;
  }
}