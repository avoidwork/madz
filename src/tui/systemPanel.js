import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import os from "node:os";
import { statfs } from "node:fs/promises";
import { partial } from "filesize";

const format = partial({ precision: 3 });

/** Default refresh interval (ms) for live system info updates. */
const DEFAULT_REFRESH_MS = 1000;

/**
 * Format a byte count as a human-readable string using the `filesize` module.
 * @param {number} bytes - The byte count.
 * @returns {string} The formatted size.
 */
export function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return "unavailable";
	return format(bytes);
}

/**
 * Gather system information using Node built-ins.
 * Handles missing `fs.promises.statfs` support and unavailable load average gracefully.
 * @returns {Promise<Object>} The gathered system info.
 */
export async function gatherSystemInfo() {
	const cpus = os.cpus() || [];
	const loadavg = os.loadavg();
	const totalmem = os.totalmem();
	const freemem = os.freemem();
	const uptime = os.uptime();
	const platform = os.platform();
	const release = os.release();
	const nodeVersion = process.version;
	const processMemory = process.memoryUsage();
	const time = new Date().toLocaleTimeString();

	let disk = { available: false };
	try {
		if (typeof statfs === "function") {
			const stat = await statfs(process.cwd());
			disk = {
				available: true,
				total: stat.blocks * stat.bsize,
				free: stat.bavail * stat.bsize,
			};
		}
	} catch {
		disk = { available: false };
	}

	// Collect non-internal IPv4 addresses for the network section.
	const interfaces = [];
	const nets = os.networkInterfaces();
	for (const [name, addrs] of Object.entries(nets)) {
		for (const addr of addrs || []) {
			if (addr.family === "IPv4" && !addr.internal) {
				interfaces.push({ name, address: addr.address });
			}
		}
	}

	return {
		hostname: os.hostname(),
		arch: os.arch(),
		osType: os.type(),
		cpu: {
			count: cpus.length,
			model: cpus[0]?.model || "unknown",
			load: loadavg && loadavg.length > 0 ? loadavg : null,
		},
		memory: {
			total: totalmem,
			free: freemem,
			used: totalmem - freemem,
		},
		disk,
		uptime,
		platform,
		release,
		nodeVersion,
		processMemory,
		interfaces,
		time,
	};
}

/**
 * Render a titled bordered section box.
 * @param {Object} props - Component props.
 * @param {string} props.title - Section title.
 * @param {string} [props.color] - Border color.
 * @param {Array} props.children - Child elements.
 * @returns {Object} The section box element.
 */
function Section({ title, color = "cyan", children }) {
	return React.createElement(
		Box,
		{
			flexDirection: "column",
			width: "100%",
			marginBottom: 1,
			borderStyle: "round",
			borderColor: color,
		},
		React.createElement(Text, { bold: true, color }, ` ${title}`),
		React.createElement(Box, { flexDirection: "column", paddingX: 1, paddingY: 1 }, children),
	);
}

/**
 * Format a duration in seconds as a human-readable string.
 * @param {number} seconds - The duration in seconds.
 * @returns {string} The formatted duration.
 */
function formatUptime(seconds) {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h ${minutes}m`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

/**
 * SystemPanel — read-only system info panel.
 * Props:
 *   onViewChange  - Callback to switch back to conversation view
 *   activeView    - The current active view name (from PANELS)
 *   refreshMs     - Live refresh interval in milliseconds (defaults to DEFAULT_REFRESH_MS)
 */
export function SystemPanel({ onViewChange, activeView, refreshMs = DEFAULT_REFRESH_MS }) {
	const isActive = activeView === "system";
	const [info, setInfo] = useState(null);
	const { columns } = useWindowSize();

	// Gather system info asynchronously
	useEffect(() => {
		let cancelled = false;
		const load = () => {
			gatherSystemInfo().then((result) => {
				if (!cancelled) setInfo(result);
			});
		};
		load();
		const interval = setInterval(load, refreshMs);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [refreshMs]);

	// Escape returns to conversation view
	useInput(
		(_input, key) => {
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	if (!info) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
			React.createElement(Text, { bold: true, color: "white" }, " System"),
			React.createElement(Text, { color: "gray" }, " Loading..."),
		);
	}

	const load = info.cpu.load;
	const loadLine = load
		? `1m ${load[0].toFixed(2)}  5m ${load[1].toFixed(2)}  15m ${load[2].toFixed(2)}`
		: "unavailable";
	const memPct =
		info.memory.total > 0 ? Math.round((info.memory.used / info.memory.total) * 100) : 0;
	const diskLine = info.disk.available
		? `${formatBytes(info.disk.free)} free of ${formatBytes(info.disk.total)}`
		: "unavailable";
	const diskPct =
		info.disk.available && info.disk.total > 0
			? Math.round(((info.disk.total - info.disk.free) / info.disk.total) * 100)
			: 0;
	const netLine =
		info.interfaces.length > 0
			? info.interfaces.map((i) => `${i.name}: ${i.address}`).join("  ")
			: "none";

	// Two-column layout when the terminal is wide enough.
	const wide = columns >= 80;

	const cpuSection = React.createElement(
		Section,
		{ title: "CPU", color: "cyan" },
		React.createElement(Text, {}, ` Model: ${info.cpu.model}`),
		React.createElement(Text, {}, ` Cores: ${info.cpu.count}  Arch: ${info.arch}`),
		React.createElement(Text, {}, ` Load: ${loadLine}`),
	);

	const memorySection = React.createElement(
		Section,
		{ title: "Memory", color: "magenta" },
		React.createElement(Text, {}, ` Used: ${formatBytes(info.memory.used)} (${memPct}%)`),
		React.createElement(Text, {}, ` Free: ${formatBytes(info.memory.free)}`),
		React.createElement(Text, {}, ` Total: ${formatBytes(info.memory.total)}`),
	);

	const diskSection = React.createElement(
		Section,
		{ title: "Disk", color: "green" },
		React.createElement(Text, {}, ` Free: ${diskLine}`),
		React.createElement(Text, {}, ` Used: ${diskPct}%`),
	);

	const processSection = React.createElement(
		Section,
		{ title: "Process", color: "yellow" },
		React.createElement(Text, {}, ` RSS: ${formatBytes(info.processMemory.rss)}`),
		React.createElement(Text, {}, ` Heap: ${formatBytes(info.processMemory.heapUsed)}`),
		React.createElement(Text, {}, ` Node: ${info.nodeVersion}`),
	);

	const systemSection = React.createElement(
		Section,
		{ title: "System", color: "white" },
		React.createElement(Text, {}, ` Host: ${info.hostname}`),
		React.createElement(Text, {}, ` OS: ${info.osType} ${info.platform} ${info.release}`),
		React.createElement(Text, {}, ` Uptime: ${formatUptime(info.uptime)}`),
	);

	const networkSection = React.createElement(
		Section,
		{ title: "Network", color: "blue" },
		React.createElement(Text, {}, ` Interfaces: ${netLine}`),
	);

	// Pair related sections on the same row when the terminal is wide enough.
	const row = (...sections) =>
		React.createElement(
			Box,
			{ flexDirection: "row", gap: 1 },
			sections.map((s, i) => React.createElement(Box, { key: i, flexGrow: 1 }, s)),
		);

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(
			Box,
			{ flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
			React.createElement(Text, { bold: true, color: "white" }, " System"),
			React.createElement(Text, { color: "gray" }, info.time),
		),
		wide
			? React.createElement(
					Box,
					{ flexDirection: "column" },
					row(systemSection, cpuSection),
					row(memorySection, diskSection),
					row(processSection, networkSection),
				)
			: React.createElement(
					Box,
					{ flexDirection: "column" },
					systemSection,
					cpuSection,
					memorySection,
					diskSection,
					processSection,
					networkSection,
				),
	);
}
