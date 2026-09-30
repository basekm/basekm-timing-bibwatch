import type {
  NextConfig
} from 'next';

// The viewer runs as its own process and passes /api and /media on to the bibwatch server, so the
// browser only ever talks to one origin (no CORS, and video frames can be drawn to a canvas).
// Rewrites are fixed at build time: set BIBWATCH_SERVER_URL before `npm run build` too.
const BibwatchServerUrl = process.env.BIBWATCH_SERVER_URL || 'http://127.0.0.1:8765';

const nextConfig: NextConfig = {
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

export default nextConfig;
