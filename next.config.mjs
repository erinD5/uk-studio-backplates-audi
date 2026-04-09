/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development artifacts separate so local `next build` does not
  // invalidate a running dev server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
