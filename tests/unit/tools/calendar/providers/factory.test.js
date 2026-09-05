/**
 * Tests for the calendar provider factory.
 * @see {@link src/tools/calendar/providers/factory.js}
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";

describe("getActiveCalendarProvider", () => {
  let getActiveCalendarProvider;

  before(async () => {
    const mod = await import("../../../../../src/tools/calendar/providers/factory.js");
    getActiveCalendarProvider = mod.getActiveCalendarProvider;
  });

  it("should return null when no calendar config", () => {
    const result = getActiveCalendarProvider({});
    assert.strictEqual(result, null);
  });

  it("should return null when calendar config is null", () => {
    const result = getActiveCalendarProvider({ calendar: null });
    assert.strictEqual(result, null);
  });

  it("should return GoogleCalendarProvider when active is google", () => {
    const result = getActiveCalendarProvider({
      calendar: { active: "google", google: {} },
    });
    assert.ok(result);
    assert.strictEqual(result.type, "google");
  });

  it("should return MsGraphProvider when active is msgraph", () => {
    const result = getActiveCalendarProvider({
      calendar: { active: "msgraph", msgraph: {} },
    });
    assert.ok(result);
    assert.strictEqual(result.type, "msgraph");
  });

  it("should default to google when no active specified", () => {
    const result = getActiveCalendarProvider({
      calendar: { google: {} },
    });
    assert.ok(result);
    assert.strictEqual(result.type, "google");
  });

  it("should return null for unknown provider type", () => {
    const result = getActiveCalendarProvider({
      calendar: { active: "unknown" },
    });
    assert.strictEqual(result, null);
  });
});
