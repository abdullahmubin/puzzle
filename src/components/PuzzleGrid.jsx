import { useEffect, useRef, useState } from 'react';

export default function PuzzleGrid({
  imageDataUrl,
  region,
  gridRows,
  gridCols,
  watermarks,
  targetShape,
  onValidate
}) {

  const canvasRef = useRef(null);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);
      drawPuzzle(ctx);
    };
    img.src = imageDataUrl;
  }, []);

  function drawPuzzle(ctx) {
    const { x, y, size } = region;
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    // draw grid
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;

    for (let r = 0; r <= gridRows; r++) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * cellH);
      ctx.lineTo(x + size, y + r * cellH);
      ctx.stroke();
    }

    for (let c = 0; c <= gridCols; c++) {
      ctx.beginPath();
      ctx.moveTo(x + c * cellW, y);
      ctx.lineTo(x + c * cellW, y + size);
      ctx.stroke();
    }

    // draw watermarks
    watermarks.forEach(w => {
      drawShape(ctx, w.shape, w.idx);
    });
  }

  function drawShape(ctx, shape, idx) {
    const { x, y, size } = region;
    const cellW = size / gridCols;
    const cellH = size / gridRows;

    const row = Math.floor(idx / gridCols);
    const col = idx % gridCols;

    const cx = x + col * cellW + cellW / 2;
    const cy = y + row * cellH + cellH / 2;
    const s = Math.min(cellW, cellH) * 0.3;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.random() - 0.5) * 0.5);
    ctx.fillStyle = "rgba(0,0,0,0.7)";

    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(0, 0, s, 0, Math.PI * 2);
    } else if (shape === "square") {
      ctx.rect(-s, -s, s * 2, s * 2);
    } else {
      ctx.moveTo(0, -s);
      ctx.lineTo(s, s);
      ctx.lineTo(-s, s);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  function handleClick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors to convert displayed coordinates to internal canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Scale click coordinates to match internal canvas coordinate system
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { x, y, size } = region;

    if (cx < x || cx > x + size || cy < y || cy > y + size)
      return;

    const col = Math.floor((cx - x) / (size / gridCols));
    const row = Math.floor((cy - y) / (size / gridRows));
    const idx = row * gridCols + col;

    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);

    // outline selection
    drawUserSelections(next);
  }

  function drawUserSelections(sel) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      drawPuzzle(ctx);

      const { x, y, size } = region;
      const cellW = size / gridCols;
      const cellH = size / gridRows;

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
    };

    img.src = imageDataUrl;
  }

  return (
    <div>
      <h3>Select all <b>{targetShape}</b> shapes</h3>

      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ border: "1px solid #ccc", maxWidth: "400px" }}
      />

      <br /><br />

      <button onClick={() => onValidate([...selected])}>
        Validate
      </button>
    </div>
  );
}
