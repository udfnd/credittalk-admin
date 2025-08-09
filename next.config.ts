import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // [신규] 이미지 최적화를 위해 외부 이미지 호스트를 등록합니다.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lmwtidqrmfclrbapmtdm.supabase.co', // Supabase 스토리지 호스트 이름
        port: '',
        pathname: '/storage/v1/object/public/**', // 모든 스토리지 경로 허용
      },
    ],
  },
};

export default nextConfig;
