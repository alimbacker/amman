/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // static site → Firebase Hosting; all data comes from Firebase at runtime
  transpilePackages: ['@temple/shared'],
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
