/** @type {import('next').NextConfig} */
const nextConfig = {
  // Newer Next.js
  serverExternalPackages: ["pdfkit"],

  // Older Next.js (still used in some versions)
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

export default nextConfig;
