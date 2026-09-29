export const SightingLabel = {
  Crossed: 'crossed',
  Viewed: 'viewed',
  NearMat: 'near-mat',
  Passing: 'passing',
  CameraMoving: 'camera-moving',
  Duplicate: 'duplicate',
  NeedsScan: 'needs-scan',
} as const;
export type SightingLabel = (typeof SightingLabel)[keyof typeof SightingLabel];

export const LegacySightingLabels: Record<string, SightingLabel> = {
  lingering: SightingLabel.NearMat,
  'no-mat': SightingLabel.Viewed,
  'no-person': SightingLabel.Viewed,
  unclear: SightingLabel.Viewed,
};

export const SightingAutoTags: Record<string, { code: string; name: string }> = {
  [SightingLabel.Crossed]: {
    code: '000',
    name: 'Crossed the mat',
  },
  [SightingLabel.Viewed]: {
    code: '001',
    name: 'Viewed',
  },
  [SightingLabel.NearMat]: {
    code: '002',
    name: 'Near the mat',
  },
  [SightingLabel.Passing]: {
    code: '003',
    name: 'Passing',
  },
  [SightingLabel.CameraMoving]: {
    code: '004',
    name: 'Camera moving',
  },
  [SightingLabel.Duplicate]: {
    code: '005',
    name: 'Duplicate',
  },
  [SightingLabel.NeedsScan]: {
    code: '',
    name: 'Not read here yet — Run scan',
  },
};

export const NotRegisteredTag = '006 Not registered';
