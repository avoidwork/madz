import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, decodeJwt, SignJWT } from "jose";
import {
	VerifyInputSchema,
	ClientMetadataSchema,
	fetchClientMetadata,
	verifyDelegation,
	verifySessionJwt,
	validateSessionClaims,
	validateAccessToken,
	lookupSession,
	execute,
} from "../../../../src/tools/poppy/verify.js";
import {
	generateSessionJwt,
	issueDelegation,
	computeAth,
} from "../../../../src/tools/poppy/session.js";

const CLIENT_ID = "https://agent.example.com";
const AUDIENCE = "https://company.example.com";
const USER_ID = "user-123";

async function makeKeys() {
	const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
	return { publicKey, privateKey };
}

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

describe("poppy verify - schema validation", () => {
	it("accepts valid verify input", () => {
		const result = VerifyInputSchema.safeParse({
			session: "jwt",
			audience: AUDIENCE,
			method: "GET",
			url: "https://company.example.com/api",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects verify input missing required fields", () => {
		const result = VerifyInputSchema.safeParse({ audience: AUDIENCE });
		assert.strictEqual(result.success, false);
	});

	it("accepts valid client metadata", () => {
		const result = ClientMetadataSchema.safeParse({ jwks_uri: "https://agent.example.com/jwks" });
		assert.strictEqual(result.success, true);
	});

	it("rejects client metadata missing jwks_uri", () => {
		const result = ClientMetadataSchema.safeParse({});
		assert.strictEqual(result.success, false);
	});
});

describe("poppy verify - fetchClientMetadata", () => {
	it("fetches client metadata and JWKS", async () => {
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
				return { ok: true, status: 200, json: async () => ({ keys: [] }) };
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});
		const result = await fetchClientMetadata(CLIENT_ID);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.metadata.jwks_uri, "https://agent.example.com/jwks");
		assert.deepStrictEqual(result.data.jwks, { keys: [] });
	});

	it("reports metadata fetch failure", async () => {
		mock.method(global, "fetch", async () => ({ ok: false, status: 404, json: async () => ({}) }));
		const result = await fetchClientMetadata(CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Failed to fetch client metadata/);
	});

	it("reports invalid client metadata", async () => {
		mock.method(global, "fetch", async () => ({ ok: true, status: 200, json: async () => ({}) }));
		const result = await fetchClientMetadata(CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid client metadata/);
	});
});

describe("poppy verify - verifyDelegation", () => {
	it("accepts a valid delegation", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const delegation = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
		});
		const jwks = { keys: [await exportJWK(signing.publicKey)] };
		const result = await verifyDelegation(delegation.jwt, jwks, CLIENT_ID, Date.now());
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.payload.cnf.jwk);
	});

	it("rejects a delegation with wrong typ", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const delegatedJwk = await exportJWK(delegated.publicKey);
		// Sign a JWT with a non-delegation typ.
		const jwt = await new SignJWT({ cnf: { jwk: delegatedJwk } })
			.setProtectedHeader({ alg: "ES256", typ: "wrong" })
			.setIssuer(CLIENT_ID)
			.setAudience(AUDIENCE)
			.setSubject(USER_ID)
			.setIssuedAt(Math.floor(Date.now() / 1000))
			.setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
			.sign(signing.privateKey);
		const jwks = { keys: [await exportJWK(signing.publicKey)] };
		const result = await verifyDelegation(jwt, jwks, CLIENT_ID, Date.now());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /typ must be/);
	});

	it("rejects a delegation with expired exp", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
		const delegation = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
		});
		const jwks = { keys: [await exportJWK(signing.publicKey)] };
		const result = await verifyDelegation(
			delegation.jwt,
			jwks,
			CLIENT_ID,
			Date.now() + 86400000 * 2,
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /expired/);
	});

	it("rejects a delegation with signature mismatch", async () => {
		const signing = await makeKeys();
		const other = await makeKeys();
		const delegated = await makeKeys();
		const delegation = await issueDelegation({
			signingKey: signing.privateKey,
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
		});
		const jwks = { keys: [await exportJWK(other.publicKey)] };
		const result = await verifyDelegation(delegation.jwt, jwks, CLIENT_ID, Date.now());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /verification failed/);
	});

	it("rejects an invalid delegation JWT", async () => {
		const result = await verifyDelegation("not-a-jwt", { keys: [] }, CLIENT_ID, Date.now());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid delegation JWT/);
	});

	it("rejects a delegation without cnf.jwk", async () => {
		const signing = await makeKeys();
		// Sign a delegation JWT without a cnf.jwk.
		const jwt = await new SignJWT({})
			.setProtectedHeader({ alg: "ES256", typ: "poppy-delegation+jwt" })
			.setIssuer(CLIENT_ID)
			.setAudience(AUDIENCE)
			.setSubject(USER_ID)
			.setIssuedAt(Math.floor(Date.now() / 1000))
			.setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
			.sign(signing.privateKey);
		const jwks = { keys: [await exportJWK(signing.publicKey)] };
		const result = await verifyDelegation(jwt, jwks, CLIENT_ID, Date.now());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /cnf.jwk/);
	});
});

describe("poppy verify - verifySessionJwt", () => {
	it("accepts a valid session JWT", async () => {
		const delegated = await makeKeys();
		const session = await generateSessionJwt({
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const delegatedJwk = await exportJWK(delegated.publicKey);
		const result = await verifySessionJwt(
			session.jwt,
			delegatedJwk,
			CLIENT_ID,
			AUDIENCE,
			Date.now(),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.payload.sub, USER_ID);
	});

	it("rejects a session JWT with wrong typ", async () => {
		const delegated = await makeKeys();
		// Sign a JWT with a non-session typ.
		const jwt = await new SignJWT({
			sid: "sid",
			htm: "GET",
			htu: "https://company.example.com/api",
		})
			.setProtectedHeader({ alg: "ES256", typ: "wrong" })
			.setIssuer(CLIENT_ID)
			.setAudience(AUDIENCE)
			.setSubject(USER_ID)
			.setIssuedAt(Math.floor(Date.now() / 1000))
			.sign(delegated.privateKey);
		const delegatedJwk = await exportJWK(delegated.publicKey);
		const result = await verifySessionJwt(jwt, delegatedJwk, CLIENT_ID, AUDIENCE, Date.now());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /typ must be/);
	});

	it("rejects a session JWT with wrong aud", async () => {
		const delegated = await makeKeys();
		const session = await generateSessionJwt({
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const delegatedJwk = await exportJWK(delegated.publicKey);
		const result = await verifySessionJwt(
			session.jwt,
			delegatedJwk,
			CLIENT_ID,
			"https://other.example.com",
			Date.now(),
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /aud/);
	});

	it("rejects a session JWT with stale iat", async () => {
		const delegated = await makeKeys();
		const session = await generateSessionJwt({
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
			now: Date.now() - 600000,
		});
		const delegatedJwk = await exportJWK(delegated.publicKey);
		const result = await verifySessionJwt(
			session.jwt,
			delegatedJwk,
			CLIENT_ID,
			AUDIENCE,
			Date.now(),
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /iat/);
	});

	it("rejects an invalid session JWT", async () => {
		const result = await verifySessionJwt("not-a-jwt", {}, CLIENT_ID, AUDIENCE, Date.now());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid session JWT/);
	});

	it("rejects an invalid delegated key", async () => {
		const delegated = await makeKeys();
		const session = await generateSessionJwt({
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const result = await verifySessionJwt(
			session.jwt,
			{ kty: "RSA" },
			CLIENT_ID,
			AUDIENCE,
			Date.now(),
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid delegated key/);
	});
});

describe("poppy verify - validateSessionClaims", () => {
	it("accepts matching htm/htu", () => {
		const result = validateSessionClaims(
			{ htm: "GET", htu: "https://company.example.com/api" },
			"GET",
			"https://company.example.com/api",
		);
		assert.strictEqual(result.ok, true);
	});

	it("rejects htm mismatch", () => {
		const result = validateSessionClaims(
			{ htm: "POST", htu: "https://company.example.com/api" },
			"GET",
			"https://company.example.com/api",
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /htm/);
	});

	it("rejects htu mismatch", () => {
		const result = validateSessionClaims(
			{ htm: "GET", htu: "https://company.example.com/other" },
			"GET",
			"https://company.example.com/api",
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /htu/);
	});
});

describe("poppy verify - validateAccessToken", () => {
	it("accepts matching ath", () => {
		const result = validateAccessToken(
			{ ath: computeAth("token"), iss: CLIENT_ID },
			"token",
			CLIENT_ID,
		);
		assert.strictEqual(result.ok, true);
	});

	it("rejects ath mismatch", () => {
		const result = validateAccessToken({ ath: "wrong", iss: CLIENT_ID }, "token", CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /ath/);
	});

	it("rejects iss mismatch", () => {
		const result = validateAccessToken(
			{ ath: "hash", iss: "https://other.example.com" },
			undefined,
			CLIENT_ID,
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /iss/);
	});
});

describe("poppy verify - lookupSession", () => {
	it("returns an existing session", async () => {
		const store = makeSessionStore();
		await store.create(CLIENT_ID, "sid-1", USER_ID);
		const result = await lookupSession(store, CLIENT_ID, "sid-1", USER_ID);
		assert.strictEqual(result.clientId, CLIENT_ID);
		assert.strictEqual(result.sid, "sid-1");
	});

	it("starts a new signed-out session for unknown combinations", async () => {
		const store = makeSessionStore();
		const result = await lookupSession(store, CLIENT_ID, "sid-new", USER_ID);
		assert.strictEqual(result.signedOut, true);
		assert.strictEqual(result.sid, "sid-new");
	});
});

describe("poppy verify - execute", () => {
	it("verifies a valid session JWT", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
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
				method: "GET",
				url: "https://company.example.com/api",
			},
			{ sessionStore: store },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.verified, true);
	});

	it("returns invalid_session for a missing delegation", async () => {
		const delegated = await makeKeys();
		const session = await generateSessionJwt({
			delegatedKey: delegated.privateKey,
			clientId: CLIENT_ID,
			audience: AUDIENCE,
			userId: USER_ID,
			method: "GET",
			url: "https://company.example.com/api",
		});
		const store = makeSessionStore();
		const result = await execute(
			{
				session: session.jwt,
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

	it("returns invalid_session for a wrong aud", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
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
				audience: "https://other.example.com",
				method: "GET",
				url: "https://company.example.com/api",
			},
			{ sessionStore: store },
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "invalid_session");
	});

	it("returns invalid_session for an htm/htu mismatch", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
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
				url: "https://company.example.com/api",
			},
			{ sessionStore: store },
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "invalid_session");
	});

	it("returns session_ended when the session has ended", async () => {
		const signing = await makeKeys();
		const delegated = await makeKeys();
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
		// Pre-create an ended session.
		const payload = decodeJwt(session.jwt);
		store.sessions.set(`${CLIENT_ID}:${payload.sid}:${USER_ID}`, {
			clientId: CLIENT_ID,
			sid: payload.sid,
			userId: USER_ID,
			ended: true,
		});
		const result = await execute(
			{
				session: session.jwt,
				audience: AUDIENCE,
				method: "GET",
				url: "https://company.example.com/api",
			},
			{ sessionStore: store },
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "session_ended");
		assert.strictEqual(result.status, 400);
	});

	it("returns an error when sessionStore is missing", async () => {
		const result = await execute(
			{
				session: "jwt",
				audience: AUDIENCE,
				method: "GET",
				url: "https://company.example.com/api",
			},
			{},
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /sessionStore is required/);
	});
});
