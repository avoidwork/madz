/**
 * Tests for the Google Calendar provider.
 * @see {@link src/tools/calendar/providers/google.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";

describe("GoogleCalendarProvider", () => {
  let GoogleCalendarProvider;

  before(async () => {
    const mod = await import("../../../../../src/tools/calendar/providers/google.js");
    GoogleCalendarProvider = mod.GoogleCalendarProvider;
  });

  describe("constructor", () => {
    it("should create instance with empty config", () => {
      const provider = new GoogleCalendarProvider({});
      assert.ok(provider);
      assert.strictEqual(provider.type, "google");
    });

    it("should create instance with apiKey config", () => {
      const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
      assert.ok(provider);
    });

    it("should create instance with serviceAccountKey as JSON string", () => {
      const provider = new GoogleCalendarProvider({
        serviceAccountKey: JSON.stringify({ client_email: "test@test.com", private_key: "key" }),
      });
      assert.ok(provider);
    });
  });

  describe("validateCredentials", () => {
    it("should return invalid when no calendar client", () => {
      const provider = new GoogleCalendarProvider({});
      const result = provider.validateCredentials();
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });
  });

  describe("convertTimezone", () => {
    it("should return original time for UTC", () => {
      const provider = new GoogleCalendarProvider({});
      const result = provider.convertTimezone("2024-01-01T00:00:00Z", "UTC");
      assert.strictEqual(result, "2024-01-01T00:00:00Z");
    });

    it("should return original time for empty timezone", () => {
      const provider = new GoogleCalendarProvider({});
      const result = provider.convertTimezone("2024-01-01T00:00:00Z", "");
      assert.strictEqual(result, "2024-01-01T00:00:00Z");
    });

    it("should convert timezone", () => {
      const provider = new GoogleCalendarProvider({});
      const result = provider.convertTimezone("2024-01-01T00:00:00Z", "America/New_York");
      assert.ok(typeof result === "string");
      assert.ok(result.length > 0);
    });
  });
});
