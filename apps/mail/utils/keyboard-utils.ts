/**
 * Converts a key string to its corresponding keyboard event code
 * @param key - The key string to convert
 * @returns The keyboard event code
 */
export function getKeyCodeFromKey(key: string): string {
  // Handle single characters
  if (key.length === 1) {
    const upperKey = key.toUpperCase();
    if (upperKey >= 'A' && upperKey <= 'Z') {
      return `Key${upperKey}`;
    }
    if (key >= '0' && key <= '9') {
      return `Digit${key}`;
    }
  }

  // Handle special keys
  const specialKeys: Record<string, string> = {
    space: 'Space',
    enter: 'Enter',
    escape: 'Escape',
    backspace: 'Backspace',
    tab: 'Tab',
    shift: 'ShiftLeft',
    ctrl: 'ControlLeft',
    control: 'ControlLeft',
    alt: 'AltLeft',
    meta: 'MetaLeft',
  };

  return specialKeys[key.toLowerCase()] || key;
}
