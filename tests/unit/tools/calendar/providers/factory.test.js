/**
 * Tests for the calendar provider factory.
 * @see {@link src/tools/calendar/providers/factory.js}
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";

describe("getActiveCalendarProvider", () => {
	let getActiveCalendarProvider;

	before(async () => {
		const mod = await import("../../../../../src/tools/calendar/providers/factory.js");
		getActiveCalendarProvider = mod.getActiveCalendarProvider;
	});

	it("should return null when no calendar config", async () => {
		const result = await getActiveCalendarProvider({});
		assert.strictEqual(result, null);
	});

	it("should return null when calendar config is null", async () => {
		const result = await getActiveCalendarProvider({ calendar: null });
		assert.strictEqual(result, null);
	});

	it("should return GoogleCalendarProvider when active is google", async () => {
		const result = await getActiveCalendarProvider({
			calendar: { active: "google", google: {} },
		});
		assert.ok(result);
		assert.strictEqual(result.type, "google");
	});

	it("should return MsGraphProvider when active is msgraph", async () => {
		const result = await getActiveCalendarProvider({
			calendar: { active: "msgraph", msgraph: {} },
		});
		assert.ok(result);
		assert.strictEqual(result.type, "msgraph");
	});

	it("should default to google when no active specified", async () => {
		const result = await getActiveCalendarProvider({
			calendar: { google: {} },
		});
		assert.ok(result);
		assert.strictEqual(result.type, "google");
	});

	it("should return null for unknown provider type", async () => {
		const result = await getActiveCalendarProvider({
			calendar: { active: "unknown" },
		});
		assert.strictEqual(result, null);
	});
});
