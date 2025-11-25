import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PuzzleGrid from '../PuzzleGrid'

// Mock canvas context
const mockContext = {
  drawImage: vi.fn(),
  strokeRect: vi.fn(),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  rect: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
}

// Mock Image
global.Image = class {
  constructor() {
    this.onload = null
    this.onerror = null
    this.src = ''
    this.width = 640
    this.height = 480
    // Simulate image load
    setTimeout(() => {
      if (this.onload) this.onload()
    }, 0)
  }
}

describe('PuzzleGrid', () => {
  const mockWatermarks = [
    { idx: 0, shape: 'square' },
    { idx: 1, shape: 'circle' },
    { idx: 2, shape: 'triangle' },
    { idx: 3, shape: 'square' },
  ]

  const mockRegion = {
    x: 100,
    y: 100,
    size: 200,
    width: 640,
    height: 480,
  }

  const mockImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    // Reset canvas mock
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext)
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 640,
      height: 480,
    }))
  })

  it('should render instructions with target shape', () => {
    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={vi.fn()}
      />
    )

    expect(screen.getByText(/select all/i)).toBeInTheDocument()
    expect(screen.getByText(/square/i)).toBeInTheDocument()
  })

  it('should render canvas element', () => {
    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={vi.fn()}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('should render validate button', () => {
    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument()
  })

  it('should disable validate button when no cells are selected', () => {
    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={vi.fn()}
      />
    )

    const button = screen.getByRole('button', { name: /validate/i })
    expect(button).toBeDisabled()
  })

  it('should handle cell clicks and enable validate button', async () => {
    const onValidate = vi.fn()
    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={onValidate}
      />
    )

    await waitFor(() => {
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    const canvas = document.querySelector('canvas')
    
    // Simulate click on a cell (within the region)
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 150, // Within region (x: 100, size: 200)
      clientY: 150,
    })
    
    fireEvent(canvas, clickEvent)

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /validate/i })
      expect(button).not.toBeDisabled()
    })
  })

  it('should call onValidate with timing data when validate is clicked', async () => {
    const onValidate = vi.fn()
    
    // Mock performance.now
    const mockNow = vi.fn(() => 1000)
    global.performance.now = mockNow

    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={onValidate}
      />
    )

    await waitFor(() => {
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    const canvas = document.querySelector('canvas')
    
    // Click a cell first
    fireEvent(canvas, new MouseEvent('click', {
      bubbles: true,
      clientX: 150,
      clientY: 150,
    }))

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /validate/i })
      expect(button).not.toBeDisabled()
    })

    // Click validate
    const button = screen.getByRole('button', { name: /validate/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(onValidate).toHaveBeenCalled()
    })

    // Check that timing data is included
    const callArgs = onValidate.mock.calls[0]
    expect(callArgs[1]).toHaveProperty('puzzleStartTime')
    expect(callArgs[1]).toHaveProperty('clickTimestamps')
    expect(callArgs[1]).toHaveProperty('validationTime')
  })

  it('should not process clicks outside the grid region', async () => {
    render(
      <PuzzleGrid
        imageDataUrl={mockImageDataUrl}
        region={mockRegion}
        gridRows={4}
        gridCols={4}
        watermarks={mockWatermarks}
        targetShape="square"
        onValidate={vi.fn()}
      />
    )

    await waitFor(() => {
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    const canvas = document.querySelector('canvas')
    const buttonBefore = screen.getByRole('button', { name: /validate/i })
    expect(buttonBefore).toBeDisabled()

    // Click outside region (x: 100, size: 200, so x > 300 is outside)
    fireEvent(canvas, new MouseEvent('click', {
      bubbles: true,
      clientX: 400,
      clientY: 150,
    }))

    // Button should still be disabled
    const buttonAfter = screen.getByRole('button', { name: /validate/i })
    expect(buttonAfter).toBeDisabled()
  })
})

