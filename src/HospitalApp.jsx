import React, { useState } from 'react';
import TranslatorClient from './TranslatorClient';
import VideoConsultation from './VideoConsultation';

const HospitalMainScreen = () => {
  const [activeMode, setActiveMode] = useState(null);
  const [role, setRole] = useState(null);
  const [roomId, setRoomId] = useState('room123');

  if (activeMode === 'face-to-face') {
    return (
      <div className="flex flex-col h-screen w-full p-0 bg-[#08090f]">
        <TranslatorClient targetLang="en" onBack={() => setActiveMode(null)} />
      </div>
    );
  }

  if (activeMode === 'video-consultation') {
    return <VideoConsultation roomId={roomId} isDoctor={role === 'doctor'} onBack={() => setActiveMode(null)} />;
  }

  return (
    <div className="min-h-screen w-full bg-[#08090f] bg-premium-dark text-white flex flex-col justify-center items-center p-8 font-sans selection:bg-[#e5c483]/30 selection:text-[#e5c483]">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-5xl md:text-6xl font-black tracking-widest text-gold-gradient uppercase drop-shadow-2xl">
          K-Plastic Surgeon Live
        </h1>
        <p className="text-sm md:text-base text-white/50 tracking-widest font-light uppercase">
          성형외과 전용 70개국 실시간 메디컬 통역 솔루션
        </p>
      </div>
      
      {/* 2단 카드 형태 레이아웃 */}
      <div className="flex flex-col md:flex-row gap-8 max-w-5xl w-full justify-center px-4">
        
        {/* 클리닉 대면 상담 카드 */}
        <div 
          onClick={() => setActiveMode('face-to-face')} 
          className="flex-1 glass-card glass-card-hover p-12 rounded-3xl text-center flex flex-col items-center justify-center space-y-6 cursor-pointer group active:scale-98"
        >
          <div className="w-20 h-20 rounded-full bg-[#e5c483]/10 border border-[#e5c483]/20 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(229,196,131,0.05)] group-hover:scale-110 group-hover:border-[#e5c483]/50 transition-all duration-300">
            🤝
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#e5c483] tracking-wide">
            클리닉 대면 상담
          </h2>
        </div>

        {/* 온라인 비대면 상담 카드 */}
        <div 
          onClick={() => { setRole('doctor'); setRoomId('room123'); setActiveMode('video-consultation'); }} 
          className="flex-1 glass-card glass-card-hover p-12 rounded-3xl text-center flex flex-col items-center justify-center space-y-6 cursor-pointer group active:scale-98"
        >
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(255,255,255,0.02)] group-hover:scale-110 group-hover:border-[#e5c483]/30 transition-all duration-300">
            💻
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white/90 tracking-wide">
            온라인 비대면 상담
          </h2>
        </div>

      </div>

      <div className="mt-20 text-[10px] text-white/20 tracking-widest font-light uppercase select-none">
        Powered by Google Gemini Live API | Luxury Clinic Edition
      </div>
    </div>
  );
};

export default HospitalMainScreen;
