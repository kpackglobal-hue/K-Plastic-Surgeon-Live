import React, { useRef, useEffect, useState } from 'react';

const DrawingCanvas = ({ isDoctor, ws, clearTrigger, undoTrigger }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    strokesRef.current.forEach(stroke => {
      if (stroke.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      strokesRef.current = [];
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (undoTrigger > 0) {
      strokesRef.current.pop();
      redraw();
    }
  }, [undoTrigger]);

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
            if (currentStrokeRef.current) {
              currentStrokeRef.current.push({ x: data.x, y: data.y });
            }
            ctx.lineTo(data.x, data.y);
            ctx.stroke();
          } else if (data.type === 'START') {
            currentStrokeRef.current = [{ x: data.x, y: data.y }];
            ctx.beginPath();
            ctx.moveTo(data.x, data.y);
          } else if (data.type === 'END') {
            if (currentStrokeRef.current) {
              strokesRef.current.push(currentStrokeRef.current);
              currentStrokeRef.current = null;
            }
          } else if (data.type === 'CLEAR') {
            strokesRef.current = [];
            currentStrokeRef.current = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          } else if (data.type === 'UNDO') {
            strokesRef.current.pop();
            redraw();
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
    
    currentStrokeRef.current = [{ x: offsetX, y: offsetY }];
    canvasRef.current.getContext('2d').beginPath();
    canvasRef.current.getContext('2d').moveTo(offsetX, offsetY);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'START', x: offsetX, y: offsetY }));
    }
  };

  const draw = (e) => {
    if (!isDrawing || !isDoctor) return;
    const { offsetX, offsetY } = e.nativeEvent;
    
    if (currentStrokeRef.current) {
      currentStrokeRef.current.push({ x: offsetX, y: offsetY });
    }
    canvasRef.current.getContext('2d').lineTo(offsetX, offsetY);
    canvasRef.current.getContext('2d').stroke();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'DRAW', x: offsetX, y: offsetY }));
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStrokeRef.current) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'END' }));
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full ${isDoctor ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseOut={stopDrawing}
    />
  );
};

export default DrawingCanvas;
