/**
 * Tests for the useMouseScroll hook and its SGR mouse sequence parsing.
 * @see {@link src/tui/useMouseScroll.js}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import React from "react";
import { render } from "ink";

const {
	parseSgrMouseSequence,
	buttonToDelta,
	buttonToSelection,
	scaleScrollDelta,
	useMouseScroll,
} = await import("../../../src/tui/useMouseScroll.js");

describe("parseSgrMouseSequence", () => {
	it("parses a wheel-up press sequence", () => {
		const { events, lastIndex } = parseSgrMouseSequence("\x1b[<64;10;5M");
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].button, 64);
		assert.strictEqual(events[0].x, 10);
		assert.strictEqual(events[0].y, 5);
		assert.strictEqual(events[0].isPress, true);
		assert.strictEqual(lastIndex, "\x1b[<64;10;5M".length);
	});

	it("parses a wheel-down press sequence", () => {
		const { events } = parseSgrMouseSequence("\x1b[<65;10;5M");
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].button, 65);
		assert.strictEqual(events[0].isPress, true);
	});

	it("parses a release sequence", () => {
		const { events } = parseSgrMouseSequence("\x1b[<0;10;5m");
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].button, 0);
		assert.strictEqual(events[0].isPress, false);
	});

	it("parses multiple sequences in one buffer", () => {
		const { events } = parseSgrMouseSequence("\x1b[<64;1;1M\x1b[<65;2;2M");
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].button, 64);
		assert.strictEqual(events[1].button, 65);
	});

	it("returns empty for non-mouse input", () => {
		const { events } = parseSgrMouseSequence("hello world");
		assert.deepStrictEqual(events, []);
	});

	it("reports lastIndex at the first unconsumed byte for a partial sequence", () => {
		// A complete sequence followed by a trailing partial sequence (split
		// across chunks). lastIndex must point at the start of the partial tail
		// so the caller can retain it for the next chunk.
		const { events, lastIndex } = parseSgrMouseSequence("\x1b[<64;10;5M\x1b[<65;");
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].button, 64);
		assert.strictEqual(lastIndex, "\x1b[<64;10;5M".length);
	});

	it("reports lastIndex 0 when no complete sequence is present", () => {
		const { events, lastIndex } = parseSgrMouseSequence("\x1b[<64;");
		assert.strictEqual(events.length, 0);
		assert.strictEqual(lastIndex, 0);
	});
});

describe("buttonToDelta", () => {
	it("maps wheel-up (64) to -1", () => {
		assert.strictEqual(buttonToDelta(64), -1);
	});

	it("maps wheel-down (65) to +1", () => {
		assert.strictEqual(buttonToDelta(65), 1);
	});

	it("returns null for non-wheel buttons", () => {
		assert.strictEqual(buttonToDelta(0), null);
		assert.strictEqual(buttonToDelta(1), null);
		assert.strictEqual(buttonToDelta(66), null);
	});
});

describe("buttonToSelection", () => {
	it("returns true for left-button (0)", () => {
		assert.strictEqual(buttonToSelection(0), true);
	});

	it("returns false for wheel buttons (64/65)", () => {
		assert.strictEqual(buttonToSelection(64), false);
		assert.strictEqual(buttonToSelection(65), false);
	});

	it("returns false for other buttons", () => {
		assert.strictEqual(buttonToSelection(1), false);
		assert.strictEqual(buttonToSelection(2), false);
		assert.strictEqual(buttonToSelection(66), false);
	});
});

describe("scaleScrollDelta", () => {
	it("defaults to 1 line per wheel event", () => {
		assert.strictEqual(scaleScrollDelta(-1), -1);
		assert.strictEqual(scaleScrollDelta(1), 1);
	});

	it("scales the delta by the configured lines", () => {
		assert.strictEqual(scaleScrollDelta(-1, 3), -3);
		assert.strictEqual(scaleScrollDelta(1, 3), 3);
	});

	it("scales wheel-up and wheel-down symmetrically", () => {
		assert.strictEqual(scaleScrollDelta(-1, 5), -5);
		assert.strictEqual(scaleScrollDelta(1, 5), 5);
	});
});

describe("useMouseScroll hook", () => {
	let stdinListeners;
	let stdoutWrites;
	let instances;

	beforeEach(() => {
		// Clear the ambient CI flag so the hook's CI guard doesn't bail early.
		// GitHub Actions sets process.env.CI=true, which would otherwise prevent
		// the hook from attaching and break the enable/disable tests.
		delete process.env.CI;
		stdinListeners = new Map();
		stdoutWrites = [];
		instances = [];

		Object.defineProperty(process, "stdin", {
			configurable: true,
			value: {
				isTTY: true,
				on: (event, cb) => {
					stdinListeners.set(event, cb);
				},
				off: (event, cb) => {
					if (stdinListeners.get(event) === cb) stdinListeners.delete(event);
				},
			},
		});
		Object.defineProperty(process, "stdout", {
			configurable: true,
			value: {
				isTTY: true,
				write: (chunk) => {
					stdoutWrites.push(chunk.toString());
				},
				on: () => {},
				off: () => {},
			},
		});
	});

	afterEach(() => {
		for (const instance of instances) {
			try {
				instance.unmount();
			} catch {
				// ignore
			}
		}
		delete process.env.CI;
	});

	// Wrapper component that invokes the hook so it can be rendered via Ink.
	function Harness({ onScroll, onSelect, onSelectionChange, enabled }) {
		useMouseScroll(onScroll, onSelect, onSelectionChange, enabled);
		return React.createElement(React.Fragment, null);
	}

	function mountHook(onScroll, onSelect, onSelectionChange, enabled) {
		const instance = render(
			React.createElement(Harness, { onScroll, onSelect, onSelectionChange, enabled }),
		);
		instances.push(instance);
		return instance;
	}

	it("enables mouse reporting on mount", () => {
		mountHook(() => {});
		assert.ok(stdoutWrites.includes("\x1b[?1000h\x1b[?1006h\x1b[?1002h"));
	});

	it("disables mouse reporting when enabled is false", () => {
		mountHook(() => {}, undefined, undefined, false);
		// No enable sequence should be written.
		assert.ok(!stdoutWrites.includes("\x1b[?1000h\x1b[?1006h\x1b[?1002h"));
		// The disable sequence should be written so mouse events bubble out.
		assert.ok(stdoutWrites.includes("\x1b[?1000l\x1b[?1006l\x1b[?1002l"));
		// No data listener should be attached.
		assert.strictEqual(stdinListeners.has("data"), false);
	});

	it("toggles mouse reporting off when enabled flips to false", () => {
		const instance = mountHook(() => {}, undefined, undefined, true);
		assert.ok(stdoutWrites.includes("\x1b[?1000h\x1b[?1006h\x1b[?1002h"));
		assert.ok(stdinListeners.has("data"));
		// Re-render with enabled=false — the effect cleanup should disable reporting.
		instance.rerender(React.createElement(Harness, { onScroll: () => {}, enabled: false }));
		assert.ok(stdoutWrites.includes("\x1b[?1000l\x1b[?1006l\x1b[?1002l"));
		assert.strictEqual(stdinListeners.has("data"), false);
	});

	it("disables mouse reporting and removes listener on unmount", () => {
		const instance = mountHook(() => {});
		assert.ok(stdoutWrites.includes("\x1b[?1000h\x1b[?1006h\x1b[?1002h"));
		instance.unmount();
		assert.ok(stdoutWrites.includes("\x1b[?1000l\x1b[?1006l\x1b[?1002l"));
		assert.strictEqual(stdinListeners.has("data"), false);
	});

	it("invokes onScroll with -1 on wheel-up", () => {
		let delta = null;
		mountHook((d) => {
			delta = d;
		});
		const handler = stdinListeners.get("data");
		assert.ok(handler, "data listener should be attached");
		handler(Buffer.from("\x1b[<64;10;5M"));
		assert.strictEqual(delta, -1);
	});

	it("invokes onScroll with +1 on wheel-down", () => {
		let delta = null;
		mountHook((d) => {
			delta = d;
		});
		const handler = stdinListeners.get("data");
		assert.ok(handler, "data listener should be attached");
		handler(Buffer.from("\x1b[<65;10;5M"));
		assert.strictEqual(delta, 1);
	});

	it("ignores release sequences", () => {
		let delta = null;
		mountHook((d) => {
			delta = d;
		});
		const handler = stdinListeners.get("data");
		handler(Buffer.from("\x1b[<64;10;5m"));
		assert.strictEqual(delta, null);
	});

	it("handles a mouse sequence split across multiple chunks", () => {
		let deltas = [];
		mountHook((d) => {
			deltas.push(d);
		});
		const handler = stdinListeners.get("data");
		assert.ok(handler, "data listener should be attached");
		// Terminal may split a sequence arbitrarily across writes.
		handler(Buffer.from("\x1b[<64;10;"));
		handler(Buffer.from("5M"));
		assert.deepStrictEqual(deltas, [-1]);
	});

	it("handles a partial sequence followed by a complete one in a later chunk", () => {
		let deltas = [];
		mountHook((d) => {
			deltas.push(d);
		});
		const handler = stdinListeners.get("data");
		// First chunk ends mid-sequence; second chunk completes it plus a new one.
		handler(Buffer.from("\x1b[<64;"));
		handler(Buffer.from("10;5M\x1b[<65;20;6M"));
		assert.deepStrictEqual(deltas, [-1, 1]);
	});

	it("does not attach when stdout is not a TTY", () => {
		Object.defineProperty(process, "stdout", {
			configurable: true,
			value: { isTTY: false, write: () => {}, on: () => {}, off: () => {} },
		});
		mountHook(() => {});
		assert.strictEqual(stdinListeners.has("data"), false);
		assert.ok(!stdoutWrites.includes("\x1b[?1000h\x1b[?1006h\x1b[?1002h"));
	});

	it("does not attach when in CI", () => {
		process.env.CI = "true";
		mountHook(() => {});
		assert.strictEqual(stdinListeners.has("data"), false);
		assert.ok(!stdoutWrites.includes("\x1b[?1000h\x1b[?1006h\x1b[?1002h"));
	});

	it("records a selection on left-button press and move, then finalizes on release", () => {
		let selected = null;
		let changes = [];
		mountHook(
			() => {},
			(sel) => {
				selected = sel;
			},
			(sel) => {
				changes.push(sel);
			},
		);
		const handler = stdinListeners.get("data");
		assert.ok(handler, "data listener should be attached");
		// Left-button press at (10, 5)
		handler(Buffer.from("\x1b[<0;10;5M"));
		assert.strictEqual(changes.length, 1);
		assert.deepStrictEqual(changes[0], { start: { x: 10, y: 5 }, end: { x: 10, y: 5 } });
		// Drag move to (20, 8)
		handler(Buffer.from("\x1b[<0;20;8M"));
		assert.strictEqual(changes.length, 2);
		assert.deepStrictEqual(changes[1], { start: { x: 10, y: 5 }, end: { x: 20, y: 8 } });
		// Release
		handler(Buffer.from("\x1b[<0;20;8m"));
		assert.deepStrictEqual(selected, { start: { x: 10, y: 5 }, end: { x: 20, y: 8 } });
	});

	it("does not invoke onSelect for a press without a release", () => {
		let selected = null;
		mountHook(
			() => {},
			(sel) => {
				selected = sel;
			},
		);
		const handler = stdinListeners.get("data");
		handler(Buffer.from("\x1b[<0;10;5M"));
		assert.strictEqual(selected, null);
	});

	it("does not invoke onSelect for wheel events", () => {
		let selected = null;
		mountHook(
			() => {},
			(sel) => {
				selected = sel;
			},
		);
		const handler = stdinListeners.get("data");
		handler(Buffer.from("\x1b[<64;10;5M"));
		handler(Buffer.from("\x1b[<65;10;5M"));
		assert.strictEqual(selected, null);
	});

	it("keeps wheel scrolling and drag selection disjoint", () => {
		let deltas = [];
		let selected = null;
		mountHook(
			(d) => {
				deltas.push(d);
			},
			(sel) => {
				selected = sel;
			},
		);
		const handler = stdinListeners.get("data");
		// Wheel-up scrolls
		handler(Buffer.from("\x1b[<64;10;5M"));
		assert.deepStrictEqual(deltas, [-1]);
		// Left-button drag selects
		handler(Buffer.from("\x1b[<0;10;5M"));
		handler(Buffer.from("\x1b[<0;20;8M"));
		handler(Buffer.from("\x1b[<0;20;8m"));
		assert.deepStrictEqual(deltas, [-1]);
		assert.deepStrictEqual(selected, { start: { x: 10, y: 5 }, end: { x: 20, y: 8 } });
	});
});
