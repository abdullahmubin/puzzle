import { useEffect, useRef, useState } from 'react';

/**
 * Camera capture component
 * Shows camera feed with a bouncing square overlay, captures frame when user clicks
 */
export default function CameraCapture({ onCaptured }) {
  // Refs for video, overlay canvas, and animation
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);

  // Whether the animation is running
  const [running, setRunning] = useState(true);

  // Square position and movement
  const squareRef = useRef({
    x: 50,
    y: 50,
    size: 150,
    vx: 1.2,  // horizontal velocity
    vy: 1.0   // vertical velocity
  });

  // Start camera when component mounts, stop when it unmounts
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Request camera access and start video stream
  async function startCamera() {
    try {
      setRunning(true);
      
      // Clean up any existing stream first
      if (videoRef.current?.srcObject) {
        const oldStream = videoRef.current.srcObject;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Reset square to starting position
      squareRef.current = {
        x: 50,
        y: 50,
        size: 150,
        vx: 1.2,
        vy: 1.0
      };

      // Get front-facing camera (no audio needed)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      
      // Show video feed
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Start the bouncing square animation
      animateSquare();
    } catch (e) {
      console.error('Camera error:', e);
      setRunning(false);
    }
  }

  // Stop camera and cancel animation
  function stopCamera() {
    setRunning(false);
    
    // Stop animation loop
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Stop camera tracks
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  // Animate the bouncing square overlay
  // Uses simple physics: velocity, random acceleration, friction, and boundary bouncing
  function animateSquare() {
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');

    function step() {
      if (!running) return;

      // Get video dimensions
      const vw = videoRef.current.videoWidth || 640;
      const vh = videoRef.current.videoHeight || 480;

      // Match canvas size to video size
      canvas.width = vw;
      canvas.height = vh;

      const sq = squareRef.current;

      // Add some randomness to make movement unpredictable
      sq.vx += (Math.random() - 0.5) * 0.5;
      sq.vy += (Math.random() - 0.5) * 0.5;

      // Apply friction so it slows down over time
      sq.vx *= 0.92;
      sq.vy *= 0.92;

      // Move the square
      sq.x += sq.vx;
      sq.y += sq.vy;

      // Bounce off edges
      sq.x = Math.max(0, Math.min(vw - sq.size, sq.x));
      sq.y = Math.max(0, Math.min(vh - sq.size, sq.y));

      // Draw dark overlay everywhere except the square
      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, vw, vh);

      // Clear square area to show video
      ctx.clearRect(sq.x, sq.y, sq.size, sq.size);
      
      // Draw white border around square
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(sq.x, sq.y, sq.size, sq.size);

      // Keep animating
      animationRef.current = requestAnimationFrame(step);
    }

    step();
  }

  // Capture the current video frame
  function captureFrame() {
    const video = videoRef.current;

    // Make sure video is ready
    if (!video || !video.videoWidth || !video.videoHeight) {
      console.error('Video not ready for capture');
      return;
    }

    // Create a canvas and draw the video frame to it
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Convert to image data URL
    const image = canvas.toDataURL("image/png");
    
    // Get where the square was positioned
    const { x, y, size } = squareRef.current;

    // Stop camera after capturing
    stopCamera();

    // Send captured data to parent
    onCaptured({
      image,
      region: { x, y, size, width: canvas.width, height: canvas.height }
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-slate-700 dark:text-slate-300">
          Position yourself in the frame and wait for the square to align
        </p>
      </div>
      <div className="relative max-w-md mx-auto rounded-lg overflow-hidden shadow-lg border-2 border-slate-300 dark:border-slate-600">
        <video ref={videoRef} className="w-full h-auto" />
        <canvas
          ref={overlayRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={captureFrame}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          Capture & Continue
        </button>
      </div>
    </div>
  );
}
