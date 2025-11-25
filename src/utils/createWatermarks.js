/**
 * WATERMARK GENERATION UTILITY
 * 
 * FEATURE: Random Watermark Distribution with Color Tints
 * 
 * This function creates a random puzzle configuration:
 * 1. Randomly selects 50% of grid cells to receive watermarks
 * 2. Assigns random shapes (triangle, square, circle) to those cells
 * 3. Assigns random color tints (red, green, blue) to those cells
 * 4. Selects a random target shape and color for the user to find
 * 
 * @param {number} rows - Number of rows in the grid (e.g., 4)
 * @param {number} cols - Number of columns in the grid (e.g., 4)
 * @returns {Object} - { watermarks: [{idx, shape, color}], targetShape: string, targetColor: string }
 */
export function createWatermarks(rows, cols) {
    // Calculate total number of cells in grid
    const total = rows * cols;
    
    // Create array of all cell indices [0, 1, 2, ..., total-1]
    const indices = [...Array(total).keys()];
  
    // FEATURE: Fisher-Yates Shuffle Algorithm
    // Randomly shuffles the indices array to ensure random cell selection
    // This ensures watermarks are distributed randomly across the grid
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  
    // FEATURE: Select Half of Cells for Watermarks
    // Exactly 50% of cells will have watermarks (e.g., 8 out of 16 for 4x4 grid)
    const half = Math.floor(total / 2);
    const chosen = indices.slice(0, half);  // Take first half of shuffled indices
  
    // Available shape types
    const shapes = ["triangle", "square", "circle"];
    
    // FEATURE: Available color tints
    // Red, green, and blue color tints for watermarks
    const colors = ["red", "green", "blue"];
  
    // FEATURE: Assign Random Shapes and Colors to Selected Cells
    // Each selected cell gets a randomly chosen shape and color
    const watermarks = chosen.map(idx => ({
      idx,  // Cell index (0-15 for 4x4 grid)
      shape: shapes[Math.floor(Math.random() * shapes.length)],  // Random shape
      color: colors[Math.floor(Math.random() * colors.length)]  // Random color tint
    }));
  
    // FEATURE: Select Target Shape and Color
    // Randomly choose which shape and color combination the user needs to find
    // This determines which cells are "correct" answers (must match BOTH shape AND color)
    const targetShape = shapes[Math.floor(Math.random() * shapes.length)];
    const targetColor = colors[Math.floor(Math.random() * colors.length)];
  
    // Return watermark configuration
    // watermarks: Array of cells with watermarks, their shapes, and colors
    // targetShape: The shape user must find to pass the CAPTCHA
    // targetColor: The color tint user must find to pass the CAPTCHA
    return { watermarks, targetShape, targetColor };
  }
  