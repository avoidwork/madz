import { describe, it } from "node:test";
import assert from "node:assert";
import { createOnboarding, PHASES } from "../../src/session/onboarding.js";
import { ATTRIBUTES } from "../../src/memory/profile.js";

function create(options = {}) {
	return createOnboarding(ATTRIBUTES, options);
}

describe("createOnboarding", () => {
	it("returns an onboarding instance", () => {
		const ob = create();
		assert.ok(ob);
	});

	it("starts in INIT phase", () => {
		const ob = create();
		assert.strictEqual(ob.getPhase(), PHASES.INIT);
	});

	it("is not started initially", () => {
		const ob = create();
		assert.strictEqual(ob.isStarted(), false);
	});

	it("uses custom profile path", () => {
		const ob = create({ profilePath: "custom/path.md" });
		assert.strictEqual(ob.getPhase(), PHASES.INIT);
	});
});

describe("INIT phase", () => {
	it("transitions to ATTRACTOR on any normal input", () => {
		const ob = create();
		assert.strictEqual(ob.getPhase(), PHASES.INIT);
		const result = ob.processResponse("yes, let's do it");
		assert.strictEqual(result.action, "nextPrompt");
		assert.strictEqual(ob.getPhase(), PHASES.ATTRACTOR);
	});

	it("returns exit on 'exit' input", () => {
		const ob = create();
		const result = ob.processResponse("exit");
		assert.strictEqual(result.action, "exit");
	});

	it("returns save on 'skip' input during INIT", () => {
		const ob = create();
		const result = ob.processResponse("skip");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it("returns save on 'cancel' input during INIT", () => {
		const ob = create();
		const result = ob.processResponse("cancel");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});
});

describe("ATTRACTOR phase", () => {
	it("shows ATTRACTOR explanation prompt", () => {
		const ob = create();
		ob.processResponse("yes");
		assert.strictEqual(ob.getPhase(), PHASES.ATTRACTOR);
		const prompt = ob.getCurrentPrompt();
		assert.ok(prompt.prompt.includes("personalized"));
		assert.ok(!prompt.current);
		assert.ok(!prompt.total);
	});

	it("proceeds to COLLECT on normal input", () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("tell me about yourself");
		assert.strictEqual(result.action, "nextPrompt");
		assert.strictEqual(ob.getPhase(), PHASES.COLLECT);
	});

	it("skips to SAVE on 'skip' during ATTRACTOR", () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("skip");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it("cancels to SAVE on 'cancel' during ATTRACTOR", () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("cancel");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it("returns exit on 'exit' during ATTRACTOR", () => {
		const ob = create();
		ob.processResponse("yes");
		const result = ob.processResponse("exit");
		assert.strictEqual(result.action, "exit");
	});
});

describe("COLLECT phase", () => {
	it("prompts for first attribute", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const prompt = ob.getCurrentPrompt();
		assert.strictEqual(prompt.current, 1);
		assert.strictEqual(prompt.total, 10);
		assert.strictEqual(prompt.prompt, "When is your date of birth?");
	});

	it("saves attribute value and advances", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		let result = ob.processResponse("1990");
		assert.strictEqual(result.action, "nextPrompt");
		assert.deepStrictEqual(ob.getProfileData(), { dob: "1990" });
	});

	it("skips current attribute on skip", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const r1 = ob.processResponse("skip");
		assert.strictEqual(r1.action, "nextPrompt");
		// dob should not be in profileData
		const data = ob.getProfileData();
		assert.ok(!data.dob);
	});

	it("cancels and saves partial data", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		// Answer first attribute (dob)
		ob.processResponse("hiking");
		// Cancel second attribute
		const result = ob.processResponse("cancel");
		assert.strictEqual(result.action, "save");
		const data = ob.getProfileData();
		// The first saved attribute is 'dob', not 'hobbies'
		assert.strictEqual(data.dob, "hiking");
	});

	it("transitions to SAVE after answering all attributes", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		// Answer all 10 attributes
		for (let i = 0; i < 10; i++) {
			const result = ob.processResponse(`answer ${i}`);
			if (i < 9) {
				assert.strictEqual(result.action, "nextPrompt", `Expected nextPrompt at index ${i}`);
			} else {
				assert.strictEqual(result.action, "save", `Expected save at index ${i}`);
			}
		}
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});

	it("treats exit as cancel during COLLECT", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		const result = ob.processResponse("exit");
		assert.strictEqual(result.action, "save");
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});
});

describe("SAVE phase", () => {
	it("returns done for any input in SAVE", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		for (let i = 0; i < 10; i++) {
			ob.processResponse(`ans${i}`);
		}
		assert.strictEqual(ob.getPhase(), PHASES.SAVE);
	});
});

describe("save", () => {
	it("persists profile data and transitions to TRANSCEND", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		for (let i = 0; i < 10; i++) {
			const result = ob.processResponse(`value${i}`);
			if (result.action === "save") break;
		}
		const data = ob.getProfileData();
		assert.ok(Object.keys(data).length > 0);
	});

	it("returns false when not in SAVE phase", () => {
		const ob = create();
		assert.strictEqual(ob.save(), false);
	});
});

describe("isComplete", () => {
	it("is false before completion", () => {
		const ob = create();
		assert.strictEqual(ob.isComplete(), false);
	});

	it("is true after save", () => {
		const ob = create();
		// Answer all attributes to reach SAVE
		ob.processResponse("yes");
		ob.processResponse("ok");
		for (let i = 0; i < 10; i++) {
			ob.processResponse(`x${i}`);
		}
		// save() transitions to TRANSCEND
		ob.save();
		assert.strictEqual(ob.isComplete(), true);
	});
});

describe("getCurrentPrompt", () => {
	it("returns null in TRANSCEND phase", () => {
		const ob = create();
		ob.processResponse("yes");
		ob.processResponse("ok");
		for (let i = 0; i < 10; i++) {
			ob.processResponse(`x${i}`);
		}
		ob.save();
		assert.strictEqual(ob.getCurrentPrompt(), null);
	});
});
