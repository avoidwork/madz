import { z } from "zod";

const TelemetryExporterSchema = z.object({
	protocol: z.enum(["console", "http", "grpc"]).default("console"),
	endpoint: z.string().url().default("http://localhost:4318"),
});

export const TelemetrySchema = z.object({
	enabled: z.boolean().default(false),
	exporter: TelemetryExporterSchema.default({
		protocol: "console",
		endpoint: "http://localhost:4318",
	}),
	sampling: z.object({
		ratio: z.number().min(0).max(1).default(0.1),
	}),
});
