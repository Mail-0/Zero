"use client";

import { parseAsBoolean, useQueryState } from "nuqs";

export const useOpenComposeModal = () => {
  const [isOpen, setIsOpen] = useQueryState(
    "open-compose",
    parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true }),
  );

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    open,
    close,
    isOpen,
    setIsOpen,
  };
};
