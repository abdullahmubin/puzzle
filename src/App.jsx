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
   * FEATURE: Time-Based Detection - Validate Human Interaction
   * Analyzes timing patterns to detect automated solving attempts
   * 
   * @param {Object} timingData - Timing information from puzzle interaction
   * @param {number} timingData.puzzleStartTime - When puzzle screen appeared (performance.now())
   * @param {Array} timingData.clickTimestamps - Array of {timestamp, cellIndex, action}
   * @param {number} timingData.validationTime - When validate button was clicked (performance.now())
   * @returns {Object} - {isHuman: boolean, reasons: string[]}
   */
  function validateHumanInteraction(timingData) {
    if (!timingData) {
      return { isHuman: false, reasons: ['No timing data provided'] };
    }

    const { puzzleStartTime, clickTimestamps, validationTime } = timingData;
    const reasons = [];
    let isHuman = true;

    // Calculate total time spent on puzzle (in milliseconds)
    const totalTime = validationTime - puzzleStartTime;
    const totalTimeSeconds = totalTime / 1000;

    // DETECTION 1: Minimum Time Threshold
    // Humans need at least 2-3 seconds to understand and solve the puzzle
    // Automated tools can solve in milliseconds
    const MIN_TIME_SECONDS = 2.0;
    if (totalTimeSeconds < MIN_TIME_SECONDS) {
      isHuman = false;
      reasons.push(`Too fast: Completed in ${totalTimeSeconds.toFixed(2)}s (minimum: ${MIN_TIME_SECONDS}s)`);
    }

    // DETECTION 2: Maximum Time Threshold (optional - prevents timeout abuse)
    // If someone takes too long, might be automated with delays
    const MAX_TIME_SECONDS = 300; // 5 minutes
    if (totalTimeSeconds > MAX_TIME_SECONDS) {
      reasons.push(`Warning: Very long completion time (${totalTimeSeconds.toFixed(2)}s)`);
    }

    // DETECTION 3: Click Pattern Analysis
    // Automated tools often have very consistent click intervals
    if (clickTimestamps.length > 1) {
      const intervals = [];
      for (let i = 1; i < clickTimestamps.length; i++) {
        const interval = clickTimestamps[i].timestamp - clickTimestamps[i - 1].timestamp;
        intervals.push(interval);
      }

      // Calculate average and standard deviation of intervals
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // DETECTION 3a: Too Consistent Intervals (indicating automation)
      // Human clicks have natural variation, automated clicks are often too regular
      const COEFFICIENT_OF_VARIATION = stdDev / avgInterval;
      const MIN_CV = 0.15; // Minimum coefficient of variation for human-like behavior
      if (COEFFICIENT_OF_VARIATION < MIN_CV && intervals.length >= 3) {
        isHuman = false;
        reasons.push(`Suspicious click pattern: Too consistent intervals (CV: ${COEFFICIENT_OF_VARIATION.toFixed(3)})`);
      }

      // DETECTION 3b: Too Fast Clicks (sub-100ms intervals are suspicious)
      // Humans cannot reliably click faster than ~100ms apart
      const MIN_CLICK_INTERVAL_MS = 80;
      const tooFastClicks = intervals.filter(interval => interval < MIN_CLICK_INTERVAL_MS).length;
      if (tooFastClicks > 0) {
        isHuman = false;
        reasons.push(`Suspicious: ${tooFastClicks} click(s) with interval < ${MIN_CLICK_INTERVAL_MS}ms (human minimum: ~100ms)`);
      }

      // DETECTION 3c: Perfectly Timed Clicks (exactly same intervals)
      // Check if multiple intervals are identical (within 1ms tolerance)
      const uniqueIntervals = new Set(intervals.map(i => Math.round(i)));
      if (uniqueIntervals.size === 1 && intervals.length >= 3) {
        isHuman = false;
        reasons.push(`Suspicious: All click intervals are identical (${intervals[0].toFixed(2)}ms)`);
      }
    } else if (clickTimestamps.length === 0) {
      // DETECTION 4: No User Interactions
      // If puzzle was solved without any clicks, it's likely automated
      // (This shouldn't happen in normal flow, but could indicate programmatic solving)
      reasons.push('Warning: No click interactions recorded');
    }

    // DETECTION 5: Time Between First Click and Validation
    // If validation happens immediately after first click, might be automated
    if (clickTimestamps.length > 0) {
      const firstClickTime = clickTimestamps[0].timestamp;
      const timeToValidation = validationTime - firstClickTime;
      const MIN_THINKING_TIME_MS = 500; // Minimum 500ms to process and validate
      if (timeToValidation < MIN_THINKING_TIME_MS) {
        isHuman = false;
        reasons.push(`Too fast validation: ${timeToValidation.toFixed(2)}ms after first click (minimum: ${MIN_THINKING_TIME_MS}ms)`);
      }
    }

    return { isHuman, reasons };
  }

  /**
   * FEATURE: Validate User's Puzzle Selection
   * Called when user clicks "Validate" button
   * 
   * This function:
   * 1. Validates timing patterns to detect automated solving
   * 2. Finds all cells that should be selected (cells with target shape)
   * 3. Compares user's selection with correct answer
   * 4. Sets result and transitions to result screen
   */
  function validatePuzzle(selectedIndices, timingData = null) {
    // FEATURE: Time-Based Detection - Validate human interaction first
    const humanValidation = validateHumanInteraction(timingData);
    
    // If timing data indicates automation, fail immediately
    if (!humanValidation.isHuman) {
      console.warn('Automated solving detected:', humanValidation.reasons);
      setResult(false);
      setScreen("result");
      return;
    }

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
