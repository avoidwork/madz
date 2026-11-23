import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, jwtVerify, importJWK } from "jose";
import { generateSessionJwt, issueDelegation } from "../../../../src/tools/poppy/session.js";

const CLIENT_ID = "https://agent.example.com";
const AUDIENCE = "https://company.example.com";
const USER_ID = "user-123";

describe("poppy - integration session", () => {
	it("signs a session JWT and verifies it against the delegated key", async () => {
		const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});

		const { payload, protectedHeader } = await jwtVerify(result.jwt, publicKey);
		assert.strictEqual(payload.iss, CLIENT_ID);
		assert.strictEqual(payload.aud, AUDIENCE);
		assert.strictEqual(payload.sub, USER_ID);
		assert.strictEqual(payload.htm, "GET");
		assert.strictEqual(payload.htu, "https://company.example.com/api");
		assert.ok(payload.sid);
		assert.ok(payload.jti);
		assert.strictEqual(protectedHeader.typ, "poppy-session+jwt");
		assert.strictEqual(protectedHeader.alg, "ES256");
	});

	it("issues a delegation and verifies it against the jwks_uri key", async () => {
		const signing = await generateKeyPair("ES256", { extractable: true });
		const delegated = await generateKeyPair("ES256", { extractable: true });
		const result = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
		});

		const { payload, protectedHeader } = await jwtVerify(result.jwt, signing.publicKey);
		assert.strictEqual(payload.iss, CLIENT_ID);
		assert.strictEqual(payload.aud, undefined);
		assert.strictEqual(payload.sub, undefined);
		assert.ok(payload.cnf.jwk);
		assert.strictEqual(protectedHeader.typ, "poppy-delegation+jwt");
		assert.strictEqual(protectedHeader.alg, "ES256");
		assert.ok(result.exp - result.iat <= 86400);
	});

	it("verifies a session JWT using the delegated key named in the delegation", async () => {
		const signing = await generateKeyPair("ES256", { extractable: true });
		const delegated = await generateKeyPair("ES256", { extractable: true });

		const delegation = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
		});

		const session = await generateSessionJwt({
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "POST",
			url: "https://company.example.com/api/orders",
			delegation: delegation.jwt,
		});

		// A verifier resolves the delegated key from the delegation's cnf.jwk.
		const delegationPayload = (await import("jose")).decodeJwt(delegation.jwt);
		const delegatedJwk = delegationPayload.cnf.jwk;
		const delegatedPublicKey = await importJWK(delegatedJwk, "ES256");
		const { payload } = await jwtVerify(session.jwt, delegatedPublicKey);
		assert.strictEqual(payload.sub, USER_ID);
		assert.strictEqual(payload.htm, "POST");
	});
});
