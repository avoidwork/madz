/**
 * Tests for the ConversationArea component.
 * @see {@link src/tui/conversationArea.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("ConversationArea module", () => {
  it("should have a default export", async () => {
    const mod = await import("../../../src/tui/conversationArea.js");
    assert.ok(mod.default);
  });
});
