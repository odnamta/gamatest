import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export interface CertificateData {
  candidateName: string
  assessmentTitle: string
  score: number
  passScore: number
  completedAt: string
  sessionId: string
  orgName: string
  primaryColor?: string
  logoUrl?: string
}

export interface ProcessedCertificate {
  certificateId: string
  formattedDate: string
}

export function buildCertificateData(data: CertificateData): ProcessedCertificate {
  return {
    certificateId: data.sessionId.slice(0, 8).toUpperCase(),
    formattedDate: format(new Date(data.completedAt), 'd MMMM yyyy', { locale: idLocale }),
  }
}

const styles = StyleSheet.create({
  page: { padding: 60, backgroundColor: '#FFFFFF', position: 'relative' },
  border: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, border: '2px solid #1e40af' },
  title: { fontSize: 28, textAlign: 'center', color: '#1e40af', marginTop: 40, fontWeight: 'bold' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#64748b', marginTop: 8 },
  name: { fontSize: 24, textAlign: 'center', marginTop: 30, fontWeight: 'bold', color: '#0f172a' },
  assessment: { fontSize: 16, textAlign: 'center', marginTop: 20, color: '#334155' },
  score: { fontSize: 14, textAlign: 'center', marginTop: 12, color: '#64748b' },
  date: { fontSize: 12, textAlign: 'center', marginTop: 30, color: '#94a3b8' },
  certId: { fontSize: 10, textAlign: 'center', marginTop: 8, color: '#cbd5e1' },
  org: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#475569' },
})

export function CertificatePDF({ data }: { data: CertificateData }) {
  const { certificateId, formattedDate } = buildCertificateData(data)
  const accentColor = data.primaryColor || '#1e40af'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.border, { borderColor: accentColor }]} />
        <Text style={[styles.title, { color: accentColor }]}>Certificate of Completion</Text>
        <Text style={styles.subtitle}>This certifies that</Text>
        <Text style={styles.name}>{data.candidateName}</Text>
        <Text style={styles.subtitle}>has successfully completed</Text>
        <Text style={styles.assessment}>{data.assessmentTitle}</Text>
        <Text style={styles.score}>
          Score: {data.score}% (minimum: {data.passScore}%)
        </Text>
        <Text style={styles.date}>{formattedDate}</Text>
        <Text style={styles.org}>{data.orgName}</Text>
        <Text style={styles.certId}>Certificate ID: {certificateId}</Text>
      </Page>
    </Document>
  )
}
