## Spec: component-message-bubbles (updated)

### Requirement: MessageBubble renders stream events
The MessageBubble component SHALL conditionally render stream events when the `events` prop is present and non-empty. Events are rendered as a collapsible section below the main content, with each event displayed as a labeled line showing the event type and name.

#### Scenario: MessageBubble renders events when present
- **WHEN** a MessageBubble receives an `events` prop with one or more event objects
- **THEN** it renders an events section with a header and individual event lines
- **THEN** each event line displays the event type and name

#### Scenario: MessageBubble does not render events when absent
- **WHEN** a MessageBubble receives no `events` prop or an empty `events` array
- **THEN** no events section is rendered

#### Scenario: MessageBubble renders events in order
- **WHEN** a MessageBubble receives an `events` array with multiple events
- **THEN** events are rendered in the order they appear in the array

### Requirement: Event data structure
Each event object has the shape `{ type, name, data, tags, metadata }`. The rendering SHALL use `type` and `name` for display, with optional `data` content when present.

### Requirement: Events rendering follows existing pattern
The events section SHALL follow the same rendering pattern as `reasoningEl`, `toolCallEl`, and `toolDisplayEl`: conditional rendering, Box wrapper with `flexDirection: "row"`, `marginTop: 1`, `marginLeft: 2`, and Text elements with appropriate styling.
