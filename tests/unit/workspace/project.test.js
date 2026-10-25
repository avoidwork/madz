import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { getProjectCwd, setProjectCwd } from "../../../src/workspace/project.js";

describe("workspace - project store", () => {
	beforeEach(() => {
		setProjectCwd("");
	});

	it("defaults to an empty string", () => {
		assert.strictEqual(getProjectCwd(), "");
	});

	it("stores the active project cwd", () => {
		setProjectCwd("/tmp/project-a");
		assert.strictEqual(getProjectCwd(), "/tmp/project-a");
	});

	it("clears the active project cwd with an empty string", () => {
		setProjectCwd("/tmp/project-a");
		setProjectCwd("");
		assert.strictEqual(getProjectCwd(), "");
	});

	it("treats a falsy value as a clear", () => {
		setProjectCwd("/tmp/project-a");
		setProjectCwd(null);
		assert.strictEqual(getProjectCwd(), "");
	});
});
