import React from "react";

interface AdBannerProps {
  type: "kakao" | "coupang";
  className?: string;
}

export const AdBanner = ({ type, className }: AdBannerProps) => {
  return (
    <div className={`w-full flex justify-center items-center overflow-hidden ${className}`}>
      {/* 배포 후 아래 주석을 풀고 실제 스크립트를 넣으세요 */}
      <div className="bg-neutral-800 border border-neutral-700 w-full max-w-[320px] h-[100px] flex flex-col items-center justify-center text-neutral-500 text-xs rounded-lg p-2">
        {type === "kakao" ? (
           // 여기에 카카오 AdFit ins 태그 삽입
           <span>📢 Kakao AdFit Area</span>
        ) : (
           // 여기에 쿠팡 파트너스 iframe 태그 삽입
           <span>🚀 Coupang Partners Area</span>
        )}
      </div>
    </div>
  );
};