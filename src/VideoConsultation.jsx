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

  const handleExit = async () => {
    try {
      // API 호출 (현재 백엔드 서버 로컬 기준)
      await fetch(`http://localhost:8000/api/end-consultation/${roomId}`, { method: 'POST' });
    } catch (error) {
      console.error("Failed to end consultation:", error);
    }
    onBack(); // 메인 화면으로 돌아가기
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
      .catch(err => console.error("Failed to get media devices:", err));

    // 2. 상대방과 연결 (상대방의 PeerID로 호출)
    peer.on('open', (id) => setPeerId(id));
    
    // 3. 통역 엔진 WebSocket 연결 (기존 서버 재활용)
    const translateSocket = new WebSocket(`ws://localhost:8000/ws/translate/en`);
    translateSocket.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.translated) {
          setSubtitles(data.translated); // 실시간 자막 업데이트
        }
      } catch (err) { }
    });

    // 4. 룸 브로드캐스트 WebSocket 연결 (드로잉 좌표 등)
    const broadcastSocket = new WebSocket(`ws://localhost:8000/ws/${roomId}`);
    setRoomWs(broadcastSocket);

    return () => {
      peer.destroy();
      translateSocket.close();
      broadcastSocket.close();
    };
  }, [roomId]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 상대방 영상 (풀스크린) */}
      <video ref={peerVideo} autoPlay playsInline className="w-full h-full object-cover" />
      
      {/* 내 영상 (우측 하단 작은 창) */}
      <video ref={myVideo} autoPlay playsInline muted className="absolute bottom-4 right-4 w-48 h-32 rounded-lg border-2 border-white object-cover shadow-lg" />
      
      {/* 드로잉 캔버스 (영상 위에 투명하게 올라감) */}
      <DrawingCanvas isDoctor={isDoctor} ws={roomWs} />
      
      {/* 넷플릭스 스타일 실시간 자막 오버레이 */}
      <div className="absolute bottom-10 w-full flex justify-center px-8 pointer-events-none z-10">
        <div className="text-white text-3xl font-bold bg-black/60 px-6 py-3 rounded-lg shadow-lg text-center max-w-4xl backdrop-blur-sm">
          {subtitles || "자막 대기중..."}
        </div>
      </div>

      {/* 환자 화면용 결제 버튼 (결제 안 했을 때만 표시) */}
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
      
      {/* 개발/테스트용 Peer ID 표시 */}
      <div className="absolute top-6 right-6 text-white text-sm bg-black/50 p-2 rounded z-50">
        My Peer ID: {peerId}
      </div>
    </div>
  );
};

export default VideoConsultation;
