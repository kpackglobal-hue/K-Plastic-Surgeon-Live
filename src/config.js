// K-Plastic Surgeon Live - 공유용 백엔드 접속 환경 설정

export const getWsUrl = (path) => {
  const host = window.location.hostname;
  
  // 1. 로컬 환경 (localhost / 127.0.0.1)
  if (host === 'localhost' || host === '127.0.0.1') {
    return `ws://localhost:8000${path}`;
  }
  
  // 2. 동일 와이파이(Wi-Fi) IP 접속 환경 (예: 192.168.x.x)
  // 브라우저 주소창의 IP를 감지하여 백엔드 포트 8000으로 자동 리다이렉트
  if (/^[0-9.]+$/.test(host)) {
    return `ws://${host}:8000${path}`;
  }
  
  // 3. 외부 원격 공유 터널 환경 (ngrok, localtunnel 등 사용 시)
  // 💡 아래 따옴표 안에 백엔드 포트 8000 터널 주소를 넣어주시면 즉시 외부에서 웹소켓이 연동됩니다.
  // 예: const REMOTE_BACKEND_URL = "https://your-backend.ngrok-free.app";
  const REMOTE_BACKEND_URL = "https://silent-boats-eat.loca.lt"; 

  if (REMOTE_BACKEND_URL) {
    const cleanUrl = REMOTE_BACKEND_URL.replace(/^https?:\/\//, '');
    const protocol = REMOTE_BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
    return `${protocol}://${cleanUrl}${path}`;
  }
  
  // 기본 폴백
  return `ws://localhost:8000${path}`;
};
