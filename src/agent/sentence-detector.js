/**
 * Sentence boundary detector for streaming text.
 *
 * Buffers incoming text chunks and emits complete sentences when
 * sentence boundary characters (`.`, `!`, `?`) are detected.
 * Handles partial chunks, multiple sentences per chunk, and edge cases.
 */

/**
 * SentenceDetector buffers streaming chunks and emits complete sentences.
 */
export class SentenceDetector {
  /**
   * Create a new SentenceDetector.
   */
  constructor() {
    this._buffer = '';
  }

  /**
   * Add a text chunk to the buffer and emit any complete sentences.
   *
   * @param {string} chunk - The text chunk to process.
   * @returns {string[]} Array of complete sentences emitted from this chunk.
   */
  addChunk(chunk) {
    if (!chunk || typeof chunk !== 'string') {
      return [];
    }

    this._buffer += chunk;
    const sentences = [];

    // Process the buffer, extracting complete sentences
    while (this._buffer.length > 0) {
      const boundaryIndex = this._findSentenceBoundary(this._buffer);

      if (boundaryIndex === -1) {
        // No complete sentence found — keep buffering
        // But don't buffer too much; keep only the last few chars in case
        // we're waiting for a boundary that's coming
        if (this._buffer.length > 100) {
          // Keep the last 50 chars in case a boundary is coming soon
          const remaining = this._buffer.slice(-50);
          this._buffer = remaining;
        }
        break;
      }

      // Extract the sentence up to and including the boundary character
      const sentence = this._buffer.slice(0, boundaryIndex + 1).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      this._buffer = this._buffer.slice(boundaryIndex + 1);
    }

    return sentences;
  }

  /**
   * Flush any remaining buffered text as a sentence (for end-of-stream).
   *
   * @returns {string[]} Any remaining buffered text as a sentence.
   */
  flush() {
    const remaining = this._buffer.trim();
    this._buffer = '';
    return remaining.length > 0 ? [remaining] : [];
  }

  /**
   * Reset the detector state.
   */
  reset() {
    this._buffer = '';
  }

  /**
   * Find the index of the next sentence boundary in the text.
   *
   * Handles edge cases:
   * - `...` (ellipsis) — treat as boundary
   * - `?!` or `!?` — treat as boundary
   * - `. ` followed by whitespace — boundary (not abbreviation like "Mr.")
   * - Standalone `.`, `!`, `?` — boundary
   *
   * @param {string} text - The text to search for a boundary.
   * @returns {number} Index of the boundary character, or -1 if none found.
   */
  _findSentenceBoundary(text) {
    const maxSearch = Math.min(text.length, 200);

    for (let i = 0; i < maxSearch; i++) {
      const char = text[i];

      if (char === '.' || char === '!' || char === '?') {
        // Check for ellipsis `...`
        if (char === '.' && text[i + 1] === '.' && text[i + 2] === '.') {
          // Ellipsis — boundary at the third dot
          return i + 2;
        }

        // Check for `?!` or `!?`
        if (char === '?' && text[i + 1] === '!') {
          return i + 1;
        }
        if (char === '!' && text[i + 1] === '?') {
          return i + 1;
        }

        // Standalone `.`, `!`, `?` — always a boundary
        if (char === '!' || char === '?') {
          return i;
        }

        // For `.`, check if followed by whitespace or end of text
        // This handles abbreviations like "Mr." where the period is NOT a boundary
        if (char === '.') {
          const nextChar = text[i + 1];
          // End of text or followed by whitespace/newline = boundary
          if (!nextChar || /\s/.test(nextChar)) {
            return i;
          }
          // Not a boundary (likely an abbreviation)
          continue;
        }
      }
    }

    return -1;
  }
}