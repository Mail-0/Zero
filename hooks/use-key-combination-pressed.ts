import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Hook that triggers a callback when a key combination is pressed
 * @param keys Array to represent a key combination. ORDER MATTERS!
 * @param action Callback to be triggered when the key combination is pressed
 */
export const useKeyCombinationPressed = ({
  keys,
  action,
}: {
  keys: string[];
  action: () => void;
}) => {
  const callbackRef = useRef(action);
  useLayoutEffect(() => {
    callbackRef.current = action;
  });
  const pressed = useRef<string[]>([]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (pressed.current.includes(e.key)) return;
      pressed.current.push(e.key);
      if (keys.every((key, i) => pressed.current[i] === key)) {
        callbackRef.current();
      }
    },
    [keys],
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    pressed.current = pressed.current.filter((key) => key !== e.key);
  }, []);

  const handleBlur = useCallback(() => {
    pressed.current = [];
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);
};
