/**
 * Tests for the MessageList component.
 * @see {@link src/tui/messageList.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("MessageList module", () => {
  it("should export MessageList component", async () => {
    const mod = await import("../../../src/tui/messageList.js");
    assert.strictEqual(typeof mod.MessageList, "object");
  });

  it("should export PubSubProvider component", async () => {
    const mod = await import("../../../src/tui/messageList.js");
    assert.strictEqual(typeof mod.PubSubProvider, "function");
  });
});
