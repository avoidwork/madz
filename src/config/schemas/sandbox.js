import { z } from "zod";

/** A positive integer byte count. */
const bytes = (n) => z.number().int().positive().default(n);

export const SandboxScopeSchema = z.object({
	paths: z.array(z.string()).default(["./", "!node_modules/", "/tmp"]),
	permissions: z.array(z.string()).default([]),
	// Skill discovery settings
	skillScanPaths: z.array(z.string()).default([".skills/", "skills/"]),
	// --- Size limits, in bytes ---
	/** Max size of a file read whole by `file` (read), `agents` and `audio`. */
	maxReadSize: bytes(1048576),
	/** Whole-file cap for `file` reads that use offset/limit pagination. */
	maxPaginatedReadSize: bytes(52428800),
	/** Max content size accepted by `file` write/append. */
	maxWriteSize: bytes(512000),
	/** Max stdout buffer for the `git diff` that `file` runs. */
	maxDiffBuffer: bytes(16777216),
	git: z.object({ maxBuffer: bytes(67108864) }).prefault({}),
	pdf: z.object({ maxFileSize: bytes(52428800) }).prefault({}),
	audio: z.object({ maxFileSize: bytes(26214400) }).prefault({}),
});
