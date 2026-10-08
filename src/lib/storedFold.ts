import { useState } from "react";

/** A fold choice kept in localStorage: open unless stored as "1". */
export function useStoredFold(key: string): [folded: boolean, toggle: () => void] {
  const [folded, setFolded] = useState(() => {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  const toggle = (): void => {
    setFolded((current) => {
      const next = !current;
      // idempotent, so a doubled updater call (StrictMode) writes the same value twice
      try {
        if (next) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
      } catch {}
      return next;
    });
  };
  return [folded, toggle];
}
