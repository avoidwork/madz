import { describe, it } from "node:test";
import assert from "node:assert";
import { gatherSystemInfo, formatBytes } from "../../../src/tui/systemPanel.js";

describe("gatherSystemInfo", () => {
	it("returns correctly shaped system info", () => {
		const info = gatherSystemInfo();
		assert.ok(Number.isInteger(info.cpu.count));
		assert.ok(info.cpu.count >= 1);
		assert.ok(typeof info.memory.total === "number");
		assert.ok(typeof info.memory.free === "number");
		assert.ok(typeof info.memory.used === "number");
		assert.ok(typeof info.uptime === "number");
		assert.ok(typeof info.platform === "string");
		assert.ok(typeof info.release === "string");
		assert.ok(typeof info.nodeVersion === "string");
		assert.ok(info.nodeVersion.startsWith("v"));
		assert.ok(info.processMemory && typeof info.processMemory.rss === "number");
	});

	it("reports load average as null when unavailable", () => {
		const info = gatherSystemInfo();
		// loadavg may be null on some platforms; assert it is either null or a number
		assert.ok(info.cpu.load === null || typeof info.cpu.load === "number");
	});

	it("handles missing fs.statfs support gracefully", () => {
		const info = gatherSystemInfo();
		// disk.available is a boolean; when false, no total/free are required
		assert.ok(typeof info.disk.available === "boolean");
		if (info.disk.available) {
			assert.ok(typeof info.disk.total === "number");
			assert.ok(typeof info.disk.free === "number");
		}
	});
});

describe("formatBytes", () => {
	it("formats byte counts as human-readable strings", () => {
		assert.strictEqual(formatBytes(0), "0.0 B");
		assert.strictEqual(formatBytes(1024), "1.0 KB");
		assert.strictEqual(formatBytes(1024 * 1024), "1.0 MB");
		assert.strictEqual(formatBytes(1024 * 1024 * 1024), "1.0 GB");
	});

	it("returns unavailable for invalid input", () => {
		assert.strictEqual(formatBytes(-1), "unavailable");
		assert.strictEqual(formatBytes(NaN), "unavailable");
		assert.strictEqual(formatBytes(Infinity), "unavailable");
	});
});
