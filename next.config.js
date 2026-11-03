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
    // Exclude native ONNX runtime (onnxruntime-node) — only needed in Node, not browser.
    // The browser uses onnxruntime-web (WASM) instead.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node': false,
    };
    // Ignore native .node binaries entirely
    config.module.rules.push({
      test: /\.node$/,
      use: 'null-loader',
    });
    return config;
  },
};

module.exports = nextConfig;