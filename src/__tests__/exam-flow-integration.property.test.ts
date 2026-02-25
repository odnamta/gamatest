/**
 * V20: Integration property tests for the assessment exam flow.
 *
 * Tests the full lifecycle: session creation, answer submission,
 * scoring, completion, and edge cases like timeouts and resume.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ============================================
// Pure Simulation of Exam Engine
// ============================================

type Question = {
  id: string
  correctIndex: number
  optionCount: number
}

type ExamSession = {
  id: string
  status: 'in_progress' | 'completed' | 'timed_out' | 'expired'
  questions: Question[]
  answers: Map<string, number>
  timeRemainingSeconds: number
  tabSwitchCount: number
}

function createSession(
  sessionId: string,
  questions: Question[],
  timeLimitSeconds: number,
): ExamSession {
  return {
    id: sessionId,
    status: 'in_progress',
    questions,
    answers: new Map(),
    timeRemainingSeconds: timeLimitSeconds,
    tabSwitchCount: 0,
  }
}

function submitAnswer(session: ExamSession, questionId: string, selectedIndex: number): ExamSession {
  if (session.status !== 'in_progress') return session
  const q = session.questions.find((q) => q.id === questionId)
  if (!q || selectedIndex < 0 || selectedIndex >= q.optionCount) return session
  const newAnswers = new Map(session.answers)
  newAnswers.set(questionId, selectedIndex)
  return { ...session, answers: newAnswers }
}

function completeSession(session: ExamSession, passScore: number): ExamSession & { score: number; passed: boolean } {
  if (session.status !== 'in_progress') {
    return { ...session, score: 0, passed: false }
  }
  let correct = 0
  for (const q of session.questions) {
    const answer = session.answers.get(q.id)
    if (answer === q.correctIndex) correct++
  }
  const score = session.questions.length > 0
    ? Math.round((correct / session.questions.length) * 100)
    : 0
  return {
    ...session,
    status: 'completed',
    score,
    passed: score >= passScore,
  }
}

function expireByTimeout(session: ExamSession): ExamSession {
  if (session.status !== 'in_progress') return session
  return { ...session, status: 'timed_out', timeRemainingSeconds: 0 }
}

function recordTabSwitch(session: ExamSession): ExamSession {
  if (session.status !== 'in_progress') return session
  return { ...session, tabSwitchCount: session.tabSwitchCount + 1 }
}

// Arbitraries
const questionArb = fc.record({
  id: fc.uuid(),
  correctIndex: fc.integer({ min: 0, max: 3 }),
  optionCount: fc.integer({ min: 2, max: 5 }),
}).map((q) => ({ ...q, correctIndex: Math.min(q.correctIndex, q.optionCount - 1) }))

const questionsArb = fc.array(questionArb, { minLength: 1, maxLength: 50 })
const passScoreArb = fc.integer({ min: 0, max: 100 })
const timeLimitArb = fc.integer({ min: 60, max: 14400 })

// ============================================
// Tests
// ============================================

describe('Exam Session Creation', () => {
  it('always starts in_progress with zero answers', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        const session = createSession(sessionId, questions, timeLimit)
        expect(session.status).toBe('in_progress')
        expect(session.answers.size).toBe(0)
        expect(session.timeRemainingSeconds).toBe(timeLimit)
        expect(session.tabSwitchCount).toBe(0)
      },
    ))
  })

  it('preserves all questions in order', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        const session = createSession(sessionId, questions, timeLimit)
        expect(session.questions).toEqual(questions)
        expect(session.questions.length).toBe(questions.length)
      },
    ))
  })
})

describe('Answer Submission', () => {
  it('records answers for valid questions', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        let session = createSession(sessionId, questions, timeLimit)
        for (const q of questions) {
          const idx = q.correctIndex // Pick a valid index
          session = submitAnswer(session, q.id, idx)
        }
        expect(session.answers.size).toBe(questions.length)
      },
    ))
  })

  it('overwrites previous answer for same question', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        if (questions.length === 0) return
        const q = questions[0]
        let session = createSession(sessionId, questions, timeLimit)
        session = submitAnswer(session, q.id, 0)
        const newIdx = Math.min(1, q.optionCount - 1)
        session = submitAnswer(session, q.id, newIdx)
        expect(session.answers.get(q.id)).toBe(newIdx)
        // Should not have duplicates
        expect(session.answers.size).toBe(1)
      },
    ))
  })

  it('rejects answers after completion', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        const session = createSession(sessionId, questions, timeLimit)
        const completed = completeSession(session, passScore)
        const q = questions[0]
        const afterAnswer = submitAnswer(completed, q.id, 0)
        // Answer should not be recorded
        expect(afterAnswer.answers.size).toBe(completed.answers.size)
      },
    ))
  })

  it('ignores invalid question IDs', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        const session = createSession(sessionId, questions, timeLimit)
        const updated = submitAnswer(session, 'nonexistent-id', 0)
        expect(updated.answers.size).toBe(0)
      },
    ))
  })

  it('ignores out-of-range option indices', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        if (questions.length === 0) return
        const q = questions[0]
        const session = createSession(sessionId, questions, timeLimit)
        const tooHigh = submitAnswer(session, q.id, q.optionCount)
        const tooLow = submitAnswer(session, q.id, -1)
        expect(tooHigh.answers.size).toBe(0)
        expect(tooLow.answers.size).toBe(0)
      },
    ))
  })
})

describe('Scoring & Completion', () => {
  it('score is always 0-100', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        let session = createSession(sessionId, questions, timeLimit)
        // Answer randomly
        for (const q of questions) {
          session = submitAnswer(session, q.id, Math.floor(Math.random() * q.optionCount))
        }
        const result = completeSession(session, passScore)
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      },
    ))
  })

  it('all correct answers gives 100%', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        let session = createSession(sessionId, questions, timeLimit)
        for (const q of questions) {
          session = submitAnswer(session, q.id, q.correctIndex)
        }
        const result = completeSession(session, 50)
        expect(result.score).toBe(100)
        expect(result.passed).toBe(true)
      },
    ))
  })

  it('no answers gives 0%', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        const session = createSession(sessionId, questions, timeLimit)
        const result = completeSession(session, 50)
        expect(result.score).toBe(0)
        expect(result.passed).toBe(false)
      },
    ))
  })

  it('score is monotonically increasing with more correct answers', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        if (questions.length < 2) return
        // Score with 0 correct
        const s0 = completeSession(createSession(sessionId, questions, timeLimit), 50)
        // Score with all correct
        let session = createSession(sessionId, questions, timeLimit)
        for (const q of questions) {
          session = submitAnswer(session, q.id, q.correctIndex)
        }
        const sAll = completeSession(session, 50)
        expect(sAll.score).toBeGreaterThanOrEqual(s0.score)
      },
    ))
  })

  it('passed is true iff score >= passScore', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        let session = createSession(sessionId, questions, timeLimit)
        for (const q of questions) {
          session = submitAnswer(session, q.id, q.correctIndex)
        }
        const result = completeSession(session, passScore)
        expect(result.passed).toBe(result.score >= passScore)
      },
    ))
  })

  it('completion is terminal — cannot complete twice', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        const session = createSession(sessionId, questions, timeLimit)
        const first = completeSession(session, passScore)
        const second = completeSession(first, passScore)
        expect(second.status).toBe('completed')
        expect(second.score).toBe(0) // Second complete returns 0 since status is already completed
      },
    ))
  })
})

describe('Timeout & Expiry', () => {
  it('timeout sets status to timed_out and time to 0', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        const session = createSession(sessionId, questions, timeLimit)
        const expired = expireByTimeout(session)
        expect(expired.status).toBe('timed_out')
        expect(expired.timeRemainingSeconds).toBe(0)
      },
    ))
  })

  it('cannot timeout an already-completed session', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        const session = createSession(sessionId, questions, timeLimit)
        const completed = completeSession(session, passScore)
        const afterTimeout = expireByTimeout(completed)
        expect(afterTimeout.status).toBe('completed')
      },
    ))
  })

  it('answers submitted before timeout are preserved', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        let session = createSession(sessionId, questions, timeLimit)
        // Answer half the questions
        const half = Math.floor(questions.length / 2)
        for (let i = 0; i < half; i++) {
          session = submitAnswer(session, questions[i].id, questions[i].correctIndex)
        }
        const answeredCount = session.answers.size
        const timedOut = expireByTimeout(session)
        expect(timedOut.answers.size).toBe(answeredCount)
      },
    ))
  })
})

describe('Tab Switch Tracking', () => {
  it('tab switch count is monotonically increasing', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      fc.integer({ min: 1, max: 20 }),
      (sessionId, questions, timeLimit, switchCount) => {
        let session = createSession(sessionId, questions, timeLimit)
        const counts: number[] = [session.tabSwitchCount]
        for (let i = 0; i < switchCount; i++) {
          session = recordTabSwitch(session)
          counts.push(session.tabSwitchCount)
        }
        for (let i = 1; i < counts.length; i++) {
          expect(counts[i]).toBeGreaterThan(counts[i - 1])
        }
      },
    ))
  })

  it('tab switches do not affect answers or score', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        // Session with tab switches
        let withSwitches = createSession(sessionId, questions, timeLimit)
        for (const q of questions) {
          withSwitches = submitAnswer(withSwitches, q.id, q.correctIndex)
        }
        withSwitches = recordTabSwitch(withSwitches)
        withSwitches = recordTabSwitch(withSwitches)

        // Session without
        let noSwitches = createSession(sessionId, questions, timeLimit)
        for (const q of questions) {
          noSwitches = submitAnswer(noSwitches, q.id, q.correctIndex)
        }

        const r1 = completeSession(withSwitches, passScore)
        const r2 = completeSession(noSwitches, passScore)
        expect(r1.score).toBe(r2.score)
        expect(r1.passed).toBe(r2.passed)
      },
    ))
  })

  it('tab switches are ignored for completed sessions', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb, passScoreArb,
      (sessionId, questions, timeLimit, passScore) => {
        const session = createSession(sessionId, questions, timeLimit)
        const completed = completeSession(session, passScore)
        const afterSwitch = recordTabSwitch(completed)
        expect(afterSwitch.tabSwitchCount).toBe(completed.tabSwitchCount)
      },
    ))
  })
})

describe('Session Resume', () => {
  it('answers persist across simulated resume', () => {
    fc.assert(fc.property(
      fc.uuid(), questionsArb, timeLimitArb,
      (sessionId, questions, timeLimit) => {
        // Simulate answering some questions
        let session = createSession(sessionId, questions, timeLimit)
        const answeredIds: string[] = []
        for (let i = 0; i < Math.min(3, questions.length); i++) {
          session = submitAnswer(session, questions[i].id, questions[i].correctIndex)
          answeredIds.push(questions[i].id)
        }

        // Simulate "resume" by creating new session and replaying answers
        const resumed = createSession(sessionId, questions, timeLimit)
        let restored = resumed
        for (const [qId, idx] of session.answers.entries()) {
          restored = submitAnswer(restored, qId, idx)
        }

        expect(restored.answers.size).toBe(session.answers.size)
        for (const id of answeredIds) {
          expect(restored.answers.get(id)).toBe(session.answers.get(id))
        }
      },
    ))
  })
})
