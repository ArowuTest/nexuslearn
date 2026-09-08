/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { dev, isServer }) {
    // Keep Next's framework/lib groups, thresholds and server layers intact.
    // The small API client was repeated in five route chunks. Sharing only
    // this browser module avoids raising the existing aggregate asset budget.
    if (!dev && !isServer && config.optimization.splitChunks) {
      config.optimization.splitChunks.cacheGroups.pupilSharedAPI = {
        test: module => module.layer === "app-pages-browser" && /[\\/]src[\\/]lib[\\/]api\.ts$/.test(module.nameForCondition?.() || ""),
        name: "nexuslearn-api-client",
        minChunks: 2,
        enforce: true,
        priority: 20,
        reuseExistingChunk: true,
      };
    }
    return config;
  },
};

export default nextConfig;
