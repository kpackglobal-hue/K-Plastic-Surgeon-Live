import React, { useRef, useEffect, useState } from 'react';

const DrawingCanvas = ({ isDoctor, ws }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    // Set actual canvas size to match the display size for correct coordinate mapping
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'red'; // 성형외과 절개선 강조용 빨간색
    ctx.lineWidth = 3;

    // 다른 사용자가 그린 좌표 수신
    if (ws) {
      // It's better to add an event listener rather than overriding onmessage
      // so it doesn't conflict with translation onmessage, but for simplicity we keep it as requested or handle carefully.
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'DRAW') {
            ctx.lineTo(data.x, data.y);
            ctx.stroke();
          } else if (data.type === 'START') {
            ctx.beginPath();
            ctx.moveTo(data.x, data.y);
          }
        } catch (e) {
          // Ignore non-JSON messages or translation messages
        }
      };
      
      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    }
  }, [ws]);

  const startDrawing = (e) => {
    if (!isDoctor) return;
    setIsDrawing(true);
    const { offsetX, offsetY } = e.nativeEvent;
    canvasRef.current.getContext('2d').beginPath();
    canvasRef.current.getContext('2d').moveTo(offsetX, offsetY);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'START', x: offsetX, y: offsetY }));
    }
  };

  const draw = (e) => {
    if (!isDrawing || !isDoctor) return;
    const { offsetX, offsetY } = e.nativeEvent;
    canvasRef.current.getContext('2d').lineTo(offsetX, offsetY);
    canvasRef.current.getContext('2d').stroke();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'DRAW', x: offsetX, y: offsetY }));
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full ${isDoctor ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={() => setIsDrawing(false)}
      onMouseOut={() => setIsDrawing(false)}
    />
  );
};

export default DrawingCanvas;
