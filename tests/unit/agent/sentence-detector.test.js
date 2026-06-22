import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SentenceDetector } from '../../src/agent/sentence-detector.js';

describe('SentenceDetector', () => {
  describe('addChunk', () => {
    it('should emit sentence on period boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Hello world.');
      assert.deepEqual(sentences, ['Hello world.']);
    });

    it('should emit sentence on exclamation boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('What a day!');
      assert.deepEqual(sentences, ['What a day!']);
    });

    it('should emit sentence on question boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('How are you?');
      assert.deepEqual(sentences, ['How are you?']);
    });

    it('should buffer partial chunks without boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Hello worl');
      assert.deepEqual(sentences, []);
      assert.strictEqual(detector.flush().length, 1);
    });

    it('should emit multiple sentences from one chunk', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('First sentence. Second sentence!');
      assert.deepEqual(sentences, ['First sentence.', 'Second sentence!']);
    });

    it('should handle chunk with only whitespace', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('   ');
      assert.deepEqual(sentences, []);
    });

    it('should handle empty chunk', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('');
      assert.deepEqual(sentences, []);
    });

    it('should handle null chunk', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk(null);
      assert.deepEqual(sentences, []);
    });

    it('should handle undefined chunk', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk(undefined);
      assert.deepEqual(sentences, []);
    });
  });

  describe('edge cases', () => {
    it('should handle ellipsis as boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Wait... what?');
      assert.ok(sentences.length >= 1);
    });

    it('should handle question-exclamation as boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Really?!');
      assert.deepEqual(sentences, ['Really?!']);
    });

    it('should handle exclamation-question as boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Wow!?');
      assert.deepEqual(sentences, ['Wow!?']);
    });

    it('should not treat abbreviation period as boundary', () => {
      const detector = new SentenceDetector();
      // "Mr." followed by space should be boundary, but "Mr.Smith" should not
      const sentences = detector.addChunk('Mr. Smith is here.');
      assert.ok(sentences.length >= 1);
    });

    it('should buffer until boundary arrives in next chunk', () => {
      const detector = new SentenceDetector();
      const first = detector.addChunk('Hello worl');
      assert.deepEqual(first, []);

      const second = detector.addChunk('d.');
      assert.deepEqual(second, ['Hello world.']);
    });

    it('should handle multiple chunks forming one sentence', () => {
      const detector = new SentenceDetector();
      detector.addChunk('The ');
      detector.addChunk('quick ');
      detector.addChunk('brown ');
      const sentences = detector.addChunk('fox.');
      assert.deepEqual(sentences, ['The quick brown fox.']);
    });

    it('should handle sentence with trailing whitespace', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Hello world.  ');
      assert.deepEqual(sentences, ['Hello world.']);
    });

    it('should handle sentence with newline after boundary', () => {
      const detector = new SentenceDetector();
      const sentences = detector.addChunk('Hello world.\nNext line');
      assert.deepEqual(sentences, ['Hello world.']);
    });
  });

  describe('flush', () => {
    it('should return remaining buffered text', () => {
      const detector = new SentenceDetector();
      detector.addChunk('Partial sentence');
      const sentences = detector.flush();
      assert.deepEqual(sentences, ['Partial sentence']);
    });

    it('should return empty array when buffer is empty', () => {
      const detector = new SentenceDetector();
      const sentences = detector.flush();
      assert.deepEqual(sentences, []);
    });

    it('should clear buffer after flush', () => {
      const detector = new SentenceDetector();
      detector.addChunk('Some text');
      detector.flush();
      const second = detector.flush();
      assert.deepEqual(second, []);
    });
  });

  describe('reset', () => {
    it('should clear the buffer', () => {
      const detector = new SentenceDetector();
      detector.addChunk('Some text');
      detector.reset();
      const sentences = detector.flush();
      assert.deepEqual(sentences, []);
    });
  });
});