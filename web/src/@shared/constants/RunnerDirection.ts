export const RunnerDirection = {
  Toward: 'toward',
  Away: 'away',
  Still: 'still',
} as const;
export type RunnerDirection = (typeof RunnerDirection)[keyof typeof RunnerDirection];

export const RunnerDirectionLabels: Record<RunnerDirection, string> = {
  [RunnerDirection.Toward]: 'Toward camera',
  [RunnerDirection.Away]: 'Away from camera',
  [RunnerDirection.Still]: 'Standing still',
};

export const AnyDirectionValue = 'any';

export const RunnerZoneLabels: Record<string, string> = {
  background: 'Background',
  'before-mat': 'Before the finish line',
  'on-mat': 'On the finish line',
  'past-mat': 'Past the finish line',
};
