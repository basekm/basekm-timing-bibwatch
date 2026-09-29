export const RunnerListFilter = {
  All: 'all',
  Finished: 'finished',
  Watchlist: 'watchlist',
  NotFinished: 'not-finished',
} as const;
export type RunnerListFilter = (typeof RunnerListFilter)[keyof typeof RunnerListFilter];

export const RunnerListFilterLabels: Record<RunnerListFilter, string> = {
  [RunnerListFilter.All]: 'All',
  [RunnerListFilter.Finished]: 'Finished',
  [RunnerListFilter.Watchlist]: 'Watchlist',
  [RunnerListFilter.NotFinished]: 'Not yet finished',
};

export const RunnerListScope = {
  ThisVideo: 'this-video',
  AllVideos: 'all-videos',
} as const;
export type RunnerListScope = (typeof RunnerListScope)[keyof typeof RunnerListScope];
