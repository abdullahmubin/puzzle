import { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCaptured }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);

  const [running, setRunning] = useState(true);

  const squareRef = useRef({
    x: 50,
    y: 50,
    size: 150,
    vx: 1.2,
    vy: 1.0
  });

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      animateSquare();
    } catch (e) {
      console.error(e);
    }
  }

  function stopCamera() {
    setRunning(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const s = videoRef.current?.srcObject;
    if (s) s.getTracks().forEach(t => t.stop());
  }

  function animateSquare() {
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');

    function step() {
      if (!running) return;

      const vw = videoRef.current.videoWidth || 640;
      const vh = videoRef.current.videoHeight || 480;

      canvas.width = vw;
      canvas.height = vh;

      const sq = squareRef.current;

      sq.vx += (Math.random() - 0.5) * 0.5;
      sq.vy += (Math.random() - 0.5) * 0.5;

      sq.vx *= 0.92;
      sq.vy *= 0.92;

      sq.x += sq.vx;
      sq.y += sq.vy;

      sq.x = Math.max(0, Math.min(vw - sq.size, sq.x));
      sq.y = Math.max(0, Math.min(vh - sq.size, sq.y));

      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, vw, vh);

      ctx.clearRect(sq.x, sq.y, sq.size, sq.size);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(sq.x, sq.y, sq.size, sq.size);

      animationRef.current = requestAnimationFrame(step);
    }

    step();
  }

  function captureFrame() {
    stopCamera();

    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/png");
    const { x, y, size } = squareRef.current;

    onCaptured({
      image,
      region: { x, y, size, width: canvas.width, height: canvas.height }
    });
  }

  return (
    <div style={{ position: "relative", maxWidth: "400px" }}>
      <video ref={videoRef} style={{ width: "100%" }} />

      <canvas
        ref={overlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        }}
      />

      <button onClick={captureFrame} style={{ marginTop: 10 }}>
        Continue
      </button>
    </div>
  );
}
