export function createWatermarks(rows, cols) {
    const total = rows * cols;
    const indices = [...Array(total).keys()];
  
    // shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  
    // half of the sectors get watermarks
    const half = Math.floor(total / 2);
    const chosen = indices.slice(0, half);
  
    const shapes = ["triangle", "square", "circle"];
  
    const watermarks = chosen.map(idx => ({
      idx,
      shape: shapes[Math.floor(Math.random() * shapes.length)]
    }));
  
    const targetShape = shapes[Math.floor(Math.random() * shapes.length)];
  
    return { watermarks, targetShape };
  }
  