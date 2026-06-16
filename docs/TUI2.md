# TUI2: Terminal Interface Blueprint

*A clean-slate design for a code-first terminal interface using Ink and `useCursor`. IRC-inspired layout, not IRC semantics.*

---

## 1. Philosophy

The interface is a terminal. Text flows in from the system, text flows out from the user. No panels, no tabs, no switching. One scrollable output area, one input line.

The IRC layout is borrowed for its elegance: messages accumulate above, input sits at the bottom, scrolling is natural. But the content is code, output, system responses — not conversation.

### Core Tenets

1. **Input is primary.** The user lives at the input line. The output area is secondary — read when needed, scroll when needed.
2. **Output is a log.** System output, code output, agent responses — all flow into the same stream.
3. **The cursor is the only control.** It appears when you're about to act, disappears when you're reading.
4. **Silence is the default.** The interface should feel like a quiet terminal — alive with output, not noise.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Header:  [● connected]                                      │
├─────────────────────────────────────────────────────────────┤
│  $ npm run build                                             │
│  > madz@1.0.0 build                                          │
│  > tsc --project tsconfig.json                               │
│  > Compiled successfully in 1.2s                             │
│  [14:23] System:  Build complete                               │
│  [14:24] System:  Running tests...                            │
│  ... (scrollable output history) ...                          │
├─────────────────────────────────────────────────────────────┤
│  > _                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App
├── Layout          — Full terminal dimensions, manages resize
├── Header          — Connection status only
├── OutputList      — Virtualized output rendering
├── InputBar        — Text input with cursor management
└── StatusLine      — Bottom bar: scroll position, mode indicators
```

### State Model

```typescript
interface AppState {
  // Output management
  entries: OutputEntry[];       // Mixed: system output, code output, responses
  scrollOffset: number;         // Lines above the fold
  autoScroll: boolean;          // True when at bottom

  // Input & cursor
  input: string;
  cursorVisible: boolean;
  cursorRow: number;            // Row within terminal (for useCursor positioning)

  // Connection
  connected: boolean;
  lastActivity: number;         // Timestamp of last user input
}
```

---

## 3. The Cursor Model

This is the heart of the design. `useCursor` from Ink gives us precise control over cursor visibility and position. We use it to create a **breathing cursor** — the interface's only interactive element.

### The Breathing Cycle

```
Reading → Typing → Idle → Reading
  ↓        ↓        ↓        ↓
Hidden   Visible  Fading   Hidden
```

| State | Cursor | Trigger |
|-------|--------|---------|
| **Reading** | Hidden | Default state. User is consuming output. |
| **Active** | Visible at input position | User presses any key. Cursor appears at end of input. |
| **Idle** | Fading (opacity transition) | No input for 2 seconds while in Active state. |
| **Submit** | Visible | User presses Enter. Cursor stays visible during send. |
| **Navigate** | Hidden | User presses Up/Down arrows for scroll. |

### Implementation Strategy

```jsx
function InputBar() {
  const { setVisibility } = useCursor({ isVisible: false });
  const [input, setInput] = useState('');
  const lastActivity = useRef(Date.now());

  // Show cursor when user starts typing
  const handleInput = (key) => {
    setVisibility(true);
    lastActivity.current = Date.now();
    setInput(prev => prev + key);
  };

  // Hide cursor after 2s of idle
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 2000) {
        setVisibility(false);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Hide cursor on navigation keys
  const handleKey = (key) => {
    if (key === 'up' || key === 'down') {
      setVisibility(false);
      handleScroll(key);
      return;
    }
    handleInput(key);
  };

  return (
    <Box>
      <Text>
        {input}
        {cursorVisible && <Text inverse> </Text>}
      </Text>
    </Box>
  );
}
```

### Why This Matters

A visible cursor during reading creates visual noise. The cleanest interface is one where the cursor is only present when you're about to contribute. The breathing model captures this naturally — the cursor is a living thing that appears when needed and rests when not.

---

## 4. Virtual Scrolling

Terminal virtualization is different from browser virtualization. We can't use DOM nodes — we render text rows. The strategy:

### Windowed Rendering

```
Terminal height: 40 lines
Header: 1 line
Input: 1 line
Status: 1 line
Output area: 37 lines

Visible window: 37 entries
Buffer above: 10 entries (for smooth scroll back)
```

### Rendering Pipeline

```
1. Calculate visible range: [scrollOffset, scrollOffset + visibleRows]
2. Render only entries in that range
3. On new output:
   - If autoScroll is true: append to end, scrollOffset = total - visibleRows
   - If autoScroll is false: append to end, user sees nothing new until they scroll down
4. On scroll up: autoScroll = false, user can review output
5. On scroll to bottom: autoScroll = true, cursor hides
```

### Scroll Behavior

| Action | Effect |
|--------|--------|
| New output arrives + at bottom | Auto-scroll, cursor hidden |
| New output arrives + scrolled up | No scroll, cursor hidden |
| User scrolls up | Auto-scroll off, cursor hidden |
| User scrolls to bottom | Auto-scroll on, cursor hidden |
| User presses Down arrow | Scroll down 1 line, cursor hidden |
| User presses Up arrow | Scroll up 1 line, cursor hidden |
| User presses PageDown | Scroll down 1 page, cursor hidden |
| User presses PageUp | Scroll up 1 page, cursor hidden |
| User starts typing | Cursor visible, scroll to bottom |

---

## 5. Component Breakdown

### 5.1 Layout

**Responsibility:** Full terminal management, resize handling, overall structure.

```jsx
function Layout() {
  const { columns, rows } = useStdout();
  const [headerHeight] = useState(1);
  const [inputHeight] = useState(1);
  const [statusHeight] = useState(1);
  const outputAreaHeight = rows - headerHeight - inputHeight - statusHeight;

  return (
    <Box direction="column" width={columns} height={rows}>
      <Header />
      <Box flexGrow={1}>
        <OutputList height={outputAreaHeight} />
      </Box>
      <InputBar />
      <StatusLine />
    </Box>
  );
}
```

### 5.2 Header

**Responsibility:** Connection status. Minimal, always visible.

```
┌─────────────────────────────────────────────────────────────┐
│  ● connected                                                │
└─────────────────────────────────────────────────────────────┘
```

| Element | Position | Style |
|---------|----------|-------|
| Connection status | Left | Colored dot (green=connected, red=disconnected) |

### 5.3 OutputList

**Responsibility:** Virtualized output rendering, scroll management, auto-scroll logic.

```jsx
function OutputList({ height }) {
  const { entries, scrollOffset, autoScroll, setScrollOffset, setAutoScroll } = useApp();
  const visibleEntries = entries.slice(scrollOffset, scrollOffset + height);

  // Auto-scroll on new output when at bottom
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(Math.max(0, entries.length - height));
    }
  }, [entries.length]);

  return (
    <Box direction="column" height={height} overflow="hidden">
      {visibleEntries.map((entry, i) => (
        <OutputRow key={entry.id} entry={entry} />
      ))}
    </Box>
  );
}
```

#### Output Row

Each entry is a terminal row. Entries can be different types:

```
$ npm run build                    ← User command (echoed)
> madz@1.0.0 build                 ← Command output
> tsc --project tsconfig.json
> Compiled successfully in 1.2s
[14:23] System:  Build complete     ← System message
[14:24] System:  Running tests...
```

| Entry Type | Format | Style |
|------------|--------|-------|
| **User command** | `$ command` | Bold, no timestamp |
| **Command output** | `> line` | Default, no timestamp |
| **System message** | `[HH:MM] System: text` | Dim timestamp, italic body |
| **Agent response** | `[HH:MM] Mads: text` | Dim timestamp, color-coded nickname |
| **Error** | `[HH:MM] Error: text` | Dim timestamp, red text |

### 5.4 InputBar

**Responsibility:** Text input, command parsing, cursor management.

```
> _
```

| Element | Behavior |
|---------|----------|
| `>` prompt | Always visible, visual cue before input |
| Input text | Grows to fill available width |
| Cursor | Breathing model (see Section 3) |

#### Command Handling

Commands are parsed from input when Enter is pressed:

| Command | Behavior |
|---------|----------|
| `/clear` | Clear output history |
| `/help` | Show command reference |
| `/quit` | Disconnect and exit |

All other input is treated as commands to execute — shell commands, code, system commands. No slash prefix needed.

### 5.5 StatusLine

**Responsibility:** Contextual information, scroll position, mode indicators.

```
───  ↑ 127 lines above  ───  [normal]
```

| Element | Content |
|---------|---------|
| Scroll position | Lines above fold (when scrolled up) |
| Mode indicator | `[normal]`, `[command]`, `[search]` |

---

## 6. Interaction Model

### Keyboard Shortcuts

| Key | Action | Cursor |
|-----|--------|--------|
| Any character | Append to input | Visible |
| Enter | Submit command | Visible → Hidden (after submit) |
| Escape | Clear input, hide cursor | Hidden |
| Up arrow | Scroll up | Hidden |
| Down arrow | Scroll down | Hidden |
| PageDown | Scroll down 1 page | Hidden |
| PageUp | Scroll up 1 page | Hidden |
| Home | Scroll to top | Hidden |
| End | Scroll to bottom, enable auto-scroll | Hidden |
| Ctrl+C | Cancel input, hide cursor | Hidden |
| Tab | Command autocomplete | Visible |

### Command History

The up/down arrows scroll through command history when the user is at the bottom of the output (not scrolling the output itself). This is a terminal convention:

```
1. User presses Enter → command executes, output appears, auto-scroll active
2. User presses Up → scrolls through previous commands (not output)
3. User presses Down → scrolls forward through command history
4. User presses Up while scrolled up in output → scrolls output
```

### Input Lifecycle

```
1. User presses key → cursor appears, input focused
2. User types → cursor follows text end
3. User presses Enter → command executed, output appended, input cleared, cursor fades
4. 2 seconds idle → cursor hidden
5. User presses key again → cycle repeats
```

---

## 7. Rendering Pipeline

### Update Cycle

```
1. State change detected (new output, input change, etc.)
2. Re-render triggered by Ink
3. Layout recalculates dimensions
4. OutputList virtualizes visible window
5. InputBar renders with cursor state
6. Terminal updates only changed cells (Ink's diffing)
```

### Performance Considerations

| Concern | Strategy |
|---------|----------|
| Large output history | Virtual scroll — only render visible rows |
| Frequent re-renders | Ink's diffing engine — only update changed cells |
| Terminal resize | Recalculate visible window, adjust scrollOffset |
| High-frequency output | Batch renders — coalesce updates within 50ms |
| Memory with long sessions | Trim old entries beyond retention limit |

---

## 8. Visual Design

### Color Palette

```
Background:    Terminal default (respects user's theme)
Text:          Terminal default
Timestamp:     Dim (#555555 or 240)
User command:  Bold
Command output: Default
System:        Italic, dim
Error:         Red
Input:         Inverse (white on dark) when cursor visible
Header:        Bold, subtle background
Divider:       ─── characters, dim
```

### Entry Styling

| Entry Type | Color | Emphasis |
|------------|-------|----------|
| User command | Terminal default | Bold |
| Command output | Terminal default | Normal |
| System message | Terminal default | Italic |
| Agent response | Color-coded | Bold nickname |
| Error | Red | Normal |

### Typography

- **Font:** Terminal default monospace (no overrides)
- **Timestamp:** Fixed-width, always 6 chars `[HH:MM]`
- **Command output prefix:** `> ` (2 chars, aligned)
- **Body:** Wraps to terminal width
- **User commands:** Prefixed with `$ ` (2 chars)

### Layout Spacing

```
Terminal width:  N columns
Header:          1 row, full width
Output area:     N-3 rows, full width
Input:           1 row, full width
Status:          1 row, full width

Output padding:  2 chars left (indent)
Command prefix:  Variable, padded to align output
Body start:      After prefix + space
```

---

## 9. Edge Cases & Resilience

### Terminal Resize

```
1. Detect resize via useStdout
2. Recalculate visible window
3. If previously at bottom: stay at bottom
4. If scrolled up: preserve scrollOffset
5. Re-render with new dimensions
```

### Connection Loss

```
1. Show red dot in header
2. Display system message: "* Disconnected"
3. Attempt reconnection (exponential backoff)
4. On reconnect: system message "* Reconnected"
5. Cursor behavior unchanged
```

### Multi-line Output

```
1. Command output longer than terminal width: wrap to multiple rows
2. Track wrapped row count for accurate scroll calculation
3. Virtual scroll accounts for wrapped entries
4. User commands (echoed) are single-line
```

### Output Retention Limit

```
1. Retain last 1000 entries
2. When limit reached: trim oldest entries
3. If user scrolled up past trim point: show "output truncated" indicator
```

---

## 10. The Cursor: A Deeper Look

The cursor is not just a UI element — it's the interface's personality. It is a quiet promise: *you can type now.* In this design, we make that promise explicit through the breathing model.

### States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    READING   │────▶│   ACTIVE    │────▶│    IDLE     │
│  (Hidden)    │◀────│ (Visible)   │◀────│ (Fading)    │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                      │
       └────────────── Escape ────────────────┘
```

### Transition Rules

| From | To | Trigger |
|------|-----|---------|
| Reading | Active | Any key press |
| Active | Idle | 2s no input |
| Idle | Active | Any key press |
| Active | Reading | Enter (submit) |
| Any | Reading | Escape |

### The "Why"

A always-visible cursor creates visual tension — the eye is drawn to it even when it's not needed. A hidden cursor during reading creates a clean canvas. The breathing model gives the interface a sense of presence without demanding attention. It's the difference between a terminal with a blinking cursor and one that waits patiently for input.

---

## 11. Implementation Notes

### Ink-Specific Patterns

1. **`useStdout`** — For terminal dimensions and resize events
2. **`useInput`** — For keyboard handling (replaces custom key listeners)
3. **`useCursor`** — For cursor visibility control (the star of the show)
4. **`Box` with `overflow="hidden"`** — For the output list viewport
5. **`Text` with `wrap="never"`** — For output rows (handle wrapping manually)

### Key Ink Patterns

```jsx
// Cursor visibility toggle
const { setVisibility } = useCursor({ isVisible: false });
setVisibility(true);   // Show
setVisibility(false);  // Hide

// Terminal dimensions
const { columns, rows } = useStdout();

// Input handling
useInput((input, key) => {
  if (key.enter) handleSubmit();
  if (key.up) handleScroll('up');
  // ...
});
```

### State Management Recommendation

For this scale, React's built-in state is sufficient. Use `useReducer` for complex state transitions (scroll management, cursor lifecycle) and `useState` for simple values (input text, connection state).

Consider a custom hook for the cursor breathing model:

```typescript
function useBreathingCursor() {
  const { setVisibility } = useCursor({ isVisible: false });
  const lastActivity = useRef(Date.now());
  const [visible, setVisible] = useState(false);

  const activate = useCallback(() => {
    setVisibility(true);
    setVisible(true);
    lastActivity.current = Date.now();
  }, [setVisibility]);

  const deactivate = useCallback(() => {
    setVisibility(false);
    setVisible(false);
  }, [setVisibility]);

  // Auto-deactivate after idle
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 2000) {
        deactivate();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [deactivate]);

  return { activate, deactivate, visible };
}
```

---

## 12. Summary

This blueprint describes a code-first TUI built on Ink with `useCursor` at its core. The IRC layout is borrowed — scrollable output above, input at the bottom — but the content is commands, output, and system responses. The design is defined by three principles:

1. **Input is primary.** The user lives at the input line. Output is secondary.
2. **The cursor breathes.** It appears when you're about to act, disappears when you're reading.
3. **The terminal is the window.** Virtual scrolling, clean rendering, respect for the user's environment.

The result is an interface that feels like a quiet terminal — present, alive, and ready for work. Not a dashboard. Not a tool. A workspace.

---

*Blueprint complete. No implementation references — this is a clean slate.*
