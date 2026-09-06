import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createOnboarding, Onboarding, PHASES } from "../../src/session/onboarding.js";
import { ATTRIBUTES } from "../../src/memory/profile.js";

// ---------------------------------------------------------------------------
// The Onboarding class internally calls getAttribute() from profile.js which
// indexes into the real ATTRIBUTES array.  To keep tests accurate we use the
// real ATTRIBUTES for state-machine tests that exercise the COLLECT phase.
// ---------------------------------------------------------------------------
const TEST_DIR = "memory/__session_onboard_test__";
const FULL_TEST_DIR = join(process.cwd(), TEST_DIR);

function setup() {
	try {
		rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	mkdirSync(FULL_TEST_DIR, { recursive: true });
}

function teardown() {
	try {
		rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

beforeEach(setup);
after(teardown);

/**
 * Create an Onboarding instance with a test profile path.
 * @param {Object} [options] - Extra options (e.g. onSave)
 * @returns {Onboarding}
 */
function create(options = {}) {
	return createOnboarding(ATTRIBUTES, {
		profilePath: join(FULL_TEST_DIR, "profile.md"),
		...options,
	});
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
describe("exports", () => {
	it("exports createOnboarding function", () => {
		assert.strictEqual(typeof createOnboarding, "function");
	});

	it("exports Onboarding class", () => {
		assert.strictEqual(typeof Onboarding, "function");
	});

	it("exports PHASES as a frozen constant", () => {
		assert.deepStrictEqual(PHASES, {
			INIT: "INIT",
			ATTRACTOR: "ATTRACTOR",
			COLLECT: "COLLECT",
			SAVE: "SAVE",
			TRANSCEND: "TRANSCEND",
		});
		assert.ok(Object.isFrozen(PHASES));
	});
});

// ---------------------------------------------------------------------------
// createOnboarding
// ---------------------------------------------------------------------------
describe("createOnboarding", () => {
	it("returns an Onboarding instance", () => {
		const ob = create();
		assert.ok(ob instanceof Onboarding);
	});

	it("starts in INIT phase", () => {
		const ob = create();
		assert.strictEqual(ob.getPhase(), PHASES.INIT);
	});

	it("is not started initially", () => {
		const ob = create();
		assert.strictEqual(ob.isStarted(), false);
	});
});

// ---------------------------------------------------------------------------
// INIT phase
// ---------------------------------------------------------------------------
describe("INIT phase", () => {
	it("transitions to ATTRACTOR on normal input", () => {
		const ob = create();
		const result = ob.processResponse("hello");
		assert.strictEqual(result.action, "nextPrompt");
		assert.strictEqual(ob.getPhase(), PHASES.ATTRACTOR);
		assert.strictEqual(ob.isStarted(), true);
	});

	it('returns exit on "exit"', () => {
		const ob = create();
		const result = ob.processResponse("exit");
		assert.strictEqual(result.action, "exit");
	});

	it('returns save on "skip"', () => {
		const ob = create();
		const result = ob.processResponse("skip");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it('returns save on "cancel"', () => {
		const ob = create();
		const result = ob.processResponse("cancel");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});
});

// ---------------------------------------------------------------------------
// ATTRACTOR phase
// ---------------------------------------------------------------------------
describe("ATTRACTOR phase", () => {
	it("shows the attractor prompt", () => {
		const ob = create();
		ob.processResponse("yes");
		const prompt = ob.getCurrentPrompt();
		assert.ok(prompt.prompt.includes("personalized"));
		assert.strictEqual(prompt.current, 0);
		assert.strictEqual(prompt.total, ATTRIBUTES.length);
	});

	it("proceeds to COLLECT on normal input", () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("tell me about yourself");
		assert.strictEqual(result.action, "nextPrompt");
		assert.strictEqual(ob.getPhase(), PHASES.COLLECT);
	});

	it('skips to SAVE on "skip"', () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("skip");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it('cancels to SAVE on "cancel"', () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("cancel");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it('returns exit on "exit"', () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("exit");
		assert.strictEqual(result.action, "exit");
	});
});

// ---------------------------------------------------------------------------
// COLLECT phase
// ---------------------------------------------------------------------------
describe("COLLECT phase", () => {
	it("prompts for the first attribute (name)", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const prompt = ob.getCurrentPrompt();
		assert.strictEqual(prompt.current, 1);
		assert.strictEqual(prompt.total, ATTRIBUTES.length);
		assert.strictEqual(prompt.prompt, "What is your name?");
	});

	it("saves attribute value and advances", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const result = ob.processResponse("Alice");
		assert.strictEqual(result.action, "nextPrompt");
		assert.deepStrictEqual(ob.getProfileData(), { name: "Alice" });
	});

	it('skips current attribute on "skip"', () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const result = ob.processResponse("skip");
		assert.strictEqual(result.action, "nextPrompt");
		assert.deepStrictEqual(ob.getProfileData(), {});
	});

	it('cancels to SAVE on "cancel"', () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		ob.processResponse("Alice");
		const result = ob.processResponse("cancel");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it('treats "exit" as cancel during COLLECT', () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const result = ob.processResponse("exit");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it("transitions to SAVE after answering all attributes", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		for (let i = 0; i < ATTRIBUTES.length; i++) {
			const result = ob.processResponse(`answer ${i}`);
			if (i < ATTRIBUTES.length - 1) {
				assert.strictEqual(result.action, "nextPrompt", `Expected nextPrompt at index ${i}`);
			} else {
				assert.strictEqual(result.action, "save", `Expected save at index ${i}`);
			}
		}
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});
});

// ---------------------------------------------------------------------------
// SAVE phase — processResponse (covers lines 162-168)
// ---------------------------------------------------------------------------
describe("SAVE phase — processResponse", () => {
	it('returns { action: "done" } for any input', () => {
		const ob = create();
		// Reach SAVE via skip from INIT
		ob.processResponse("skip");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);

		const result = ob.processResponse("anything at all");
		assert.deepStrictEqual(result, { action: "done" });
	});
});

// ---------------------------------------------------------------------------
// TRANSCEND phase — processResponse
// ---------------------------------------------------------------------------
describe("TRANSCEND phase — processResponse", () => {
	it('returns { action: "done" } for any input', async () => {
		const ob = create();
		// Reach SAVE then save() to get to TRANSCEND
		ob.processResponse("skip");
		await ob.save();
		assert.strictEqual(ob.getPhase(), PHASES.TRANSCEND);

		const result = ob.processResponse("anything");
		assert.deepStrictEqual(result, { action: "done" });
	});
});

// ---------------------------------------------------------------------------
// save()
// ---------------------------------------------------------------------------
describe("save()", () => {
	it("persists profile data and transitions to TRANSCEND", async () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		ob.processResponse("Alice");
		ob.processResponse("1990-01-01");
		ob.processResponse("single");
		ob.processResponse("a dog");
		ob.processResponse("reading");
		ob.processResponse("math");
		ob.processResponse("Radiohead");
		ob.processResponse("Dune");
		ob.processResponse("Breaking Bad");
		ob.processResponse("Inception");
		ob.processResponse("New York, USA");
		ob.processResponse("nothing else");
		// Now in SAVE phase
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);

		const result = await ob.save();
		assert.strictEqual(result, true);
		assert.strictEqual(ob.getPhase(), PHASES.TRANSCEND);
	});

	it("calls onSave callback when provided", async () => {
		let onSaveCalled = false;
		const ob = create({
			onSave: () => {
				onSaveCalled = true;
			},
		});
		ob.processResponse("skip");
		await ob.save();
		assert.strictEqual(onSaveCalled, true);
	});

	it("returns false if not in SAVE phase", async () => {
		const ob = create();
		// Still in INIT — save() should return false
		assert.strictEqual(await ob.save(), false);
	});
});

// ---------------------------------------------------------------------------
// isComplete()
// ---------------------------------------------------------------------------
describe("isComplete()", () => {
	it("returns false before completion", () => {
		const ob = create();
		assert.strictEqual(ob.isComplete(), false);
	});

	it("returns true after save() transitions to TRANSCEND", async () => {
		const ob = create();
		ob.processResponse("skip");
		await ob.save();
		assert.strictEqual(ob.isComplete(), true);
	});
});

// ---------------------------------------------------------------------------
// isStarted()
// ---------------------------------------------------------------------------
describe("isStarted()", () => {
	it("returns false before any input", () => {
		const ob = create();
		assert.strictEqual(ob.isStarted(), false);
	});

	it("returns true after processResponse is called", () => {
		const ob = create();
		ob.processResponse("hello");
		assert.strictEqual(ob.isStarted(), true);
	});
});

// ---------------------------------------------------------------------------
// getPhase()
// ---------------------------------------------------------------------------
describe("getPhase()", () => {
	it("returns the current phase at each stage of the flow", () => {
		const ob = create();
		assert.strictEqual(ob.getPhase(), PHASES.INIT);

		ob.processResponse("yes");
		assert.strictEqual(ob.getPhase(), PHASES.ATTRACTOR);

		ob.processResponse("ok");
		assert.strictEqual(ob.getPhase(), PHASES.COLLECT);

		// Answer all attributes to reach SAVE
		for (let i = 0; i < ATTRIBUTES.length; i++) {
			ob.processResponse(`answer ${i}`);
		}
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});
});

// ---------------------------------------------------------------------------
// getProfileData()
// ---------------------------------------------------------------------------
describe("getProfileData()", () => {
	it("returns empty object initially", () => {
		const ob = create();
		assert.deepStrictEqual(ob.getProfileData(), {});
	});

	it("returns collected attributes", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		ob.processResponse("Alice");
		ob.processResponse("1990-01-01");
		assert.deepStrictEqual(ob.getProfileData(), {
			name: "Alice",
			dob: "1990-01-01",
		});
	});

	it("returns a copy, not the internal reference", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		ob.processResponse("Alice");
		const data = ob.getProfileData();
		data.name = "Bob";
		// Internal state should be unchanged
		assert.deepStrictEqual(ob.getProfileData(), { name: "Alice" });
	});
});

// ---------------------------------------------------------------------------
// getCurrentPrompt()
// ---------------------------------------------------------------------------
describe("getCurrentPrompt()", () => {
	it("returns null in INIT phase", () => {
		const ob = create();
		assert.strictEqual(ob.getCurrentPrompt(), null);
	});

	it("returns attractor prompt in ATTRACTOR phase", () => {
		const ob = create();
		ob.processResponse("yes");
		const prompt = ob.getCurrentPrompt();
		assert.ok(prompt.prompt.includes("personalized"));
		assert.strictEqual(prompt.current, 0);
		assert.strictEqual(prompt.total, ATTRIBUTES.length);
	});

	it("returns attribute prompt in COLLECT phase", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const prompt = ob.getCurrentPrompt();
		assert.strictEqual(prompt.current, 1);
		assert.strictEqual(prompt.total, ATTRIBUTES.length);
		assert.strictEqual(prompt.prompt, "What is your name?");
	});

	it("returns null in SAVE phase", () => {
		const ob = create();
		ob.processResponse("skip");
		assert.strictEqual(ob.getCurrentPrompt(), null);
	});

	it("returns null in TRANSCEND phase", async () => {
		const ob = create();
		ob.processResponse("skip");
		await ob.save();
		assert.strictEqual(ob.getCurrentPrompt(), null);
	});
});
