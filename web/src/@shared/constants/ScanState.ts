export const ScanStateId = {
  Idle: 'idle',
  Starting: 'starting',
  Segments: 'segments',
  Scanning: 'scanning',
  Done: 'done',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;
export type ScanStateId = (typeof ScanStateId)[keyof typeof ScanStateId];

export const RunningScanStates: string[] = [
  ScanStateId.Starting,
  ScanStateId.Segments,
  ScanStateId.Scanning,
];

export const isScanRunning = (state: string | null | undefined) => {
  return RunningScanStates.includes(state ?? '');
};

export const ScanPhaseLabels: Record<string, string> = {
  scan: 'Scanning',
  segments: 'Finding camera positions',
  coarse: 'Reading bibs (pass 1 of 2)',
  fine: 'Following runners (pass 2 of 2)',
};
