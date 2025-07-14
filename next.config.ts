import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    const { NormalModuleReplacementPlugin } = require('webpack');
    // a bug in `node-fetch` required by `firebase-admin` causes a build-time error, so we need to mock it
    // https://github.com/firebase/firebase-admin-node/issues/1471
    // https://github.com/node-fetch/node-fetch/issues/784
    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /^node-fetch$/,
        require.resolve('./node-fetch.mock.js')
      )
    );
    return config;
  },
};

export default nextConfig;
