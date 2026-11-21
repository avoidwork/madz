import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK } from "jose";
import { execute } from "../../../../src/tools/poppy/verify.js";
import { generateSessionJwt, issueDelegation } from "../../../../src/tools/poppy/session.js";

const CLIENT_ID = "https://agent.example.com";
const AUDIENCE = "https://company.example.com";
const USER_ID = "user-123";

function makeSessionStore() {
	const sessions = new Map();
	return {
		sessions,
		async get(clientId, sid, userId) {
			return sessions.get(`${clientId}:${sid}:${userId}`);
		},
		async create(clientId, sid, userId) {
			const record = { clientId, sid, userId, signedOut: true };
			sessions.set(`${clientId}:${sid}:${userId}`, record);
			return record;
		},
	};
}

describe("poppy - integration verify", () => {
	it("verifies a signed session JWT against a mock company endpoint", async () => {
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

		const signingJwk = await exportJWK(signing.publicKey);
		mock.method(global, "fetch", async (url) => {
			const href = String(url);
			if (href === CLIENT_ID) {
				return {
					ok: true,
					status: 200,
					json: async () => ({ jwks_uri: "https://agent.example.com/jwks" }),
				};
			}
			if (href === "https://agent.example.com/jwks") {
				return { ok: true, status: 200, json: async () => ({ keys: [signingJwk] }) };
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const store = makeSessionStore();
		const result = await execute(
			{
				session: session.jwt,
				audience: AUDIENCE,
				method: "POST",
				url: "https://company.example.com/api/orders",
			},
			{ sessionStore: store },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.verified, true);
		assert.strictEqual(result.data.claims.sub, USER_ID);
		assert.strictEqual(result.data.session.signedOut, true);
	});

	it("rejects a session JWT with a tampered signature", async () => {
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
			method: "GET",
			url: "https://company.example.com/api",
			delegation: delegation.jwt,
		});

		// Tamper the session JWT payload.
		const [header, payload, signature] = session.jwt.split(".");
		const tamperedPayload = Buffer.from(
			JSON.stringify({
				...JSON.parse(Buffer.from(payload, "base64url").toString()),
				sub: "attacker",
			}),
		).toString("base64url");
		const tampered = `${header}.${tamperedPayload}.${signature}`;

		const signingJwk = await exportJWK(signing.publicKey);
		mock.method(global, "fetch", async (url) => {
			const href = String(url);
			if (href === CLIENT_ID) {
				return {
					ok: true,
					status: 200,
					json: async () => ({ jwks_uri: "https://agent.example.com/jwks" }),
				};
			}
			if (href === "https://agent.example.com/jwks") {
				return { ok: true, status: 200, json: async () => ({ keys: [signingJwk] }) };
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const store = makeSessionStore();
		const result = await execute(
			{
				session: tampered,
				audience: AUDIENCE,
				method: "GET",
				url: "https://company.example.com/api",
			},
			{ sessionStore: store },
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "invalid_session");
		assert.strictEqual(result.status, 400);
	});
});
