import { GoogleCalendarProvider } from "./google.js";
import { MsGraphProvider } from "./msgraph.js";
import { loadConfig } from "../../../config/loader.js";

/**
 * Get the active calendar provider instance.
 * @param {object} [config] - Optional config override
 * @returns {CalendarProviderBase|null} Active provider or null
 */
export function getActiveCalendarProvider(config) {
	const cfg = config || loadConfig();
	const calendarConfig = cfg.calendar;

	if (!calendarConfig) {
		return null;
	}

	const activeType = calendarConfig.active || "google";

	if (activeType === "google") {
		return new GoogleCalendarProvider(calendarConfig.google);
	}

	if (activeType === "msgraph") {
		return new MsGraphProvider(calendarConfig.msgraph);
	}

	return null;
}
