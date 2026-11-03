/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // Transformers.js / ONNX Runtime WASM files must not be processed by webpack.
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    // Prevent webpack from trying to parse ESM-only deps as CJS
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  },
};

module.exports = nextConfig;
