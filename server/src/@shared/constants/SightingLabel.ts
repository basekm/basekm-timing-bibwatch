/**
 * Automatic tags from the crossing decision, keyed by sighting label.
 * Mirror of SightingAutoTags in web/src/@shared/constants/SightingLabel.ts and tagCode in Scan.swift.
 */
export const SightingAutoTag: Record<string, { code: string; name: string }> = {
  'crossed': { code: '000', name: 'Crossed the mat' },
  'viewed': { code: '001', name: 'Viewed' },
  'near-mat': { code: '002', name: 'Near the mat' },
  'passing': { code: '003', name: 'Passing' },
  'camera-moving': { code: '004', name: 'Camera moving' },
  'duplicate': { code: '005', name: 'Duplicate' },
};

/** Labels from older scans, read as their current equivalent. */
export const LegacySightingLabel: Record<string, string> = {
  'lingering': 'near-mat',
  'no-mat': 'viewed',
  'no-person': 'viewed',
  'unclear': 'viewed',
};

export const currentSightingLabel = (label: string) => LegacySightingLabel[label] ?? label;
