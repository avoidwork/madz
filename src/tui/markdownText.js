/**
 * Render markdown content using OpenTUI's native markdown component.
 * @param {object} props
 * @param {string} props.content - The markdown string to render
 * @returns {React.ReactNode}
 */
export function MarkdownText({ content }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}
	return <markdown content={content} />;
}
