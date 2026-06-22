import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LoopDetector } from '../../src/agent/loop-detector.js';

describe('LoopDetector', () => {
  let detector;
  let loopCallback;

  beforeEach(() => {
    loopCallback = sinon?.stub() ?? (() => {});
    detector = new LoopDetector({
      threshold: 3,
      windowDuration: 100, // 100ms for faster tests
      onLoop: (sentence, frequency) => {
        loopCallback(sentence, frequency);
      },
    });
  });

  describe('processChunk', () => {
    it('should emit loop_detected when sentence exceeds threshold', () => {
      const events = [];
      const testDetector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      // Add the same sentence 4 times (exceeds threshold of 3)
      testDetector.processChunk('Hello world. ');
      testDetector.processChunk('Hello world. ');
      testDetector.processChunk('Hello world. ');
      const events2 = testDetector.processChunk('Hello world.');

      assert.ok(events2.some(e => e.type === 'loop_detected'));
    });

    it('should not emit loop_detected below threshold', () => {
      const events = [];
      const testDetector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      // Add the same sentence 3 times (at threshold, not exceeding)
      testDetector.processChunk('Hello world. ');
      testDetector.processChunk('Hello world. ');
      const events2 = testDetector.processChunk('Hello world.');

      assert.strictEqual(events2.filter(e => e.type === 'loop_detected').length, 0);
    });

    it('should not emit loop_detected for different sentences', () => {
      const events = [];
      const testDetector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      testDetector.processChunk('First sentence. ');
      testDetector.processChunk('Second sentence. ');
      testDetector.processChunk('Third sentence. ');
      const events2 = testDetector.processChunk('Fourth sentence.');

      assert.strictEqual(events2.filter(e => e.type === 'loop_detected').length, 0);
    });

    it('should return empty array for empty chunk', () => {
      const events = detector.processChunk('');
      assert.deepEqual(events, []);
    });

    it('should return empty array for null chunk', () => {
      const events = detector.processChunk(null);
      assert.deepEqual(events, []);
    });
  });

  describe('flush', () => {
    it('should flush remaining buffered text', () => {
      const events = [];
      const testDetector = new LoopDetector({
        threshold: 3,
        windowDuration: 100,
        onLoop: () => events.push({ type: 'loop_detected' }),
      });

      testDetector.processChunk('Hello world');
      const flushEvents = testDetector.flush();
      assert.ok(Array.isArray(flushEvents));
    });

    it('should return empty array when no buffered text', () => {
      const events = detector.flush();
      assert.deepEqual(events, []);
    });
  });

  describe('reset', () => {
    it('should clear the detector state', () => {
      detector.processChunk('Hello world. ');
      detector.reset();
      assert.strictEqual(detector.windowSize, 0);
    });
  });

  describe('threshold', () => {
    it('should use default threshold of 3', () => {
      const testDetector = new LoopDetector();
      assert.strictEqual(testDetector.threshold, 3);
    });

    it('should use custom threshold', () => {
      const testDetector = new LoopDetector({ threshold: 5 });
      assert.strictEqual(testDetector.threshold, 5);
    });
  });

  describe('windowSize', () => {
    it('should return current window size', () => {
      detector.processChunk('Hello world. ');
      assert.strictEqual(detector.windowSize, 1);
    });
  });
});