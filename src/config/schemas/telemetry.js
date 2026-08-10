import { z } from "zod";

export const TelemetryExporterSchema = z.object({
	protocol: z.enum(["console", "http", "grpc"]).default("console"),
	endpoint: z.string().url().default("http://localhost:4318"),
	batch: z.object({
		maxSize: z.number().int().positive().default(512),
		scheduledDelay: z.number().int().positive().default(5000),
	}),
});

export const TelemetrySchema = z.object({
	enabled: z.boolean().default(false),
	exporter: TelemetryExporterSchema.default({
		protocol: "console",
		endpoint: "http://localhost:4318",
		batch: { maxSize: 512, scheduledDelay: 5000 },
	}),
	sampling: z.object({
		ratio: z.number().min(0).max(1).default(0.1),
	}),
	redact: z.object({
		paths: z.array(z.string()).default(["credentials.apiKey"]),
	}),
});
