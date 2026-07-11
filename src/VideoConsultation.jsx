import React, { useEffect, useRef, useState } from 'react';
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
  const [transcript, setTranscript] = useState([]);
  const [clearCounter, setClearCounter] = useState(0);
  const [undoCounter, setUndoCounter] = useState(0);

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
      consultation_transcript: transcript,
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
    const translateSocket = new WebSocket(`ws://localhost:8000/ws/translate/en`);
    translateSocket.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.translated) {
          setSubtitles(data.translated); // 실시간 자막 업데이트
          setTranscript(prev => [...prev, data.translated]); // 자막 기록 추가
        }
      } catch (err) { }
    });

    // 4. 룸 브로드캐스트 WebSocket 연결 (드로잉 좌표 등)
    const broadcastSocket = new WebSocket(`ws://localhost:8000/ws/${roomId}`);
    
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
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      {/* 상대방 영상 (풀스크린) 또는 선택된 사진 */}
      <div className="relative w-full h-full max-h-screen flex items-center justify-center">
        {!selectedPhoto && (
          <video ref={peerVideo} autoPlay playsInline className="w-full h-full object-cover" />
        )}
        
        {selectedPhoto && (
          <img src={selectedPhoto} alt="Patient" className="max-w-full max-h-full object-contain" />
        )}

        {/* 내 영상 (숨김 처리, 연결 유지를 위해 DOM에는 존재) */}
        <video ref={myVideo} autoPlay playsInline muted className="hidden" />
        
        {/* 드로잉 캔버스 (영상/사진 위에 투명하게 올라감) */}
        <div className="absolute inset-0 z-30">
          <DrawingCanvas isDoctor={isDoctor} ws={roomWs} clearTrigger={`${selectedPhoto}-${clearCounter}`} undoTrigger={undoCounter} />
        </div>
      </div>
      
      {/* 우측 자막 기록(트랜스크립트) 패널 */}
      <div className="absolute right-0 top-0 h-full w-80 bg-black/80 border-l border-gray-700 p-6 flex flex-col z-40 backdrop-blur-md">
        <h3 className="text-white text-xl font-bold mb-4 border-b border-gray-600 pb-2">실시간 상담 기록</h3>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
          {transcript.length === 0 && <div className="text-gray-400 text-sm">상담 내용이 여기에 기록됩니다...</div>}
          {transcript.map((text, idx) => (
            <div key={idx} className="bg-blue-900/60 p-3 rounded-xl text-white text-sm shadow">
              {text}
            </div>
          ))}
        </div>
      </div>
      

      {!isDoctor && !isPaid && (
        <button 
          onClick={handlePayment}
          className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-lg shadow-xl animate-bounce z-50 transition-colors"
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
          <div className="bg-white p-8 rounded-3xl flex flex-col gap-6 shadow-2xl items-center max-w-lg w-full">
            <h2 className="text-2xl font-bold text-gray-800">성형 후 예상 결과</h2>
            
            {/* 플레이스홀더 영역 (실제 이미지 연동 전) */}
            <div className="w-full h-80 bg-gray-200 rounded-xl flex items-center justify-center overflow-hidden relative">
              <span className="text-gray-400 font-semibold absolute z-10">AI 생성 이미지 영역</span>
              {/* <img src="/placeholder-after.jpg" alt="Result" className="w-full h-full object-cover relative z-20" /> */}
            </div>

            <button 
              onClick={() => setResultVisible(false)} 
              className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-4 rounded-xl font-bold text-xl"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      
      {/* 나가기 버튼 */}
      <button 
        onClick={handleExit}
        className="absolute top-6 left-6 z-50 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-lg font-semibold transition-colors shadow-md"
      >
        ← 나가기
      </button>
      
      {/* 넷플릭스 스타일 실시간 자막 오버레이 */}
      <div className="absolute bottom-36 w-full flex justify-center px-8 pointer-events-none z-40">
        <div className="text-white text-3xl font-bold bg-black/60 px-6 py-3 rounded-lg shadow-lg text-center max-w-4xl backdrop-blur-sm">
          {subtitles || "자막 대기중..."}
        </div>
      </div>

      {/* 의사용 썸네일 컨트롤 패널 및 환자 정보 (좌측 하단) */}
      {isDoctor && (
        <div className="absolute bottom-6 left-6 flex flex-col gap-4 bg-black/60 p-5 rounded-2xl backdrop-blur-md z-50 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-3 border-b border-gray-600 pb-3">
            <span className="text-3xl">🇺🇸</span>
            <div>
              <div className="text-white font-bold text-xl">Sarah Connor</div>
              <div className="text-gray-300 text-sm">미국 (USA)</div>
            </div>
          </div>
          <div className="text-white font-semibold text-sm">사전 촬영 사진:</div>
          <div className="flex gap-3">
            {MOCK_PHOTOS.map((photo) => (
              <button
                key={photo.id}
                onClick={() => handlePhotoClick(photo.url)}
                className={`relative overflow-hidden rounded-lg w-20 h-20 border-2 transition-all hover:scale-105 ${selectedPhoto === photo.url ? 'border-blue-500 scale-110 shadow-lg' : 'border-transparent'}`}
              >
                <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 w-full bg-black/50 text-white text-xs font-bold py-1 text-center">
                  {photo.label}
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={handleUndoDrawing}
              className="bg-yellow-500 hover:bg-yellow-600 text-black w-full py-2 rounded-xl font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <span>↩️</span> 실행 취소 (하나씩 지우기)
            </button>
            {selectedPhoto && (
              <button
                onClick={handleBackToVideo}
                className="bg-red-500 hover:bg-red-600 text-white w-full py-3 rounded-xl font-bold text-sm transition-colors shadow-lg"
              >
                영상으로 돌아가기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 개발/테스트용 Peer ID 표시 */}
      <div className="absolute top-6 right-6 text-white text-sm bg-black/50 p-2 rounded z-50">
        My Peer ID: {peerId}
      </div>
    </div>
  );
};

export default VideoConsultation;
