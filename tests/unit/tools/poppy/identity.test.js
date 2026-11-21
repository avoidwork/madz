import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	ClientMetadataSchema,
	SUPPORTED_ALGS,
	buildClientMetadata,
	deriveJwksUri,
	exportPublicJwks,
	generateSigningKey,
	signClientAssertion,
	validateClientMetadata,
	validateJwksUri,
	validateRedirectUri,
} from "../../../../src/tools/poppy/identity.js";

const CLIENT_ID = "https://agent.example.com";
const JWKS_URI = "https://agent.example.com/.well-known/jwks.json";

describe("poppy identity - schema validation", () => {
	it("accepts a valid client metadata document", () => {
		const result = ClientMetadataSchema.safeParse({
			client_id: CLIENT_ID,
			client_name: "Madz",
			jwks_uri: JWKS_URI,
			redirect_uris: ["https://agent.example.com/callback"],
			token_endpoint_auth_method: "private_key_jwt",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects a missing jwks_uri", () => {
		const result = ClientMetadataSchema.safeParse({
			client_id: CLIENT_ID,
			client_name: "Madz",
			redirect_uris: ["https://agent.example.com/callback"],
			token_endpoint_auth_method: "private_key_jwt",
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects a non-private_key_jwt auth method", () => {
		const result = ClientMetadataSchema.safeParse({
			client_id: CLIENT_ID,
			client_name: "Madz",
			jwks_uri: JWKS_URI,
			redirect_uris: ["https://agent.example.com/callback"],
			token_endpoint_auth_method: "client_secret_basic",
		});
		assert.strictEqual(result.success, false);
	});
});

describe("poppy identity - validateClientMetadata", () => {
	it("returns ok for a valid document", () => {
		const result = validateClientMetadata({
			client_id: CLIENT_ID,
			client_name: "Madz",
			jwks_uri: JWKS_URI,
			redirect_uris: ["https://agent.example.com/callback"],
			token_endpoint_auth_method: "private_key_jwt",
		});
		assert.strictEqual(result.ok, true);
	});

	it("returns an error for a missing jwks_uri", () => {
		const result = validateClientMetadata({
			client_id: CLIENT_ID,
			client_name: "Madz",
			redirect_uris: ["https://agent.example.com/callback"],
			token_endpoint_auth_method: "private_key_jwt",
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid client metadata/);
	});
});

describe("poppy identity - buildClientMetadata", () => {
	it("sets client_id equal to the configured URL", () => {
		const doc = buildClientMetadata({
			clientId: CLIENT_ID,
			clientName: "Madz",
			jwksUri: JWKS_URI,
			redirectUris: ["https://agent.example.com/callback"],
		});
		assert.strictEqual(doc.client_id, CLIENT_ID);
	});

	it("exposes all required fields", () => {
		const doc = buildClientMetadata({
			clientId: CLIENT_ID,
			clientName: "Madz",
			jwksUri: JWKS_URI,
			redirectUris: ["https://agent.example.com/callback"],
			logoUri: "https://agent.example.com/logo.png",
		});
		assert.strictEqual(doc.client_name, "Madz");
		assert.strictEqual(doc.logo_uri, "https://agent.example.com/logo.png");
		assert.strictEqual(doc.jwks_uri, JWKS_URI);
		assert.deepEqual(doc.redirect_uris, ["https://agent.example.com/callback"]);
		assert.strictEqual(doc.token_endpoint_auth_method, "private_key_jwt");
	});

	it("omits logo_uri when not configured", () => {
		const doc = buildClientMetadata({
			clientId: CLIENT_ID,
			clientName: "Madz",
			jwksUri: JWKS_URI,
			redirectUris: ["https://agent.example.com/callback"],
		});
		assert.strictEqual(doc.logo_uri, undefined);
	});
});

describe("poppy identity - deriveJwksUri", () => {
	it("derives a jwks_uri on the same domain as client_id", () => {
		assert.strictEqual(deriveJwksUri(CLIENT_ID), JWKS_URI);
	});
});

describe("poppy identity - validateRedirectUri", () => {
	it("accepts an on-domain HTTPS redirect URI", () => {
		assert.strictEqual(
			validateRedirectUri("https://agent.example.com/callback", CLIENT_ID).ok,
			true,
		);
	});

	it("accepts a loopback redirect URI per RFC 8252", () => {
		assert.strictEqual(validateRedirectUri("http://127.0.0.1:8080/callback", CLIENT_ID).ok, true);
	});

	it("rejects an off-domain redirect URI", () => {
		const result = validateRedirectUri("https://other.example.com/callback", CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /same domain/);
	});

	it("rejects a non-HTTPS redirect URI", () => {
		const result = validateRedirectUri("http://agent.example.com/callback", CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /HTTPS/);
	});

	it("rejects an invalid redirect URI", () => {
		const result = validateRedirectUri("not a url", CLIENT_ID);
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy identity - validateJwksUri", () => {
	it("accepts an on-domain HTTPS jwks_uri", () => {
		assert.strictEqual(validateJwksUri(JWKS_URI, CLIENT_ID).ok, true);
	});

	it("rejects an off-domain jwks_uri", () => {
		const result = validateJwksUri("https://other.example.com/.well-known/jwks.json", CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /same domain/);
	});

	it("rejects a non-HTTPS jwks_uri", () => {
		const result = validateJwksUri("http://agent.example.com/.well-known/jwks.json", CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /HTTPS/);
	});

	it("rejects an invalid jwks_uri", () => {
		const result = validateJwksUri("not a url", CLIENT_ID);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid jwks_uri/);
	});
});

describe("poppy identity - generateSigningKey", () => {
	it("generates an ES256 key pair", async () => {
		const keys = await generateSigningKey("ES256");
		assert.ok(keys.publicKey);
		assert.ok(keys.privateKey);
	});

	it("generates a PS384 key pair", async () => {
		const keys = await generateSigningKey("PS384");
		assert.ok(keys.publicKey);
		assert.ok(keys.privateKey);
	});

	it("rejects an unsupported algorithm", async () => {
		await assert.rejects(() => generateSigningKey("RS256"), /Unsupported/);
	});
});

describe("poppy identity - exportPublicJwks", () => {
	it("exports public keys only", async () => {
		const keys = await generateSigningKey("ES256");
		const jwks = await exportPublicJwks(keys.publicKey);
		assert.strictEqual(jwks.keys.length, 1);
		assert.strictEqual(jwks.keys[0].kty, "EC");
		assert.strictEqual(jwks.keys[0].d, undefined);
	});
});

describe("poppy identity - signClientAssertion", () => {
	it("signs an assertion with required claims", async () => {
		const keys = await generateSigningKey("ES256");
		const result = await signClientAssertion({
			privateKey: keys.privateKey,
			clientId: CLIENT_ID,
			audience: "https://company.example.com",
		});
		assert.ok(result.jwt);
		assert.ok(result.jti);
		assert.ok(result.iat > 0);
		assert.ok(result.exp > result.iat);
	});

	it("sets exp at most 5 minutes after iat", async () => {
		const keys = await generateSigningKey("ES256");
		const result = await signClientAssertion({
			privateKey: keys.privateKey,
			clientId: CLIENT_ID,
			audience: "https://company.example.com",
		});
		assert.ok(result.exp - result.iat <= 300);
	});

	it("produces a unique jti for each assertion", async () => {
		const keys = await generateSigningKey("ES256");
		const a = await signClientAssertion({
			privateKey: keys.privateKey,
			clientId: CLIENT_ID,
			audience: "https://company.example.com",
		});
		const b = await signClientAssertion({
			privateKey: keys.privateKey,
			clientId: CLIENT_ID,
			audience: "https://company.example.com",
		});
		assert.notStrictEqual(a.jti, b.jti);
	});

	it("supports PS384 signing", async () => {
		const keys = await generateSigningKey("PS384");
		const result = await signClientAssertion({
			privateKey: keys.privateKey,
			clientId: CLIENT_ID,
			audience: "https://company.example.com",
			alg: "PS384",
		});
		assert.ok(result.jwt);
	});

	it("rejects an unsupported signing algorithm", async () => {
		const keys = await generateSigningKey("ES256");
		await assert.rejects(
			() =>
				signClientAssertion({
					privateKey: keys.privateKey,
					clientId: CLIENT_ID,
					audience: "https://company.example.com",
					alg: "RS256",
				}),
			/Unsupported/,
		);
	});
});

describe("poppy identity - supported algorithms", () => {
	it("exposes ES256 and PS384", () => {
		assert.deepEqual(SUPPORTED_ALGS, ["ES256", "PS384"]);
	});
});
