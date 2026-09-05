/**
 * Tests for the TUI App component.
 * @see {@link src/tui/app.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// App is a React component using Ink. We test the module exports and structure.
describe("App module", () => {
  it("should export a default function", async () => {
    const mod = await import("../../../src/tui/app.js");
    assert.strictEqual(typeof mod.default, "function");
  });
});
