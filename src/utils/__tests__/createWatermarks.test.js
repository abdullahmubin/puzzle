import { describe, it, expect } from 'vitest'
import { createWatermarks } from '../createWatermarks'

describe('createWatermarks', () => {
  it('should create watermarks for exactly 50% of cells', () => {
    const { watermarks } = createWatermarks(4, 4)
    expect(watermarks.length).toBe(8) // 50% of 16 cells
  })

  it('should create watermarks for different grid sizes', () => {
    const { watermarks: wm1 } = createWatermarks(2, 2)
    expect(wm1.length).toBe(2) // 50% of 4 cells

    const { watermarks: wm2 } = createWatermarks(3, 3)
    expect(wm2.length).toBe(4) // 50% of 9 cells (floor)
  })

  it('should return a valid target shape', () => {
    const { targetShape } = createWatermarks(4, 4)
    const validShapes = ['triangle', 'square', 'circle']
    expect(validShapes).toContain(targetShape)
  })

  it('should assign valid shapes to watermarks', () => {
    const { watermarks } = createWatermarks(4, 4)
    const validShapes = ['triangle', 'square', 'circle']
    
    watermarks.forEach(watermark => {
      expect(validShapes).toContain(watermark.shape)
      expect(typeof watermark.idx).toBe('number')
      expect(watermark.idx).toBeGreaterThanOrEqual(0)
      expect(watermark.idx).toBeLessThan(16)
    })
  })

  it('should have unique cell indices in watermarks', () => {
    const { watermarks } = createWatermarks(4, 4)
    const indices = watermarks.map(w => w.idx)
    const uniqueIndices = new Set(indices)
    expect(uniqueIndices.size).toBe(indices.length)
  })

  it('should generate different configurations on multiple calls', () => {
    const config1 = createWatermarks(4, 4)
    const config2 = createWatermarks(4, 4)
    
    // At least one of these should be different (high probability)
    const different = 
      config1.targetShape !== config2.targetShape ||
      JSON.stringify(config1.watermarks) !== JSON.stringify(config2.watermarks)
    
    // Note: This test has a small chance of false negative, but probability is very low
    expect(different).toBe(true)
  })
})

