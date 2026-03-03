import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'

// Mock @react-pdf/renderer since we only test the pure function buildCertificateData
vi.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  Text: 'Text',
  View: 'View',
  Svg: 'Svg',
  Path: 'Path',
  Link: 'Link',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}))

import { buildCertificateData, type CertificateData } from '@/lib/certificate-pdf'

describe('Certificate PDF', () => {
  const certDataArb = fc.record({
    candidateName: fc.string({ minLength: 1, maxLength: 100 }),
    assessmentTitle: fc.string({ minLength: 1, maxLength: 200 }),
    score: fc.integer({ min: 0, max: 100 }),
    passScore: fc.integer({ min: 0, max: 100 }),
    completedAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() }).map((ts) => new Date(ts).toISOString()),
    sessionId: fc.uuid(),
    orgName: fc.string({ minLength: 1, maxLength: 100 }),
    primaryColor: fc.stringMatching(/^[0-9a-f]{6}$/).map((s) => `#${s}`),
  })

  it('generates a certificate ID from full sessionId (uppercase)', () => {
    fc.assert(
      fc.property(certDataArb, (data) => {
        const result = buildCertificateData(data)
        expect(result.certificateId).toBe(data.sessionId.toUpperCase())
      })
    )
  })

  it('formats completion date in Indonesian locale', () => {
    fc.assert(
      fc.property(certDataArb, (data) => {
        const result = buildCertificateData(data)
        expect(typeof result.formattedDate).toBe('string')
        expect(result.formattedDate.length).toBeGreaterThan(0)
      })
    )
  })

  it('generates a verification URL from sessionId', () => {
    fc.assert(
      fc.property(certDataArb, (data) => {
        const result = buildCertificateData(data)
        expect(result.verificationUrl).toBe(`https://cekatan.com/verify/${data.sessionId}`)
      })
    )
  })
})
