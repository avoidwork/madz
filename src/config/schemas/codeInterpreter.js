// src/config/schemas/codeInterpreter.js — Zod schema for codeInterpreter config.

import { z } from "zod";

/**
 * Zod schema for codeInterpreter configuration.
 * @type {z.ZodObject}
 */
export const CodeInterpreterSchema = z
	.object({
		enabled: z.boolean().default(false),
		mode: z.enum(["thread", "turn", "call"]).default("thread"),
		memoryLimit: z.number().int().min(0).default(536870912),
		timeoutMs: z.number().int().min(0).default(30000),
		maxResultChars: z.number().int().min(0).default(50000),
		captureConsole: z.boolean().default(false),
		toolName: z.string().default("eval"),
	})
	.default({
		enabled: false,
		mode: "thread",
		memoryLimit: 536870912,
		timeoutMs: 30000,
		maxResultChars: 50000,
		captureConsole: false,
		toolName: "eval",
	});
