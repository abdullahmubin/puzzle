import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import PuzzleGrid from './components/PuzzleGrid';
import { createWatermarks } from './utils/createWatermarks';

/**
 * Main app component that handles the CAPTCHA flow
 * 
 * Three screens:
 * - Camera: user takes a photo
 * - Puzzle: user selects matching shapes
 * - Result: shows if they passed or failed
 */
export default function App() {
  // Current screen: "camera", "puzzle", or "result"
  const [screen, setScreen] = useState("camera");
  
  // Captured image and grid info from camera
  const [captured, setCaptured] = useState(null);
  
  // Watermark data: which cells have shapes/colors, and what to find
  const [wm, setWm] = useState(null);
  
  // Validation result: true if passed, false if failed
  const [result, setResult] = useState(null);

  // Key to force camera component to remount on reset
  const [cameraKey, setCameraKey] = useState(0);

  // Attempt tracking for progressive tolerance
  const [attemptCount, setAttemptCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const MAX_ATTEMPTS = 3;

  // Tolerance configuration - decreases with each attempt
  const TOLERANCE_CONFIG = {
    1: { allowedMistakes: 2, description: "You can make up to 2 mistakes" }, // First attempt: lenient
    2: { allowedMistakes: 1, description: "You can make up to 1 mistake" }, // Second attempt: moderate
    3: { allowedMistakes: 0, description: "Perfect match required" }, // Third attempt: strict
  };

  // Reset everything to start a new challenge
  // Note: attemptCount is NOT reset here - it only resets on success
  // This allows progressive tolerance across retries
  function resetChallenge() {
    setScreen("camera");
    setCaptured(null);
    setWm(null);
    setResult(null);
    // Change key to force camera component to remount
    setCameraKey(prev => prev + 1);
  }

  // Reset everything including attempt count (for starting completely new challenge)
  function resetChallengeCompletely() {
    setScreen("camera");
    setCaptured(null);
    setWm(null);
    setResult(null);
    setAttemptCount(0);
    setIsBlocked(false);
    setCameraKey(prev => prev + 1);
  }

  // Called when user captures a photo
  function handleCapture({ image, region }) {
    // Make sure we got valid data
    if (!image || !region) {
      console.error('Invalid capture data:', { image, region });
      return;
    }

    // 4x4 grid = 16 cells total
    const gridRows = 4;
    const gridCols = 4;
    
    // Generate random watermarks and pick a target shape/color
    // Half the cells get watermarks
    const { watermarks, targetShape, targetColor } = createWatermarks(gridRows, gridCols);

    // Save everything
    setCaptured({ image, region, gridRows, gridCols });
    setWm({ watermarks, targetShape, targetColor });
    
    // Go to puzzle screen
    setScreen("puzzle");
  }

  /**
   * Checks if the user interaction looks human or automated
   * Looks at timing patterns, click intervals, etc.
   */
  function validateHumanInteraction(timingData) {
    if (!timingData) {
      return { isHuman: false, reasons: ['No timing data provided'] };
    }

    const { puzzleStartTime, clickTimestamps, validationTime } = timingData;
    const reasons = [];
    let isHuman = true;

    // How long did they take?
    const totalTime = validationTime - puzzleStartTime;
    const totalTimeSeconds = totalTime / 1000;

    // Check 1: Too fast? Bots can solve instantly, humans need a few seconds
    const MIN_TIME_SECONDS = 2.0;
    if (totalTimeSeconds < MIN_TIME_SECONDS) {
      isHuman = false;
      reasons.push(`Too fast: Completed in ${totalTimeSeconds.toFixed(2)}s (minimum: ${MIN_TIME_SECONDS}s)`);
    }

    // Check 2: Too slow? Might be a bot with artificial delays
    const MAX_TIME_SECONDS = 300; // 5 minutes
    if (totalTimeSeconds > MAX_TIME_SECONDS) {
      reasons.push(`Warning: Very long completion time (${totalTimeSeconds.toFixed(2)}s)`);
    }

    // Check 3: Look at click patterns
    // Bots tend to click at perfectly regular intervals
    if (clickTimestamps.length > 1) {
      const intervals = [];
      for (let i = 1; i < clickTimestamps.length; i++) {
        const interval = clickTimestamps[i].timestamp - clickTimestamps[i - 1].timestamp;
        intervals.push(interval);
      }

      // Calculate how consistent the intervals are
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Check 3a: Are intervals too consistent? Humans have natural variation
      const COEFFICIENT_OF_VARIATION = stdDev / avgInterval;
      const MIN_CV = 0.15; // Need at least this much variation to look human
      if (COEFFICIENT_OF_VARIATION < MIN_CV && intervals.length >= 3) {
        isHuman = false;
        reasons.push(`Suspicious click pattern: Too consistent intervals (CV: ${COEFFICIENT_OF_VARIATION.toFixed(3)})`);
      }

      // Check 3b: Clicking too fast? Humans can't reliably click faster than ~100ms apart
      const MIN_CLICK_INTERVAL_MS = 80;
      const tooFastClicks = intervals.filter(interval => interval < MIN_CLICK_INTERVAL_MS).length;
      if (tooFastClicks > 0) {
        isHuman = false;
        reasons.push(`Suspicious: ${tooFastClicks} click(s) with interval < ${MIN_CLICK_INTERVAL_MS}ms (human minimum: ~100ms)`);
      }

      // Check 3c: All intervals exactly the same? That's definitely a bot
      const uniqueIntervals = new Set(intervals.map(i => Math.round(i)));
      if (uniqueIntervals.size === 1 && intervals.length >= 3) {
        isHuman = false;
        reasons.push(`Suspicious: All click intervals are identical (${intervals[0].toFixed(2)}ms)`);
      }
    } else if (clickTimestamps.length === 0) {
      // No clicks at all? That's weird
      reasons.push('Warning: No click interactions recorded');
    }

    // Check 4: Did they validate immediately after first click?
    // Humans need a moment to think
    if (clickTimestamps.length > 0) {
      const firstClickTime = clickTimestamps[0].timestamp;
      const timeToValidation = validationTime - firstClickTime;
      const MIN_THINKING_TIME_MS = 500; // Need at least 500ms to think about it
      if (timeToValidation < MIN_THINKING_TIME_MS) {
        isHuman = false;
        reasons.push(`Too fast validation: ${timeToValidation.toFixed(2)}ms after first click (minimum: ${MIN_THINKING_TIME_MS}ms)`);
      }
    }

    return { isHuman, reasons };
  }

  // Called when user clicks "Validate"
  function validatePuzzle(selectedIndices, timingData = null) {
    // Check if user is blocked
    if (isBlocked) {
      setResult(false);
      setScreen("result");
      return;
    }

    // First check if the timing looks human
    const humanValidation = validateHumanInteraction(timingData);
    
    // If it looks like a bot, fail immediately
    if (!humanValidation.isHuman) {
      console.warn('Automated solving detected:', humanValidation.reasons);
      setResult(false);
      setScreen("result");
      return;
    }

    // Find all cells that match both the target shape AND color
    if (!wm.targetShape || !wm.targetColor) {
      console.error('Missing target shape or color:', { targetShape: wm.targetShape, targetColor: wm.targetColor });
      setResult(false);
      setScreen("result");
      return;
    }

    const correct = wm.watermarks
      .filter(w => w.shape === wm.targetShape && w.color === wm.targetColor)
      .map(w => w.idx);

    // Compare what they selected vs what's correct
    const correctSet = new Set(correct);
    const userSet = new Set(selectedIndices);

    // Calculate mistakes
    const correctSelected = [...userSet].filter(i => correctSet.has(i)).length;
    const incorrectSelected = userSet.size - correctSelected;
    const missedCorrect = correctSet.size - correctSelected;
    const totalMistakes = incorrectSelected + missedCorrect;

    // Get tolerance for current attempt
    const currentAttempt = attemptCount + 1;
    const tolerance = TOLERANCE_CONFIG[currentAttempt] || TOLERANCE_CONFIG[3];
    const allowedMistakes = tolerance.allowedMistakes;

    // Validate against tolerance
    let isValid = false;
    if (totalMistakes <= allowedMistakes && correctSet.size > 0) {
      // Additional check: ensure reasonable accuracy even with tolerance
      const accuracy = correctSelected / correctSet.size;
      if (currentAttempt === 1 && allowedMistakes > 0) {
        // First attempt with tolerance: require at least 80% accuracy
        isValid = accuracy >= 0.8 && totalMistakes <= allowedMistakes;
      } else if (allowedMistakes === 0) {
        // Perfect match required (attempt 3)
        isValid = correctSet.size === userSet.size &&
      [...correctSet].every(i => userSet.has(i));
      } else {
        // Attempt 2 with tolerance 1: allow mistakes but require good accuracy
        isValid = accuracy >= 0.9 && totalMistakes <= allowedMistakes;
      }
    }

    if (isValid) {
      // Success: reset attempt count
      setAttemptCount(0);
      setResult(true);
      setScreen("result");
    } else {
      // Failure: increment attempt count
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      if (newAttemptCount >= MAX_ATTEMPTS) {
        // Block user after max attempts
        setIsBlocked(true);
        setResult(false);
        setScreen("result");
      } else {
        // Allow retry with stricter tolerance
        setResult(false);
    setScreen("result");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header Section with Title and Subtitle */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Visual CAPTCHA Challenge
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400">
            Prove you're human by completing the visual puzzle
          </p>
        </div>

        {/* Main Content Container */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 md:p-8">
      {/* Camera screen */}
      {screen === "camera" && (
            <CameraCapture key={cameraKey} onCaptured={handleCapture} />
      )}

      {/* Puzzle screen */}
      {screen === "puzzle" && captured && wm && (
        <PuzzleGrid
          imageDataUrl={captured.image}
          region={captured.region}
          gridRows={captured.gridRows}
          gridCols={captured.gridCols}
          watermarks={wm.watermarks}
          targetShape={wm.targetShape}
          targetColor={wm.targetColor}
          attemptCount={attemptCount}
          maxAttempts={MAX_ATTEMPTS}
          onValidate={validatePuzzle}
        />
      )}

      {/* Result screen */}
      {screen === "result" && (
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Result
              </h2>
          {result ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
                    <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                    You passed the CAPTCHA!
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    You've successfully verified that you're human.
                  </p>
                  <button
                    onClick={resetChallengeCompletely}
                    className="mt-6 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    Play Again
                  </button>
                </div>
          ) : isBlocked ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                    Maximum Attempts Reached
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    You have exceeded the maximum number of attempts. Please start a new challenge.
                  </p>
                  <button
                    onClick={resetChallengeCompletely}
                    className="mt-6 px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    Start New Challenge
                  </button>
                </div>
          ) : (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                    CAPTCHA Failed
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Attempt {attemptCount + 1} of {MAX_ATTEMPTS}
                  </p>
                  {attemptCount + 1 < MAX_ATTEMPTS && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        {TOLERANCE_CONFIG[attemptCount + 2]?.description || "Next attempt will be stricter"}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={resetChallenge}
                    className="mt-6 px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    Try Again
                  </button>
                </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
