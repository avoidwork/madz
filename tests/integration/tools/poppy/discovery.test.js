import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverPoppy } from "../../../../src/tools/poppy/discovery.js";

// The test server uses a self-signed cert; allow Node's fetch (undici) to
// accept it for the localhost test connection only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CERT = readFileSync(join(process.cwd(), "tests", "fixtures", "poppy", "cert.pem"));
const KEY = readFileSync(join(process.cwd(), "tests", "fixtures", "poppy", "key.pem"));

const FIXTURE = {
	protocol_version: "1.0",
	organization: { name: "Example", domain: "localhost" },
	apis: [{ type: "openapi", url: "https://api.example.com/openapi.json", description: "Orders" }],
};

let server;
let port;

describe("poppy - integration discovery", () => {
	before(async () => {
		server = createServer({ key: KEY, cert: CERT }, (req, res) => {
			if (req.url === "/.well-known/poppy.json") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(FIXTURE));
			} else {
				res.writeHead(404);
				res.end();
			}
		});
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		port = server.address().port;
	});

	after(() => {
		server.close();
	});

	it("fetches and validates a poppy.json from a local HTTPS server", async () => {
		const result = await discoverPoppy(`localhost:${port}`, { allowPrivate: true });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.source, "network");
		assert.strictEqual(result.data.organization.name, "Example");
		assert.strictEqual(result.data.protocolVersion, "1.0");
	});

	it("returns a cached result on a second call", async () => {
		const first = await discoverPoppy(`localhost:${port}`, { allowPrivate: true });
		const second = await discoverPoppy(`localhost:${port}`, { allowPrivate: true });
		assert.strictEqual(first.ok, true);
		assert.strictEqual(second.ok, true);
		assert.strictEqual(second.source, "cache");
	});
});
