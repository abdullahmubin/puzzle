import { useEffect, useRef, useState } from 'react';

/**
 * PUZZLE GRID COMPONENT
 * 
 * FEATURES:
 * 1. Image Display - Shows captured image from camera
 * 2. Grid Overlay - Draws grid lines over the captured region
 * 3. Watermark Rendering - Draws shapes (triangle, square, circle) on cells
 * 4. Cell Selection - Allows user to click cells to select/deselect
 * 5. Visual Feedback - Highlights selected cells with yellow border
 * 6. Validation - Submits selected cells for validation
 */
export default function PuzzleGrid({
  imageDataUrl,    // Base64 image data from camera
  region,          // Square region coordinates {x, y, size, width, height}
  gridRows,        // Number of rows in grid (4)
  gridCols,        // Number of columns in grid (4)
  watermarks,      // Array of {idx, shape} objects for cells with watermarks
  targetShape,     // Shape user needs to find (e.g., "triangle", "square", "circle")
  onValidate       // Callback function when user clicks Validate
}) {

  // REF: Canvas element reference for drawing
  const canvasRef = useRef(null);
  
  // REF: Stores the loaded image to avoid reloading on every redraw
  const imageRef = useRef(null);
  
  // REF: Stores rotation angles for each watermark to keep them consistent
  // Format: { [idx]: rotationAngle }
  const rotationsRef = useRef({});
  
  // STATE: Tracks which grid cells user has selected
  // Uses Set for efficient add/remove/check operations
  const [selected, setSelected] = useState(new Set());

  /**
   * EFFECT: Initialize Canvas
   * Loads the captured image and draws the puzzle grid when component mounts
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Load image from data URL
    const img = new Image();
    img.onload = () => {
      // Store image in ref to avoid reloading on every redraw
      imageRef.current = img;
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image first (background)
      ctx.drawImage(img, 0, 0);
      
      // Draw grid lines and watermarks on top
      drawPuzzle(ctx);
    };
    img.src = imageDataUrl;
  }, []);

  /**
   * FEATURE: Draw Puzzle Grid and Watermarks
   * Draws the grid lines and watermark shapes on the canvas
   * 
   * This function:
   * 1. Calculates cell dimensions
   * 2. Draws horizontal and vertical grid lines
   * 3. Draws watermark shapes in their assigned cells
   */
  function drawPuzzle(ctx) {
    const { x, y, size } = region;
    
    // Calculate cell dimensions
    const cellW = size / gridCols;  // Width of each cell
    const cellH = size / gridRows;  // Height of each cell

    // FEATURE: Draw Grid Lines
    // Draws horizontal lines (rows)
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;

    for (let r = 0; r <= gridRows; r++) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * cellH);
      ctx.lineTo(x + size, y + r * cellH);
      ctx.stroke();
    }

    // Draws vertical lines (columns)
    for (let c = 0; c <= gridCols; c++) {
      ctx.beginPath();
      ctx.moveTo(x + c * cellW, y);
      ctx.lineTo(x + c * cellW, y + size);
      ctx.stroke();
    }

    // FEATURE: Draw Watermark Shapes
    // Draws shapes (triangle, square, circle) in cells that have watermarks
    watermarks.forEach(w => {
      drawShape(ctx, w.shape, w.idx);
    });
  }

  /**
   * FEATURE: Draw Individual Watermark Shape
   * Draws a single shape (triangle, square, or circle) in a specific grid cell
   * 
   * @param ctx - Canvas 2D context
   * @param shape - Shape type: "triangle", "square", or "circle"
   * @param idx - Grid cell index (0-15 for 4x4 grid)
   */
  function drawShape(ctx, shape, idx) {
    const { x, y, size } = region;
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    // Convert linear index to row/column
    const row = Math.floor(idx / gridCols);
    const col = idx % gridCols;

    // Calculate center of the cell
    const cx = x + col * cellW + cellW / 2;
    const cy = y + row * cellH + cellH / 2;
    
    // Shape size is 30% of the smaller cell dimension
    const s = Math.min(cellW, cellH) * 0.3;

    // Save canvas state before transformations
    ctx.save();
    
    // Move origin to cell center
    ctx.translate(cx, cy);
    
    // FIX: Use consistent rotation angle for each shape
    // Generate rotation only once per shape, store it, and reuse it
    // This prevents shapes from "shaking" when canvas is redrawn
    if (!rotationsRef.current[idx]) {
      rotationsRef.current[idx] = (Math.random() - 0.5) * 0.5;  // Random rotation up to ±0.25 radians
    }
    ctx.rotate(rotationsRef.current[idx]);
    
    // Set shape color (semi-transparent black)
    ctx.fillStyle = "rgba(0,0,0,0.7)";

    // FEATURE: Draw Different Shape Types
    ctx.beginPath();
    if (shape === "circle") {
      // Draw circle
      ctx.arc(0, 0, s, 0, Math.PI * 2);
    } else if (shape === "square") {
      // Draw square (centered at origin)
      ctx.rect(-s, -s, s * 2, s * 2);
    } else {
      // Draw triangle (pointing up)
      ctx.moveTo(0, -s);
      ctx.lineTo(s, s);
      ctx.lineTo(-s, s);
      ctx.closePath();
    }
    ctx.fill();
    
    // Restore canvas state
    ctx.restore();
  }

  /**
   * FEATURE: Handle Cell Click Selection
   * Processes user clicks on the canvas to select/deselect grid cells
   * 
   * This function:
   * 1. Converts click coordinates to canvas coordinates (handles scaling)
   * 2. Determines which grid cell was clicked
   * 3. Toggles cell selection (add if not selected, remove if selected)
   * 4. Updates visual feedback
   */
  function handleClick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // FEATURE: Coordinate Scaling
    // Canvas may be displayed at different size than internal resolution
    // Calculate scale factors to convert displayed coordinates to internal canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Scale click coordinates to match internal canvas coordinate system
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { x, y, size } = region;

    // FEATURE: Boundary Check
    // Only process clicks within the grid region
    if (cx < x || cx > x + size || cy < y || cy > y + size)
      return;

    // FEATURE: Cell Index Calculation
    // Convert click coordinates to grid cell row/column
    const col = Math.floor((cx - x) / (size / gridCols));
    const row = Math.floor((cy - y) / (size / gridRows));
    const idx = row * gridCols + col;

    // FEATURE: Toggle Selection
    // Add cell to selection if not selected, remove if already selected
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);

    // Update visual feedback (yellow borders on selected cells)
    drawUserSelections(next);
  }

  /**
   * FEATURE: Visual Feedback for Selections
   * Redraws the canvas with yellow borders around selected cells
   * 
   * FIX: Uses cached image instead of reloading to prevent flicker/shaking
   * 
   * This function:
   * 1. Uses cached image (no reload needed)
   * 2. Redraws grid and watermarks (with consistent rotations)
   * 3. Draws yellow borders around user-selected cells
   */
  function drawUserSelections(sel) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // FIX: Use cached image instead of reloading
    // This prevents the flicker/shaking caused by image reload
    const img = imageRef.current;
    
    if (!img) {
      // Image not loaded yet, wait for it
      return;
    }

    // Draw base image (from cache, instant)
    ctx.drawImage(img, 0, 0);
    
    // Redraw grid and watermarks (with consistent rotations)
    drawPuzzle(ctx);

    const { x, y, size } = region;
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    // FEATURE: Highlight Selected Cells
    // Draw yellow borders around selected cells
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;

    sel.forEach(idx => {
      // Convert index to row/column
      const row = Math.floor(idx / gridCols);
      const col = idx % gridCols;

      // Draw yellow border around the cell
      ctx.strokeRect(
        x + col * cellW,
        y + row * cellH,
        cellW,
        cellH
      );
    });
  }

  return (
    <div>
      {/* FEATURE: Instructions Display */}
      {/* Shows user which shape they need to find */}
      <h3>Select all <b>{targetShape}</b> shapes</h3>

      {/* FEATURE: Interactive Canvas */}
      {/* Displays image with grid and handles click events */}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ border: "1px solid #ccc", maxWidth: "400px" }}
      />

      <br /><br />

      {/* FEATURE: Validation Button */}
      {/* Submits selected cells for validation */}
      <button onClick={() => onValidate([...selected])}>
        Validate
      </button>
    </div>
  );
}
