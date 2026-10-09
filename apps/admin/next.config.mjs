/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pages are static; /api/* routes run on Vercel's Node runtime (replaces Firebase Cloud Functions).
  transpilePackages: ['@temple/shared', '@temple/server'],
  serverExternalPackages: ['firebase-admin'],
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
