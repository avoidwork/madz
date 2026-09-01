// src/sandbox/vm/snapshot.js — HMAC-signed snapshot serialization/restore.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC snapshot format: HMAC_SIGNATURE::SNAPSHOT_DATA
 * The snapshot data is JSON-serialized VM state.
 */

/**
 * Sign a snapshot with HMAC-SHA256.
 * @param {string} snapshot — The snapshot data to sign
 * @param {string} secret — HMAC secret key
 * @returns {string} Signed snapshot in format: HMAC_SIGNATURE::SNAPSHOT_DATA
 */
export function signSnapshot(snapshot, secret) {
	const hmac = createHmac("sha256", secret);
	hmac.update(snapshot);
	const signature = hmac.digest("hex");
	return `${signature}::${snapshot}`;
}

/**
 * Verify an HMAC-signed snapshot and extract the original data.
 * @param {string} signedSnapshot — Signed snapshot string
 * @param {string} secret — HMAC secret key
 * @returns {{ valid: boolean, snapshot: string }} Verification result
 */
export function verifySnapshot(signedSnapshot, secret) {
	const parts = signedSnapshot.split("::");
	if (parts.length !== 2) {
		return { valid: false, snapshot: "" };
	}

	const [providedSignature, data] = parts;

	if (providedSignature.length !== 64) {
		return { valid: false, snapshot: "" };
	}

	const hmac = createHmac("sha256", secret);
	hmac.update(data);
	const expectedSignature = hmac.digest("hex");

	const valid = timingSafeEqual(
		Buffer.from(providedSignature, "hex"),
		Buffer.from(expectedSignature, "hex"),
	);

	return { valid, snapshot: valid ? data : "" };
}

/**
 * Extract the snapshot data from a signed snapshot string.
 * @param {string} signedSnapshot — Signed snapshot string
 * @returns {string} The raw snapshot data (unverified)
 */
export function extractSnapshot(signedSnapshot) {
	const parts = signedSnapshot.split("::");
	if (parts.length >= 2) {
		return parts.slice(1).join("::");
	}
	return signedSnapshot;
}
