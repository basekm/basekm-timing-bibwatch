export const ScanStateId = {
  Idle: 'idle',
  Starting: 'starting',
  Segments: 'segments',
  Scanning: 'scanning',
  Done: 'done',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;

export type ScanState = (typeof ScanStateId)[keyof typeof ScanStateId];

export const RunningScanStates: ScanState[] = [
  ScanStateId.Starting,
  ScanStateId.Segments,
  ScanStateId.Scanning,
];
