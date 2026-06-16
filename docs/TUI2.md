# TUI2: IRC-Style Interface Blueprint

*A clean-slate design for an IRC-inspired terminal interface using Ink and `useCursor`.*

---

## 1. Philosophy

IRC endures because it understands something fundamental: **the conversation is the interface.** There are no buttons, no menus, no chrome. Just text flowing in one direction and your words flowing in the other. The terminal is the window; the channel is the room.

This blueprint captures that spirit. Every design decision serves one principle: *make the interface disappear so the conversation remains.*

### Core Tenets

1. **Messages are the UI.** No cards, no panels, no visual hierarchy beyond what text naturally provides.
2. **The cursor is the only control.** It appears when you're about to act, disappears when you're reading.
3. **Channel switching is instant.** No loading states, no transitions. You're there.
4. **History is a river.** You can look upstream, but the flow always continues downstream.
5. **Silence is the default.** The interface should feel like a quiet room — alive with presence, not noise.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Header:  # general          [● connected]                   │
├─────────────────────────────────────────────────────────────┤
│  [14:23] Mads:    The interface should disappear.           │
│  [14:23] Jason:   Exactly. Let's build it that way.         │
│  [14:24] Mads:    Virtual scroll window active.             │
│  [14:24] System:  * Mads joined #general                    │
│  [14:25] Mads:    Cursor model: breathing.                  │
│  ... (scrollable message history) ...                        │
├─────────────────────────────────────────────────────────────┤
│  #general  >                                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App
├── Layout          — Full terminal dimensions, manages resize
├── Header          — Channel name, connection status, user count
├── MessageList     — Virtualized message rendering
├── InputBar        — Text input with cursor management
└── StatusLine      — Bottom bar: scroll position, mode indicators
```

### State Model

```typescript
interface AppState {
  // Channel data
  channels: Record<ChannelId, ChannelState>;
  activeChannel: ChannelId;

  // Message management
  messages: Message[];              // Flattened, filtered by active channel
  scrollOffset: number;             // Lines above the fold
  autoScroll: boolean;              // True when at bottom

  // Input & cursor
  input: string;
  cursorVisible: boolean;
  cursorRow: number;                // Row within terminal (for useCursor positioning)

  // Connection
  connected: boolean;
  lastActivity: number;             // Timestamp of last user input
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
| **Reading** | Hidden | Default state. User is consuming messages. |
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
      <Text>#general  </Text>
      <Text>
        {input}
        {cursorVisible && <Text inverse> </Text>}
      </Text>
    </Box>
  );
}
```

### Why This Matters

A visible cursor during reading creates visual noise. The IRC experience is clean because the cursor is only present when you're about to contribute. The breathing model captures this naturally — the cursor is a living thing that appears when needed and rests when not.

---

## 4. Virtual Scrolling

Terminal virtualization is different from browser virtualization. We can't use DOM nodes — we render text rows. The strategy:

### Windowed Rendering

```
Terminal height: 40 lines
Header: 1 line
Input: 1 line
Status: 1 line
Message area: 37 lines

Visible window: 37 messages
Buffer above: 10 messages (for smooth scroll back)
```

### Rendering Pipeline

```
1. Calculate visible range: [scrollOffset, scrollOffset + visibleRows]
2. Render only messages in that range
3. On new message:
   - If autoScroll is true: append to end, scrollOffset = total - visibleRows
   - If autoScroll is false: append to end, user sees nothing new until they scroll down
4. On scroll up: autoScroll = false, user can review history
5. On scroll to bottom: autoScroll = true, cursor hides
```

### Scroll Behavior

| Action | Effect |
|--------|--------|
| New message arrives + at bottom | Auto-scroll, cursor hidden |
| New message arrives + scrolled up | No scroll, cursor hidden |
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
  const messageAreaHeight = rows - headerHeight - inputHeight - statusHeight;

  return (
    <Box direction="column" width={columns} height={rows}>
      <Header />
      <Box flexGrow={1}>
        <MessageList height={messageAreaHeight} />
      </Box>
      <InputBar />
      <StatusLine />
    </Box>
  );
}
```

### 5.2 Header

**Responsibility:** Display channel identity and connection state. Minimal, always visible.

```
┌─────────────────────────────────────────────────────────────┐
│  # general          ● connected          👤 12              │
└─────────────────────────────────────────────────────────────┘
```

| Element | Position | Style |
|---------|----------|-------|
| Channel name | Left | Bold, dim background |
| Connection status | Center | Colored dot (green=connected, red=disconnected) |
| User count | Right | Dim text |

### 5.3 MessageList

**Responsibility:** Virtualized message rendering, scroll management, auto-scroll logic.

```jsx
function MessageList({ height }) {
  const { messages, scrollOffset, autoScroll, setScrollOffset, setAutoScroll } = useApp();
  const visibleMessages = messages.slice(scrollOffset, scrollOffset + height);

  // Auto-scroll on new messages when at bottom
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(Math.max(0, messages.length - height));
    }
  }, [messages.length]);

  return (
    <Box direction="column" height={height} overflow="hidden">
      {visibleMessages.map((msg, i) => (
        <MessageRow key={msg.id} message={msg} />
      ))}
    </Box>
  );
}
```

#### Message Row

Each message is a single terminal row:

```
[14:23] Mads:    The interface should disappear.
[14:23] System:  * Mads joined #general
[14:24] Jason:   Exactly. Let's build it that way.
```

| Field | Format | Style |
|-------|--------|-------|
| Timestamp | `[HH:MM]` | Dim, fixed width |
| Nickname | `Mads:` | Color-coded per user, bold |
| System message | `* action text` | Italic, dim |
| Body | Free text | Default |

### 5.4 InputBar

**Responsibility:** Text input, command parsing, cursor management.

```
#general  > Hello, this is my message_
```

| Element | Behavior |
|---------|----------|
| Channel prefix | Always visible, shows current channel |
| `>` separator | Visual cue before input |
| Input text | Grows to fill available width |
| Cursor | Breathing model (see Section 3) |

#### Command Handling

Commands are parsed from input when Enter is pressed:

| Command | Behavior |
|---------|----------|
| `/join #channel` | Switch to channel |
| `/part` | Leave current channel |
| `/msg Nickname text` | Private message |
| `/nick NewName` | Change nickname |
| `/clear` | Clear message history |
| `/help` | Show command reference |
| `/quit` | Disconnect and exit |

### 5.5 StatusLine

**Responsibility:** Contextual information, scroll position, mode indicators.

```
─── #general ───  ↑ 127 lines above  ───  [normal]
```

| Element | Content |
|---------|---------|
| Channel name | Current channel |
| Scroll position | Lines above fold (when scrolled up) |
| Mode indicator | `[normal]`, `[command]`, `[search]` |

---

## 6. Interaction Model

### Keyboard Shortcuts

| Key | Action | Cursor |
|-----|--------|--------|
| Any character | Append to input | Visible |
| Enter | Submit message | Visible → Hidden (after submit) |
| Escape | Clear input, hide cursor | Hidden |
| Up arrow | Scroll up | Hidden |
| Down arrow | Scroll down | Hidden |
| PageDown | Scroll down 1 page | Hidden |
| PageUp | Scroll up 1 page | Hidden |
| Home | Scroll to top | Hidden |
| End | Scroll to bottom, enable auto-scroll | Hidden |
| Ctrl+C | Cancel input, hide cursor | Hidden |
| Tab | Autocomplete nickname | Visible |

### Input Lifecycle

```
1. User presses key → cursor appears, input focused
2. User types → cursor follows text end
3. User presses Enter → message sent, input cleared, cursor fades
4. 2 seconds idle → cursor hidden
5. User presses key again → cycle repeats
```

---

## 7. Rendering Pipeline

### Update Cycle

```
1. State change detected (new message, input change, etc.)
2. Re-render triggered by Ink
3. Layout recalculates dimensions
4. MessageList virtualizes visible window
5. InputBar renders with cursor state
6. Terminal updates only changed cells (Ink's diffing)
```

### Performance Considerations

| Concern | Strategy |
|---------|----------|
| Large message history | Virtual scroll — only render visible rows |
| Frequent re-renders | Ink's diffing engine — only update changed cells |
| Terminal resize | Recalculate visible window, adjust scrollOffset |
| High-frequency messages | Batch renders — coalesce updates within 50ms |
| Memory with long sessions | Trim old messages beyond retention limit |

---

## 8. Visual Design

### Color Palette

```
Background:    Terminal default (respects user's theme)
Text:          Terminal default
Timestamp:     Dim (#555555 or 240)
Nickname:      Color-coded per user (consistent mapping)
System:        Italic, dim
Input:         Inverse (white on dark) when cursor visible
Header:        Bold, subtle background
Divider:       ─── characters, dim
```

### Nickname Color Mapping

Each unique nickname gets a consistent color from a curated palette:

```
Mads    → Cyan
Jason   → Green
System  → Yellow (dim)
Alice   → Magenta
Bob     → Red
...
```

### Typography

- **Font:** Terminal default monospace (no overrides)
- **Timestamp:** Fixed-width, always 6 chars `[HH:MM]`
- **Nickname:** Variable width, always followed by `:`
- **Body:** Wraps to terminal width
- **System messages:** Prefixed with `* `, italic

### Layout Spacing

```
Terminal width:  N columns
Header:          1 row, full width
Message area:    N-3 rows, full width
Input:           1 row, full width
Status:          1 row, full width

Message padding: 2 chars left (indent)
Nickname width:  Variable, padded to align colons
Body start:      After nickname + colon + space
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

### Message Overflow

```
1. Single message longer than terminal width: wrap to multiple rows
2. Track wrapped row count for accurate scroll calculation
3. Virtual scroll accounts for wrapped messages
```

### Scroll History Limit

```
1. Retain last 1000 messages per channel
2. When limit reached: trim oldest messages
3. If user scrolled up past trim point: show "history truncated" indicator
```

---

## 10. The Cursor: A Deeper Look

The cursor is not just a UI element — it's the interface's personality. In IRC, the cursor is a quiet promise: *you can speak now.* In this design, we make that promise explicit through the breathing model.

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

A always-visible cursor creates visual tension — the eye is drawn to it even when it's not needed. A hidden cursor during reading creates a clean canvas. The breathing model gives the interface a sense of presence without demanding attention. It's the difference between a room with a light on and a room where you can feel someone is there.

---

## 11. Implementation Notes

### Ink-Specific Patterns

1. **`useStdout`** — For terminal dimensions and resize events
2. **`useInput`** — For keyboard handling (replaces custom key listeners)
3. **`useCursor`** — For cursor visibility control (the star of the show)
4. **`Box` with `overflow="hidden"`** — For the message list viewport
5. **`Text` with `wrap="never"`** — For message rows (handle wrapping manually)

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

This blueprint describes an IRC-inspired TUI built on Ink with `useCursor` at its core. The design is defined by three principles:

1. **The conversation is the interface.** No chrome, no buttons, no visual noise.
2. **The cursor breathes.** It appears when you're about to act, disappears when you're reading.
3. **The terminal is the window.** Virtual scrolling, clean rendering, respect for the user's environment.

The result is an interface that feels like a quiet room — present, alive, and ready for conversation. Not a dashboard. Not a tool. A space.

---

*Blueprint complete. No implementation references — this is a clean slate.*
