import React, { useState, useEffect, useRef } from 'react';

// 70개 언어 스펙트럼 마스터 리스트
const ALL_LANGUAGES = [
  { code: "en", name: "영어 (English)" },
  { code: "vi", name: "베트남어 (Tiếng Việt)" },
  { code: "ja", name: "일본어 (日本語)" },
  { code: "zh", name: "중국어 (中文)" },
  { code: "th", name: "태국어 (ไทย)" },
  { code: "ru", name: "러시아어 (Русский)" },
  { code: "es", name: "스페인어 (Español)" },
  { code: "fr", name: "프랑스어 (Français)" },
  { code: "de", name: "독일어 (Deutsch)" },
  { code: "ar", name: "아랍어 (العربية)" },
  { code: "mn", name: "몽골어 (Монгол)" },
  { code: "km", name: "캄보디아어 (ភាសាខ្មែរ)" },
  { code: "my", name: "미얀마어 (မြန်မာဘာသာ)" },
  { code: "id", name: "인도네시아어 (Bahasa Indonesia)" },
  { code: "tl", name: "타갈로그어/필리핀 (Tagalog)" },
  { code: "hi", name: "힌디어 (हिन्दी)" },
  { code: "pt", name: "포르투갈어 (Português)" },
  { code: "it", name: "이탈리아어 (Italiano)" },
  { code: "tr", name: "터키어 (Türkçe)" },
  { code: "ms", name: "말레이어 (Bahasa Melayu)" },
  { code: "uz", name: "우즈베크어 (O'zbekcha)" },
  { code: "kk", name: "카자흐어 (Қазақ тілі)" },
  { code: "bg", name: "불가리아어 (Български)" },
  { code: "cs", name: "체코어 (Čeština)" },
  { code: "da", name: "덴마크어 (Dansk)" },
  { code: "nl", name: "네덜란드어 (Nederlands)" },
  { code: "el", name: "그리스어 (Ελληνικά)" },
  { code: "hu", name: "헝가리어 (Magyar)" },
  { code: "no", name: "노르웨이어 (Norsk)" },
  { code: "pl", name: "폴란드어 (Polski)" },
  { code: "ro", name: "루마니아어 (Română)" },
  { code: "sv", name: "스웨덴어 (Svenska)" },
  { code: "uk", name: "우크라이나어 (Українська)" },
  { code: "he", name: "히브리어 (עברית)" },
  { code: "fa", name: "페르시아어 (فارسی)" }
];

// 💡 브라우저 메모리 누수로 인한 오디오 이중 재생(하울링) 원천 차단을 위한 전역 싱글톤 레퍼런스
let globalActiveWebSocket = null;
let globalActiveAudioContext = null;
let globalActiveMicStream = null;

export default function TranslatorClient({ onBack }) {
  const [isLive, setIsLive] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const [statusMessage, setStatusMessage] = useState("상단 🌐 언어 메뉴에서 환자 언어를 선택한 후 성형 상담을 시작하세요.");
  const [chatLines, setChatLines] = useState([
    {
      id: "demo-1",
      speaker: "Dr.",
      original: "안녕하세요. 오늘 어떤 부위 상담을 도와드릴까요?",
      translation: "Hello. How can I help you with your consultation today?"
    },
    {
      id: "demo-2",
      speaker: "Client",
      original: "I am thinking about getting eyelid and nose surgery.",
      translation: "눈이랑 코 성형을 생각하고 있어요."
    }
  ]); 
  
  // 드롭다운 열림/닫힘 및 즐겨찾기 상태관리
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('surgeon_lang_favorites');
    return saved ? JSON.parse(saved) : ["en", "vi", "ja", "zh"]; // 기본 즐겨찾기 4개 지정
  });

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioInputProcessorRef = useRef(null);
  const micStreamRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const dropdownRef = useRef(null);

  // 즐겨찾기 클릭 토글 함수
  const toggleFavorite = (code, e) => {
    e.stopPropagation(); // 드롭다운이 닫히거나 언어가 선택되는 이벤트 버블링 차단
    let updated;
    if (favorites.includes(code)) {
      updated = favorites.filter(fav => fav !== code);
    } else {
      updated = [...favorites, code];
    }
    setFavorites(updated);
    localStorage.setItem('surgeon_lang_favorites', JSON.stringify(updated));
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      stopLiveTranslation();
    };
  }, []);

  // 즐겨찾기(별표)된 언어를 최상단으로 정렬하는 로직
  const sortedLanguages = [...ALL_LANGUAGES].sort((a, b) => {
    const aFav = favorites.includes(a.code) ? 1 : 0;
    const bFav = favorites.includes(b.code) ? 1 : 0;
    return bFav - aFav; // 즐겨찾기가 1이므로 앞으로 옴
  });

  const currentLangObj = ALL_LANGUAGES.find(l => l.code === selectedLang) || ALL_LANGUAGES[0];

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatLines]);

  const startLiveTranslation = async () => {
    // 💡 전역 싱글톤 누수 완전 강제 셧다운
    if (globalActiveWebSocket) {
      try { globalActiveWebSocket.close(); } catch(e){}
      globalActiveWebSocket = null;
    }
    if (globalActiveAudioContext) {
      try { globalActiveAudioContext.close(); } catch(e){}
      globalActiveAudioContext = null;
    }
    if (globalActiveMicStream) {
      try {
        globalActiveMicStream.getTracks().forEach(t => t.stop());
      } catch(e){}
      globalActiveMicStream = null;
    }

    // 로컬 클린업도 호출
    stopLiveTranslation();

    try {
      setStatusMessage("오디오 스트리밍 파이프라인 연결 중...");
      setChatLines([]); 
      nextStartTimeRef.current = 0;
      
      const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'localhost:8000'
        : window.location.host;
        
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsRef.current = new WebSocket(`${protocol}//${wsHost}/ws/live-translate/${selectedLang}`);
      wsRef.current.binaryType = 'arraybuffer';
      globalActiveWebSocket = wsRef.current;

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      await audioContextRef.current.resume(); 
      globalActiveAudioContext = audioContextRef.current;

      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      globalActiveMicStream = micStreamRef.current;
      const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
      
      audioInputProcessorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      audioInputProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
        // 하울링 및 마이크 로컬 루프백 방지 (출력 버퍼 무음화)
        const outputBuffer = audioProcessingEvent.outputBuffer;
        for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
          const outputData = outputBuffer.getChannelData(channel);
          outputData.fill(0);
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const isSpeaking = audioContextRef.current && audioContextRef.current.currentTime < nextStartTimeRef.current;
          if (isSpeaking) return;

          const inputBuffer = audioProcessingEvent.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          const pcmBuffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          wsRef.current.send(pcmBuffer.buffer);
        }
      };

      // 💡 하울링(마이크 루프백) 물리적 무음화: 스피커(destination)로 흐르지 않게 볼륨 0의 GainNode로 우회 연결
      const silenceGain = audioContextRef.current.createGain();
      silenceGain.gain.value = 0.0;
      silenceGain.connect(audioContextRef.current.destination);

      source.connect(audioInputProcessorRef.current);
      audioInputProcessorRef.current.connect(silenceGain);

      wsRef.current.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const res = JSON.parse(event.data);
            if (res.type === 'start_turn') {
              setChatLines(prev => {
                if (prev.length > 0) {
                  const lastItem = prev[prev.length - 1];
                  // 💡 이전 턴이 침묵/소음 등으로 텍스트 없이 끝났다면 새 턴으로 덮어씁니다.
                  if (lastItem.original === "") {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      id: lastItem.id,
                      speaker: res.speaker,
                      original: "",
                      translation: ""
                    };
                    return updated;
                  }
                  // 💡 Pending 상태에서 실제 화자가 결정되었다면 화자 정보를 덮어씁니다.
                  if (lastItem.speaker === "Pending") {
                    if (res.speaker !== "Pending") {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        speaker: res.speaker
                      };
                      return updated;
                    }
                    return prev;
                  }
                }
                return [
                  ...prev,
                  {
                    id: Math.random().toString(36).substring(2, 9),
                    speaker: res.speaker,
                    original: "",
                    translation: ""
                  }
                ];
              });
            } else if (res.type === 'original_text') {
              setChatLines(prev => {
                if (prev.length === 0) return prev;
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.original = res.content;
                updated[updated.length - 1] = last;
                return updated;
              });
            } else if (res.type === 'translation_text') {
              setChatLines(prev => {
                if (prev.length === 0) return prev;
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.translation = last.translation + res.content;
                updated[updated.length - 1] = last;
                return updated;
              });
            }
          } catch (e) {
            console.error("자막 파싱 에러:", e);
          }
          return;
        }

        const arrayBuffer = event.data;
        const int16Array = new Int16Array(arrayBuffer);
        const float32Array = new Float32Array(int16Array.length);
        
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        const playContext = audioContextRef.current;
        const audioBuffer = playContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        const bufferSource = playContext.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(playContext.destination);

        const currentTime = playContext.currentTime;
        if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime;
        }
        bufferSource.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
      };

      wsRef.current.onopen = () => {
        setIsLive(true);
        setStatusMessage(`🟢 실시간 통역 활성화됨 [한국어 🔄 ${currentLangObj.name}]`);
      };

      wsRef.current.onclose = () => stopLiveTranslation();

    } catch (err) {
      console.error("라이브 세션 기동 실패:", err);
      stopLiveTranslation();
    }
  };

  const stopLiveTranslation = () => {
    setIsLive(false);
    setStatusMessage("성형 상담이 종료되었습니다.");

    // 전역 싱글톤 참조 해제
    globalActiveWebSocket = null;
    globalActiveAudioContext = null;
    globalActiveMicStream = null;

    try {
      const processor = audioInputProcessorRef.current;
      if (processor && typeof processor.disconnect === 'function') {
        processor.disconnect();
      }
      if (audioInputProcessorRef.current) {
        audioInputProcessorRef.current.onaudioprocess = null;
        audioInputProcessorRef.current = null;
      }
    } catch (e) { console.error("Processor disconnect error:", e); }

    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
    } catch (e) { console.error(e); }

    try {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    } catch (e) { console.error(e); }
    
    try {
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        audioContextRef.current = null;
      }
    } catch (e) {
      console.error("AudioContext close error:", e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#08090f] bg-premium-dark text-white font-sans selection:bg-[#e5c483]/30 selection:text-[#e5c483]">
      {/* 🌐 샴페인 골드 & 글래스모피즘 헤더 */}
      <header className="grid grid-cols-3 items-center px-8 py-5 border-b border-white/5 bg-[#08090f]/75 backdrop-blur-xl relative z-50">
        {/* 좌측: 나가기 버튼 */}
        <div className="justify-self-start">
          <button 
            onClick={onBack} 
            className="text-white/50 hover:text-[#e5c483] flex items-center gap-2 transition-all duration-300 font-medium tracking-wide text-sm group"
          >
            <span className="transform translate-x-0 group-hover:-translate-x-1 transition-transform duration-300">←</span> 나가기
          </button>
        </div>

        {/* 중앙: 물리적 정중앙 정렬 타이틀 */}
        <div className="justify-self-center text-center">
          <h1 className="text-lg font-bold tracking-widest text-gold-gradient uppercase opacity-95">
            K-Plastic Surgeon Live
          </h1>
        </div>
        
        {/* 우측: ⭐ 별표 분류 컴포넌트형 커스텀 드롭다운 */}
        <div className="justify-self-end relative" ref={dropdownRef}>
          <button
            disabled={isLive}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 rounded-2xl px-5 py-2.5 font-medium flex items-center gap-3 transition-all duration-300 shadow-md disabled:opacity-40 disabled:cursor-not-allowed text-xs tracking-wider uppercase hover:border-[#e5c483]/30 active:scale-95"
          >
            <span>🌐 {currentLangObj.name}</span>
            <span className="text-[10px] text-white/40">▼</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-[#0f111a]/95 border border-[#e5c483]/15 backdrop-blur-3xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="px-5 py-4 border-b border-white/5 bg-[#161926]/40 text-[10px] font-bold text-[#e5c483]/80 tracking-widest uppercase">
                📋 환자 국가 언어 선택 (별표 = 상단 고정)
              </div>
              <ul className="max-h-64 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                {sortedLanguages.map((lang) => {
                  const isFav = favorites.includes(lang.code);
                  return (
                    <li 
                      key={lang.code}
                      onClick={() => {
                        setSelectedLang(lang.code);
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#e5c483]/10 cursor-pointer transition-all duration-200 ${selectedLang === lang.code ? 'bg-[#e5c483]/15 text-[#e5c483] font-bold' : 'text-white/70'}`}
                    >
                      <span className="text-sm tracking-wide">{lang.name}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(lang.code, e);
                        }}
                        className="text-lg p-1.5 hover:scale-125 transition-transform duration-200 outline-none text-[#e5c483]/70 hover:text-[#e5c483]"
                      >
                        {isFav ? "★" : "☆"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* 🎙️ 라이브 오라 펄스 & 자막 대시보드 */}
      <main className="flex-1 flex flex-col items-center justify-start p-8 space-y-10 overflow-y-auto">
        <div className="flex flex-col items-center mt-6 space-y-5">
          <div className="relative flex items-center justify-center">
            {/* 3중 실키 골드 펄스 오라 */}
            {isLive && (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-[#d4af37]/5 pulse-wave-1"></div>
                <div className="absolute w-36 h-36 rounded-full bg-[#d4af37]/5 pulse-wave-2"></div>
                <div className="absolute w-36 h-36 rounded-full bg-[#d4af37]/5 pulse-wave-3"></div>
              </>
            )}
            
            <div className={`relative z-10 flex items-center justify-center w-32 h-32 rounded-full transition-all duration-500 border ${isLive ? 'bg-gradient-to-tr from-[#1a1c29] to-[#25283b] border-[#d4af37]/30 shadow-[0_0_50px_rgba(212,175,55,0.15)] scale-105' : 'bg-white/5 border-white/5'}`}>
              <span className={`text-4xl transition-transform duration-500 ${isLive ? 'scale-110 animate-pulse text-[#e5c483]' : 'opacity-30'}`}>
                {isLive ? '✦' : '🎙️'}
              </span>
            </div>
          </div>
          
          <p className={`text-xl font-bold tracking-tight text-center max-w-3xl transition-colors duration-300 ${isLive ? 'text-[#e5c483]' : 'text-white/40'}`}>
            {statusMessage}
          </p>
        </div>
        
        {isLive && (
          <div className="w-full max-w-6xl p-8 rounded-3xl glass-card shadow-[0_20px_60px_rgba(0,0,0,0.6)] min-h-[450px] max-h-[600px] overflow-y-auto flex flex-col justify-between custom-scrollbar">
            <div>
              <p className="text-xs text-[#e5c483]/80 font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e5c483] animate-ping"></span>
                📄 실시간 성형 상담 자막 (Live Transcript)
              </p>
              
              {chatLines.length === 0 ? (
                <p className="text-3xl text-white/20 font-bold font-sans italic tracking-wide pl-2">
                  환자분께 먼저 이야기하세요
                </p>
              ) : (
                <div className="space-y-8 divide-y divide-white/5">
                  {chatLines.map((line, idx) => (
                    <div 
                      key={line.id} 
                      className={`text-3xl font-sans font-bold leading-relaxed tracking-wide flex flex-col space-y-2 ${idx > 0 ? 'pt-6' : ''}`}
                    >
                      {/* 원본 발화 */}
                      <div className="flex items-start gap-4">
                        <div className="min-w-[140px] select-none flex items-center gap-2.5 pt-2">
                          {line.speaker === "Dr." ? (
                            <>
                              <svg className="w-5 h-5 text-[#e5c483] filter drop-shadow-[0_2px_6px_rgba(229,196,131,0.4)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0v-1.5M12 19.5v-7.5M12 12a3 3 0 100-6 3 3 0 000 6z" />
                              </svg>
                              <span className="text-xs font-bold tracking-widest text-[#e5c483] bg-[#e5c483]/10 border border-[#e5c483]/20 px-2 py-0.5 rounded-md uppercase">
                                Doctor
                              </span>
                            </>
                          ) : line.speaker === "Client" ? (
                            <>
                              <svg className="w-5 h-5 text-[#85CAFF] filter drop-shadow-[0_2px_6px_rgba(133,202,255,0.4)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                              <span className="text-xs font-bold tracking-widest text-[#85CAFF] bg-[#85CAFF]/10 border border-[#85CAFF]/20 px-2 py-0.5 rounded-md uppercase">
                                Client
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-slate-500 animate-ping"></span>
                              <span className="text-xs font-bold tracking-widest text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md uppercase">
                                Analyzing
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-white/90">
                          {line.original || <span className="text-white/10">음성 분석 중...</span>}
                        </span>
                      </div>
                      
                      {/* 번역 결과 */}
                      {line.translation && (
                        <div className="flex items-start gap-4">
                          <span className="min-w-[140px]"></span>
                          <span className={`${line.speaker === "Dr." ? "text-[#67C29F]" : "text-[#85CAFF]"} font-medium`}>
                            {line.translation}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div ref={transcriptEndRef} />
          </div>
        )}
      </main>

      {/* 🏆 하이글로시 샴페인 골드 푸터 버튼 */}
      <footer className="p-8 bg-[#08090f]/75 backdrop-blur-xl border-t border-white/5 flex justify-center">
        <button
          onClick={isLive ? stopLiveTranslation : startLiveTranslation}
          className={`w-full max-w-md py-5 rounded-2xl text-lg font-bold tracking-widest transition-all duration-300 transform active:scale-98 shadow-xl ${
            isLive 
              ? 'bg-gradient-to-r from-[#8c2d2d] to-[#b33939] hover:from-[#b33939] hover:to-[#d64a4a] text-white/95 shadow-red-950/20' 
              : 'btn-gold text-[#08090f] font-extrabold uppercase'
          }`}
        >
          {isLive ? "🛑 성형 상담 종료" : "✨ 성형 상담 시작"}
        </button>
      </footer>
    </div>
  );
}