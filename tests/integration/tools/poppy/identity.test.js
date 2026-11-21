import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	buildClientMetadata,
	validateClientMetadata,
} from "../../../../src/tools/poppy/identity.js";

// The test server uses a self-signed cert; allow Node's fetch (undici) to
// accept it for the localhost test connection only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CERT = readFileSync(join(process.cwd(), "tests", "fixtures", "poppy", "cert.pem"));
const KEY = readFileSync(join(process.cwd(), "tests", "fixtures", "poppy", "key.pem"));

const CLIENT_ID = "https://agent.example.com";
const JWKS_URI = "https://agent.example.com/.well-known/jwks.json";

let server;
let port;

describe("poppy - integration identity", () => {
	before(async () => {
		server = createServer({ key: KEY, cert: CERT }, (req, res) => {
			if (req.url === "/.well-known/client-metadata.json") {
				const doc = buildClientMetadata({
					clientId: CLIENT_ID,
					clientName: "Madz",
					jwksUri: JWKS_URI,
					redirectUris: ["https://agent.example.com/callback"],
				});
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(doc));
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

	it("serves a fetchable and valid client metadata document", async () => {
		const resp = await fetch(`https://127.0.0.1:${port}/.well-known/client-metadata.json`);
		assert.strictEqual(resp.status, 200);
		const doc = await resp.json();
		assert.strictEqual(doc.client_id, CLIENT_ID);
		assert.strictEqual(doc.client_name, "Madz");
		assert.strictEqual(doc.jwks_uri, JWKS_URI);
		assert.deepEqual(doc.redirect_uris, ["https://agent.example.com/callback"]);
		assert.strictEqual(doc.token_endpoint_auth_method, "private_key_jwt");
		const validation = validateClientMetadata(doc);
		assert.strictEqual(validation.ok, true);
	});
});
