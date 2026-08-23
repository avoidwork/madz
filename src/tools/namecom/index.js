import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Default API base URLs.
 */
const BASE_URLS = Object.freeze({
	production: "https://api.name.com/v1",
	testing: "https://api.dev.name.com/v1",
});

/**
 * Allowed hostnames for outbound requests.
 */
const ALLOWED_HOSTS = new Set(["api.name.com", "api.dev.name.com"]);

/**
 * Validate credentials are present.
 * @returns {{ valid: boolean; errors?: string[] }}
 */
function validateCredentials() {
	const errors = [];
	const username = process.env.NAMECOM_USERNAME;
	const token = process.env.NAMECOM_TOKEN;
	if (!username) errors.push("NAMECOM_USERNAME is not set");
	if (!token) errors.push("NAMECOM_TOKEN is not set");
	if (errors.length > 0) return { valid: false, errors };
	return { valid: true };
}

/**
 * Validate the hostname is in the allowlist.
 * @param {string} hostname
 * @returns {{ valid: boolean; error?: string }}
 */
function validateHost(hostname) {
	if (!ALLOWED_HOSTS.has(hostname)) {
		return {
			valid: false,
			error: `Host "${hostname}" is not allowed. Allowed: ${[...ALLOWED_HOSTS].join(", ")}`,
		};
	}
	return { valid: true };
}

/**
 * Make an authenticated request to the name.com API.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g., "/core/v1/domains")
 * @param {object} [body] - Request body (will be JSON-stringified)
 * @returns {Promise<object>} Parsed JSON response
 */
async function makeRequest(method, path, body) {
	const creds = validateCredentials();
	if (!creds.valid) {
		throw new Error(`Authentication failed: ${creds.errors.join("; ")}`);
	}

	const encoded = Buffer.from(`${creds.username}:${creds.token}`).toString("base64");
	const url = `${BASE_URLS.production}${path}`;

	// Validate hostname
	const hostname = new URL(url).hostname;
	const hostCheck = validateHost(hostname);
	if (!hostCheck.valid) {
		throw new Error(hostCheck.error);
	}

	const headers = {
		Authorization: `Basic ${encoded}`,
		"Content-Type": "application/json",
	};

	const options = {
		method,
		headers,
		signal: AbortSignal.timeout(30000),
	};

	if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
		options.body = JSON.stringify(body);
	}

	const response = await fetch(url, options);

	// Handle rate limit
	if (response.status === 429) {
		const resetHeader = response.headers.get("x-ratelimit-reset");
		const resetTime = resetHeader
			? new Date(parseInt(resetHeader) * 1000).toISOString()
			: "unknown";
		throw new Error(`Rate limit exceeded. Reset at: ${resetTime}`);
	}

	if (!response.ok) {
		let message = `HTTP ${response.status}`;
		try {
			const errBody = await response.json();
			message = errBody.message || message;
		} catch {
			// Ignore JSON parse errors on error responses
		}
		throw new Error(message);
	}

	// Some endpoints return 204 No Content
	if (response.status === 204) {
		return { ok: true, status: 204 };
	}

	return response.json();
}

/**
 * Action handler implementations — each maps to one or more API operations.
 */
const handlers = {
	// === Hello ===
	hello: () => makeRequest("GET", "/core/v1/hello"),

	// === Account Info ===
	getAccountBalance: () => makeRequest("GET", "/core/v1/accountinfo/balance"),

	// === Accounts ===
	createAccount: (params) => makeRequest("POST", "/core/v1/accounts", params),

	// === Domains ===
	listDomains: (params) => {
		const qs = new URLSearchParams();
		if (params.perPage) qs.set("perPage", String(params.perPage));
		if (params.page) qs.set("page", String(params.page));
		if (params.sort) qs.set("sort", params.sort);
		if (params.dir) qs.set("dir", params.dir);
		if (params.domainName) qs.set("domainName", params.domainName);
		if (params.tld) qs.set("tld", params.tld);
		if (params.locked !== undefined) qs.set("locked", String(params.locked));
		if (params.createDate) qs.set("createDate", params.createDate);
		if (params.createDateStart) qs.set("createDateStart", params.createDateStart);
		if (params.createDateEnd) qs.set("createDateEnd", params.createDateEnd);
		if (params.expireDate) qs.set("expireDate", params.expireDate);
		if (params.expireDateStart) qs.set("expireDateStart", params.expireDateStart);
		if (params.expireDateEnd) qs.set("expireDateEnd", params.expireDateEnd);
		if (params.privacyEnabled !== undefined)
			qs.set("privacyEnabled", String(params.privacyEnabled));
		if (params.isPremium !== undefined) qs.set("isPremium", String(params.isPremium));
		if (params.autorenewEnabled !== undefined)
			qs.set("autorenewEnabled", String(params.autorenewEnabled));
		if (params.orderId) qs.set("orderId", String(params.orderId));
		if (params.includeRenewalPrice !== undefined)
			qs.set("includeRenewalPrice", String(params.includeRenewalPrice));
		return makeRequest("GET", `/core/v1/domains?${qs}`);
	},
	createDomain: (params) => makeRequest("POST", "/core/v1/domains", params),
	getDomain: (params) => makeRequest("GET", `/core/v1/domains/${params.domainName}`),
	updateDomain: (params) => makeRequest("PATCH", `/core/v1/domains/${params.domainName}`, params),
	enableAutorenew: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:enableAutorenew`),
	disableAutorenew: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:disableAutorenew`),
	enableWhoisPrivacy: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:enableWhoisPrivacy`),
	disableWhoisPrivacy: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:disableWhoisPrivacy`),
	lockDomain: (params) => makeRequest("POST", `/core/v1/domains/${params.domainName}:lock`),
	unlockDomain: (params) => makeRequest("POST", `/core/v1/domains/${params.domainName}:unlock`),
	renewDomain: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:renew`, params),
	setContacts: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:setContacts`, params),
	setNameservers: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:setNameservers`, params),
	getAuthCode: (params) => makeRequest("GET", `/core/v1/domains/${params.domainName}:getAuthCode`),
	getPricing: (params) => makeRequest("GET", `/core/v1/domains/${params.domainName}:getPricing`),
	checkAvailability: (params) => makeRequest("POST", "/core/v1/domains:checkAvailability", params),
	searchDomains: (params) => makeRequest("POST", "/core/v1/domains:search", params),
	zoneCheck: (params) => makeRequest("POST", "/core/v1/zonecheck", params),
	purchasePrivacy: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}:purchasePrivacy`, params),

	// === DNS ===
	listRecords: (params) => makeRequest("GET", `/core/v1/domains/${params.domainName}/records`),
	createRecord: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}/records`, params),
	getRecord: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/records/${params.id}`),
	updateRecord: (params) =>
		makeRequest("PUT", `/core/v1/domains/${params.domainName}/records/${params.id}`, params),
	deleteRecord: (params) =>
		makeRequest("DELETE", `/core/v1/domains/${params.domainName}/records/${params.id}`),

	// === URL Forwardings ===
	listUrlForwardings: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/url/forwarding`),
	createUrlForwarding: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}/url/forwarding`, params),
	getUrlForwarding: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/url/forwarding/${params.host}`),
	updateUrlForwarding: (params) =>
		makeRequest(
			"PUT",
			`/core/v1/domains/${params.domainName}/url/forwarding/${params.host}`,
			params,
		),
	deleteUrlForwarding: (params) =>
		makeRequest("DELETE", `/core/v1/domains/${params.domainName}/url/forwarding/${params.host}`),
	listUrlForwardingsByDomain: (params) =>
		makeRequest("GET", `/core/v1/urlforwarding/${params.domainName}`),
	getUrlForwardingById: (params) =>
		makeRequest("GET", `/core/v1/urlforwarding/${params.domainName}/${params.id}`),
	updateUrlForwardingById: (params) =>
		makeRequest("PATCH", `/core/v1/urlforwarding/${params.domainName}/${params.id}`, params),
	deleteUrlForwardingById: (params) =>
		makeRequest("DELETE", `/core/v1/urlforwarding/${params.domainName}/${params.id}`),

	// === Email Forwardings ===
	listEmailForwardings: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/email/forwarding`),
	createEmailForwarding: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}/email/forwarding`, params),
	getEmailForwarding: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/email/forwarding/${params.emailBox}`),
	updateEmailForwarding: (params) =>
		makeRequest(
			"PUT",
			`/core/v1/domains/${params.domainName}/email/forwarding/${params.emailBox}`,
			params,
		),
	deleteEmailForwarding: (params) =>
		makeRequest(
			"DELETE",
			`/core/v1/domains/${params.domainName}/email/forwarding/${params.emailBox}`,
		),

	// === Vanity Nameservers ===
	listVanityNameservers: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/vanity_nameservers`),
	createVanityNameserver: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}/vanity_nameservers`, params),
	getVanityNameserver: (params) =>
		makeRequest(
			"GET",
			`/core/v1/domains/${params.domainName}/vanity_nameservers/${params.hostname}`,
		),
	updateVanityNameserver: (params) =>
		makeRequest(
			"PUT",
			`/core/v1/domains/${params.domainName}/vanity_nameservers/${params.hostname}`,
			params,
		),
	deleteVanityNameserver: (params) =>
		makeRequest(
			"DELETE",
			`/core/v1/domains/${params.domainName}/vanity_nameservers/${params.hostname}`,
		),

	// === DNSSECs ===
	listDnssecs: (params) => makeRequest("GET", `/core/v1/domains/${params.domainName}/dnssec`),
	createDnssec: (params) =>
		makeRequest("POST", `/core/v1/domains/${params.domainName}/dnssec`, params),
	getDnssec: (params) =>
		makeRequest("GET", `/core/v1/domains/${params.domainName}/dnssec/${params.digest}`),
	deleteDnssec: (params) =>
		makeRequest("DELETE", `/core/v1/domains/${params.domainName}/dnssec/${params.digest}`),

	// === Transfers ===
	listTransfers: (params) => {
		const qs = new URLSearchParams();
		if (params.page) qs.set("page", String(params.page));
		if (params.perPage) qs.set("perPage", String(params.perPage));
		if (params.domainName) qs.set("domainName", params.domainName);
		return makeRequest("GET", `/core/v1/transfers?${qs}`);
	},
	createTransfer: (params) => makeRequest("POST", "/core/v1/transfers", params),
	getTransfer: (params) => makeRequest("GET", `/core/v1/transfers/${params.domainName}`),
	cancelTransfer: (params) => makeRequest("POST", `/core/v1/transfers/${params.domainName}:cancel`),
	cancelExternalTransferOut: (params) =>
		makeRequest("POST", `/core/v1/transfers/external/out/${params.domainName}:cancel`),
	createInternalTransferIn: (params) =>
		makeRequest("POST", "/core/v1/transfers/internal/in", params),
	getTransferEligibility: (params) =>
		makeRequest("GET", `/core/v1/transfers/eligibility/${params.domainName}`),

	// === Webhook Notifications ===
	listNotifications: () => makeRequest("GET", "/core/v1/notifications"),
	subscribeNotification: (params) => makeRequest("POST", "/core/v1/notifications", params),
	deleteNotification: (params) => makeRequest("DELETE", `/core/v1/notifications/${params.id}`),
	modifyNotification: (params) => makeRequest("PUT", `/core/v1/notifications/${params.id}`, params),

	// === Domain Info ===
	getTldRequirements: (params) =>
		makeRequest("GET", `/core/v1/domaininfo/requirements/${params.tld}`),
	checkDomainClaims: (params) =>
		makeRequest("POST", "/core/v1/domaininfo/claims", { domain: params.domain }),
	getTldRequirementsV2: (params) =>
		makeRequest("GET", `/core/v1/domaininfo/requirementsV2/${params.tld}`),

	// === Contact Verification ===
	listUnverifiedContacts: () => makeRequest("GET", "/core/v1/contacts/unverified"),
	verifyContact: (params) =>
		makeRequest("POST", `/core/v1/contacts/verify/${params.verificationId}`),
	resendContactVerification: (params) =>
		makeRequest("POST", `/core/v1/contacts/verify/${params.verificationId}:resend`),

	// === Orders ===
	listOrders: (params) => {
		const qs = new URLSearchParams();
		if (params.page) qs.set("page", String(params.page));
		if (params.perPage) qs.set("perPage", String(params.perPage));
		if (params.domainName) qs.set("domainName", params.domainName);
		return makeRequest("GET", `/core/v1/orders?${qs}`);
	},
	getOrder: (params) => makeRequest("GET", `/core/v1/orders/${params.orderId}`),

	// === Refunds ===
	processRefund: (params) => makeRequest("POST", "/core/v1/refund", params),

	// === TLD Pricing ===
	getTldPricing: () => makeRequest("GET", "/core/v1/tldpricing"),

	// === Premium Domains ===
	getPremiumDomainsList: () => makeRequest("GET", "/core/v1/premiumdomainslist"),
};

/**
 * All valid action names for the name.com API tool.
 */
const VALID_ACTIONS = Object.freeze([
	// Hello
	"hello",
	// Account Info
	"getAccountBalance",
	// Accounts
	"createAccount",
	// Domains
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
	// DNS
	"listRecords",
	"createRecord",
	"getRecord",
	"updateRecord",
	"deleteRecord",
	// URL Forwardings
	"listUrlForwardings",
	"createUrlForwarding",
	"getUrlForwarding",
	"updateUrlForwarding",
	"deleteUrlForwarding",
	"listUrlForwardingsByDomain",
	"getUrlForwardingById",
	"updateUrlForwardingById",
	"deleteUrlForwardingById",
	// Email Forwardings
	"listEmailForwardings",
	"createEmailForwarding",
	"getEmailForwarding",
	"updateEmailForwarding",
	"deleteEmailForwarding",
	// Vanity Nameservers
	"listVanityNameservers",
	"createVanityNameserver",
	"getVanityNameserver",
	"updateVanityNameserver",
	"deleteVanityNameserver",
	// DNSSECs
	"listDnssecs",
	"createDnssec",
	"getDnssec",
	"deleteDnssec",
	// Transfers
	"listTransfers",
	"createTransfer",
	"getTransfer",
	"cancelTransfer",
	"cancelExternalTransferOut",
	"createInternalTransferIn",
	"getTransferEligibility",
	// Webhook Notifications
	"listNotifications",
	"subscribeNotification",
	"deleteNotification",
	"modifyNotification",
	// Domain Info
	"getTldRequirements",
	"checkDomainClaims",
	"getTldRequirementsV2",
	// Contact Verification
	"listUnverifiedContacts",
	"verifyContact",
	"resendContactVerification",
	// Orders
	"listOrders",
	"getOrder",
	// Refunds
	"processRefund",
	// TLD Pricing
	"getTldPricing",
	// Premium Domains
	"getPremiumDomainsList",
]);

/**
 * name.com API tool — manage domains, DNS, transfers, and related services.
 * @param {z.infer<typeof NamecomToolSchema>} input - Tool input with action and params
 * @returns {Promise<object>} Result object
 */
export async function namecomImpl(input) {
	const { action, ...params } = input;

	if (!VALID_ACTIONS.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: "${action}". Valid actions: ${VALID_ACTIONS.join(", ")}`,
		};
	}

	const handler = handlers[action];
	if (!handler) {
		return {
			ok: false,
			error: `No handler for action: "${action}"`,
		};
	}

	try {
		const result = await handler(params);
		return { ok: true, data: result };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Zod schema for the name.com API tool.
 */
export const NamecomToolSchema = z.object({
	action: z.enum(VALID_ACTIONS).describe("Operation to perform"),
	// Common fields
	domainName: z.string().optional().describe("Domain name (e.g., example.com)"),
	type: z
		.string()
		.optional()
		.describe(
			"Record type (A, AAAA, CNAME, MX, TXT, NS, SRV, PTR, SOA, SPF, CAA, DNSKEY, DS, NAPTR, SSHFP)",
		),
	name: z.string().optional().describe("Record name or subdomain"),
	value: z.string().optional().describe("Record value"),
	ttl: z.number().optional().describe("Time-to-live in seconds"),
	id: z.string().optional().describe("Resource ID (record, notification, forwarding, etc.)"),
	perPage: z.number().optional().describe("Records per page (default: 250)"),
	page: z.number().optional().describe("Page number"),
	sort: z.string().optional().describe("Sort field"),
	dir: z.string().optional().describe("Sort direction (asc/desc)"),
	// DNS record fields
	data: z.string().optional().describe("DNS record data"),
	priority: z.number().optional().describe("Record priority (MX, SRV)"),
	// URL forwarding fields
	host: z.string().optional().describe("URL forwarding host"),
	url: z.string().optional().describe("Forwarding URL"),
	// Email forwarding fields
	emailBox: z.string().optional().describe("Email forwarder mailbox"),
	// Vanity nameserver fields
	hostname: z.string().optional().describe("Vanity nameserver hostname"),
	ip: z.string().optional().describe("Nameserver IP address"),
	// DNSSEC fields
	digest: z.string().optional().describe("DNSSEC digest"),
	digestType: z.number().optional().describe("DNSSEC digest type"),
	algorithm: z.number().optional().describe("DNSSEC algorithm"),
	keyTag: z.number().optional().describe("DNSSEC key tag"),
	flags: z.number().optional().describe("DNSSEC flags"),
	protocol: z.number().optional().describe("DNSSEC protocol"),
	publicKey: z.string().optional().describe("DNSSEC public key"),
	// Transfer fields
	authCode: z.string().optional().describe("Authorization code for transfer"),
	period: z.number().optional().describe("Transfer period in years"),
	productType: z
		.string()
		.optional()
		.describe("Product type (domain, premium, aftermarket, expiring, backorder)"),
	// Domain registration fields
	registrar: z.string().optional().describe("Registrar for new domain registration"),
	term: z.number().optional().describe("Registration term in years"),
	purchasePrice: z.number().optional().describe("Purchase price for premium/aftermarket domains"),
	purchaseType: z
		.string()
		.optional()
		.describe("Purchase type (registration, premium, aftermarket, expiring, backorder)"),
	contacts: z.array(z.record(z.string(), z.unknown())).optional().describe("Domain contacts"),
	nameservers: z.array(z.string()).optional().describe("Nameservers for the domain"),
	// Domain search/availability fields
	domain: z.string().optional().describe("Domain name to check"),
	tld: z.string().optional().describe("TLD (e.g., com, net, org)"),
	// Contact verification fields
	verificationId: z.string().optional().describe("Verification ID"),
	// Orders/Refunds fields
	orderId: z.string().optional().describe("Order ID"),
	idempotencyKey: z.string().optional().describe("Idempotency key for retry safety"),
	// Webhook fields
	eventTypes: z.array(z.string()).optional().describe("Webhook event types to subscribe to"),
	callbackUrl: z.string().optional().describe("Webhook callback URL"),
	// Transfer eligibility fields
	// (uses domainName)
	// Domain info fields
	// (uses tld or domain)
	// Free text params for any action-specific fields not covered above
	params: z.record(z.unknown()).optional().describe("Additional action-specific parameters"),
});

/**
 * name.com API tool — manage domains, DNS, transfers, and related services.
 * Single tool with action parameter dispatching to 40+ API operations across 17 tag groups.
 */
export const namecom = tool(async (input) => namecomImpl(input), {
	name: "namecom",
	description:
		"Manage domains, DNS records, transfers, email/URL forwarding, vanity nameservers, DNSSEC, webhook notifications, orders, refunds, TLD pricing, and contact verification via the name.com API. Actions: hello, getAccountBalance, createAccount, listDomains, createDomain, getDomain, updateDomain, enableAutorenew, disableAutorenew, enableWhoisPrivacy, disableWhoisPrivacy, lockDomain, unlockDomain, renewDomain, setContacts, setNameservers, getAuthCode, getPricing, checkAvailability, searchDomains, zoneCheck, purchasePrivacy, listRecords, createRecord, getRecord, updateRecord, deleteRecord, listUrlForwardings, createUrlForwarding, getUrlForwarding, updateUrlForwarding, deleteUrlForwarding, listUrlForwardingsByDomain, getUrlForwardingById, updateUrlForwardingById, deleteUrlForwardingById, listEmailForwardings, createEmailForwarding, getEmailForwarding, updateEmailForwarding, deleteEmailForwarding, listVanityNameservers, createVanityNameserver, getVanityNameserver, updateVanityNameserver, deleteVanityNameserver, listDnssecs, createDnssec, getDnssec, deleteDnssec, listTransfers, createTransfer, getTransfer, cancelTransfer, cancelExternalTransferOut, createInternalTransferIn, getTransferEligibility, listNotifications, subscribeNotification, deleteNotification, modifyNotification, getTldRequirements, checkDomainClaims, getTldRequirementsV2, listUnverifiedContacts, verifyContact, resendContactVerification, listOrders, getOrder, processRefund, getTldPricing, getPremiumDomainsList.",
	schema: NamecomToolSchema,
});
