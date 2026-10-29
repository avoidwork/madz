import React from "react";
import { describe, it, afterEach, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink";
import { SessionsPanel } from "../../../src/tui/sessionsPanel.js";
import { SessionStateManager } from "../../../src/session/stateManager.js";

let unmount;
let tempDir;
let stdinListeners;
let stdinReadQueue;

beforeEach(() => {
	delete process.env.CI;
	stdinListeners = new Map();
	stdinReadQueue = [];
	Object.defineProperty(process, "stdin", {
		configurable: true,
		value: {
			isTTY: true,
			setRawMode: () => {},
			setEncoding: () => {},
			read: () => stdinReadQueue.shift() ?? null,
			on: (event, cb) => {
				stdinListeners.set(event, cb);
			},
			off: (event, cb) => {
				if (stdinListeners.get(event) === cb) stdinListeners.delete(event);
			},
			addListener: (event, cb) => {
				stdinListeners.set(event, cb);
			},
			removeListener: (event, cb) => {
				if (stdinListeners.get(event) === cb) stdinListeners.delete(event);
			},
		},
	});
});

afterEach(async () => {
	if (unmount) unmount();
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = null;
	}
});

function makeSessionFile(dir, id, conversation) {
	const body = JSON.stringify(conversation, null, 2);
	const content = `---\nthreadId: "${id}"\nmessageCount: ${conversation.length}\nstartedAt: "2026-01-01T00:00:00.000Z"\nendedAt: "2026-01-01T00:00:00.000Z"\n---\n${body}\n`;
	return writeFile(join(dir, `${id}.md`), content);
}

function renderPanel({ sessionState, onResumeSession, onViewChange }) {
	return React.createElement(SessionsPanel, {
		sessionState,
		config: { memory: { sessionsDir: "sessions/" }, cwd: tempDir },
		onViewChange: onViewChange || (() => {}),
		onResumeSession: onResumeSession || (() => {}),
		activeView: "sessions",
	});
}

describe("SessionsPanel resume", () => {
	it("loads the resumed conversation into the message list via onResumeSession", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "madz-sessions-"));
		await mkdir(join(tempDir, "sessions"), { recursive: true });
		const sessionId = "abc-1234-5678";
		const conversation = [
			{ role: "user", content: "hello", timestamp: "2026-01-01T00:00:00.000Z" },
			{ role: "assistant", content: "hi there", timestamp: "2026-01-01T00:00:01.000Z" },
		];
		await makeSessionFile(join(tempDir, "sessions"), sessionId, conversation);

		const sessionState = new SessionStateManager({});
		let resumed = null;
		let viewChanged = null;
		const { unmount: um } = render(
			renderPanel({
				sessionState,
				onResumeSession: (conv) => {
					resumed = conv;
				},
				onViewChange: (view) => {
					viewChanged = view;
				},
			}),
		);
		unmount = um;

		// Wait for the session list to load from disk.
		await new Promise((r) => setTimeout(r, 100));

		// Press Enter to select the first (only) session. Ink v8 reads chunks
		// from stdin.read() and pushes them through its input parser, so we
		// enqueue the Enter byte and emit the 'readable' event.
		const readableHandler = stdinListeners.get("readable");
		assert.ok(readableHandler, "readable listener attached");
		stdinReadQueue.push("\r");
		readableHandler();
		await new Promise((r) => setTimeout(r, 100));

		assert.ok(resumed, "onResumeSession was called");
		assert.strictEqual(resumed.length, 2, "loaded conversation has 2 messages");
		assert.strictEqual(resumed[0].content, "hello");
		assert.strictEqual(viewChanged, "conversation", "navigated back to conversation view");
		assert.strictEqual(sessionState.getConversation().length, 2, "session state loaded");
	});
});
