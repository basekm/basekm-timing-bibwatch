import type {
  Metadata
} from 'next';

import {
  CamerasPageScreen
} from '@basekm/screens/CamerasPageScreen';

export const metadata: Metadata = {
  title: 'All cameras',
  description: 'Every camera on one race clock: scrub or play them all as one.',
};

const Cameras = () => {
  return <CamerasPageScreen />;
};

export default Cameras;
