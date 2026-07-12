import React, { useEffect, useRef, useState } from 'react';
import { getWsUrl } from './config';
import Peer from 'peerjs';
import DrawingCanvas from './DrawingCanvas';

const VideoConsultation = ({ roomId = "room-123", isDoctor = true, onBack }) => {
  const myVideo = useRef(null);
  const peerVideo = useRef(null);
  
  const [peerId, setPeerId] = useState('');
  const [subtitles, setSubtitles] = useState('');
  const [roomWs, setRoomWs] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
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
  const [clearCounter, setClearCounter] = useState(0);
  const [undoCounter, setUndoCounter] = useState(0);
  const [isBeautyFilterActive, setIsBeautyFilterActive] = useState(false);

  const MOCK_PHOTOS = [
    { id: 'front', label: '정면', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80' },
    { id: 'side', label: '측면', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80' },
    { id: 'bottom', label: '하단', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80' },
  ];

  const handlePayment = async () => {
    // 1. Stripe 결제 모듈 호출 (백엔드와 연동)
    // const response = await fetch('/api/create-checkout-session', { method: 'POST' });
    // const session = await response.json();
    
    // 임시 모의 결제
    setIsPaid(true);
    setIsGenerating(true);
    
    // 2. 가상 성형 생성 중 메시지 표시 후 결과 팝업
    setTimeout(() => {
      setIsGenerating(false);
      // 여기서 가상의 성형 전후 이미지 팝업 표시
      alert("시뮬레이션 완료! 결과 이미지를 확인하세요.");
      setResultVisible(true); 
    }, 3000); 
  };

  const handleExit = () => {
    // 1. 전송할 상담 데이터 패키징 (JSON)
    const exportData = {
      reservation_id: "RES-20260711-001", // 실제로는 라우트나 프롭스로 전달받은 ID 사용
      patient_info: {
        name: "Sarah Connor",
        age: 28,
        nationality: "USA"
      },
      original_photos: MOCK_PHOTOS.map(p => p.url),
      // 현재는 캔버스 캡처본이 없으므로 빈 배열로 두지만 추후 그림 그려진 이미지를 base64로 캡처해 추가할 수 있음
      annotated_photos: [], 
      consultation_transcript: chatLines.map(line => `${line.speaker}: ${line.original} -> ${line.translation}`),
      consultation_date: new Date().toISOString()
    };

    // 2. 개발자 도구(콘솔)에 전송될 데이터 뼈대 출력 (확인용)
    console.log("🚀 [병원 서버로 전송되는 상담 데이터 패키지]:", JSON.stringify(exportData, null, 2));

    // 3. 백그라운드에서 상담 종료 API 호출 (모의 엔드포인트)
    fetch(`http://localhost:8000/api/hospital-emr/export-consultation`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportData)
    }).catch(error => console.warn("모의 전송이므로 서버 오류는 무시됩니다:", error));

    // 4. 즉시 메인 화면으로 돌아가기
    onBack(); 
  };

  useEffect(() => {
    // 1. PeerJS 설정 (내 카메라 시작)
    const peer = new Peer(); 
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
        
        // 의사가 접속하면 호출 대기
        peer.on('call', (call) => {
          call.answer(stream);
          call.on('stream', (userStream) => {
            if (peerVideo.current) {
              peerVideo.current.srcObject = userStream;
            }
          });
        });
      })
      .catch(err => {
        console.error("Failed to get media devices:", err);
        alert("카메라 및 마이크 권한을 허용해주세요. (또는 카메라/마이크 장치가 연결되어 있는지 확인해 주세요)\n에러 상세: " + err.message);
      });

    // 2. 상대방과 연결 (상대방의 PeerID로 호출)
    peer.on('open', (id) => setPeerId(id));
    
    // 3. 통역 엔진 WebSocket 연결 (기존 서버 재활용)
    const translateSocket = new WebSocket(getWsUrl(`/ws/translate/en`));
    translateSocket.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.translated) {
          setSubtitles(data.translated); // 실시간 자막 업데이트
          setChatLines(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              speaker: isDoctor ? "Client" : "Dr.",
              original: isDoctor ? "Incoming client speech..." : "의사 발화 실시간 분석 중...",
              translation: data.translated
            }
          ]);
        }
      } catch (err) { }
    });

    // 4. 룸 브로드캐스트 WebSocket 연결 (드로잉 좌표 등)
    const broadcastSocket = new WebSocket(getWsUrl(`/ws/${roomId}`));
    
    broadcastSocket.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'PHOTO_SELECT') {
          setSelectedPhoto(data.url);
        } else if (data.type === 'PHOTO_CLEAR') {
          setSelectedPhoto(null);
        }
      } catch (err) {}
    });
    
    setRoomWs(broadcastSocket);

    return () => {
      peer.destroy();
      translateSocket.close();
      broadcastSocket.close();
    };
  }, [roomId]);

  const handlePhotoClick = (url) => {
    setSelectedPhoto(url);
    if (roomWs && roomWs.readyState === WebSocket.OPEN) {
      roomWs.send(JSON.stringify({ type: 'PHOTO_SELECT', url }));
      roomWs.send(JSON.stringify({ type: 'CLEAR' })); // Clear drawing when photo changes
    }
  };

  const handleBackToVideo = () => {
    setSelectedPhoto(null);
    if (roomWs && roomWs.readyState === WebSocket.OPEN) {
      roomWs.send(JSON.stringify({ type: 'PHOTO_CLEAR' }));
      roomWs.send(JSON.stringify({ type: 'CLEAR' })); // Clear drawing
    }
  };

  const handleUndoDrawing = () => {
    setUndoCounter(c => c + 1);
    if (roomWs && roomWs.readyState === WebSocket.OPEN) {
      roomWs.send(JSON.stringify({ type: 'UNDO' }));
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#08090f] bg-premium-dark text-white font-sans selection:bg-[#e5c483]/30 selection:text-[#e5c483] overflow-hidden flex flex-col items-center justify-center">
      {/* 상대방 영상 (풀스크린) 또는 선택된 사진 */}
      <div className="relative w-full h-full max-h-screen flex items-center justify-center">
        {!selectedPhoto && (
          <video 
            ref={peerVideo} 
            autoPlay 
            playsInline 
            style={!isDoctor && isBeautyFilterActive ? { filter: "brightness(1.06) contrast(1.02) saturate(1.06) blur(0.4px) sepia(0.01)" } : {}}
            className="w-full h-full object-cover" 
          />
        )}
        
        {selectedPhoto && (
          <img src={selectedPhoto} alt="Patient" className="max-w-full max-h-full object-contain" />
        )}
 
        {/* 내 영상 (의사일 경우 우측 하단 PIP로 표시, 환자일 경우 hidden 유지) */}
        <video 
          ref={myVideo} 
          autoPlay 
          playsInline 
          muted 
          style={isDoctor && isBeautyFilterActive ? { filter: "brightness(1.06) contrast(1.02) saturate(1.06) blur(0.4px) sepia(0.01)" } : {}}
          className={isDoctor 
            ? "absolute bottom-6 right-6 w-32 h-44 object-cover rounded-2xl border border-white/20 shadow-2xl z-40 transition-all duration-500" 
            : "hidden"
          } 
        />
        
        {/* 드로잉 캔버스 (영상/사진 위에 투명하게 올라감) */}
        <div className="absolute inset-0 z-30">
          <DrawingCanvas isDoctor={isDoctor} ws={roomWs} clearTrigger={`${selectedPhoto}-${clearCounter}`} undoTrigger={undoCounter} />
        </div>
      </div>
      
      {/* 우측 자막 기록(트랜스크립트) 패널 */}
      <div className="absolute right-0 top-0 h-full w-96 bg-[#08090f]/75 border-l border-white/5 p-6 flex flex-col z-40 backdrop-blur-2xl">
        <h3 className="text-[#e5c483]/90 text-sm font-bold tracking-widest mb-6 border-b border-white/5 pb-3 uppercase">
          실시간 상담 기록
        </h3>
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
          {chatLines.length === 0 ? (
            <div className="text-white/20 font-medium text-xs tracking-wide pl-1">
              상담 내용이 실시간 기록됩니다...
            </div>
          ) : (
            <div className="space-y-6 divide-y divide-white/5">
              {chatLines.map((line, idx) => (
                <div 
                  key={line.id} 
                  className={`text-xs font-sans font-bold leading-relaxed tracking-wide flex flex-col space-y-1.5 ${idx > 0 ? 'pt-4' : ''}`}
                >
                  {/* 화자 뱃지 및 원본 발화 */}
                  <div className="flex flex-col space-y-1">
                    <div className="select-none flex items-center gap-1.5 pb-1">
                      {line.speaker === "Dr." ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-[#e5c483] filter drop-shadow-[0_1px_3px_rgba(229,196,131,0.4)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0v-1.5M12 19.5v-7.5M12 12a3 3 0 100-6 3 3 0 000 6z" />
                          </svg>
                          <span className="text-[9px] font-bold tracking-widest text-[#e5c483] bg-[#e5c483]/10 border border-[#e5c483]/20 px-1.5 py-0.5 rounded uppercase">
                            Doctor
                          </span>
                        </>
                      ) : line.speaker === "Client" ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-[#85CAFF] filter drop-shadow-[0_1px_3px_rgba(133,202,255,0.4)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          <span className="text-[9px] font-bold tracking-widest text-[#85CAFF] bg-[#85CAFF]/10 border border-[#85CAFF]/20 px-1.5 py-0.5 rounded uppercase">
                            Client
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-ping"></span>
                          <span className="text-[9px] font-bold tracking-widest text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded uppercase">
                            Analyzing
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-white/90 text-[11px] pl-1 font-semibold leading-relaxed">
                      {line.original || <span className="text-white/10">음성 분석 중...</span>}
                    </span>
                  </div>
                  
                  {/* 번역 결과 */}
                  {line.translation && (
                    <div className="text-[11px] pl-1 font-medium leading-relaxed">
                      <span className={line.speaker === "Dr." ? "text-[#67C29F]" : "text-[#85CAFF]"}>
                        {line.translation}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isDoctor && !isPaid && (
        <button 
          onClick={handlePayment}
          className="absolute bottom-32 left-1/2 transform -translate-x-1/2 btn-gold text-[#08090f] font-extrabold px-8 py-4 rounded-full text-base shadow-xl animate-bounce z-50 transition-colors"
        >
          AI 시뮬레이션 결과 보기 ($14.99)
        </button>
      )}
 
      {/* 상태 메시지 */}
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-3xl font-bold z-[100] backdrop-blur-sm">
          AI가 성형 후 모습을 생성 중입니다...
        </div>
      )}
 
      {/* 가상 성형 결과 팝업 */}
      {resultVisible && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 p-10 backdrop-blur-md">
          <div className="bg-[#0f111a] border border-[#e5c483]/20 p-8 rounded-3xl flex flex-col gap-6 shadow-2xl items-center max-w-lg w-full">
            <h2 className="text-xl font-bold text-[#e5c483] tracking-wider">성형 후 예상 결과</h2>
            
            {/* 플레이스홀더 영역 (실제 이미지 연동 전) */}
            <div className="w-full h-80 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden relative">
              <span className="text-white/30 font-semibold absolute z-10 text-xs tracking-widest uppercase">AI 생성 이미지 영역</span>
            </div>
 
            <button 
              onClick={() => setResultVisible(false)} 
              className="w-full btn-gold text-[#08090f] py-4 rounded-xl font-bold text-base"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      
      {/* 나가기 버튼 (대면상담과 동일한 스펙 변경) */}
      <button 
        onClick={handleExit}
        className="absolute top-6 left-6 z-50 text-white/50 hover:text-[#e5c483] flex items-center gap-2 transition-all duration-300 font-medium tracking-wide text-sm group"
      >
        <span className="transform translate-x-0 group-hover:-translate-x-1 transition-transform duration-300">←</span> 나가기
      </button>
      
      {/* 넷플릭스 스타일 실시간 자막 오버레이 (자막 대기중 텍스트 삭제 및 조건부 가시화) */}
      {subtitles && (
        <div className="absolute bottom-36 w-full flex justify-center px-8 pointer-events-none z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="text-white text-3xl font-bold bg-[#08090f]/75 border border-white/5 px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-center max-w-4xl backdrop-blur-md">
            {subtitles}
          </div>
        </div>
      )}
 
      {/* 의사용 썸네일 컨트롤 패널 및 환자 정보 (좌측 하단) */}
      {isDoctor && (
        <div className="absolute bottom-6 left-6 flex flex-col gap-4 bg-[#08090f]/75 p-6 rounded-3xl backdrop-blur-2xl z-50 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/5">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <span className="text-3xl filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.3)]">🇺🇸</span>
            <div>
              <div className="text-white font-extrabold text-base tracking-wide">Sarah Connor</div>
              <div className="text-white/40 text-xs tracking-wider">미국 (USA)</div>
            </div>
          </div>
          <div className="text-[#e5c483]/80 font-bold text-[10px] tracking-widest uppercase">사전 촬영 사진</div>
          <div className="flex gap-3">
            {MOCK_PHOTOS.map((photo) => (
              <button
                key={photo.id}
                onClick={() => handlePhotoClick(photo.url)}
                className={`relative overflow-hidden rounded-xl w-20 h-20 border-2 transition-all duration-300 hover:scale-105 active:scale-95 ${selectedPhoto === photo.url ? 'border-[#e5c483] shadow-md shadow-[#e5c483]/10 scale-105' : 'border-transparent'}`}
              >
                <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 w-full bg-[#08090f]/75 text-white/80 text-[10px] font-bold py-1 text-center backdrop-blur-sm border-t border-white/5">
                  {photo.label}
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={handleUndoDrawing}
              className="btn-gold text-[#08090f] w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
            >
              <span>↩️</span> 실행 취소 (하나씩 지우기)
            </button>
            {selectedPhoto && (
              <button
                onClick={handleBackToVideo}
                className="bg-gradient-to-r from-[#8c2d2d] to-[#b33939] hover:from-[#b33939] hover:to-[#d64a4a] text-white/95 w-full py-2.5 rounded-xl font-bold text-xs transition-all active:scale-98"
              >
                영상으로 돌아가기
              </button>
            )}
          </div>
        </div>
      )}
 
      {/* 보정 필터 토글 버튼 (우측 레이아웃 겹침 방지: right-[408px]로 좌측 배치) */}
      <button 
        onClick={() => setIsBeautyFilterActive(!isBeautyFilterActive)}
        className={`absolute top-6 right-[408px] z-50 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 shadow-md flex items-center gap-2 active:scale-95 border ${
          isBeautyFilterActive 
            ? 'bg-gradient-to-r from-[#e5c483] to-[#d4af37] text-[#08090f] border-[#e5c483]' 
            : 'bg-white/5 text-white/80 hover:bg-white/10 border-white/10'
        }`}
      >
        <span>✨</span> {isBeautyFilterActive ? "보정 필터 ON" : "보정 필터 OFF"}
      </button>
 
      {/* 개발/테스트용 Session ID 표시 (우측 레이아웃 겹침 방지: top-left의 나가기 우측 배치) */}
      <div className="absolute top-[26px] left-32 text-white/40 text-[10px] font-bold tracking-widest bg-[#08090f]/75 border border-white/5 px-3 py-2 rounded-2xl z-50 uppercase flex items-center gap-1.5 backdrop-blur-sm">
        <span>Session ID:</span> <span className="text-[#e5c483] font-mono">{peerId}</span>
      </div>
    </div>
  );
};

export default VideoConsultation;
