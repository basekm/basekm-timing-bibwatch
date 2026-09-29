import type {
  NextConfig
} from 'next';
import {
  PHASE_DEVELOPMENT_SERVER
} from 'next/constants';

const BibwatchServerUrl = process.env.BIBWATCH_SERVER_URL || 'http://127.0.0.1:8765';

const developmentConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${BibwatchServerUrl}/api/:path*`,
    },
    {
      source: '/media/:path*',
      destination: `${BibwatchServerUrl}/media/:path*`,
    },
  ],
};

const productionConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};

const nextConfig = (phase: string): NextConfig => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return developmentConfig;
  }

  return productionConfig;
};

export default nextConfig;
