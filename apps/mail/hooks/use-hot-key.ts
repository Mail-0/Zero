import { useCallback } from 'react';

const keyStates = new Map<string, boolean>();

let listenersInit = false;

function initKeyListeners() {
  if (typeof window !== 'undefined' && !listenersInit) {
    window.addEventListener('keydown', (e) => {
      keyStates.set(e.key, true);
    });

    window.addEventListener('keyup', (e) => {
      keyStates.set(e.key, false);
    });

    window.addEventListener('blur', () => {
      keyStates.forEach((_, key) => {
        keyStates.set(key, false);
      });
    });

    listenersInit = true;
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => initKeyListeners(), 0);
}

export function useKeyState() {
  return useCallback((key: string) => keyStates.get(key) || false, []);
}
