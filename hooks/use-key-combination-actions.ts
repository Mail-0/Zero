import { useCallback, useEffect, useRef } from "react";

export const useKeyCombinationActions = ({
  config,
}: {
  config: Array<{ shortcut: string[]; action: () => void }>;
}) => {
  const pressed = useRef<Array<string>>([]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      //dont allow duplicate keys in pressed array
      if (pressed.current.includes(e.key)) return;
      pressed.current.push(e.key);
      config.forEach(({ shortcut, action }) => {
        if (
          shortcut.every((key, i) => pressed.current[i] === key) &&
          shortcut.length === pressed.current.length
        ) {
          action();
        }
      });
    },
    [config],
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
