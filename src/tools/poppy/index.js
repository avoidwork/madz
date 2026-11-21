import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { poppyImpl } from "./discovery.js";
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
} from "./identity.js";

/**
 * Poppy (Personal Agent Protocol) discovery tool. Fetches and validates a
 * company's `poppy.json` document at `/.well-known/poppy.json`, returning a
 * normalized representation for downstream layers. Requires `network:outbound`.
 * @param {z.infer<typeof PoppySchema>} input - Tool input with a domain
 * @returns {Promise<{ok: boolean, data?: object, source?: string, error?: string}>} Result
 */
export const poppy = tool(poppyImpl, {
	name: "poppy",
	description:
		"Poppy (Personal Agent Protocol) discovery. Fetches and validates a company's poppy.json at https://{domain}/.well-known/poppy.json over HTTPS, following redirects (each HTTPS, final path exactly /.well-known/poppy.json with no query). Validates required fields (protocol_version, organization.name/domain, at least one of agent/apis/web), checks organization.domain equals the serving host (case-insensitive), rejects non-HTTPS and loopback/private/link-local URLs, returns a normalized representation, and caches per-domain with a TTL. Requires network:outbound.",
	schema: z.object({
		domain: z.string().min(1).describe("The company domain to discover (e.g. example.com)"),
	}),
});

export {
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
};
