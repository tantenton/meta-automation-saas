import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output hanya untuk Docker self-hosted
  // Vercel tidak butuh ini (punya adapter sendiri)
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
};

export default nextConfig;
