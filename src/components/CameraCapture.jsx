import { useEffect, useRef, useState } from 'react';

/**
 * CAMERA CAPTURE COMPONENT
 * 
 * FEATURES:
 * 1. Camera Access - Requests and displays user's front-facing camera
 * 2. Animated Square Overlay - Shows a moving square that bounces around
 * 3. Frame Capture - Captures the current video frame as an image
 * 4. Region Extraction - Extracts the square's position for puzzle grid
 */
export default function CameraCapture({ onCaptured }) {
  // REFS: DOM element references
  const videoRef = useRef(null);        // Video element showing camera feed
  const overlayRef = useRef(null);      // Canvas overlay for animated square
  const animationRef = useRef(null);    // Animation frame ID for cleanup

  // STATE: Controls whether animation loop is running
  const [running, setRunning] = useState(true);

  // REF: Stores square position, size, and velocity for animation
  // This manages the animated square overlay feature
  const squareRef = useRef({
    x: 50,        // X position (pixels)
    y: 50,        // Y position (pixels)
    size: 150,    // Square size (pixels)
    vx: 1.2,      // X velocity (pixels per frame)
    vy: 1.0       // Y velocity (pixels per frame)
  });

  // EFFECT: Initialize camera when component mounts
  // Cleanup: Stops camera when component unmounts
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  /**
   * FEATURE: Camera Initialization
   * Requests access to user's front-facing camera and starts video stream
   */
  async function startCamera() {
    try {
      // Request camera access (front-facing, no audio)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      
      // Connect stream to video element and play
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Start the animated square overlay
      animateSquare();
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * FEATURE: Camera Cleanup
   * Stops the camera stream and cancels animation
   */
  function stopCamera() {
    setRunning(false);
    
    // Cancel animation frame
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    // Stop all camera tracks
    const s = videoRef.current?.srcObject;
    if (s) s.getTracks().forEach(t => t.stop());
  }

  /**
   * FEATURE: Animated Square Overlay
   * Creates a physics-based animation of a square bouncing around the video
   * 
   * Animation details:
   * - Square moves with velocity (vx, vy)
   * - Random acceleration adds unpredictability
   * - Friction (0.92 multiplier) slows it down gradually
   * - Bounces off edges of video
   * - Dark overlay with transparent square window
   */
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

      // FEATURE: Physics-based movement
      // Add random acceleration for unpredictable movement
      sq.vx += (Math.random() - 0.5) * 0.5;
      sq.vy += (Math.random() - 0.5) * 0.5;

      // Apply friction to slow down gradually
      sq.vx *= 0.92;
      sq.vy *= 0.92;

      // Update position
      sq.x += sq.vx;
      sq.y += sq.vy;

      // FEATURE: Boundary collision detection
      // Keep square within video bounds (bounce off edges)
      sq.x = Math.max(0, Math.min(vw - sq.size, sq.x));
      sq.y = Math.max(0, Math.min(vh - sq.size, sq.y));

      // FEATURE: Overlay rendering
      // Draw dark overlay covering entire video
      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, vw, vh);

      // Clear the square area to show video through
      ctx.clearRect(sq.x, sq.y, sq.size, sq.size);
      
      // Draw white border around square
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(sq.x, sq.y, sq.size, sq.size);

      // Continue animation loop
      animationRef.current = requestAnimationFrame(step);
    }

    step();
  }

  /**
   * FEATURE: Frame Capture
   * Captures the current video frame and extracts the square region
   * 
   * This function:
   * 1. Stops the camera
   * 2. Draws current video frame to a canvas
   * 3. Converts canvas to image data URL
   * 4. Extracts square position and size
   * 5. Passes data to parent component
   */
  function captureFrame() {
    // Stop camera and animation
    stopCamera();

    const video = videoRef.current;

    // Create temporary canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Convert canvas to image data URL (base64 PNG)
    const image = canvas.toDataURL("image/png");
    
    // Get square position and size
    const { x, y, size } = squareRef.current;

    // Pass captured data to parent component
    // image: base64 image data
    // region: square position and dimensions for puzzle grid
    onCaptured({
      image,
      region: { x, y, size, width: canvas.width, height: canvas.height }
    });
  }

  return (
    <div style={{ position: "relative", maxWidth: "400px" }}>
      {/* FEATURE: Video Display - Shows live camera feed */}
      <video ref={videoRef} style={{ width: "100%" }} />

      {/* FEATURE: Animated Overlay Canvas - Draws the moving square */}
      <canvas
        ref={overlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"  // Allows clicks to pass through
        }}
      />

      {/* FEATURE: Capture Button - Triggers frame capture */}
      <button onClick={captureFrame} style={{ marginTop: 10 }}>
        Continue
      </button>
    </div>
  );
}
