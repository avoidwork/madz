import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, decodeJwt, decodeProtectedHeader, exportJWK } from "jose";
import {
	SessionInputSchema,
	DelegationInputSchema,
	computeAth,
	generateSessionJwt,
	issueDelegation,
	execute,
} from "../../../../src/tools/poppy/session.js";

const CLIENT_ID = "https://agent.example.com";
const AUDIENCE = "https://company.example.com";
const USER_ID = "user-123";

async function makeKeys() {
	const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
	return { publicKey, privateKey };
}

describe("poppy session - schema validation", () => {
	it("accepts valid session input", () => {
		const result = SessionInputSchema.safeParse({
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects session input missing required fields", () => {
		const result = SessionInputSchema.safeParse({
			clientId: CLIENT_ID,
			audience: AUDIENCE,
		});
		assert.strictEqual(result.success, false);
	});

	it("accepts valid delegation input", () => {
		const result = DelegationInputSchema.safeParse({
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects delegation input missing required fields", () => {
		const result = DelegationInputSchema.safeParse({});
		assert.strictEqual(result.success, false);
	});

	it("does not require userId or audience for delegation input", () => {
		const result = DelegationInputSchema.safeParse({ clientId: CLIENT_ID });
		assert.strictEqual(result.success, true);
	});
});

describe("poppy session - computeAth", () => {
	it("computes a SHA-256 hash of the access token", () => {
		const hash = computeAth("my-access-token");
		assert.match(hash, /^[A-Za-z0-9_-]+$/);
		assert.strictEqual(hash, computeAth("my-access-token"));
	});

	it("produces different hashes for different tokens", () => {
		assert.notStrictEqual(computeAth("token-a"), computeAth("token-b"));
	});
});

describe("poppy session - generateSessionJwt", () => {
	it("generates a session JWT with required claims", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		assert.ok(result.jwt);
		assert.ok(result.sid);
		assert.ok(result.jti);
		assert.ok(result.iat > 0);
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.iss, CLIENT_ID);
		assert.strictEqual(payload.aud, AUDIENCE);
		assert.strictEqual(payload.sub, USER_ID);
		assert.strictEqual(payload.htm, "GET");
		assert.strictEqual(payload.htu, "https://company.example.com/api");
		assert.ok(payload.sid);
		assert.ok(payload.jti);
		const header = decodeProtectedHeader(result.jwt);
		assert.strictEqual(header.typ, "poppy-session+jwt");
		assert.strictEqual(header.alg, "ES256");
	});

	it("includes agent_id when provided", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
			agentId: "agent-1",
		});
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.agent_id, "agent-1");
	});

	it("omits agent_id when absent", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.agent_id, undefined);
	});

	it("includes ath when access token present", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
			accessToken: "access-token",
		});
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.ath, computeAth("access-token"));
	});

	it("omits ath when access token absent", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.ath, undefined);
	});

	it("produces a unique sid for each session", async () => {
		const { privateKey } = await makeKeys();
		const a = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const b = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		assert.notStrictEqual(a.sid, b.sid);
	});

	it("produces a unique jti for each session", async () => {
		const { privateKey } = await makeKeys();
		const a = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const b = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		assert.notStrictEqual(a.jti, b.jti);
	});

	it("carries the delegation in the poppy_dlg header", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
			delegation: "delegation.jwt",
		});
		const header = decodeProtectedHeader(result.jwt);
		assert.strictEqual(header.poppy_dlg, "delegation.jwt");
	});

	it("emits Poppy headers alongside the session header", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateSessionJwt({
			delegatedKey: privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		assert.strictEqual(result.headers["Poppy-Session"], result.jwt);
		assert.strictEqual(result.headers["Poppy-Version"], "1.0");
		assert.strictEqual(result.headers["Poppy-Extensions"], undefined);
	});
});

describe("poppy session - issueDelegation", () => {
	it("issues a delegation with required claims", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const result = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
		});
		assert.ok(result.jwt);
		assert.ok(result.jti);
		assert.ok(result.iat > 0);
		assert.ok(result.exp > result.iat);
		assert.ok(result.kid);
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.iss, CLIENT_ID);
		assert.strictEqual(payload.aud, undefined);
		assert.strictEqual(payload.sub, undefined);
		assert.ok(payload.cnf.jwk);
		const header = decodeProtectedHeader(result.jwt);
		assert.strictEqual(header.typ, "poppy-delegation+jwt");
		assert.strictEqual(header.alg, "ES256");
	});

	it("sets exp at most 24 hours after iat", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const result = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
		});
		assert.ok(result.exp - result.iat <= 86400);
	});

	it("names the delegated key in cnf.jwk", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const result = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
		});
		const payload = decodeJwt(result.jwt);
		const delegatedJwk = await exportJWK(delegated.publicKey);
		assert.strictEqual(payload.cnf.jwk.kty, delegatedJwk.kty);
		assert.strictEqual(payload.cnf.jwk.x, delegatedJwk.x);
		assert.strictEqual(payload.cnf.jwk.y, delegatedJwk.y);
	});
});

describe("poppy session - execute", () => {
	it("signs a session with a delegated key", async () => {
		const { privateKey } = await makeKeys();
		const result = await execute(
			{
				op: "sign_session",
				clientId: CLIENT_ID,
				audience: AUDIENCE,
				userId: USER_ID,
				method: "GET",
				url: "https://company.example.com/api",
				delegatedKey: privateKey,
			},
			{ keyRegistry: new Map() },
		);
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.jwt);
		assert.strictEqual(result.data.headers["Poppy-Version"], "1.0");
	});

	it("rejects sign_session with missing required fields", async () => {
		const { privateKey } = await makeKeys();
		const result = await execute(
			{
				op: "sign_session",
				clientId: CLIENT_ID,
				audience: AUDIENCE,
				delegatedKey: privateKey,
			},
			{ keyRegistry: new Map() },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid session input/);
	});

	it("rejects sign_session without a delegated key", async () => {
		const result = await execute(
			{
				op: "sign_session",
				clientId: CLIENT_ID,
				audience: AUDIENCE,
				userId: USER_ID,
				method: "GET",
				url: "https://company.example.com/api",
			},
			{ keyRegistry: new Map() },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /delegatedKey is required/);
	});

	it("allows a delegated key for its bound user", async () => {
		const { privateKey } = await makeKeys();
		const registry = new Map();
		const delegatedJwk = await exportJWK(privateKey);
		const { calculateJwkThumbprint } = await import("jose");
		const kid = await calculateJwkThumbprint(delegatedJwk);
		registry.set(kid, USER_ID);
		const result = await execute(
			{
				op: "sign_session",
				clientId: CLIENT_ID,
				audience: AUDIENCE,
				userId: USER_ID,
				method: "GET",
				url: "https://company.example.com/api",
				delegatedKey: privateKey,
			},
			{ keyRegistry: registry },
		);
		assert.strictEqual(result.ok, true);
	});

	it("rejects a delegated key for a different user", async () => {
		const { privateKey } = await makeKeys();
		const registry = new Map();
		const delegatedJwk = await exportJWK(privateKey);
		const { calculateJwkThumbprint } = await import("jose");
		const kid = await calculateJwkThumbprint(delegatedJwk);
		registry.set(kid, "user-other");
		const result = await execute(
			{
				op: "sign_session",
				clientId: CLIENT_ID,
				audience: AUDIENCE,
				userId: USER_ID,
				method: "GET",
				url: "https://company.example.com/api",
				delegatedKey: privateKey,
			},
			{ keyRegistry: registry },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /bound to user/);
	});

	it("issues a delegation", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const result = await execute({
			op: "issue_delegation",
			clientId: CLIENT_ID,
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.jwt);
		assert.ok(result.data.exp - result.data.iat <= 86400);
	});

	it("rejects issue_delegation without a signing key", async () => {
		const delegated = await makeKeys();
		const result = await execute({
			op: "issue_delegation",
			clientId: CLIENT_ID,
			delegatedKey: delegated.privateKey,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /signingKey is required/);
	});

	it("rejects issue_delegation without a delegated key", async () => {
		const signing = await makeKeys();
		const result = await execute({
			op: "issue_delegation",
			clientId: CLIENT_ID,
			signingKey: signing.privateKey,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /delegatedKey is required/);
	});

	it("rejects an unknown operation", async () => {
		const result = await execute({ op: "nope" });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Unknown session operation/);
	});

	it("rejects issue_delegation with invalid input", async () => {
		// Missing required fields triggers the delegation schema validation error.
		const result = await execute({ op: "issue_delegation" });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid delegation input/);
	});

	it("returns an error when session signing fails", async () => {
		// A corrupt delegated key makes generateSessionJwt throw, triggering the catch.
		const result = await execute(
			{
				op: "sign_session",
				clientId: CLIENT_ID,
				audience: AUDIENCE,
				userId: USER_ID,
				method: "GET",
				url: "https://company.example.com/api",
				delegatedKey: "not-a-key",
			},
			{ keyRegistry: new Map() },
		);
		assert.strictEqual(result.ok, false);
	});

	it("returns an error when delegation issuance fails", async () => {
		// A corrupt signing key makes issueDelegation throw, triggering the catch.
		const delegated = await makeKeys();
		const result = await execute({
			op: "issue_delegation",
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			signingKey: "not-a-key",
			delegatedKey: delegated.privateKey,
		});
		assert.strictEqual(result.ok, false);
	});
});
