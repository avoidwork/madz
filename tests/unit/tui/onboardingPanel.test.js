/**
 * Tests for the OnboardingPanel component.
 * @see {@link src/tui/onboardingPanel.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("OnboardingPanel module", () => {
  it("should export OnboardingPanel function", async () => {
    const mod = await import("../../../src/tui/onboardingPanel.js");
    assert.strictEqual(typeof mod.OnboardingPanel, "function");
  });
});
