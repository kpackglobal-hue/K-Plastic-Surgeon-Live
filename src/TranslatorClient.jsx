import React, { useState, useEffect, useRef } from 'react';

const TranslatorClient = ({ targetLang, onBack }) => {
  const [transcript, setTranscript] = useState('');
  const [translated, setTranslated] = useState('');
  const ws = useRef(null);

  useEffect(() => {
    // 1. WebSocket 연결 (로컬 FastAPI 서버)
    ws.current = new WebSocket(`ws://localhost:8000/ws/translate/${targetLang}`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTranslated(data.translated); // 번역된 결과 표시
    };

    return () => ws.current.close();
  }, [targetLang]);

  // 2. 음성 인식 시작 (브라우저 내장 API 활용)
  const startRecording = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      // 3. 서버로 텍스트 전송
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(text);
      }
    };
    recognition.start();
  };

  return (
    <div className="flex flex-col h-full w-full p-8 bg-white rounded-3xl shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">
          대면 통역 모드 ({targetLang === 'en' ? '영어' : targetLang})
        </h2>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-lg font-semibold transition-colors"
        >
          돌아가기
        </button>
      </div>

      <div className="flex flex-col flex-1 gap-6">
        <button 
          onClick={startRecording} 
          className="py-4 bg-red-500 hover:bg-red-600 transition-colors text-white text-2xl font-bold rounded-2xl shadow-md"
        >
          🔴 마이크 켜기
        </button>
        
        <div className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 font-semibold mb-2">한국어 입력</p>
          <div className="text-2xl text-gray-800 min-h-[4rem]">
            {transcript || "마이크를 켜고 말씀해주세요..."}
          </div>
        </div>

        <div className="flex-1 bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <p className="text-sm text-blue-500 font-semibold mb-2">통역 결과</p>
          <div className="text-4xl font-bold text-blue-600 min-h-[4rem]">
            {translated}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslatorClient;
