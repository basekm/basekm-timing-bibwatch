export const RunnerListScope = {
  ThisVideo: 'this-video',
  AllVideos: 'all-videos',
} as const;
export type RunnerListScope = (typeof RunnerListScope)[keyof typeof RunnerListScope];
