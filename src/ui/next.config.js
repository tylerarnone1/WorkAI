const path = require("path");
const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(__dirname, "../.."),
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };

    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^cpu-features$/ }),
      new webpack.IgnorePlugin({ resourceRegExp: /sshcrypto\.node$/ })
    );

    return config;
  },
};

module.exports = nextConfig;
