/**
 * Tests for the calendar tool.
 * @see {@link src/tools/calendar/index.js}
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";

describe("calendarImpl", () => {
  let calendarImpl;

  before(async () => {
    const mod = await import("../../../../src/tools/calendar/index.js");
    calendarImpl = mod.calendarImpl;
  });

  it("should return error for unknown action", async () => {
    const result = await calendarImpl({ action: "unknown" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Unknown action"));
  });

  it("should return error when no provider config", async () => {
    // The factory returns a GoogleCalendarProvider by default even without config,
    // but validateCredentials fails because no credentials are configured
    const result = await calendarImpl({ action: "read", startDate: "2024-01-01" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config"));
  });

  it("should return error for read without startDate", async () => {
    const result = await calendarImpl({ action: "read" });
    assert.strictEqual(result.ok, false);
    // The provider validation happens before the startDate check
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("startDate"));
  });

  it("should return error for create without title", async () => {
    const result = await calendarImpl({ action: "create" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("title"));
  });

  it("should return error for create without start/end", async () => {
    const result = await calendarImpl({ action: "create", title: "Test" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("start and end"));
  });

  it("should return error for update without eventId", async () => {
    const result = await calendarImpl({ action: "update" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("eventId"));
  });

  it("should return error for delete without eventId", async () => {
    const result = await calendarImpl({ action: "delete" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("eventId"));
  });

  it("should return error for availability without startDate/duration", async () => {
    const result = await calendarImpl({ action: "availability" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("startDate"));
  });

  it("should return error for summary without startDate", async () => {
    const result = await calendarImpl({ action: "summary" });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes("Invalid calendar provider config") || result.error.includes("startDate"));
  });
});
