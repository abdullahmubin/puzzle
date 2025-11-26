import { useEffect, useRef, useState } from 'react';

// Puzzle grid - shows image with grid overlay and watermarks
// User clicks cells to select the matching shapes
export default function PuzzleGrid({
  imageDataUrl,
  region,
  gridRows,
  gridCols,
  watermarks,
  targetShape,
  targetColor,
  onValidate
}) {

  const canvasRef = useRef(null);
  const imageRef = useRef(null);  // Cache image to avoid reloading
  const rotationsRef = useRef({});  // Store rotation per shape so they don't shake on redraw
  
  const [selected, setSelected] = useState(new Set());

  // Timing data for bot detection
  const puzzleStartTimeRef = useRef(null);
  const clickTimestampsRef = useRef([]);
  const validationTimeRef = useRef(null);

  // Load image and draw puzzle when component mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Start timing for bot detection
    puzzleStartTimeRef.current = performance.now();
    clickTimestampsRef.current = [];

    if (!imageDataUrl) {
      console.error('No image data URL provided');
      return;
    }

    // Load the image
    const img = new Image();
    img.onload = () => {
      // Cache it - avoids reloading on every redraw
      imageRef.current = img;
      
      // Match canvas size to image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw everything
      ctx.drawImage(img, 0, 0);
      drawPuzzle(ctx);
    };
    img.onerror = (error) => {
      console.error('Failed to load image:', error);
      // TODO: show error to user
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, region, watermarks]);

  // Draw grid lines and watermarks
  function drawPuzzle(ctx) {
    const { x, y, size } = region;
    
    // Cell dimensions
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    // Grid line style
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;

    // Draw horizontal lines
    for (let r = 0; r <= gridRows; r++) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * cellH);
      ctx.lineTo(x + size, y + r * cellH);
      ctx.stroke();
    }

    // Draw vertical lines
    for (let c = 0; c <= gridCols; c++) {
      ctx.beginPath();
      ctx.moveTo(x + c * cellW, y);
      ctx.lineTo(x + c * cellW, y + size);
      ctx.stroke();
    }

    // Draw all watermarks
    watermarks.forEach(w => {
      drawShape(ctx, w.shape, w.color, w.idx);
    });
  }

  // Draw a single shape with color in a cell
  function drawShape(ctx, shape, color, idx) {
    const { x, y, size } = region;
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    // Convert index to row/col
    const row = Math.floor(idx / gridCols);
    const col = idx % gridCols;

    // Center of the cell
    const cx = x + col * cellW + cellW / 2;
    const cy = y + row * cellH + cellH / 2;
    
    // Shape is 30% of cell size
    const s = Math.min(cellW, cellH) * 0.3;

    ctx.save();
    ctx.translate(cx, cy);
    
    // Use consistent rotation per shape - prevents shaking on redraw
    if (!rotationsRef.current[idx]) {
      rotationsRef.current[idx] = (Math.random() - 0.5) * 0.5;
    }
    ctx.rotate(rotationsRef.current[idx]);
    
    // Set fill color based on tint
    if (color === "red") {
      ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
    } else if (color === "green") {
      ctx.fillStyle = "rgba(0, 255, 0, 0.7)";
    } else if (color === "blue") {
      ctx.fillStyle = "rgba(0, 0, 255, 0.7)";
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; // fallback
    }

    // Draw the actual shape
    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(0, 0, s, 0, Math.PI * 2);
    } else if (shape === "square") {
      ctx.rect(-s, -s, s * 2, s * 2);
    } else {
      // triangle - draw three points
      ctx.moveTo(0, -s);
      ctx.lineTo(s, s);
      ctx.lineTo(-s, s);
      ctx.closePath();
    }
    ctx.fill();
    
    ctx.restore();
  }

  // Handle canvas clicks - select/deselect cells
  function handleClick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert screen coords to canvas coords
    // Canvas might be scaled (responsive sizing)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { x, y, size } = region;

    // Ignore clicks outside grid area
    if (cx < x || cx > x + size || cy < y || cy > y + size)
      return;

    // Calculate which cell was clicked
    const col = Math.floor((cx - x) / (size / gridCols));
    const row = Math.floor((cy - y) / (size / gridRows));
    const idx = row * gridCols + col;

    // Toggle selection
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);

    // Track click timing for bot detection
    clickTimestampsRef.current.push({
      timestamp: performance.now(),
      cellIndex: idx,
      action: next.has(idx) ? 'select' : 'deselect'
    });

    // Redraw with yellow borders on selected cells
    drawUserSelections(next);
  }

  // Redraw with yellow borders on selected cells
  // Uses cached image to avoid flicker/reloading
  function drawUserSelections(sel) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = imageRef.current;
    
    if (!img) {
      return;  // Image not ready yet
    }

    // Redraw base image and grid
    ctx.drawImage(img, 0, 0);
    drawPuzzle(ctx);

    const { x, y, size } = region;
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    // Highlight selected cells with yellow border
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;

    sel.forEach(idx => {
      const row = Math.floor(idx / gridCols);
      const col = idx % gridCols;

      ctx.strokeRect(
        x + col * cellW,
        y + row * cellH,
        cellW,
        cellH
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Select all <span className={`capitalize font-bold ${
            targetColor === 'red' ? 'text-red-600 dark:text-red-400' :
            targetColor === 'green' ? 'text-green-600 dark:text-green-400' :
            'text-blue-600 dark:text-blue-400'
          }`}>{targetColor || 'colored'}</span> <span className="text-blue-600 dark:text-blue-400 capitalize font-bold">{targetShape}</span> shapes
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Click on the cells containing both the <span className="capitalize font-semibold">{targetColor || 'specified'}</span> color and <span className="capitalize font-semibold">{targetShape}</span> shape
        </p>
      </div>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-md max-w-full cursor-pointer hover:shadow-lg transition-shadow duration-200"
          style={{ maxWidth: "400px" }}
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => {
            // Record validation time
            validationTimeRef.current = performance.now();
            
            // Send validation with timing data for bot detection
            onValidate([...selected], {
              puzzleStartTime: puzzleStartTimeRef.current,
              clickTimestamps: clickTimestampsRef.current,
              validationTime: validationTimeRef.current
            });
          }}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={selected.size === 0}
        >
          Validate
        </button>
      </div>
    </div>
  );
}
