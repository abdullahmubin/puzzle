/**
 * Generates random watermarks for the puzzle
 * Picks 50% of cells, assigns random shapes and colors, then picks a target
 */
export function createWatermarks(rows, cols) {
    const total = rows * cols;
    const indices = [...Array(total).keys()];
  
    // Shuffle indices randomly (Fisher-Yates)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  
    // Pick half the cells for watermarks
    const half = Math.floor(total / 2);
    const chosen = indices.slice(0, half);
  
    const shapes = ["triangle", "square", "circle"];
    const colors = ["red", "green", "blue"];
  
    // Assign random shape and color to each chosen cell
    const watermarks = chosen.map(idx => ({
      idx,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
  
    // Pick a random target shape and color
    const targetShape = shapes[Math.floor(Math.random() * shapes.length)];
    const targetColor = colors[Math.floor(Math.random() * colors.length)];
  
    return { watermarks, targetShape, targetColor };
  }
  