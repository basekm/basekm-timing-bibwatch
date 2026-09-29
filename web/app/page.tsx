import type {
  Metadata
} from 'next';

import {
  ViewerPageScreen
} from '@basekm/screens/ViewerPageScreen';

export const metadata: Metadata = {
  title: 'Viewer',
  description: 'Race video with every bib found, the finish line and the runners spotted.',
};

const Index = () => {
  return <ViewerPageScreen />;
};

export default Index;
