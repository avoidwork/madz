import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { setTestMode } from "../../../src/sandbox/urlFilter.js";
import { browserImpl, resetBrowser } from "../../../src/tools/browser/index.js";

let server;
let baseUrl;

const fixture = `<!DOCTYPE html>
<html>
  <head><title>Fixture</title></head>
  <body>
    <h1 id="title">Hello Fixture</h1>
    <button id="submit">Submit</button>
    <input id="name" type="text" />
    <div id="result"></div>
  </body>
</html>`;

before(async () => {
	setTestMode(true);
	server = createServer((_req, res) => {
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(fixture);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address();
	baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
	// Close the persistent browser so the test process does not hang.
	await browserImpl({ action: "close" });
	resetBrowser();
	setTestMode(false);
	if (server) {
		await new Promise((resolve) => server.close(resolve));
	}
});

describe("integration - browser tool", () => {
	it("navigates to a local fixture page", async () => {
		const result = await browserImpl({ action: "navigate", url: baseUrl });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.url, baseUrl);
	});

	it("extracts text from the page", async () => {
		await browserImpl({ action: "navigate", url: baseUrl });
		const result = await browserImpl({ action: "extract" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.match(parsed.content, /Hello Fixture/);
	});

	it("clicks an element", async () => {
		await browserImpl({ action: "navigate", url: baseUrl });
		const result = await browserImpl({ action: "click", selector: "#submit" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("fills a form field", async () => {
		await browserImpl({ action: "navigate", url: baseUrl });
		const result = await browserImpl({ action: "fill", selector: "#name", text: "Jason" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});
});
