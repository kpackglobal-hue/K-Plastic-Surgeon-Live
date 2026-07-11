import React, { useState } from 'react';
import TranslatorClient from './TranslatorClient';
import VideoConsultation from './VideoConsultation';

const HospitalMainScreen = () => {
  const [activeMode, setActiveMode] = useState(null);
  const [role, setRole] = useState(null);
  const [roomId, setRoomId] = useState('room123');

  if (activeMode === 'face-to-face') {
    return (
      <div className="flex flex-col h-screen w-full p-4 bg-gray-50">
        <TranslatorClient targetLang="en" onBack={() => setActiveMode(null)} />
      </div>
    );
  }

  if (activeMode === 'video-consultation') {
    return <VideoConsultation roomId={roomId} isDoctor={role === 'doctor'} onBack={() => setActiveMode(null)} />;
  }

  return (
    <div className="flex flex-col gap-6 p-10 max-w-4xl mx-auto min-h-screen justify-center">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">K-Plastic Surgeon Live</h1>
        <p className="text-xl text-gray-600">VIP 실시간 화상 상담 및 대면 통역 솔루션</p>
      </div>
      
      {/* 대면 통역 모드 */}
      <button 
        onClick={() => setActiveMode('face-to-face')} 
        className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white text-3xl font-bold rounded-3xl shadow-lg flex items-center justify-center gap-4 py-8"
      >
        <span>🤝</span>
        <span>데스크 대면 통역</span>
      </button>

      <div className="flex gap-6 mt-4">
        {/* 의사용: 방 생성 */}
        <button 
          onClick={() => { setRole('doctor'); setRoomId('room123'); setActiveMode('video-consultation'); }} 
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white text-3xl font-bold rounded-3xl shadow-lg flex flex-col items-center justify-center gap-4 py-10"
        >
          <span className="text-5xl">💻</span>
          <span>의사용: 상담방 생성</span>
        </button>

        {/* 환자용: 방 입장 */}
        <button 
          onClick={() => { setRole('patient'); setRoomId('room123'); setActiveMode('video-consultation'); }} 
          className="flex-1 bg-teal-600 hover:bg-teal-700 transition-colors text-white text-3xl font-bold rounded-3xl shadow-lg flex flex-col items-center justify-center gap-4 py-10"
        >
          <span className="text-5xl">📱</span>
          <span>환자용: 상담방 입장</span>
        </button>
      </div>
    </div>
  );
};

export default HospitalMainScreen;
