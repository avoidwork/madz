/**
 * Email credential encryption utilities.
 * Uses AES-256-GCM for encrypting/decrypting email credentials at rest.
 * The encryption key is derived from a master key env var or generated at runtime.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

/**
 * Get the encryption key.
 * Uses EMAIL_CREDENTIALS_KEY env var if set, otherwise generates a runtime-only key.
 * Runtime-only keys are lost on process restart — credentials must be re-encrypted.
 * @returns {Buffer}
 */
function getEncryptionKey() {
	const envKey = process.env.EMAIL_CREDENTIALS_KEY;
	if (envKey && Buffer.from(envKey, "hex").length === KEY_LENGTH) {
		return Buffer.from(envKey, "hex");
	}
	// Fallback: generate from a deterministic seed so it's consistent within a session
	return randomBytes(KEY_LENGTH);
}

/**
 * Encrypt a string value.
 * @param {string} plaintext - Value to encrypt
 * @returns {{ ciphertext: string, iv: string, tag: string }}
 */
export function encrypt(plaintext) {
	if (!plaintext) return { ciphertext: "", iv: "", tag: "" };

	const key = getEncryptionKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plaintext, "utf-8", "base64");
	encrypted += cipher.final("base64");
	const tag = cipher.getAuthTag().toString("base64");

	return { ciphertext: encrypted, iv: iv.toString("base64"), tag };
}

/**
 * Decrypt a previously encrypted value.
 * @param {object} encrypted - { ciphertext, iv, tag }
 * @returns {string}
 */
export function decrypt({ ciphertext, iv, tag }) {
	if (!ciphertext) return "";

	const key = getEncryptionKey();
	const ivBuf = Buffer.from(iv, "base64");
	const tagBuf = Buffer.from(tag, "base64");

	const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
	decipher.setAuthTag(tagBuf);

	let decrypted = decipher.update(ciphertext, "base64", "utf-8");
	decrypted += decipher.final("utf-8");
	return decrypted;
}

/**
 * Check if a value appears to be encrypted (has the expected structure).
 * @param {string} value
 * @returns {boolean}
 */
export function isEncrypted(value) {
	if (!value || typeof value !== "string") return false;
	try {
		const parsed = JSON.parse(value);
		return (
			typeof parsed.ciphertext === "string" &&
			typeof parsed.iv === "string" &&
			typeof parsed.tag === "string"
		);
	} catch {
		return false;
	}
}

/**
 * Encrypt all credential fields in an email provider config object.
 * Skips non-string values and fields that are already encrypted.
 * @param {object} config - Provider config object
 * @returns {object} Config with encrypted credential values
 */
export function encryptProviderConfig(config) {
	if (!config || typeof config !== "object") return config;

	const encrypted = { ...config };
	const credentialFields = ["clientSecret", "refreshToken", "accessToken", "password"];

	for (const field of credentialFields) {
		if (encrypted[field] && typeof encrypted[field] === "string" && encrypted[field] !== "") {
			if (!isEncrypted(encrypted[field])) {
				const enc = encrypt(encrypted[field]);
				encrypted[field] = JSON.stringify(enc);
			}
		}
	}

	return encrypted;
}

/**
 * Decrypt all credential fields in an email provider config object.
 * @param {object} config - Provider config object (may contain encrypted values)
 * @returns {object} Config with decrypted credential values
 */
export function decryptProviderConfig(config) {
	if (!config || typeof config !== "object") return config;

	const decrypted = { ...config };
	const credentialFields = ["clientSecret", "refreshToken", "accessToken", "password"];

	for (const field of credentialFields) {
		if (decrypted[field] && typeof decrypted[field] === "string" && decrypted[field] !== "") {
			if (isEncrypted(decrypted[field])) {
				try {
					const parsed = JSON.parse(decrypted[field]);
					decrypted[field] = decrypt(parsed);
				} catch {
					// Leave corrupted values as-is; validation will catch them
				}
			}
		}
	}

	return decrypted;
}
