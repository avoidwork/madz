import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SentenceDetector } from '../../src/agent/sentence-detector.js';
import { SlidingWindowTracker } from '../../src/agent/sliding-window-tracker.js';
import { LoopDetector } from '../../src/agent/loop-detector.js';

describe('Streaming Loop Detection Integration', () => {
  describe('7.1 Sentence detection with real streaming chunk patterns', () => {
    it('should handle realistic streaming chunks forming sentences', () => {
      const detector = new SentenceDetector();
      const chunks = [
        'The ',
        'quick ',
        'brown ',
        'fox ',
        'jumps ',
        'over ',
        'the ',
        'lazy ',
        'dog.',
      ];

      let allSentences = [];
      for (const chunk of chunks) {
        const sentences = detector.addChunk(chunk);
        allSentences = allSentences.concat(sentences);
      }

      assert.deepEqual(allSentences, ['The quick brown fox jumps over the lazy dog.']);
    });

    it('should handle multiple sentences from realistic streaming', () => {
      const detector = new SentenceDetector();
      const chunks = [
        'Hello ',
        'world.',
        ' ',
        'How ',
        'are ',
        'you?',
        ' ',
        'I ',
        'am ',
        'fine!',
      ];

      const sentences = detector.addChunk('Hello ');
      assert.deepEqual(sentences, []);

      const sentences2 = detector.addChunk('world.');
      assert.deepEqual(sentences2, ['Hello world.']);

      const sentences3 = detector.addChunk(' How ');
      assert.deepEqual(sentences3, []);

      const sentences4 = detector.addChunk('are you?');
      assert.deepEqual(sentences4, ['How are you?']);

      const sentences5 = detector.addChunk(' I am fine!');
      assert.deepEqual(sentences5, ['I am fine!']);
    });

    it('should handle chunks that arrive out of sentence order', () => {
      const detector = new SentenceDetector();
      // Simulate chunks arriving with punctuation at the end
      detector.addChunk('First sentence. ');
      detector.addChunk('Second sentence. ');
      const sentences = detector.addChunk('Third sentence.');
      assert.deepEqual(sentences, ['Third sentence.']);
    });
  });

  describe('7.2 Loop detection with repetitive streaming text', () => {
    it('should detect loops in repetitive streaming text', () => {
      const events = [];
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      // Simulate repetitive streaming text
      const chunks = [
        'Checking status. ',
        'Checking status. ',
        'Checking status. ',
        'Checking status.',
      ];

      for (const chunk of chunks) {
        const chunkEvents = detector.processChunk(chunk);
        events.push(...chunkEvents);
      }

      assert.ok(events.some(e => e.type === 'loop_detected'));
    });

    it('should not detect false loops in normal text', () => {
      const events = [];
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      const chunks = [
        'Hello ',
        'world. ',
        'This ',
        'is ',
        'a ',
        'normal ',
        'sentence.',
      ];

      for (const chunk of chunks) {
        const chunkEvents = detector.processChunk(chunk);
        events.push(...chunkEvents);
      }

      assert.strictEqual(events.filter(e => e.type === 'loop_detected').length, 0);
    });

    it('should detect loops with case-insensitive matching', () => {
      const events = [];
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      const chunks = [
        'Checking status. ',
        'checking status. ',
        'CHECKING STATUS. ',
        'Checking status.',
      ];

      for (const chunk of chunks) {
        const chunkEvents = detector.processChunk(chunk);
        events.push(...chunkEvents);
      }

      assert.ok(events.some(e => e.type === 'loop_detected'));
    });
  });

  describe('7.3 Nudge injection and handling', () => {
    it('should emit loop_detected event when threshold is exceeded', () => {
      let loopEventEmitted = false;
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => {
          loopEventEmitted = true;
        },
      });

      detector.processChunk('Looping. ');
      detector.processChunk('Looping. ');
      detector.processChunk('Looping. ');
      detector.processChunk('Looping.');

      assert.ok(loopEventEmitted);
    });

    it('should not emit nudge below threshold', () => {
      let loopEventEmitted = false;
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => {
          loopEventEmitted = true;
        },
      });

      detector.processChunk('Not looping. ');
      detector.processChunk('Not looping. ');
      detector.processChunk('Not looping.');

      assert.strictEqual(loopEventEmitted, false);
    });
  });

  describe('7.4 Stream cleanup and state reset', () => {
    it('should reset state after stream completion', () => {
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
      });

      detector.processChunk('Some text. ');
      detector.processChunk('More text.');
      detector.reset();

      assert.strictEqual(detector.windowSize, 0);
    });

    it('should allow new stream after reset', () => {
      const events = [];
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      // First stream
      detector.processChunk('First stream. ');
      detector.reset();

      // Second stream - should be independent
      detector.processChunk('Second stream. ');
      detector.processChunk('Second stream. ');
      detector.processChunk('Second stream. ');
      detector.processChunk('Second stream.');

      assert.ok(events.some(e => e.type === 'loop_detected'));
    });

    it('should handle rapid reset and reuse', () => {
      const detector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
      });

      for (let i = 0; i < 10; i++) {
        detector.processChunk(`Stream ${i}. `);
        detector.reset();
      }

      assert.strictEqual(detector.windowSize, 0);
    });
  });

  describe('7.5 Concurrent streams have independent samplers', () => {
    it('should maintain independent state for separate detector instances', () => {
      const detector1 = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
      });
      const detector2 = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
      });

      // Stream 1
      detector1.processChunk('Stream 1 text. ');
      detector1.processChunk('Stream 1 text. ');

      // Stream 2
      detector2.processChunk('Stream 2 text. ');
      detector2.processChunk('Stream 2 text. ');

      // Each should have independent state
      assert.strictEqual(detector1.windowSize, 2);
      assert.strictEqual(detector2.windowSize, 2);

      // Reset one should not affect the other
      detector1.reset();
      assert.strictEqual(detector1.windowSize, 0);
      assert.strictEqual(detector2.windowSize, 2);
    });

    it('should handle different thresholds per stream', () => {
      const detector1 = new LoopDetector({
        threshold: 2,
        windowDuration: 100,
      });
      const detector2 = new LoopDetector({
        threshold: 5,
        windowDuration: 100,
      });

      detector1.processChunk('Text. ');
      detector1.processChunk('Text. ');
      assert.strictEqual(detector1.threshold, 2);

      detector2.processChunk('Text. ');
      detector2.processChunk('Text. ');
      assert.strictEqual(detector2.threshold, 5);
    });
  });
});