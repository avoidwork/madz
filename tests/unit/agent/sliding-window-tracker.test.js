import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindowTracker } from '../../src/agent/sliding-window-tracker.js';

describe('SlidingWindowTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new SlidingWindowTracker(100); // 100ms window for faster tests
  });

  describe('addSentence', () => {
    it('should add a sentence to the window', () => {
      const count = tracker.addSentence('Hello world');
      assert.strictEqual(count, 1);
      assert.strictEqual(tracker.size, 1);
    });

    it('should return frequency count of 1 for new sentence', () => {
      const count = tracker.addSentence('New sentence');
      assert.strictEqual(count, 1);
    });

    it('should return 0 for empty sentence', () => {
      const count = tracker.addSentence('');
      assert.strictEqual(count, 0);
    });

    it('should return 0 for null sentence', () => {
      const count = tracker.addSentence(null);
      assert.strictEqual(count, 0);
    });

    it('should increment frequency for repeated sentence', () => {
      tracker.addSentence('Hello world');
      const count = tracker.addSentence('Hello world');
      assert.strictEqual(count, 2);
      assert.strictEqual(tracker.size, 2);
    });

    it('should treat case-insensitive sentences as same', () => {
      tracker.addSentence('Hello world');
      const count = tracker.addSentence('hello world');
      assert.strictEqual(count, 2);
    });

    it('should treat whitespace-different sentences as same', () => {
      tracker.addSentence('  Hello world  ');
      const count = tracker.addSentence('Hello world');
      assert.strictEqual(count, 2);
    });
  });

  describe('getFrequency', () => {
    it('should return frequency of a sentence in the window', () => {
      tracker.addSentence('Hello world');
      tracker.addSentence('Hello world');
      const freq = tracker.getFrequency('Hello world');
      assert.strictEqual(freq, 2);
    });

    it('should return 0 for sentence not in window', () => {
      tracker.addSentence('Hello world');
      const freq = tracker.getFrequency('Goodbye world');
      assert.strictEqual(freq, 0);
    });

    it('should return 0 for empty sentence', () => {
      const freq = tracker.getFrequency('');
      assert.strictEqual(freq, 0);
    });
  });

  describe('getSentences', () => {
    it('should return all sentences in the window', () => {
      tracker.addSentence('First');
      tracker.addSentence('Second');
      const sentences = tracker.getSentences();
      assert.strictEqual(sentences.length, 2);
      assert.strictEqual(sentences[0].sentence, 'First');
      assert.strictEqual(sentences[1].sentence, 'Second');
    });

    it('should return empty array when window is empty', () => {
      const sentences = tracker.getSentences();
      assert.strictEqual(sentences.length, 0);
    });
  });

  describe('size', () => {
    it('should return number of sentences in window', () => {
      tracker.addSentence('One');
      tracker.addSentence('Two');
      tracker.addSentence('Three');
      assert.strictEqual(tracker.size, 3);
    });

    it('should return 0 when empty', () => {
      assert.strictEqual(tracker.size, 0);
    });
  });

  describe('clear', () => {
    it('should remove all sentences from the window', () => {
      tracker.addSentence('Hello');
      tracker.addSentence('World');
      tracker.clear();
      assert.strictEqual(tracker.size, 0);
      assert.strictEqual(tracker.getSentences().length, 0);
    });
  });

  describe('expiration', () => {
    it('should expire old sentences after window duration', (t) => {
      tracker.addSentence('Old sentence');
      assert.strictEqual(tracker.size, 1);

      // Wait for window to expire
      t.after(() => {
        // Force expiration by waiting
      });

      // Use a shorter approach: manually manipulate timestamps
      // For this test, we'll use a custom tracker with immediate expiration
      const fastTracker = new SlidingWindowTracker(0);
      fastTracker.addSentence('Test');
      // With 0ms window, sentences should expire immediately on next add
      fastTracker.addSentence('New');
      // The old sentence should have expired
      assert.strictEqual(fastTracker.size, 1);
    });

    it('should keep recent sentences', () => {
      tracker.addSentence('Recent');
      assert.strictEqual(tracker.size, 1);
    });
  });

  describe('normalization', () => {
    it('should normalize sentences for comparison', () => {
      tracker.addSentence('HELLO WORLD');
      const freq = tracker.getFrequency('hello world');
      assert.strictEqual(freq, 1);
    });

    it('should trim whitespace before comparing', () => {
      tracker.addSentence('  Hello World  ');
      const freq = tracker.getFrequency('Hello World');
      assert.strictEqual(freq, 1);
    });
  });
});