import { useEffect, useRef, useState } from 'react';

// Camera component - shows video feed with bouncing square overlay
// The square movement is randomized to make it more dynamic
export default function CameraCapture({ onCaptured }) {
  // Refs for video element, overlay canvas, and animation frame
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);

  // Animation running state
  const [running, setRunning] = useState(true);

  // Square position and physics
  const squareRef = useRef({
    x: 50,
    y: 50,
    size: 150,
    vx: 1.2,  // horizontal speed
    vy: 1.0   // vertical speed
  });

  // Start camera on mount, cleanup on unmount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Start camera - request access and show video feed
  async function startCamera() {
    try {
      setRunning(true);
      
      // Clean up any existing stream - had issues with multiple streams before
      if (videoRef.current?.srcObject) {
        const oldStream = videoRef.current.srcObject;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Reset square position - start from top-left
      squareRef.current = {
        x: 50,
        y: 50,
        size: 150,
        vx: 1.2,
        vy: 1.0
      };

      // Get front camera (facingMode: 'user')
      // No audio needed for this
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      
      // Show the video
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Start animation
      animateSquare();
    } catch (e) {
      console.error('Camera error:', e);
      // TODO: show user-friendly error message
      setRunning(false);
    }
  }

  // Stop camera and cleanup
  function stopCamera() {
    setRunning(false);
    
    // Cancel animation
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

  // Animate the bouncing square
  // Simple physics: velocity + random acceleration + friction + bouncing
  // The randomness makes it less predictable
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

      // Add randomness to velocity - makes it less predictable
      sq.vx += (Math.random() - 0.5) * 0.5;
      sq.vy += (Math.random() - 0.5) * 0.5;

      // Friction - slows it down gradually
      sq.vx *= 0.92;
      sq.vy *= 0.92;

      // Update position
      sq.x += sq.vx;
      sq.y += sq.vy;

      // Bounce off edges - keep it within bounds
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

  // Capture current frame - draw video to canvas and convert to image
  function captureFrame() {
    const video = videoRef.current;

    // Safety check - video needs to be ready
    if (!video || !video.videoWidth || !video.videoHeight) {
      console.error('Video not ready for capture');
      return;
    }

    // Create temp canvas and draw video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Convert to base64 image
    const image = canvas.toDataURL("image/png");
    
    // Get square position at capture time
    const { x, y, size } = squareRef.current;

    // Stop camera - important to do this AFTER capture
    // Had a bug where stopping before capture caused blank images
    stopCamera();

    // Send to parent component
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
          Continue
        </button>
      </div>
    </div>
  );
}
