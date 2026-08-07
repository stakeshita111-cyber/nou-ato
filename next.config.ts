import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.26"],
  async redirects() {
    return [
      {
        source: "/board",
        destination: "/teacher/dashboard",
        permanent: true,
      },
      {
        source: "/board/:path*",
        destination: "/teacher/dashboard",
        permanent: true,
      },
      {
        source: "/students",
        destination: "/teacher/dashboard",
        permanent: true,
      },
      {
        source: "/journals",
        destination: "/teacher/dashboard",
        permanent: true,
      },
      {
        source: "/templates",
        destination: "/teacher/dashboard",
        permanent: true,
      },
      {
        source: "/student",
        destination: "/student/quests",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
