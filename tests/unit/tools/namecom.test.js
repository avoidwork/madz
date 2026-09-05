import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { namecomImpl, NamecomToolSchema } from "../../../src/tools/namecom/index.js";

// All valid action names from the schema
const VALID_ACTIONS = [
	// Hello
	"hello",
	// Account Info
	"getAccountBalance",
	// Accounts
	"createAccount",
	// Domains (19)
	"listDomains",
	"createDomain",
	"getDomain",
	"updateDomain",
	"enableAutorenew",
	"disableAutorenew",
	"enableWhoisPrivacy",
	"disableWhoisPrivacy",
	"lockDomain",
	"unlockDomain",
	"renewDomain",
	"setContacts",
	"setNameservers",
	"getAuthCode",
	"getPricing",
	"checkAvailability",
	"searchDomains",
	"zoneCheck",
	"purchasePrivacy",
	// DNS (5)
	"listRecords",
	"createRecord",
	"getRecord",
	"updateRecord",
	"deleteRecord",
	// URL Forwardings (9)
	"listUrlForwardings",
	"createUrlForwarding",
	"getUrlForwarding",
	"updateUrlForwarding",
	"deleteUrlForwarding",
	"listUrlForwardingsByDomain",
	"getUrlForwardingById",
	"updateUrlForwardingById",
	"deleteUrlForwardingById",
	// Email Forwardings (5)
	"listEmailForwardings",
	"createEmailForwarding",
	"getEmailForwarding",
	"updateEmailForwarding",
	"deleteEmailForwarding",
	// Vanity Nameservers (5)
	"listVanityNameservers",
	"createVanityNameserver",
	"getVanityNameserver",
	"updateVanityNameserver",
	"deleteVanityNameserver",
	// DNSSECs (4)
	"listDnssecs",
	"createDnssec",
	"getDnssec",
	"deleteDnssec",
	// Transfers (7)
	"listTransfers",
	"createTransfer",
	"getTransfer",
	"cancelTransfer",
	"cancelExternalTransferOut",
	"createInternalTransferIn",
	"getTransferEligibility",
	// Webhook Notifications (4)
	"listNotifications",
	"subscribeNotification",
	"deleteNotification",
	"modifyNotification",
	// Domain Info (3)
	"getTldRequirements",
	"checkDomainClaims",
	"getTldRequirementsV2",
	// Contact Verification (3)
	"listUnverifiedContacts",
	"verifyContact",
	"resendContactVerification",
	// Orders (2)
	"listOrders",
	"getOrder",
	// Refunds (1)
	"processRefund",
	// TLD Pricing (1)
	"getTldPricing",
	// Premium Domains (1)
	"getPremiumDomainsList",
];

// --- Schema Tests ---

describe("Namecom Schema", () => {
	describe("action validation", () => {
		for (const action of VALID_ACTIONS) {
			test(`should validate action "${action}"`, () => {
				const result = NamecomToolSchema.safeParse({ action });
				assert.strictEqual(result.success, true);
			});
		}

		test("should reject invalid action", () => {
			const result = NamecomToolSchema.safeParse({ action: "foobar" });
			assert.strictEqual(result.success, false);
		});

		test("should reject missing action", () => {
			const result = NamecomToolSchema.safeParse({});
			assert.strictEqual(result.success, false);
		});
	});

	describe("domainName field", () => {
		test("should accept domainName string", () => {
			const result = NamecomToolSchema.safeParse({
				action: "getDomain",
				domainName: "example.com",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept domainName with subdomain", () => {
			const result = NamecomToolSchema.safeParse({
				action: "getDomain",
				domainName: "sub.example.com",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("pagination fields", () => {
		test("should accept perPage and page", () => {
			const result = NamecomToolSchema.safeParse({
				action: "listDomains",
				perPage: 100,
				page: 2,
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept sort and dir", () => {
			const result = NamecomToolSchema.safeParse({
				action: "listDomains",
				sort: "name",
				dir: "desc",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("DNS record fields", () => {
		test("should accept DNS record fields", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createRecord",
				domainName: "example.com",
				type: "A",
				name: "www",
				value: "192.168.1.1",
				ttl: 3600,
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept MX record with priority", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createRecord",
				domainName: "example.com",
				type: "MX",
				name: "@",
				value: "mail.example.com",
				priority: 10,
				ttl: 3600,
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept data field", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createRecord",
				domainName: "example.com",
				type: "TXT",
				name: "@",
				data: "some text",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("URL forwarding fields", () => {
		test("should accept host and url", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createUrlForwarding",
				domainName: "example.com",
				host: "www",
				url: "https://example.com",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Email forwarding fields", () => {
		test("should accept emailBox", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createEmailForwarding",
				domainName: "example.com",
				emailBox: "info",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Vanity nameserver fields", () => {
		test("should accept hostname and ip", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createVanityNameserver",
				domainName: "example.com",
				hostname: "ns1.example.com",
				ip: "192.168.1.1",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("DNSSEC fields", () => {
		test("should accept all DNSSEC fields", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createDnssec",
				domainName: "example.com",
				digest: "abcdef123456",
				digestType: 2,
				algorithm: 13,
				keyTag: 12345,
				flags: 256,
				protocol: 3,
				publicKey: "pubkeydata",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Transfer fields", () => {
		test("should accept authCode and period", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createTransfer",
				domainName: "example.com",
				authCode: "abc123",
				period: 1,
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Domain registration fields", () => {
		test("should accept registrar, term, purchasePrice, purchaseType", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createDomain",
				domainName: "example.com",
				registrar: "namecom",
				term: 1,
				purchasePrice: 12.99,
				purchaseType: "registration",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Contact verification fields", () => {
		test("should accept verificationId", () => {
			const result = NamecomToolSchema.safeParse({
				action: "verifyContact",
				verificationId: "v_123",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Orders/Refunds fields", () => {
		test("should accept orderId and idempotencyKey", () => {
			const result = NamecomToolSchema.safeParse({
				action: "getOrder",
				orderId: "order_123",
				idempotencyKey: "key_123",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Webhook fields", () => {
		test("should accept eventTypes and callbackUrl", () => {
			const result = NamecomToolSchema.safeParse({
				action: "subscribeNotification",
				eventTypes: ["DOMAIN_CREATED"],
				callbackUrl: "https://example.com/webhook",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Contacts and nameservers arrays", () => {
		test("should accept contacts array", () => {
			const result = NamecomToolSchema.safeParse({
				action: "setContacts",
				domainName: "example.com",
				contacts: [{ type: "registrant", name: "John" }],
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept nameservers array", () => {
			const result = NamecomToolSchema.safeParse({
				action: "setNameservers",
				domainName: "example.com",
				nameservers: ["ns1.example.com", "ns2.example.com"],
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("Domain search fields", () => {
		test("should accept domain and tld", () => {
			const result = NamecomToolSchema.safeParse({
				action: "checkAvailability",
				domain: "example",
				tld: "com",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("params field", () => {
		test("should accept params record", () => {
			const result = NamecomToolSchema.safeParse({
				action: "createDomain",
				domainName: "example.com",
				params: { someCustomField: "value" },
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("id field", () => {
		test("should accept id for record operations", () => {
			const result = NamecomToolSchema.safeParse({
				action: "getRecord",
				domainName: "example.com",
				id: "12345",
			});
			assert.strictEqual(result.success, true);
		});
	});
});

// --- Implementation Tests ---

describe("Namecom Implementation", () => {
	test("returns structured error when no credentials", async () => {
		const result = await namecomImpl({ action: "hello" });
		assert.ok(!result.ok);
		assert.ok(result.error);
		assert.ok(typeof result.error === "string");
		assert.ok(result.error.includes("NAMECOM_USERNAME") || result.error.includes("NAMECOM_TOKEN"));
	});

	test("returns error for unknown action", async () => {
		const result = await namecomImpl({ action: "foobar" });
		assert.ok(!result.ok);
		assert.ok(result.error);
		assert.ok(result.error.includes("Unknown action"));
	});

	// Test a representative sample of actions — all return the same credential error
	// since no env vars are set
	test("hello action returns credential error", async () => {
		const result = await namecomImpl({ action: "hello" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listDomains action returns credential error", async () => {
		const result = await namecomImpl({ action: "listDomains" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createDomain action returns credential error", async () => {
		const result = await namecomImpl({ action: "createDomain" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getDomain action returns credential error", async () => {
		const result = await namecomImpl({ action: "getDomain", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createRecord action returns credential error", async () => {
		const result = await namecomImpl({
			action: "createRecord",
			domainName: "example.com",
			type: "A",
			name: "www",
			value: "192.168.1.1",
			ttl: 3600,
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listRecords action returns credential error", async () => {
		const result = await namecomImpl({ action: "listRecords", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createTransfer action returns credential error", async () => {
		const result = await namecomImpl({ action: "createTransfer", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listTransfers action returns credential error", async () => {
		const result = await namecomImpl({ action: "listTransfers" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("checkAvailability action returns credential error", async () => {
		const result = await namecomImpl({ action: "checkAvailability", domain: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getAccountBalance action returns credential error", async () => {
		const result = await namecomImpl({ action: "getAccountBalance" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listOrders action returns credential error", async () => {
		const result = await namecomImpl({ action: "listOrders" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getTldPricing action returns credential error", async () => {
		const result = await namecomImpl({ action: "getTldPricing" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getPremiumDomainsList action returns credential error", async () => {
		const result = await namecomImpl({ action: "getPremiumDomainsList" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createAccount action returns credential error", async () => {
		const result = await namecomImpl({ action: "createAccount" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("processRefund action returns credential error", async () => {
		const result = await namecomImpl({ action: "processRefund" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listNotifications action returns credential error", async () => {
		const result = await namecomImpl({ action: "listNotifications" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("subscribeNotification action returns credential error", async () => {
		const result = await namecomImpl({ action: "subscribeNotification" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listUnverifiedContacts action returns credential error", async () => {
		const result = await namecomImpl({ action: "listUnverifiedContacts" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("verifyContact action returns credential error", async () => {
		const result = await namecomImpl({ action: "verifyContact", verificationId: "abc123" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("checkDomainClaims action returns credential error", async () => {
		const result = await namecomImpl({ action: "checkDomainClaims", domain: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getTldRequirements action returns credential error", async () => {
		const result = await namecomImpl({ action: "getTldRequirements", tld: "com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("zoneCheck action returns credential error", async () => {
		const result = await namecomImpl({ action: "zoneCheck", domain: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("searchDomains action returns credential error", async () => {
		const result = await namecomImpl({ action: "searchDomains", keyword: "example" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("updateDomain action returns credential error", async () => {
		const result = await namecomImpl({ action: "updateDomain", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("enableAutorenew action returns credential error", async () => {
		const result = await namecomImpl({ action: "enableAutorenew", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("disableAutorenew action returns credential error", async () => {
		const result = await namecomImpl({ action: "disableAutorenew", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("enableWhoisPrivacy action returns credential error", async () => {
		const result = await namecomImpl({ action: "enableWhoisPrivacy", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("disableWhoisPrivacy action returns credential error", async () => {
		const result = await namecomImpl({ action: "disableWhoisPrivacy", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("lockDomain action returns credential error", async () => {
		const result = await namecomImpl({ action: "lockDomain", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("unlockDomain action returns credential error", async () => {
		const result = await namecomImpl({ action: "unlockDomain", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("renewDomain action returns credential error", async () => {
		const result = await namecomImpl({ action: "renewDomain", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("setContacts action returns credential error", async () => {
		const result = await namecomImpl({ action: "setContacts", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("setNameservers action returns credential error", async () => {
		const result = await namecomImpl({ action: "setNameservers", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getAuthCode action returns credential error", async () => {
		const result = await namecomImpl({ action: "getAuthCode", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getPricing action returns credential error", async () => {
		const result = await namecomImpl({ action: "getPricing", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("purchasePrivacy action returns credential error", async () => {
		const result = await namecomImpl({ action: "purchasePrivacy", domainName: "example.com" });
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getRecord action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getRecord",
			domainName: "example.com",
			id: "123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("updateRecord action returns credential error", async () => {
		const result = await namecomImpl({
			action: "updateRecord",
			domainName: "example.com",
			id: "123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteRecord action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteRecord",
			domainName: "example.com",
			id: "123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listUrlForwardings action returns credential error", async () => {
		const result = await namecomImpl({
			action: "listUrlForwardings",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createUrlForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "createUrlForwarding",
			domainName: "example.com",
			host: "www",
			url: "https://example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getUrlForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getUrlForwarding",
			domainName: "example.com",
			host: "www",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("updateUrlForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "updateUrlForwarding",
			domainName: "example.com",
			host: "www",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteUrlForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteUrlForwarding",
			domainName: "example.com",
			host: "www",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listUrlForwardingsByDomain action returns credential error", async () => {
		const result = await namecomImpl({
			action: "listUrlForwardingsByDomain",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getUrlForwardingById action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getUrlForwardingById",
			domainName: "example.com",
			id: "123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("updateUrlForwardingById action returns credential error", async () => {
		const result = await namecomImpl({
			action: "updateUrlForwardingById",
			domainName: "example.com",
			id: "123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteUrlForwardingById action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteUrlForwardingById",
			domainName: "example.com",
			id: "123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listEmailForwardings action returns credential error", async () => {
		const result = await namecomImpl({
			action: "listEmailForwardings",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createEmailForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "createEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getEmailForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("updateEmailForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "updateEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteEmailForwarding action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listVanityNameservers action returns credential error", async () => {
		const result = await namecomImpl({
			action: "listVanityNameservers",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createVanityNameserver action returns credential error", async () => {
		const result = await namecomImpl({
			action: "createVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
			ip: "1.2.3.4",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getVanityNameserver action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("updateVanityNameserver action returns credential error", async () => {
		const result = await namecomImpl({
			action: "updateVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteVanityNameserver action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("listDnssecs action returns credential error", async () => {
		const result = await namecomImpl({
			action: "listDnssecs",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createDnssec action returns credential error", async () => {
		const result = await namecomImpl({
			action: "createDnssec",
			domainName: "example.com",
			digest: "abc123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getDnssec action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getDnssec",
			domainName: "example.com",
			digest: "abc123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteDnssec action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteDnssec",
			domainName: "example.com",
			digest: "abc123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getTransfer action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getTransfer",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("cancelTransfer action returns credential error", async () => {
		const result = await namecomImpl({
			action: "cancelTransfer",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("cancelExternalTransferOut action returns credential error", async () => {
		const result = await namecomImpl({
			action: "cancelExternalTransferOut",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("createInternalTransferIn action returns credential error", async () => {
		const result = await namecomImpl({
			action: "createInternalTransferIn",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getTransferEligibility action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getTransferEligibility",
			domainName: "example.com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("deleteNotification action returns credential error", async () => {
		const result = await namecomImpl({
			action: "deleteNotification",
			id: "notif_123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("modifyNotification action returns credential error", async () => {
		const result = await namecomImpl({
			action: "modifyNotification",
			id: "notif_123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getTldRequirementsV2 action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getTldRequirementsV2",
			tld: "com",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("resendContactVerification action returns credential error", async () => {
		const result = await namecomImpl({
			action: "resendContactVerification",
			verificationId: "v_123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("getOrder action returns credential error", async () => {
		const result = await namecomImpl({
			action: "getOrder",
			orderId: "order_123",
		});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});
});

// --- Mocked fetch tests (with credentials set) ---

describe("Namecom Implementation — with mocked fetch", () => {
	const originalFetch = global.fetch;
	const originalUsername = process.env.NAMECOM_USERNAME;
	const originalToken = process.env.NAMECOM_TOKEN;

	before(() => {
		process.env.NAMECOM_USERNAME = "testuser";
		process.env.NAMECOM_TOKEN = "testtoken";
	});

	after(() => {
		global.fetch = originalFetch;
		if (originalUsername) {
			process.env.NAMECOM_USERNAME = originalUsername;
		} else {
			delete process.env.NAMECOM_USERNAME;
		}
		if (originalToken) {
			process.env.NAMECOM_TOKEN = originalToken;
		} else {
			delete process.env.NAMECOM_TOKEN;
		}
	});

	test("hello action — successful API call", async () => {
		global.fetch = async (url, options) => {
			assert.ok(url.includes("api.name.com"));
			assert.ok(options.headers.Authorization.startsWith("Basic "));
			return {
				ok: true,
				status: 200,
				json: async () => ({ hello: "world" }),
			};
		};

		const result = await namecomImpl({ action: "hello" });
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data, { hello: "world" });
	});

	test("getAccountBalance action", async () => {
		global.fetch = async () => ({
			ok: true,
			status: 200,
			json: async () => ({ balance: 100.0 }),
		});

		const result = await namecomImpl({ action: "getAccountBalance" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.balance, 100.0);
	});

	test("listDomains action with pagination params", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("perPage=50"));
			assert.ok(url.includes("page=2"));
			assert.ok(url.includes("sort=name"));
			assert.ok(url.includes("dir=asc"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ domains: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listDomains",
			perPage: 50,
			page: 2,
			sort: "name",
			dir: "asc",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listDomains with all optional params", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("domainName=example.com"));
			assert.ok(url.includes("tld=com"));
			assert.ok(url.includes("locked=true"));
			assert.ok(url.includes("isPremium=false"));
			assert.ok(url.includes("autorenewEnabled=true"));
			assert.ok(url.includes("includeRenewalPrice=true"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ domains: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listDomains",
			domainName: "example.com",
			tld: "com",
			locked: true,
			isPremium: false,
			autorenewEnabled: true,
			includeRenewalPrice: true,
		});
		assert.strictEqual(result.ok, true);
	});

	test("listDomains with date params", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("createDate=2024-01-01"));
			assert.ok(url.includes("createDateStart=2024-01-01"));
			assert.ok(url.includes("createDateEnd=2024-12-31"));
			assert.ok(url.includes("expireDate=2025-01-01"));
			assert.ok(url.includes("expireDateStart=2025-01-01"));
			assert.ok(url.includes("expireDateEnd=2025-12-31"));
			assert.ok(url.includes("orderId=123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ domains: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listDomains",
			createDate: "2024-01-01",
			createDateStart: "2024-01-01",
			createDateEnd: "2024-12-31",
			expireDate: "2025-01-01",
			expireDateStart: "2025-01-01",
			expireDateEnd: "2025-12-31",
			orderId: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createDomain action sends POST with body", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			const body = JSON.parse(options.body);
			assert.strictEqual(body.domainName, "example.com");
			return {
				ok: true,
				status: 200,
				json: async () => ({ domain: { name: "example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "createDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getDomain action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/domains/example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ domain: { name: "example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "getDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("updateDomain action sends PATCH", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PATCH");
			return {
				ok: true,
				status: 200,
				json: async () => ({ domain: { name: "example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "updateDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("enableAutorenew action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("enableAutorenew"));
			return {
				ok: true,
				status: 200,
				json: async () => ({}),
			};
		};

		const result = await namecomImpl({
			action: "enableAutorenew",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("disableAutorenew action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("disableAutorenew"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "disableAutorenew",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("enableWhoisPrivacy action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("enableWhoisPrivacy"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "enableWhoisPrivacy",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("disableWhoisPrivacy action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("disableWhoisPrivacy"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "disableWhoisPrivacy",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("lockDomain action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes(":lock"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "lockDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("unlockDomain action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes(":unlock"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "unlockDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("renewDomain action sends POST with body", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes(":renew"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "renewDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("setContacts action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes(":setContacts"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "setContacts",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("setNameservers action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes(":setNameservers"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "setNameservers",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getAuthCode action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes(":getAuthCode"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ authCode: "abc123" }),
			};
		};

		const result = await namecomImpl({
			action: "getAuthCode",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getPricing action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes(":getPricing"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ pricing: {} }),
			};
		};

		const result = await namecomImpl({
			action: "getPricing",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("checkAvailability action sends POST", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes(":checkAvailability"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ results: [] }),
			};
		};

		const result = await namecomImpl({
			action: "checkAvailability",
			domain: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("searchDomains action sends POST", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes(":search"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ results: [] }),
			};
		};

		const result = await namecomImpl({
			action: "searchDomains",
			keyword: "example",
		});
		assert.strictEqual(result.ok, true);
	});

	test("zoneCheck action sends POST", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/zonecheck"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ results: [] }),
			};
		};

		const result = await namecomImpl({
			action: "zoneCheck",
			domain: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("purchasePrivacy action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes(":purchasePrivacy"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "purchasePrivacy",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listRecords action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/records"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ records: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listRecords",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createRecord action sends POST with body", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/records"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ record: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "createRecord",
			domainName: "example.com",
			type: "A",
			name: "www",
			value: "1.2.3.4",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getRecord action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/records/123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ record: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "getRecord",
			domainName: "example.com",
			id: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("updateRecord action sends PUT", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PUT");
			assert.ok(url.includes("/records/123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ record: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "updateRecord",
			domainName: "example.com",
			id: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteRecord action sends DELETE", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/records/123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteRecord",
			domainName: "example.com",
			id: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listUrlForwardings action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/url/forwarding"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwardings: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listUrlForwardings",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createUrlForwarding action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/url/forwarding"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "createUrlForwarding",
			domainName: "example.com",
			host: "www",
			url: "https://example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getUrlForwarding action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/url/forwarding/www"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { host: "www" } }),
			};
		};

		const result = await namecomImpl({
			action: "getUrlForwarding",
			domainName: "example.com",
			host: "www",
		});
		assert.strictEqual(result.ok, true);
	});

	test("updateUrlForwarding action sends PUT", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PUT");
			assert.ok(url.includes("/url/forwarding/www"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { host: "www" } }),
			};
		};

		const result = await namecomImpl({
			action: "updateUrlForwarding",
			domainName: "example.com",
			host: "www",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteUrlForwarding action sends DELETE", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/url/forwarding/www"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteUrlForwarding",
			domainName: "example.com",
			host: "www",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listUrlForwardingsByDomain action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/urlforwarding/example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwardings: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listUrlForwardingsByDomain",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getUrlForwardingById action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/urlforwarding/example.com/123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "getUrlForwardingById",
			domainName: "example.com",
			id: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("updateUrlForwardingById action sends PATCH", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PATCH");
			assert.ok(url.includes("/urlforwarding/example.com/123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "updateUrlForwardingById",
			domainName: "example.com",
			id: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteUrlForwardingById action sends DELETE", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/urlforwarding/example.com/123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteUrlForwardingById",
			domainName: "example.com",
			id: "123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listEmailForwardings action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/email/forwarding"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwardings: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listEmailForwardings",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createEmailForwarding action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/email/forwarding"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { emailBox: "info" } }),
			};
		};

		const result = await namecomImpl({
			action: "createEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getEmailForwarding action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/email/forwarding/info"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { emailBox: "info" } }),
			};
		};

		const result = await namecomImpl({
			action: "getEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.strictEqual(result.ok, true);
	});

	test("updateEmailForwarding action sends PUT", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PUT");
			assert.ok(url.includes("/email/forwarding/info"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ forwarding: { emailBox: "info" } }),
			};
		};

		const result = await namecomImpl({
			action: "updateEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteEmailForwarding action sends DELETE", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/email/forwarding/info"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteEmailForwarding",
			domainName: "example.com",
			emailBox: "info",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listVanityNameservers action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/vanity_nameservers"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ nameservers: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listVanityNameservers",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createVanityNameserver action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/vanity_nameservers"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ nameserver: { hostname: "ns1.example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "createVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
			ip: "1.2.3.4",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getVanityNameserver action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/vanity_nameservers/ns1.example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ nameserver: { hostname: "ns1.example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "getVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("updateVanityNameserver action sends PUT", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PUT");
			assert.ok(url.includes("/vanity_nameservers/ns1.example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ nameserver: { hostname: "ns1.example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "updateVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteVanityNameserver action sends DELETE", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/vanity_nameservers/ns1.example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteVanityNameserver",
			domainName: "example.com",
			hostname: "ns1.example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listDnssecs action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/dnssec"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ dnssecs: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listDnssecs",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createDnssec action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/dnssec"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ dnssec: { digest: "abc123" } }),
			};
		};

		const result = await namecomImpl({
			action: "createDnssec",
			domainName: "example.com",
			digest: "abc123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getDnssec action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/dnssec/abc123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ dnssec: { digest: "abc123" } }),
			};
		};

		const result = await namecomImpl({
			action: "getDnssec",
			domainName: "example.com",
			digest: "abc123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteDnssec action sends DELETE", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/dnssec/abc123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteDnssec",
			domainName: "example.com",
			digest: "abc123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listTransfers action with pagination", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("page=1"));
			assert.ok(url.includes("perPage=50"));
			assert.ok(url.includes("domainName=example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ transfers: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listTransfers",
			page: 1,
			perPage: 50,
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createTransfer action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/transfers"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ transfer: { domain: "example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "createTransfer",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getTransfer action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/transfers/example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ transfer: { domain: "example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "getTransfer",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("cancelTransfer action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/transfers/example.com:cancel"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "cancelTransfer",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("cancelExternalTransferOut action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/transfers/external/out/example.com:cancel"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "cancelExternalTransferOut",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createInternalTransferIn action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/transfers/internal/in"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ transfer: { domain: "example.com" } }),
			};
		};

		const result = await namecomImpl({
			action: "createInternalTransferIn",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getTransferEligibility action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/transfers/eligibility/example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ eligible: true }),
			};
		};

		const result = await namecomImpl({
			action: "getTransferEligibility",
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listNotifications action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/notifications"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ notifications: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listNotifications",
		});
		assert.strictEqual(result.ok, true);
	});

	test("subscribeNotification action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/notifications"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ notification: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "subscribeNotification",
			eventTypes: ["DOMAIN_CREATED"],
			callbackUrl: "https://example.com/webhook",
		});
		assert.strictEqual(result.ok, true);
	});

	test("deleteNotification action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "DELETE");
			assert.ok(url.includes("/notifications/notif_123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "deleteNotification",
			id: "notif_123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("modifyNotification action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "PUT");
			assert.ok(url.includes("/notifications/notif_123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ notification: { id: "notif_123" } }),
			};
		};

		const result = await namecomImpl({
			action: "modifyNotification",
			id: "notif_123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getTldRequirements action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/domaininfo/requirements/com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ requirements: {} }),
			};
		};

		const result = await namecomImpl({
			action: "getTldRequirements",
			tld: "com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("checkDomainClaims action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/domaininfo/claims"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ claims: [] }),
			};
		};

		const result = await namecomImpl({
			action: "checkDomainClaims",
			domain: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getTldRequirementsV2 action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/domaininfo/requirementsV2/com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ requirements: {} }),
			};
		};

		const result = await namecomImpl({
			action: "getTldRequirementsV2",
			tld: "com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listUnverifiedContacts action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/contacts/unverified"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ contacts: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listUnverifiedContacts",
		});
		assert.strictEqual(result.ok, true);
	});

	test("verifyContact action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/contacts/verify/v_123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "verifyContact",
			verificationId: "v_123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("resendContactVerification action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/contacts/verify/v_123:resend"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			};
		};

		const result = await namecomImpl({
			action: "resendContactVerification",
			verificationId: "v_123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("listOrders action with pagination", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("page=1"));
			assert.ok(url.includes("perPage=50"));
			assert.ok(url.includes("domainName=example.com"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ orders: [] }),
			};
		};

		const result = await namecomImpl({
			action: "listOrders",
			page: 1,
			perPage: 50,
			domainName: "example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getOrder action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/orders/order_123"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ order: { id: "order_123" } }),
			};
		};

		const result = await namecomImpl({
			action: "getOrder",
			orderId: "order_123",
		});
		assert.strictEqual(result.ok, true);
	});

	test("processRefund action", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/refund"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ refund: { id: "refund_123" } }),
			};
		};

		const result = await namecomImpl({
			action: "processRefund",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getTldPricing action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/tldpricing"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ pricing: {} }),
			};
		};

		const result = await namecomImpl({
			action: "getTldPricing",
		});
		assert.strictEqual(result.ok, true);
	});

	test("getPremiumDomainsList action", async () => {
		global.fetch = async (url) => {
			assert.ok(url.includes("/premiumdomainslist"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ domains: [] }),
			};
		};

		const result = await namecomImpl({
			action: "getPremiumDomainsList",
		});
		assert.strictEqual(result.ok, true);
	});

	test("createAccount action sends POST", async () => {
		global.fetch = async (url, options) => {
			assert.strictEqual(options.method, "POST");
			assert.ok(url.includes("/accounts"));
			return {
				ok: true,
				status: 200,
				json: async () => ({ account: { id: "123" } }),
			};
		};

		const result = await namecomImpl({
			action: "createAccount",
		});
		assert.strictEqual(result.ok, true);
	});

	test("handles API error response", async () => {
		global.fetch = async () => ({
			ok: false,
			status: 400,
			json: async () => ({ message: "Bad request" }),
		});

		const result = await namecomImpl({ action: "hello" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("handles 429 rate limit", async () => {
		global.fetch = async () => ({
			ok: false,
			status: 429,
			headers: new Map([["x-ratelimit-reset", "1234567890"]]),
			json: async () => ({}),
		});

		const result = await namecomImpl({ action: "hello" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Rate limit"));
	});

	test("handles 204 No Content", async () => {
		global.fetch = async () => ({
			ok: true,
			status: 204,
		});

		const result = await namecomImpl({ action: "hello" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.status, 204);
	});

	test("handles API error without JSON body", async () => {
		global.fetch = async () => ({
			ok: false,
			status: 500,
			json: async () => {
				throw new Error("parse error");
			},
		});

		const result = await namecomImpl({ action: "hello" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("HTTP 500"));
	});

	test("handles network error", async () => {
		global.fetch = async () => {
			throw new Error("Network failure");
		};

		const result = await namecomImpl({ action: "hello" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Network failure"));
	});
});
