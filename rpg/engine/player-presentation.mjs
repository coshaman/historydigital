// Keep native editing and focused controls in charge of their own keyboard events.
export function ownsKeyboardInput(event) {
  return Boolean(event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
    || event.target?.closest?.('input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

export function observationText(clue, hostId) {
  const thought = clue.hostLines[hostId];
  return thought ? `${clue.textKo}\n\n“${thought}”` : clue.textKo;
}
