/**
 * Settings panel section for the TUI.
 * Props: configSections, highContrast
 * @param {object} props
 * @param {string[]} [props.configSections] - Array of config section names
 * @param {boolean} [props.highContrast] - High-contrast display mode
 */
export function SettingsPanel({ configSections = [], highContrast = false }) {
	const [focusIndex, setFocusIndex] = useState(0);
	const [selectedSection, setSelectedSection] = useState(null);

	useInput((_, key) => {
		if (key.up && focusIndex > 0) {
			setFocusIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.down && focusIndex < configSections.length - 1) {
			setFocusIndex((prev) => Math.min(configSections.length - 1, prev + 1));
		}
		if (key.enter) {
			setSelectedSection(configSections[focusIndex] || null);
		}
		if (key.escape) {
			setSelectedSection(null);
		}
	});

	return (
		<Box flexDirection="row">
			<Box flexDirection="column" width="45%">
				<Text bold color="cyan">
					{" "}
					Settings{" "}
				</Text>
				{configSections.map((section, i) => (
					<Box key={section} borderColor={focusIndex === i ? "cyan" : "transparent"}>
						<Text
							color={focusIndex === i && highContrast ? "white" : undefined}
							bold={focusIndex === i && highContrast}
						>
							{focusIndex === i ? "▸ " : "  "}
							{section}
						</Text>
					</Box>
				))}
			</Box>
			{selectedSection && (
				<Box flexDirection="column" width="55%" borderStyle="single" borderColor="gray">
					<Text bold> {selectedSection} </Text>
					<Text gray dim={!highContrast} bold={highContrast}>
						{" "}
						Edit config values here.
					</Text>
					<Text gray dim={!highContrast} bold={highContrast}>
						{" "}
						Use :config set &lt;key&gt; &lt;value&gt;.
					</Text>
				</Box>
			)}
		</Box>
	);
}
