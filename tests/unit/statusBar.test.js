import { describe, it, afterEach } from "node:test";
import React from "react";
import { render } from "ink";
import { StatusBar } from "../../src/tui/statusBar.js";

describe("StatusBar", () => {
	let unmount;

	afterEach(() => {
		if (unmount) unmount();
	});

	it("renders with default props", () => {
		const { unmount: um } = render(React.createElement(StatusBar, {}));
		unmount = um;
	});

	it("renders with contextSize prop", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				contextSize: 42,
				messageCount: 10,
				skillCount: 3,
			}),
		);
		unmount = um;
	});

	it("renders with isCompacting=true", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				contextSize: 10,
				isCompacting: true,
			}),
		);
		unmount = um;
	});

	it("renders with isCompacting=false", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				contextSize: 10,
				isCompacting: false,
			}),
		);
		unmount = um;
	});

	it("renders context:0 by default", () => {
		const { unmount: um } = render(React.createElement(StatusBar, {}));
		unmount = um;
	});

	it("renders all props together", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 5,
				messageCount: 20,
				contextSize: 50,
				isCompacting: false,
			}),
		);
		unmount = um;
	});

	it("renders compacting state with all props", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				statusMessage: "Streaming...",
				skillCount: 5,
				messageCount: 20,
				contextSize: 50,
				isCompacting: true,
			}),
		);
		unmount = um;
	});
});
