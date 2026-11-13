import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import { redactAttributes } from "./redaction.js";

/**
 * Record a finished skill execution as a span. A missing or non-zero exit
 * status is reported as an error.
 * @param {Object} options - Execution details
 * @param {string} options.skillName - The skill name
 * @param {number} options.durationMs - Execution duration in milliseconds
 * @param {number} [options.exitStatus] - Process exit code (non-zero or missing = error)
 * @param {import("@opentelemetry/api").Span} [options.parentSpan] - Parent span
 * @param {import("@opentelemetry/api").Tracer} [options.tracer] - Tracer (defaults to harness tracer)
 * @returns {{span: Object, name: string, spanKind: string, attributes: Object}} Span data
 */
export function instrumentSkillExecution({
	skillName,
	durationMs,
	exitStatus,
	parentSpan,
	tracer,
}) {
	const ok = exitStatus === 0;
	const name = `skill:${skillName}`;
	const attributes = redactAttributes({
		"mz.skill.name": skillName,
		"mz.skill.duration_ms": durationMs,
		"mz.skill.status": ok ? "ok" : "error",
		"mz.skill.exit_code": exitStatus,
	});

	const parent = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();
	const end = Date.now();
	const span = (tracer ?? trace.getTracer("madz-harness")).startSpan(
		name,
		{ startTime: end - (durationMs || 0), attributes },
		parent,
	);
	span.setStatus({ code: ok ? SpanStatusCode.OK : SpanStatusCode.ERROR });
	span.end(end);

	return { span, spanKind: "internal", name, attributes };
}
