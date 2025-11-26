import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import PuzzleGrid from './components/PuzzleGrid';
import { createWatermarks } from './utils/createWatermarks';

// Main CAPTCHA app - handles the whole flow
// Three screens: camera -> puzzle -> result
export default function App() {
  // Screen state: "camera", "puzzle", or "result"
  const [screen, setScreen] = useState("camera");
  
  // Captured image data from camera
  const [captured, setCaptured] = useState(null);
  
  // Watermark stuff - which cells have shapes/colors, what to find
  const [wm, setWm] = useState(null);
  
  // Did they pass or fail?
  const [result, setResult] = useState(null);

  // Key to force camera remount - had issues with camera not resetting properly
  const [cameraKey, setCameraKey] = useState(0);

  // Track attempts for progressive tolerance
  const [attemptCount, setAttemptCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const MAX_ATTEMPTS = 3; // TODO: maybe make this configurable?

  // Tolerance gets stricter with each attempt
  // First try is lenient, then we get stricter
  const TOLERANCE_CONFIG = {
    1: { allowedMistakes: 2, description: "You can make up to 2 mistakes" },
    2: { allowedMistakes: 1, description: "You can make up to 1 mistake" },
    3: { allowedMistakes: 0, description: "Perfect match required" },
  };

  // Reset for retry - keeps attempt count so tolerance gets stricter
  // Only resets attempt count on success
  function resetChallenge() {
    setScreen("camera");
    setCaptured(null);
    setWm(null);
    setResult(null);
    // Force camera remount - this was needed to fix a bug where camera wouldn't restart
    setCameraKey(prev => prev + 1);
  }

  // Full reset - starts completely fresh (used when blocked or "Play Again")
  function resetChallengeCompletely() {
    setScreen("camera");
    setCaptured(null);
    setWm(null);
    setResult(null);
    setAttemptCount(0);
    setIsBlocked(false);
    setCameraKey(prev => prev + 1);
  }

  // User captured a photo - generate puzzle and move to next screen
  function handleCapture({ image, region }) {
    // Safety check - had some issues with undefined data before
    if (!image || !region) {
      console.error('Invalid capture data:', { image, region });
      return;
    }

    // 4x4 grid - 16 cells total
    const gridRows = 4;
    const gridCols = 4;
    
    // Generate watermarks - half the cells get random shapes/colors
    const { watermarks, targetShape, targetColor } = createWatermarks(gridRows, gridCols);

    // Store everything we need
    setCaptured({ image, region, gridRows, gridCols });
    setWm({ watermarks, targetShape, targetColor });
    
    // Show the puzzle
    setScreen("puzzle");
  }

  // Bot detection - checks if interaction timing looks human
  // This is pretty basic but catches obvious automation
  function validateHumanInteraction(timingData) {
    if (!timingData) {
      return { isHuman: false, reasons: ['No timing data provided'] };
    }

    const { puzzleStartTime, clickTimestamps, validationTime } = timingData;
    const reasons = [];
    let isHuman = true;

    // Total time taken
    const totalTime = validationTime - puzzleStartTime;
    const totalTimeSeconds = totalTime / 1000;

    // Check 1: Too fast? Bots solve instantly, humans need time to think
    const MIN_TIME_SECONDS = 2.0; // 2 seconds minimum seems reasonable
    if (totalTimeSeconds < MIN_TIME_SECONDS) {
      isHuman = false;
      reasons.push(`Too fast: Completed in ${totalTimeSeconds.toFixed(2)}s (minimum: ${MIN_TIME_SECONDS}s)`);
    }

    // Check 2: Too slow? Might be suspicious but not necessarily a bot
    const MAX_TIME_SECONDS = 300; // 5 min max - probably just someone taking their time
    if (totalTimeSeconds > MAX_TIME_SECONDS) {
      reasons.push(`Warning: Very long completion time (${totalTimeSeconds.toFixed(2)}s)`);
    }

    // Check 3: Look at click patterns - bots click at perfect intervals
    if (clickTimestamps.length > 1) {
      const intervals = [];
      for (let i = 1; i < clickTimestamps.length; i++) {
        const interval = clickTimestamps[i].timestamp - clickTimestamps[i - 1].timestamp;
        intervals.push(interval);
      }

      // Calculate consistency (coefficient of variation)
      // Lower CV = more consistent = more bot-like
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Check 3a: Too consistent? Humans have natural variation
      const COEFFICIENT_OF_VARIATION = stdDev / avgInterval;
      const MIN_CV = 0.15; // This threshold seems to work well
      if (COEFFICIENT_OF_VARIATION < MIN_CV && intervals.length >= 3) {
        isHuman = false;
        reasons.push(`Suspicious click pattern: Too consistent intervals (CV: ${COEFFICIENT_OF_VARIATION.toFixed(3)})`);
      }

      // Check 3b: Clicking too fast? Humans can't click faster than ~100ms reliably
      const MIN_CLICK_INTERVAL_MS = 80; // A bit below 100ms to account for edge cases
      const tooFastClicks = intervals.filter(interval => interval < MIN_CLICK_INTERVAL_MS).length;
      if (tooFastClicks > 0) {
        isHuman = false;
        reasons.push(`Suspicious: ${tooFastClicks} click(s) with interval < ${MIN_CLICK_INTERVAL_MS}ms (human minimum: ~100ms)`);
      }

      // Check 3c: All intervals identical? Definitely automated
      const uniqueIntervals = new Set(intervals.map(i => Math.round(i)));
      if (uniqueIntervals.size === 1 && intervals.length >= 3) {
        isHuman = false;
        reasons.push(`Suspicious: All click intervals are identical (${intervals[0].toFixed(2)}ms)`);
      }
    } else if (clickTimestamps.length === 0) {
      // No clicks? That's odd but not necessarily a bot
      reasons.push('Warning: No click interactions recorded');
    }

    // Check 4: Did they validate right after first click? Humans need thinking time
    if (clickTimestamps.length > 0) {
      const firstClickTime = clickTimestamps[0].timestamp;
      const timeToValidation = validationTime - firstClickTime;
      const MIN_THINKING_TIME_MS = 500; // Half a second seems reasonable
      if (timeToValidation < MIN_THINKING_TIME_MS) {
        isHuman = false;
        reasons.push(`Too fast validation: ${timeToValidation.toFixed(2)}ms after first click (minimum: ${MIN_THINKING_TIME_MS}ms)`);
      }
    }

    return { isHuman, reasons };
  }

  // Validate the puzzle - check bot detection first, then check answers
  function validatePuzzle(selectedIndices, timingData = null) {
    // Already blocked? Don't let them continue
    if (isBlocked) {
      setResult(false);
      setScreen("result");
      return;
    }

    // Check bot detection first - fail fast if automated
    const humanValidation = validateHumanInteraction(timingData);
    
    if (!humanValidation.isHuman) {
      console.warn('Automated solving detected:', humanValidation.reasons);
      setResult(false);
      setScreen("result");
      return;
    }

    // Safety check - had a bug where target wasn't set
    if (!wm.targetShape || !wm.targetColor) {
      console.error('Missing target shape or color:', { targetShape: wm.targetShape, targetColor: wm.targetColor });
      setResult(false);
      setScreen("result");
      return;
    }

    // Find all correct cells (must match both shape AND color)
    const correct = wm.watermarks
      .filter(w => w.shape === wm.targetShape && w.color === wm.targetColor)
      .map(w => w.idx);

    // Compare selections
    const correctSet = new Set(correct);
    const userSet = new Set(selectedIndices);

    // Count mistakes: wrong selections + missed correct ones
    const correctSelected = [...userSet].filter(i => correctSet.has(i)).length;
    const incorrectSelected = userSet.size - correctSelected;
    const missedCorrect = correctSet.size - correctSelected;
    const totalMistakes = incorrectSelected + missedCorrect;

    // Get tolerance for this attempt
    const currentAttempt = attemptCount + 1;
    const tolerance = TOLERANCE_CONFIG[currentAttempt] || TOLERANCE_CONFIG[3];
    const allowedMistakes = tolerance.allowedMistakes;

    // Check if valid based on tolerance
    let isValid = false;
    if (totalMistakes <= allowedMistakes && correctSet.size > 0) {
      // Calculate accuracy - need to penalize wrong selections
      // Fixed a bug where selecting wrong answers didn't reduce accuracy
      // Now: selectionAccuracy = correct / (correct + wrong)
      // This way if you select 1 correct + 1 wrong, accuracy is only 50%
      const totalSelected = correctSelected + incorrectSelected;
      const selectionAccuracy = totalSelected > 0 ? correctSelected / totalSelected : 0;
      
      // Also check if they found most/all correct answers
      const correctAccuracy = correctSelected / correctSet.size;
      
      if (currentAttempt === 1 && allowedMistakes > 0) {
        // First try: lenient but still need good accuracy
        // Must find 80% of correct answers AND have 80% selection accuracy (no too many wrong clicks)
        isValid = correctAccuracy >= 0.8 && selectionAccuracy >= 0.8 && totalMistakes <= allowedMistakes;
      } else if (allowedMistakes === 0) {
        // Third try: perfect match only - all correct, zero wrong
        isValid = correctSet.size === userSet.size &&
      [...correctSet].every(i => userSet.has(i)) && incorrectSelected === 0;
      } else {
        // Second try: stricter - 90% for both metrics
        isValid = correctAccuracy >= 0.9 && selectionAccuracy >= 0.9 && totalMistakes <= allowedMistakes;
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
            Reactjs Code Challenge
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
        
        {/* Footer with developer information */}
        <footer className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-6">
          <p className="mb-2">
            <strong>React.js Code Challenge</strong>
          </p>
          <p className="mb-1">
            Developed by <strong>Abdullah al Mubin</strong>
          </p>
          <div className="mb-3 mt-3 text-xs">
            <p className="mb-1">
              <strong>Task Completion:</strong>
            </p>
            <p className="mb-1">
              • Task 1 & Task 2: Completed (Branch: <a 
                href="https://github.com/abdullahmubin/puzzle/tree/task1-task2-completed" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded"
              >
                task1-task2-completed
              </a>)
            </p>
            <p>
              • Task 1, Task 2 & Task 3: Completed (Branches: <a 
                href="https://github.com/abdullahmubin/puzzle/tree/task1-task2-task3-completed" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded"
              >
                task1-task2-task3-completed
              </a> | <a 
                href="https://github.com/abdullahmubin/puzzle/tree/master" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded"
              >
                master
              </a>)
            </p>
          </div>
          <div className="flex justify-center gap-4 flex-wrap text-xs">
            <a 
              href="mailto:amubin19@gmail.com" 
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              📧 amubin19@gmail.com
            </a>
            <a 
              href="https://wa.me/8801686578649" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              📱 +8801686578649
            </a>
            <span>📍 Dhaka, Bangladesh</span>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <a 
              href="https://github.com/abdullahmubin" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              GitHub
            </a>
            <a 
              href="https://www.linkedin.com/in/abdullah-al-mubin/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
