import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, jwtVerify } from "jose";
import {
	Vault,
	DelegatedKeyRegistry,
	blindSign,
	redact,
	execute,
} from "../../../../src/tools/poppy/security.js";

const CLIENT_ID = "https://agent.example.com";
const AUDIENCE = "https://company.example.com";
const USER_ID = "user-123";

describe("poppy - integration security", () => {
	it("keeps secrets out of model context through a full flow", async () => {
		const vault = new Vault();
		vault.set("access_token", "super-secret-token");

		// The model receives a payload that would otherwise contain the secret.
		const modelPayload = { message: "hello", token: "super-secret-token" };
		const sanitized = redact(modelPayload, vault.values());

		// The secret never reaches the model.
		assert.strictEqual(sanitized.token, "[REDACTED]");
		assert.strictEqual(JSON.stringify(sanitized).includes("super-secret-token"), false);
	});

	it("blind-signs a client assertion that verifies against the public key", async () => {
		const { publicKey, privateKey } = await generateKeyPair("PS384", { extractable: true });
		const result = await blindSign({
			privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
		});

		const { payload, protectedHeader } = await jwtVerify(result.jwt, publicKey);
		assert.strictEqual(payload.iss, CLIENT_ID);
		assert.strictEqual(payload.aud, AUDIENCE);
		assert.strictEqual(protectedHeader.typ, "poppy-assertion+jwt");
		assert.strictEqual(protectedHeader.alg, "PS384");
	});

	it("rotates a delegated key and verifies the new key signs for the user", async () => {
		const registry = new DelegatedKeyRegistry();
		const rotated = await registry.rotate(USER_ID, "PS384");
		assert.strictEqual(registry.getUser(rotated.kid), USER_ID);

		// The new key's public key verifies a blind-signed assertion.
		const assertion = await blindSign({
			privateKey: rotated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
		});
		const { payload } = await jwtVerify(assertion.jwt, rotated.publicKey);
		assert.strictEqual(payload.sub, CLIENT_ID);
	});

	it("executes a full security flow keeping secrets out of the model", async () => {
		const vault = new Vault();
		const registry = new DelegatedKeyRegistry();

		// Store a secret server-side.
		const storeResult = await execute(
			{ op: "vault_set", key: "refresh_token", value: "refresh-secret" },
			{ vault },
		);
		assert.strictEqual(storeResult.ok, true);

		// The model only sees presence, never the secret.
		const getResult = await execute({ op: "vault_get", key: "refresh_token" }, { vault });
		assert.strictEqual(getResult.ok, true);
		assert.strictEqual(getResult.data.present, true);
		assert.strictEqual(getResult.data.value, undefined);

		// Redact a payload before returning it to the model.
		const redactResult = await execute(
			{ op: "redact", content: { token: "refresh-secret" } },
			{ vault },
		);
		assert.strictEqual(redactResult.ok, true);
		assert.strictEqual(redactResult.data.content.token, "[REDACTED]");

		// Rotate a delegated key for the user.
		const rotateResult = await execute(
			{ op: "rotate_key", userId: USER_ID },
			{ keyRegistry: registry },
		);
		assert.strictEqual(rotateResult.ok, true);
		assert.ok(rotateResult.data.kid);
	});
});
