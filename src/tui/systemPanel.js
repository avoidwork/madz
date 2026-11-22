import React from "react";
import { Box, Text, useInput } from "ink";
import os from "node:os";
import fs from "node:fs";

/**
 * Format a byte count as a human-readable string.
 * @param {number} bytes - The byte count.
 * @returns {string} The formatted size.
 */
export function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return "unavailable";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Gather system information using Node built-ins.
 * Handles missing `fs.statfs` support and unavailable load average gracefully.
 * @returns {Object} The gathered system info.
 */
export function gatherSystemInfo() {
	const cpus = os.cpus() || [];
	const loadavg = os.loadavg();
	const totalmem = os.totalmem();
	const freemem = os.freemem();
	const uptime = os.uptime();
	const platform = os.platform();
	const release = os.release();
	const nodeVersion = process.version;
	const processMemory = process.memoryUsage();

	let disk = { available: false };
	try {
		if (typeof fs.statfs === "function") {
			const stat = fs.statfs(process.cwd());
			disk = {
				available: true,
				total: stat.blocks * stat.bsize,
				free: stat.bavail * stat.bsize,
			};
		}
	} catch {
		disk = { available: false };
	}

	return {
		cpu: {
			count: cpus.length,
			load: loadavg && loadavg.length > 0 ? loadavg[0] : null,
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
	};
}

/**
 * SystemPanel — read-only system info panel.
 * Props:
 *   onViewChange  - Callback to switch back to conversation view
 *   activeView    - The current active view name (from PANELS)
 */
export function SystemPanel({ onViewChange, activeView }) {
	const isActive = activeView === "system";
	const info = gatherSystemInfo();

	// Escape returns to conversation view
	useInput(
		(_input, key) => {
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	const cpuLoad = info.cpu.load === null ? "unavailable" : `${info.cpu.load.toFixed(2)}`;
	const diskLine = info.disk.available
		? `${formatBytes(info.disk.free)} free of ${formatBytes(info.disk.total)}`
		: "unavailable";

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "white" }, " System"),
		React.createElement(Text, { color: "gray" }, " Escape back"),
		React.createElement(Text, {}, ` Platform: ${info.platform} ${info.release}`),
		React.createElement(Text, {}, ` Node: ${info.nodeVersion}`),
		React.createElement(
			Text,
			{},
			` Uptime: ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m`,
		),
		React.createElement(Text, {}, ` CPU: ${info.cpu.count} cores, load ${cpuLoad}`),
		React.createElement(
			Text,
			{},
			` Memory: ${formatBytes(info.memory.used)} used of ${formatBytes(info.memory.total)}`,
		),
		React.createElement(Text, {}, ` Disk: ${diskLine}`),
		React.createElement(
			Text,
			{},
			` Process: ${formatBytes(info.processMemory.rss)} RSS, ${formatBytes(info.processMemory.heapUsed)} heap`,
		),
	);
}
