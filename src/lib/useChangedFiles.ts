import { useCallback, useEffect, useState } from "react";

import type { ChangedFile, ChangedFilesResponse, SessionChangedFile } from "../../shared/protocol.ts";
import { fetchChangedFiles } from "./api.ts";

/** While the panel is open the list is asked for again this often: an agent keeps editing. */
export const CHANGED_FILES_REFRESH_MS = 15_000;

export interface ChangedFilesState {
  /** the last list; null before the first answer, and for a PC whose bridge has no such route */
  files: ChangedFilesResponse | null;
  /** false once the PC's bridge answered that it does not know the route: the header shows no button */
  supported: boolean;
  refresh: () => void;
}

/**
 * The pane's changed files. It is read again when the pane's status changes (the pane-status
 * stream moves `agentStatus`: a turn that ends is when the count moves) and, while `open`, every
 * 15 seconds. A closed panel never polls.
 */
export function useChangedFiles(machineId: string, paneId: string | null, agentStatus: string | undefined, open: boolean): ChangedFilesState {
  const [state, setState] = useState<{ paneId: string | null; machineId: string; files: ChangedFilesResponse | null; supported: boolean }>(
    { paneId, machineId, files: null, supported: true },
  );
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  // another pane (or PC) has its own list: the previous one must not show under it
  const current = state.paneId === paneId && state.machineId === machineId;

  useEffect(() => {
    if (paneId === null) return;
    let cancelled = false;
    const load = (): void => {
      fetchChangedFiles(paneId, machineId).then((files) => {
        if (!cancelled) setState({ paneId, machineId, files, supported: files !== null });
      }).catch(() => { /* keep the last list: the next refresh tries again */ });
    };
    load();
    if (!open) return () => { cancelled = true; };
    const timer = window.setInterval(load, CHANGED_FILES_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [machineId, paneId, agentStatus, open, tick]);

  return current ? { files: state.files, supported: state.supported, refresh } : { files: null, supported: true, refresh };
}

/**
 * What the file viewer needs to show a file's changes: the list's entry for the file open in it,
 * when it is a file of the selected pane. `first`: the panel opened it, so it starts on the changes.
 */
export function changeOf(
  files: ChangedFilesResponse | null,
  viewing: { path: string; paneId: string | null; machineId: string },
  machineId: string,
  paneId: string | null,
  first: string | null,
): { changes: { file: ChangedFile | SessionChangedFile; first: boolean } } | null {
  if (files === null || paneId === null || viewing.paneId !== paneId || viewing.machineId !== machineId) return null;
  const file = [...files.session, ...files.git].find((entry) => entry.path === viewing.path || entry.rel === viewing.path);
  return file === undefined ? null : { changes: { file, first: first === viewing.path } };
}
