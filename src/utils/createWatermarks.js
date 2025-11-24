/**
 * WATERMARK GENERATION UTILITY
 * 
 * FEATURE: Random Watermark Distribution
 * 
 * This function creates a random puzzle configuration:
 * 1. Randomly selects 50% of grid cells to receive watermarks
 * 2. Assigns random shapes (triangle, square, circle) to those cells
 * 3. Selects a random target shape for the user to find
 * 
 * @param {number} rows - Number of rows in the grid (e.g., 4)
 * @param {number} cols - Number of columns in the grid (e.g., 4)
 * @returns {Object} - { watermarks: [{idx, shape}], targetShape: string }
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
  
    // FEATURE: Assign Random Shapes to Selected Cells
    // Each selected cell gets a randomly chosen shape
    const watermarks = chosen.map(idx => ({
      idx,  // Cell index (0-15 for 4x4 grid)
      shape: shapes[Math.floor(Math.random() * shapes.length)]  // Random shape
    }));
  
    // FEATURE: Select Target Shape
    // Randomly choose which shape the user needs to find
    // This is the shape that determines which cells are "correct" answers
    const targetShape = shapes[Math.floor(Math.random() * shapes.length)];
  
    // Return watermark configuration
    // watermarks: Array of cells with watermarks and their shapes
    // targetShape: The shape user must find to pass the CAPTCHA
    return { watermarks, targetShape };
  }
  