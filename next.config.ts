import type { NextConfig } from "next";

const config: NextConfig = {
  webpack: (config) => {
    config.externals.push({
      "utf-8-validate": "commonjs utf-8-validate",
      bufferutil: "commonjs bufferutil",
    });
    return config;
  },
  experimental: {
    turbo: {
      loaders: {
        // Configure loaders for turbopack
        ".svg": ["@svgr/webpack"],
      },
    },
  },
};

export default config;
