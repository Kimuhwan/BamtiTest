"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer_motion";
import { Upload, Share2, Download, RefreshCcw, Sparkles, AlertCircle } from "lucide-react";
import html2canvas from "html2canvas";
import { AdBanner } from "@/components/AdBanner";
// TensorFlow 모델 로드
import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(""); // 진행상황 메시지
  const [result, setResult] = useState<any>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);

  // 1. 사람 탐지 함수 (클라이언트 사이드 필터링)
  const checkIsPerson = async (imgElement: HTMLImageElement): Promise<boolean> => {
    setStatusMsg("사람인지 확인 중...");
    try {
      const model = await cocoSsd.load();
      const predictions = await model.detect(imgElement);
      // 'person' 클래스가 하나라도 있는지 확인
      const hasPerson = predictions.some((pred) => pred.class === "person");
      return hasPerson;
    } catch (e) {
      console.error("Detection failed", e);
      return true; // 에러나면 일단 통과시킴 (UX 방어)
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImage(base64);
      setLoading(true);
      setResult(null);

      // 이미지 로드용 임시 엘리먼트 생성
      const img = new Image();
      img.src = base64;
      img.onload = async () => {
        // [Step 1] 사람 탐지 실행
        const isPerson = await checkIsPerson(img);
        
        if (!isPerson) {
          alert("사람이 감지되지 않았습니다! 전신이나 상반신이 잘 나온 사진을 써주세요.");
          setLoading(false);
          setImage(null);
          return;
        }

        // [Step 2] AI 분석 요청 (Backend)
        setStatusMsg("AI가 패션을 분석 중...");
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            body: JSON.stringify({ image: base64 }),
          });
          
          if (!res.ok) throw new Error("API Error");
          const data = await res.json();
          setResult(data);
        } catch (error) {
          alert("분석 실패. 잠시 후 다시 시도해주세요.");
        } finally {
          setLoading(false);
          setStatusMsg("");
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // 이미지 저장
  const handleSaveImage = async () => {
    if (!resultCardRef.current) return;
    try {
      const canvas = await html2canvas(resultCardRef.current, {
        backgroundColor: "#171717", scale: 2, useCORS: true 
      });
      const link = document.createElement("a");
      link.download = `fashion_judge_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) { console.error(err); }
  };

  // 공유
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: '패션 판독기', text: '내 패션 점수는?', url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("링크 복사 완료!");
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-start p-4 font-sans overflow-x-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-6 mb-4">
        <h1 className="text-3xl font-black italic tracking-tighter bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text">
          FASHION JUDGE
        </h1>
        <p className="text-neutral-500 text-xs mt-1">AI 패션 판독기 (사람만 인식됨)</p>
      </motion.div>

      <AdBanner type="kakao" className="mb-6" />

      <div className="w-full max-w-md space-y-4">
        <div ref={resultCardRef} className="bg-neutral-900 p-3 rounded-2xl border border-neutral-800 shadow-2xl">
            <div className="relative aspect-[3/4] bg-neutral-800 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-neutral-700/50 group">
                {!image ? (
                <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center hover:bg-neutral-800/80 transition">
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                    <Upload className="w-10 h-10 text-neutral-600 mb-2 group-hover:text-green-400 transition-colors" />
                    <span className="text-neutral-500 text-sm font-medium">사진 업로드 (사람만 가능)</span>
                </label>
                ) : (
                <img src={image} alt="Target" className="w-full h-full object-cover" />
                )}

                {loading && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                    <Sparkles className="w-10 h-10 text-green-400 animate-spin mb-3" />
                    <p className="text-green-400 font-mono text-sm animate-pulse">{statusMsg}</p>
                </div>
                )}
                
                {result && !loading && (
                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-16">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[10px] text-black bg-white/90 px-2 py-0.5 rounded font-bold uppercase tracking-wider mb-1 inline-block">Verdict</span>
                                <h2 className={`text-4xl font-black italic transform -skew-x-6 drop-shadow-lg ${result.score >= 80 ? 'text-green-400' : 'text-rose-500'}`}>{result.verdict}</h2>
                            </div>
                            <div className="text-right">
                                <span className="text-3xl font-black text-white">{result.score}</span>
                                <span className="text-sm text-neutral-400 font-light ml-0.5">/ 100</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {result && !loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 px-1">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-white mb-1">"{result.title}"</h3>
                        <p className="text-sm text-neutral-400 leading-relaxed font-light">{result.comment}</p>
                    </div>
                    <div className="space-y-3 bg-neutral-800/50 p-3 rounded-lg">
                        {Object.entries(result.stats).map(([key, value]: any) => (
                            <div key={key} className="flex items-center text-[10px] gap-3">
                                <span className="w-12 uppercase text-neutral-500 font-bold tracking-wider">{key}</span>
                                <div className="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${value * 10}%` }} className={`h-full rounded-full ${result.score >= 80 ? 'bg-green-500' : 'bg-rose-500'}`} />
                                </div>
                                <span className="w-4 text-right text-neutral-300 font-mono">{value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-600 border-t border-neutral-800 pt-2">
                        <span>Date: {new Date().toLocaleDateString()}</span>
                        <span className="font-bold">JUDGED BY AI</span>
                    </div>
                </motion.div>
                )}
            </AnimatePresence>
        </div>

        {result && !loading && (
            <div className="flex gap-2">
                <button onClick={handleSaveImage} className="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 transition"><Download size={16} /> 저장</button>
                <button onClick={handleShare} className="flex-1 bg-neutral-800 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-neutral-700 transition"><Share2 size={16} /> 공유</button>
            </div>
        )}
        {image && !loading && (
             <button onClick={() => { setImage(null); setResult(null); }} className="w-full text-neutral-500 text-xs py-2 hover:text-white flex items-center justify-center gap-1 transition"><RefreshCcw size={12} /> 다시하기</button>
        )}
      </div>

      {result && (
        <div className="w-full max-w-md mt-8">
            <p className="text-center text-[10px] text-neutral-600 mb-2 tracking-widest uppercase">Sponsored Item</p>
            <AdBanner type="coupang" />
        </div>
      )}
    </main>
  );
}