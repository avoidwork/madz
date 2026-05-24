/**
 * Panel types for TUI navigation.
 */
export const PANELS = Object.freeze({
  CONVERSATION: "conversation",
  SKILLS: "skills",
  MEMORY: "memory",
  SETTINGS: "settings",
});

/**
 * Get the ordered list of panels for tab navigation.
 * @returns {string[]}
 */
export function getPanelOrder() {
  return [PANELS.CONVERSATION, PANELS.SKILLS, PANELS.MEMORY, PANELS.SETTINGS];
}

/**
 * Cycle to the next panel.
 * @param {string} current
 * @returns {string}
 */
export function nextPanel(current) {
  const order = getPanelOrder();
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

/**
 * Cycle to the previous panel.
 * @param {string} current
 * @returns {string}
 */
export function prevPanel(current) {
  const order = getPanelOrder();
  const idx = order.indexOf(current);
  return order[(idx - 1 + order.length) % order.length];
}
