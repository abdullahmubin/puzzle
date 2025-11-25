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
})

