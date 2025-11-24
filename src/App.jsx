import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import PuzzleGrid from './components/PuzzleGrid';
import { createWatermarks } from './utils/createWatermarks';

export default function App() {
  const [screen, setScreen] = useState("camera");
  const [captured, setCaptured] = useState(null);
  const [wm, setWm] = useState(null);
  const [result, setResult] = useState(null);

  function handleCapture({ image, region }) {
    // generate grid + watermarks
    const gridRows = 4;
    const gridCols = 4;
    const { watermarks, targetShape } = createWatermarks(gridRows, gridCols);

    setCaptured({ image, region, gridRows, gridCols });
    setWm({ watermarks, targetShape });

    setScreen("puzzle");
  }

  function validatePuzzle(selectedIndices) {
    const correct = wm.watermarks
      .filter(w => w.shape === wm.targetShape)
      .map(w => w.idx);

    const correctSet = new Set(correct);
    const userSet = new Set(selectedIndices);

    let isValid = correctSet.size === userSet.size &&
      [...correctSet].every(i => userSet.has(i));

    setResult(isValid);
    setScreen("result");
  }

  return (
    <div style={{ padding: 20 }}>
      {screen === "camera" && (
        <CameraCapture onCaptured={handleCapture} />
      )}

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
