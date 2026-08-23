import { test, describe } from "node:test";
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

	test("hello action returns credential error", async () => {
		const result = await namecomImpl({ action: "hello" });
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
});
