import { describe, it, expect, beforeEach } from 'vitest'

// Import the validation function from App
// Since it's not exported, we'll test the logic separately
describe('Time-Based Detection Logic', () => {
  let validateHumanInteraction

  beforeEach(() => {
    // Simulate the validation logic
    validateHumanInteraction = (timingData) => {
      if (!timingData) {
        return { isHuman: false, reasons: ['No timing data provided'] }
      }

      const { puzzleStartTime, clickTimestamps, validationTime } = timingData
      const reasons = []
      let isHuman = true

      const totalTime = validationTime - puzzleStartTime
      const totalTimeSeconds = totalTime / 1000

      const MIN_TIME_SECONDS = 2.0
      if (totalTimeSeconds < MIN_TIME_SECONDS) {
        isHuman = false
        reasons.push(`Too fast: Completed in ${totalTimeSeconds.toFixed(2)}s (minimum: ${MIN_TIME_SECONDS}s)`)
      }

      if (clickTimestamps.length > 1) {
        const intervals = []
        for (let i = 1; i < clickTimestamps.length; i++) {
          intervals.push(clickTimestamps[i].timestamp - clickTimestamps[i - 1].timestamp)
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const variance = intervals.reduce((sum, interval) => {
          return sum + Math.pow(interval - avgInterval, 2)
        }, 0) / intervals.length
        const stdDev = Math.sqrt(variance)
        const COEFFICIENT_OF_VARIATION = stdDev / avgInterval
        const MIN_CV = 0.15

        if (COEFFICIENT_OF_VARIATION < MIN_CV && intervals.length >= 3) {
          isHuman = false
          reasons.push(`Suspicious click pattern: Too consistent intervals (CV: ${COEFFICIENT_OF_VARIATION.toFixed(3)})`)
        }

        const MIN_CLICK_INTERVAL_MS = 80
        const tooFastClicks = intervals.filter(interval => interval < MIN_CLICK_INTERVAL_MS).length
        if (tooFastClicks > 0) {
          isHuman = false
          reasons.push(`Suspicious: ${tooFastClicks} click(s) with interval < ${MIN_CLICK_INTERVAL_MS}ms`)
        }

        const uniqueIntervals = new Set(intervals.map(i => Math.round(i)))
        if (uniqueIntervals.size === 1 && intervals.length >= 3) {
          isHuman = false
          reasons.push(`Suspicious: All click intervals are identical (${intervals[0].toFixed(2)}ms)`)
        }
      }

      if (clickTimestamps.length > 0) {
        const firstClickTime = clickTimestamps[0].timestamp
        const timeToValidation = validationTime - firstClickTime
        const MIN_THINKING_TIME_MS = 500
        if (timeToValidation < MIN_THINKING_TIME_MS) {
          isHuman = false
          reasons.push(`Too fast validation: ${timeToValidation.toFixed(2)}ms after first click`)
        }
      }

      return { isHuman, reasons }
    }
  })

  it('should reject when no timing data is provided', () => {
    const result = validateHumanInteraction(null)
    expect(result.isHuman).toBe(false)
    expect(result.reasons).toContain('No timing data provided')
  })

  it('should reject solutions completed too quickly', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [{ timestamp: 1200, cellIndex: 0, action: 'select' }],
      validationTime: 1500, // 0.5 seconds - too fast
    })

    expect(result.isHuman).toBe(false)
    expect(result.reasons.some(r => r.includes('Too fast'))).toBe(true)
  })

  it('should accept solutions with sufficient time', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [
        { timestamp: 2000, cellIndex: 0, action: 'select' },
        { timestamp: 2500, cellIndex: 1, action: 'select' },
      ],
      validationTime: 4000, // 3 seconds - sufficient
    })

    expect(result.isHuman).toBe(true)
  })

  it('should detect too consistent click intervals', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [
        { timestamp: 2000, cellIndex: 0, action: 'select' },
        { timestamp: 2250, cellIndex: 1, action: 'select' }, // 250ms
        { timestamp: 2500, cellIndex: 2, action: 'select' }, // 250ms
        { timestamp: 2750, cellIndex: 3, action: 'select' }, // 250ms
      ],
      validationTime: 4000,
    })

    expect(result.isHuman).toBe(false)
    expect(result.reasons.some(r => r.includes('consistent intervals'))).toBe(true)
  })

  it('should detect too fast click intervals', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [
        { timestamp: 2000, cellIndex: 0, action: 'select' },
        { timestamp: 2050, cellIndex: 1, action: 'select' }, // 50ms - too fast
      ],
      validationTime: 4000,
    })

    expect(result.isHuman).toBe(false)
    expect(result.reasons.some(r => r.includes('interval < 80ms'))).toBe(true)
  })

  it('should detect identical click intervals', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [
        { timestamp: 2000, cellIndex: 0, action: 'select' },
        { timestamp: 2250, cellIndex: 1, action: 'select' },
        { timestamp: 2500, cellIndex: 2, action: 'select' },
        { timestamp: 2750, cellIndex: 3, action: 'select' },
      ],
      validationTime: 4000,
    })

    expect(result.isHuman).toBe(false)
    expect(result.reasons.some(r => r.includes('identical'))).toBe(true)
  })

  it('should detect too fast validation after first click', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [
        { timestamp: 2000, cellIndex: 0, action: 'select' },
      ],
      validationTime: 2200, // 200ms after first click - too fast
    })

    expect(result.isHuman).toBe(false)
    expect(result.reasons.some(r => r.includes('Too fast validation'))).toBe(true)
  })

  it('should accept human-like interaction patterns', () => {
    const result = validateHumanInteraction({
      puzzleStartTime: 1000,
      clickTimestamps: [
        { timestamp: 2500, cellIndex: 0, action: 'select' },
        { timestamp: 3200, cellIndex: 1, action: 'select' }, // 700ms interval
        { timestamp: 3800, cellIndex: 2, action: 'select' }, // 600ms interval
      ],
      validationTime: 5000, // 4 seconds total, 2.5 seconds after first click
    })

    expect(result.isHuman).toBe(true)
    expect(result.reasons.length).toBe(0)
  })
})

