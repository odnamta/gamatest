import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Path, Link } from '@react-pdf/renderer'
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
  verificationUrl: string
}

export function buildCertificateData(data: CertificateData): ProcessedCertificate {
  const certificateId = data.sessionId.toUpperCase()
  return {
    certificateId,
    formattedDate: format(new Date(data.completedAt), 'd MMMM yyyy', { locale: idLocale }),
    verificationUrl: `https://cekatan.com/verify/${data.sessionId}`,
  }
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 0,
    position: 'relative',
    fontFamily: 'Helvetica',
  },
  accentBar: {
    height: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Oblique',
    color: '#64748b',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerOrgName: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'Helvetica-Bold',
  },
  divider: {
    height: 1.5,
    marginHorizontal: 48,
  },
  body: {
    flexDirection: 'row',
    paddingHorizontal: 48,
    paddingTop: 36,
    paddingBottom: 28,
    flex: 1,
  },
  leftCol: {
    width: '60%',
    paddingRight: 32,
    justifyContent: 'center',
  },
  rightCol: {
    width: '40%',
    paddingLeft: 32,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    justifyContent: 'center',
  },
  preText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  candidateName: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
    textDecoration: 'underline',
    textDecorationColor: '#cbd5e1',
  },
  midText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
    marginBottom: 6,
  },
  assessmentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  orgText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
    marginBottom: 4,
  },
  orgName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  rightLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rightOrgName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
    marginBottom: 20,
  },
  rightDateLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
  },
  rightDate: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 24,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  scoreNumber: {
    fontSize: 42,
    fontFamily: 'Helvetica-Bold',
  },
  scorePercent: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    marginBottom: 6,
  },
  scoreMinLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  footer: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBrand: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  footerCenter: {
    alignItems: 'center',
  },
  footerCenterLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerCenterDate: {
    fontSize: 9,
    color: '#64748b',
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  footerCertId: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#94a3b8',
    marginBottom: 2,
  },
  footerLink: {
    fontSize: 7,
    color: '#3b82f6',
  },
})

function CheckmarkIcon({ size = 16, color = '#3b82f6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path
        d="M6 21L15 30L34 10"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function CertificatePDF({ data }: { data: CertificateData }) {
  const { certificateId, formattedDate, verificationUrl } = buildCertificateData(data)
  const accentColor = data.primaryColor || '#1e40af'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Top accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Sertifikat Terverifikasi</Text>
          </View>
          <View style={styles.headerRight}>
            <CheckmarkIcon size={14} color={accentColor} />
            <Text style={styles.headerOrgName}>{data.orgName}</Text>
          </View>
        </View>

        {/* Accent divider */}
        <View style={[styles.divider, { backgroundColor: accentColor }]} />

        {/* Body: two columns */}
        <View style={styles.body}>
          {/* Left column — certification text */}
          <View style={styles.leftCol}>
            <Text style={styles.preText}>Dengan ini menyatakan bahwa</Text>
            <Text style={styles.candidateName}>{data.candidateName}</Text>

            <Text style={styles.midText}>telah berhasil menyelesaikan dan lulus dalam</Text>
            <Text style={[styles.assessmentTitle, { color: accentColor }]}>
              {data.assessmentTitle}
            </Text>

            <Text style={styles.orgText}>yang diselenggarakan oleh</Text>
            <Text style={styles.orgName}>{data.orgName}</Text>
          </View>

          {/* Right column — org, date, score */}
          <View style={styles.rightCol}>
            <Text style={styles.rightLabel}>Diterbitkan oleh</Text>
            <Text style={styles.rightOrgName}>{data.orgName}</Text>

            <Text style={styles.rightDateLabel}>Tanggal</Text>
            <Text style={styles.rightDate}>{formattedDate}</Text>

            <Text style={styles.rightLabel}>Skor</Text>
            <View style={styles.scoreContainer}>
              <Text style={[styles.scoreNumber, { color: accentColor }]}>{data.score}</Text>
              <Text style={styles.scorePercent}>%</Text>
            </View>
            <Text style={styles.scoreMinLabel}>
              Minimum kelulusan: {data.passScore}%
            </Text>
          </View>
        </View>

        {/* Footer bar */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <CheckmarkIcon size={12} color={accentColor} />
            <Text style={styles.footerBrand}>cekatan</Text>
          </View>
          <View style={styles.footerCenter}>
            <Text style={styles.footerCenterLabel}>Sertifikat Terverifikasi</Text>
            <Text style={styles.footerCenterDate}>{formattedDate}</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerCertId}>{certificateId}</Text>
            <Link src={verificationUrl} style={styles.footerLink}>
              {verificationUrl}
            </Link>
          </View>
        </View>
      </Page>
    </Document>
  )
}
