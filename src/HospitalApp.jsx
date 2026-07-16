import React, { useState } from 'react';
import TranslatorClient from './TranslatorClient';
import VideoConsultation from './VideoConsultation';
import HospitalMain from './HospitalMain';

const HospitalMainScreen = () => {
  const [activeMode, setActiveMode] = useState('dashboard');
  const [role, setRole] = useState(null);
  const [roomId, setRoomId] = useState('room123');

  if (activeMode === 'face-to-face') {
    return (
      <div className="flex flex-col h-screen w-full p-0 bg-[#08090f]">
        <TranslatorClient targetLang="en" onBack={() => setActiveMode('dashboard')} />
      </div>
    );
  }

  if (activeMode === 'video-consultation') {
    return <VideoConsultation roomId={roomId} isDoctor={role === 'doctor'} onBack={() => setActiveMode('dashboard')} />;
  }

  return (
    <HospitalMain 
      onEnterRoom={(id) => {
        setRole('doctor');
        setRoomId(id);
        setActiveMode('video-consultation');
      }}
      onBackToSelector={() => {
        // If we want a separate selector screen, we can handle it here, 
        // but currently we can toggle directly or jump to face-to-face mode.
        setActiveMode('face-to-face');
      }}
    />
  );
};

export default HospitalMainScreen;
