import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import CameraCapture from '../CameraCapture'

// Mock getUserMedia
const mockStream = {
  getTracks: () => [
    {
      stop: vi.fn(),
      kind: 'video',
    },
  ],
}

global.navigator.mediaDevices = {
  getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
}

// Mock video element
HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve())
HTMLVideoElement.prototype.pause = vi.fn()

describe('CameraCapture', () => {
  const mockOnCaptured = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    HTMLVideoElement.prototype.videoWidth = 640
    HTMLVideoElement.prototype.videoHeight = 480
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render camera capture interface', () => {
    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    expect(screen.getByText(/position yourself/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /capture/i })).toBeInTheDocument()
  })

  it('should request camera access on mount', async () => {
    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'user' },
        audio: false,
      })
    })
  })

  it('should render video element', () => {
    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
  })

  it('should render overlay canvas', () => {
    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('should handle camera access errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigator.mediaDevices.getUserMedia = vi.fn(() => 
      Promise.reject(new Error('Camera access denied'))
    )

    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    consoleErrorSpy.mockRestore()
  })

  it('should call onCaptured with image and region when capture button is clicked', async () => {
    // Mock canvas toDataURL
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,test')

    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
    })

    const button = screen.getByRole('button', { name: /capture/i })
    
    // Wait a bit for video to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
    
    button.click()

    await waitFor(() => {
      expect(mockOnCaptured).toHaveBeenCalled()
    })

    const callArgs = mockOnCaptured.mock.calls[0][0]
    expect(callArgs).toHaveProperty('image')
    expect(callArgs).toHaveProperty('region')
    expect(callArgs.region).toHaveProperty('x')
    expect(callArgs.region).toHaveProperty('y')
    expect(callArgs.region).toHaveProperty('size')
  })

  it('should stop camera tracks when capture is clicked', async () => {
    const stopSpy = vi.fn()
    const mockTrack = { stop: stopSpy, kind: 'video' }
    const mockStreamWithTrack = {
      getTracks: () => [mockTrack],
    }
    
    navigator.mediaDevices.getUserMedia = vi.fn(() => 
      Promise.resolve(mockStreamWithTrack)
    )

    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
    })

    const button = screen.getByRole('button', { name: /capture/i })
    await new Promise(resolve => setTimeout(resolve, 100))
    button.click()

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalled()
    })
  })

  it('should not capture if video is not ready', async () => {
    HTMLVideoElement.prototype.videoWidth = 0
    HTMLVideoElement.prototype.videoHeight = 0

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<CameraCapture onCaptured={mockOnCaptured} />)
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
    })

    const button = screen.getByRole('button', { name: /capture/i })
    button.click()

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(mockOnCaptured).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Video not ready for capture')

    consoleErrorSpy.mockRestore()
  })
})

