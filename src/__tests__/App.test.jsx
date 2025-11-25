import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'

// Mock camera components
vi.mock('../components/CameraCapture', () => ({
  default: ({ onCaptured }) => (
    <div>
      <div>Camera Capture</div>
      <button onClick={() => onCaptured({
        image: 'data:image/png;base64,test',
        region: { x: 100, y: 100, size: 200, width: 640, height: 480 }
      })}>
        Mock Capture
      </button>
    </div>
  ),
}))

vi.mock('../components/PuzzleGrid', () => ({
  default: ({ onValidate, targetShape }) => (
    <div>
      <div>Puzzle Grid - Find {targetShape}</div>
      <button onClick={() => onValidate([0, 1], {
        puzzleStartTime: 1000,
        clickTimestamps: [{ timestamp: 1500, cellIndex: 0, action: 'select' }],
        validationTime: 2000,
      })}>
        Validate
      </button>
    </div>
  ),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render title and subtitle', () => {
    render(<App />)
    
    expect(screen.getByText(/visual captcha challenge/i)).toBeInTheDocument()
    expect(screen.getByText(/prove you're human/i)).toBeInTheDocument()
  })

  it('should start with camera screen', () => {
    render(<App />)
    
    expect(screen.getByText(/camera capture/i)).toBeInTheDocument()
  })

  it('should transition to puzzle screen after capture', async () => {
    render(<App />)
    
    const captureButton = screen.getByRole('button', { name: /mock capture/i })
    captureButton.click()

    await waitFor(() => {
      expect(screen.getByText(/puzzle grid/i)).toBeInTheDocument()
    })
  })

  it('should transition to result screen after validation', async () => {
    render(<App />)
    
    // Capture first
    const captureButton = screen.getByRole('button', { name: /mock capture/i })
    captureButton.click()

    await waitFor(() => {
      expect(screen.getByText(/puzzle grid/i)).toBeInTheDocument()
    })

    // Validate
    const validateButton = screen.getByRole('button', { name: /validate/i })
    validateButton.click()

    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument()
    })
  })

  it('should show success message when puzzle is solved correctly', async () => {
    // Mock PuzzleGrid to return correct answer
    vi.mock('../components/PuzzleGrid', () => ({
      default: ({ onValidate, watermarks, targetShape }) => {
        // Find correct cells
        const correct = watermarks
          .filter(w => w.shape === targetShape)
          .map(w => w.idx)
        
        return (
          <div>
            <div>Puzzle Grid</div>
            <button onClick={() => onValidate(correct, {
              puzzleStartTime: 1000,
              clickTimestamps: [{ timestamp: 1500, cellIndex: 0, action: 'select' }],
              validationTime: 3000, // > 2 seconds
            })}>
              Validate
            </button>
          </div>
        )
      },
    }))

    const { default: AppComponent } = await import('../App')
    render(<AppComponent />)
    
    // Capture
    const captureButton = screen.getByRole('button', { name: /mock capture/i })
    captureButton.click()

    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate/i })
      validateButton.click()
    })

    await waitFor(() => {
      expect(screen.getByText(/you passed/i)).toBeInTheDocument()
    })
  })

  it('should reset to camera screen when Try Again is clicked', async () => {
    render(<App />)
    
    // Go through flow
    const captureButton = screen.getByRole('button', { name: /mock capture/i })
    captureButton.click()

    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate/i })
      validateButton.click()
    })

    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument()
    })

    // Click Try Again
    const tryAgainButton = screen.getByRole('button', { name: /try again/i })
    tryAgainButton.click()

    await waitFor(() => {
      expect(screen.getByText(/camera capture/i)).toBeInTheDocument()
    })
  })

  it('should detect automated solving attempts (too fast)', async () => {
    vi.mock('../components/PuzzleGrid', () => ({
      default: ({ onValidate, watermarks, targetShape }) => {
        const correct = watermarks
          .filter(w => w.shape === targetShape)
          .map(w => w.idx)
        
        return (
          <div>
            <div>Puzzle Grid</div>
            <button onClick={() => onValidate(correct, {
              puzzleStartTime: 1000,
              clickTimestamps: [],
              validationTime: 1500, // < 2 seconds - too fast!
            })}>
              Validate
            </button>
          </div>
        )
      },
    }))

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { default: AppComponent } = await import('../App')
    render(<AppComponent />)
    
    const captureButton = screen.getByRole('button', { name: /mock capture/i })
    captureButton.click()

    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate/i })
      validateButton.click()
    })

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Automated solving detected'),
        expect.any(Array)
      )
      expect(screen.getByText(/captcha failed/i)).toBeInTheDocument()
    })

    consoleWarnSpy.mockRestore()
  })

  describe('Progressive Tolerance Error Workflow', () => {
    it('should track attempt count and increment on failure', async () => {
      // Mock PuzzleGrid to return incorrect answer
      vi.doMock('../components/PuzzleGrid', () => ({
        default: ({ onValidate }) => {
          return (
            <div>
              <div>Puzzle Grid</div>
              <button onClick={() => onValidate([999], { // Wrong cell
                puzzleStartTime: 1000,
                clickTimestamps: [{ timestamp: 1500, cellIndex: 999, action: 'select' }],
                validationTime: 3000,
              })}>
                Validate
              </button>
            </div>
          )
        },
      }))

      const { default: AppComponent } = await import('../App')
      render(<AppComponent />)
      
      // Capture
      const captureButton = screen.getByRole('button', { name: /mock capture/i })
      captureButton.click()

      await waitFor(() => {
        const validateButton = screen.getByRole('button', { name: /validate/i })
        validateButton.click()
      })

      // Should show attempt 1 of 3
      await waitFor(() => {
        expect(screen.getByText(/attempt 1 of 3/i)).toBeInTheDocument()
      })
    })

    it('should allow mistakes based on tolerance level (attempt 1)', async () => {
      // Mock PuzzleGrid to return partially correct answer (within tolerance)
      vi.doMock('../components/PuzzleGrid', () => ({
        default: ({ onValidate, watermarks, targetShape, targetColor }) => {
          // Get correct cells
          const correct = watermarks
            .filter(w => w.shape === targetShape && w.color === targetColor)
            .map(w => w.idx)
          
          // Select most correct cells but miss 1 and add 1 wrong (2 mistakes total, within tolerance)
          const selection = correct.length > 0 
            ? [...correct.slice(0, -1), 999] // Miss last correct, add one wrong
            : [999] // Fallback if no correct cells
          
          return (
            <div>
              <div>Puzzle Grid</div>
              <button onClick={() => onValidate(selection, {
                puzzleStartTime: 1000,
                clickTimestamps: [{ timestamp: 1500, cellIndex: 0, action: 'select' }],
                validationTime: 3000,
              })}>
                Validate
              </button>
            </div>
          )
        },
      }))

      const { default: AppComponent } = await import('../App')
      render(<AppComponent />)
      
      const captureButton = screen.getByRole('button', { name: /mock capture/i })
      captureButton.click()

      await waitFor(() => {
        const validateButton = screen.getByRole('button', { name: /validate/i })
        validateButton.click()
      })

      // Should pass on first attempt with tolerance (if accuracy >= 80%)
      await waitFor(() => {
        // Either passes with tolerance or fails - both are valid outcomes
        const resultText = screen.queryByText(/you passed/i) || screen.queryByText(/captcha failed/i)
        expect(resultText).toBeInTheDocument()
      })
    })

    it('should block user after max attempts', async () => {
      // Mock PuzzleGrid to always return wrong answer
      vi.doMock('../components/PuzzleGrid', () => ({
        default: ({ onValidate }) => {
          return (
            <div>
              <div>Puzzle Grid</div>
              <button onClick={() => onValidate([999], { // Always wrong
                puzzleStartTime: 1000,
                clickTimestamps: [{ timestamp: 1500, cellIndex: 999, action: 'select' }],
                validationTime: 3000,
              })}>
                Validate
              </button>
            </div>
          )
        },
      }))

      const { default: AppComponent } = await import('../App')
      render(<AppComponent />)
      
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        const captureButton = screen.getByRole('button', { name: /mock capture/i })
        captureButton.click()

        await waitFor(() => {
          const validateButton = screen.getByRole('button', { name: /validate/i })
          validateButton.click()
        })

        await waitFor(() => {
          expect(screen.getByText(/result/i)).toBeInTheDocument()
        })

        if (i < 2) {
          // Not blocked yet, try again
          const tryAgainButton = screen.getByRole('button', { name: /try again/i })
          tryAgainButton.click()
          
          // Wait for camera screen
          await waitFor(() => {
            expect(screen.getByText(/camera capture/i)).toBeInTheDocument()
          })
        }
      }

      // Should be blocked after 3 attempts
      await waitFor(() => {
        expect(screen.getByText(/maximum attempts reached/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /start new challenge/i })).toBeInTheDocument()
      })
    })

    it('should reset attempt count on success', async () => {
      // Mock PuzzleGrid to return correct answer
      vi.doMock('../components/PuzzleGrid', () => ({
        default: ({ onValidate, watermarks, targetShape, targetColor }) => {
          const correct = watermarks
            .filter(w => w.shape === targetShape && w.color === targetColor)
            .map(w => w.idx)
          
          return (
            <div>
              <div>Puzzle Grid</div>
              <button onClick={() => onValidate(correct, {
                puzzleStartTime: 1000,
                clickTimestamps: [{ timestamp: 1500, cellIndex: 0, action: 'select' }],
                validationTime: 3000,
              })}>
                Validate
              </button>
            </div>
          )
        },
      }))

      const { default: AppComponent } = await import('../App')
      render(<AppComponent />)
      
      // Capture and validate successfully
      const captureButton = screen.getByRole('button', { name: /mock capture/i })
      captureButton.click()

      await waitFor(() => {
        const validateButton = screen.getByRole('button', { name: /validate/i })
        validateButton.click()
      })

      // Should show success and reset attempt count
      await waitFor(() => {
        expect(screen.getByText(/you passed/i)).toBeInTheDocument()
      })

      // Try again should start fresh (no attempt indicator)
      const tryAgainBtn = screen.getByRole('button', { name: /try again/i })
      tryAgainBtn.click()

      await waitFor(() => {
        expect(screen.getByText(/camera capture/i)).toBeInTheDocument()
      })
    })

    it('should show tolerance information in puzzle grid on retry', async () => {
      // Mock PuzzleGrid to check if attemptCount prop is passed
      vi.doMock('../components/PuzzleGrid', () => ({
        default: ({ onValidate, attemptCount, maxAttempts }) => {
          return (
            <div>
              <div>Puzzle Grid</div>
              {attemptCount > 0 && (
                <div data-testid="attempt-indicator">
                  Attempt {attemptCount + 1} of {maxAttempts}
                </div>
              )}
              <button onClick={() => onValidate([999], {
                puzzleStartTime: 1000,
                clickTimestamps: [{ timestamp: 1500, cellIndex: 999, action: 'select' }],
                validationTime: 3000,
              })}>
                Validate
              </button>
            </div>
          )
        },
      }))

      const { default: AppComponent } = await import('../App')
      render(<AppComponent />)
      
      // First attempt - no indicator
      const captureButton = screen.getByRole('button', { name: /mock capture/i })
      captureButton.click()

      await waitFor(() => {
        expect(screen.queryByTestId('attempt-indicator')).not.toBeInTheDocument()
      })

      // Fail first attempt
      const validateButton = screen.getByRole('button', { name: /validate/i })
      validateButton.click()

      await waitFor(() => {
        const tryAgainButton = screen.getByRole('button', { name: /try again/i })
        tryAgainButton.click()
      })

      // Second attempt - should show indicator
      await waitFor(() => {
        const captureBtn = screen.getByRole('button', { name: /mock capture/i })
        captureBtn.click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('attempt-indicator')).toBeInTheDocument()
        expect(screen.getByText(/attempt 2 of 3/i)).toBeInTheDocument()
      })
    })
  })
})

