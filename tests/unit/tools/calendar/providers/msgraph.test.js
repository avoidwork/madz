/**
 * Tests for the MS Graph Calendar provider.
 * @see {@link src/tools/calendar/providers/msgraph.js}
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";

describe("MsGraphProvider", () => {
  let MsGraphProvider;

  before(async () => {
    const mod = await import("../../../../../src/tools/calendar/providers/msgraph.js");
    MsGraphProvider = mod.MsGraphProvider;
  });

  describe("constructor", () => {
    it("should set type to msgraph", () => {
      const provider = new MsGraphProvider({});
      assert.strictEqual(provider.type, "msgraph");
    });
  });

  describe("validateCredentials", () => {
    it("should return invalid when no client initialized", () => {
      const provider = new MsGraphProvider({});
      const result = provider.validateCredentials();
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });
  });
});
