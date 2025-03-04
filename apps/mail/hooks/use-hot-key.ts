import { useCallback, useRef, useLayoutEffect, useState, useEffect } from "react";

export const useHotKey = (
  shortcut: string,
  callback: (event?: KeyboardEvent) => void,
  options = { disableTextInputs: true },
) => {
  const callbackRef = useRef(callback);
  const [keyCombo, setKeyCombo] = useState<string[]>([]);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isTextInput =
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLInputElement &&
          (!event.target.type || event.target.type === "text")) ||
        (event.target as HTMLElement).isContentEditable;

      const modifierMap: Record<string, boolean> = {
        Control: event.ctrlKey,
        Alt: event.altKey,
        Command: event.metaKey,
        Meta: event.metaKey,
        Shift: event.shiftKey,
      };

      if (event.repeat) {
        return null;
      }

      // Allow Escape key to work even in text inputs
      if (shortcut === "Escape" || shortcut === "Esc") {
        if (event.key === "Escape") {
          event.preventDefault();
          return callbackRef.current(event);
        }
      } else if (options.disableTextInputs && isTextInput) {
        return event.stopPropagation();
      }

      if (shortcut.includes("+")) {
        const keyArray = shortcut.split("+");

        // @ts-expect-error
        if (Object.keys(modifierMap).includes(keyArray[0])) {
          const finalKey = keyArray.pop();

          if (
            finalKey &&
            keyArray.every((k) => modifierMap[k]) &&
            finalKey.toLowerCase() === event.key.toLowerCase()
          ) {
            event.preventDefault();
            return callbackRef.current(event);
          }
        } else {
          if (keyArray[keyCombo.length] === event.key) {
            if (
              keyArray[keyArray.length - 1] === event.key &&
              keyCombo.length === keyArray.length - 1
            ) {
              event.preventDefault();
              callbackRef.current(event);
              return setKeyCombo([]);
            }

            return setKeyCombo((prevCombo) => [...prevCombo, event.key]);
          }

          if (keyCombo.length > 0) {
            return setKeyCombo([]);
          }
        }
      }

      if (shortcut === event.key) {
        event.preventDefault();
        return callbackRef.current(event);
      }
    },
    [keyCombo.length, options.disableTextInputs, shortcut],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
