/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma must stay external to the server bundle or the query engine binary
  // is not resolvable at runtime.
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
