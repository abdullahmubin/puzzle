import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import PuzzleGrid from './components/PuzzleGrid';
import { createWatermarks } from './utils/createWatermarks';

/**
 * MAIN APP COMPONENT - Manages the overall CAPTCHA flow
 * 
 * This component controls the three-screen flow:
 * 1. Camera Capture Screen - User takes a photo
 * 2. Puzzle Grid Screen - User selects shapes
 * 3. Result Screen - Shows pass/fail result
 */
export default function App() {
  // STATE MANAGEMENT: Controls which screen is currently displayed
  // Possible values: "camera", "puzzle", "result"
  const [screen, setScreen] = useState("camera");
  
  // STATE MANAGEMENT: Stores the captured image and region data from camera
  // Contains: { image, region, gridRows, gridCols }
  const [captured, setCaptured] = useState(null);
  
  // STATE MANAGEMENT: Stores watermark data (which cells have watermarks and target shape)
  // Contains: { watermarks: [{idx, shape}], targetShape }
  const [wm, setWm] = useState(null);
  
  // STATE MANAGEMENT: Stores validation result (true = passed, false = failed)
  const [result, setResult] = useState(null);

  /**
   * FEATURE: Handle Camera Capture
   * Called when user captures a photo from the camera
   * 
   * This function:
   * 1. Generates the puzzle grid configuration (4x4)
   * 2. Creates random watermarks for half the cells
   * 3. Saves captured image and watermark data
   * 4. Transitions to the puzzle screen
   */
  function handleCapture({ image, region }) {
    // Generate grid configuration - fixed 4x4 grid (16 cells total)
    const gridRows = 4;
    const gridCols = 4;
    
    // FEATURE: Generate random watermarks and target shape
    // This creates watermarks on 50% of cells and picks a random target shape
    const { watermarks, targetShape } = createWatermarks(gridRows, gridCols);

    // Save captured image data and grid configuration
    setCaptured({ image, region, gridRows, gridCols });
    
    // Save watermark data (which cells have which shapes, and what to find)
    setWm({ watermarks, targetShape });

    // Navigate to puzzle screen
    setScreen("puzzle");
  }

  /**
   * FEATURE: Validate User's Puzzle Selection
   * Called when user clicks "Validate" button
   * 
   * This function:
   * 1. Finds all cells that should be selected (cells with target shape)
   * 2. Compares user's selection with correct answer
   * 3. Sets result and transitions to result screen
   */
  function validatePuzzle(selectedIndices) {
    // Find all cells that have the target shape (correct answers)
    const correct = wm.watermarks
      .filter(w => w.shape === wm.targetShape)
      .map(w => w.idx);

    // Convert to Sets for easy comparison
    const correctSet = new Set(correct);
    const userSet = new Set(selectedIndices);

    // FEATURE: Validation Logic
    // User passes if:
    // - They selected the same number of cells as correct answers
    // - All their selections match the correct answers exactly
    let isValid = correctSet.size === userSet.size &&
      [...correctSet].every(i => userSet.has(i));

    // Save result and show result screen
    setResult(isValid);
    setScreen("result");
  }

  return (
    <div style={{ padding: 20 }}>
      {/* SCREEN 1: Camera Capture Feature */}
      {/* Shows camera interface with animated square overlay */}
      {screen === "camera" && (
        <CameraCapture onCaptured={handleCapture} />
      )}

      {/* SCREEN 2: Puzzle Grid Feature */}
      {/* Shows captured image with grid and watermarks, user selects cells */}
      {screen === "puzzle" && captured && wm && (
        <PuzzleGrid
          imageDataUrl={captured.image}
          region={captured.region}
          gridRows={captured.gridRows}
          gridCols={captured.gridCols}
          watermarks={wm.watermarks}
          targetShape={wm.targetShape}
          onValidate={validatePuzzle}
        />
      )}

      {/* SCREEN 3: Result Display Feature */}
      {/* Shows pass/fail message and restart option */}
      {screen === "result" && (
        <div>
          <h2>Result</h2>
          {result ? (
            <p style={{ color: "green" }}>✔ You passed the CAPTCHA</p>
          ) : (
            <p style={{ color: "red" }}>✖ CAPTCHA failed</p>
          )}

          <button onClick={() => window.location.reload()}>
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
