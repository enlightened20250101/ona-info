import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "awsimgsrc.dmm.co.jp" },
      { protocol: "https", hostname: "pics.dmm.co.jp" },
      { protocol: "https", hostname: "pics.dmm.com" },
      { protocol: "https", hostname: "img.dmm.co.jp" },
      { protocol: "https", hostname: "www.dmm.co.jp" },
      { protocol: "https", hostname: "r18.com" },
      { protocol: "https", hostname: "www.r18.com" },
      { protocol: "https", hostname: "static.mgstage.com" },
      { protocol: "https", hostname: "www.mgstage.com" },
      { protocol: "https", hostname: "image.mgstage.com" },
      { protocol: "https", hostname: "cdn.tokyo-motion.net" },
      { protocol: "https", hostname: "api.dmm.com" },
      { protocol: "https", hostname: "wsrv.nl" },
      { protocol: "https", hostname: "images.weserv.nl" },
    ],
  },
};

export default nextConfig;
