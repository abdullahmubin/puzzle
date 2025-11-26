import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import PuzzleGrid from './components/PuzzleGrid';
import { createWatermarks } from './utils/createWatermarks';

// Main CAPTCHA app - handles camera -> puzzle -> result flow
export default function App() {
  // Current screen state
  const [screen, setScreen] = useState("camera");
  
  // Captured image data from camera
  const [captured, setCaptured] = useState(null);
  
  // Watermark stuff - shapes, colors, and what to find
  const [wm, setWm] = useState(null);
  
  // Did they pass or fail?
  const [result, setResult] = useState(null);

  // Key to force camera remount - needed to fix camera reset bug
  const [cameraKey, setCameraKey] = useState(0);

  // Reset for retry - go back to camera screen
  function resetChallenge() {
    setScreen("camera");
    setCaptured(null);
    setWm(null);
    setResult(null);
    // Force camera remount - had issues with camera not restarting properly
    setCameraKey(prev => prev + 1);
  }

  // User captured a photo - generate puzzle
  function handleCapture({ image, region }) {
    // Safety check - had some undefined data issues before
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

    // Show puzzle screen
    setScreen("puzzle");
  }

  // Bot detection - checks if timing patterns look human
  // Pretty basic but catches obvious automation
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
    const MIN_TIME_SECONDS = 2.0; // 2 seconds seems reasonable
    if (totalTimeSeconds < MIN_TIME_SECONDS) {
      isHuman = false;
      reasons.push(`Too fast: Completed in ${totalTimeSeconds.toFixed(2)}s (minimum: ${MIN_TIME_SECONDS}s)`);
    }

    // Check 2: Too slow? Probably just someone taking their time, not necessarily a bot
    const MAX_TIME_SECONDS = 300; // 5 min max
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

  // Validate puzzle - check bot detection first, then check answers
  function validatePuzzle(selectedIndices, timingData = null) {
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

    // Perfect match required - all correct selected, nothing extra
    let isValid = correctSet.size === userSet.size &&
      [...correctSet].every(i => userSet.has(i));

    setResult(isValid);
    setScreen("result");
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
                    Please try again to verify you're human.
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
      </div>
    </div>
  );
}
