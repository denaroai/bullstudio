import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@bullstudio/adapter-utils",
    "@bullstudio/bullmq-adapter",
    "@bullstudio/connect-types",
    "@bullstudio/embedded-core",
    "@bullstudio/next",
  ],
};

export default nextConfig;
