import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  allowedDevOrigins: ['192.168.1.20', '192.168.1.26', '192.168.1.*'],
  async redirects() {
    return [
      {
        source: '/board',
        destination: '/teacher/dashboard',
        permanent: true,
      },
      {
        source: '/board/:path*',
        destination: '/teacher/dashboard',
        permanent: true,
      },
      {
        source: '/students',
        destination: '/teacher/dashboard',
        permanent: true,
      },
      {
        source: '/journals',
        destination: '/teacher/dashboard',
        permanent: true,
      },
      {
        source: '/templates',
        destination: '/teacher/dashboard',
        permanent: true,
      },
      {
        source: '/student/quests',
        destination: '/student',
        permanent: true,
      },
      {
        source:
          '/:doc(api-docs\.html|database-design\.html|test-plan\.html|architecture-map\.html|agent-and-skills-guide\.html|screen_flow\.html|markdown-viewer\.html|review-checklist-dashboard\.html)',
        destination: '/docs/:doc',
        permanent: true,
      },
      {
        source: '/tutorial',
        destination: '/docs/tutorial/index.html',
        permanent: true,
      },
      {
        source: '/tutorial/:path*',
        destination: '/docs/tutorial/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
