import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export interface CandidateReportData {
  orgName: string
  primaryColor?: string
  candidateName: string
  candidateEmail: string
  reportDate: string
  totalAssessments: number
  avgScore: number
  passRate: number
  recentScores: Array<{
    assessmentTitle: string
    score: number
    passed: boolean
    date: string
  }>
  skillScores: Array<{
    skillName: string
    score: number | null
  }>
}

const colors = {
  accent: '#1e40af',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  bgLight: '#f8fafc',
  green: '#16a34a',
  red: '#dc2626',
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  // Header
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2px solid ${colors.accent}`,
  },
  orgName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  candidateEmail: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportDate: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 8,
  },
  // Summary stats
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 12,
    backgroundColor: colors.bgLight,
    borderRadius: 4,
    border: `1px solid ${colors.border}`,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Section heading
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.bgLight,
    borderBottom: `1px solid ${colors.border}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${colors.border}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  colTitle: { flex: 3 },
  colScore: { flex: 1, textAlign: 'center' },
  colStatus: { flex: 1, textAlign: 'center' },
  colDate: { flex: 2, textAlign: 'right' },
  headerText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  cellText: {
    fontSize: 9,
    color: colors.textPrimary,
  },
  passedText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.green,
  },
  failedText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.red,
  },
  // Skills section
  skillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: `1px solid ${colors.border}`,
  },
  skillName: {
    fontSize: 9,
    color: colors.textPrimary,
  },
  skillScore: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  noData: {
    fontSize: 9,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: colors.textMuted,
  },
})

function formatDateId(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'd MMMM yyyy', { locale: idLocale })
  } catch {
    return dateStr
  }
}

export function CandidateReportPDF({ data }: { data: CandidateReportData }) {
  const accentColor = data.primaryColor || colors.accent

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: accentColor }]}>
          <Text style={[styles.orgName, { color: accentColor }]}>{data.orgName}</Text>
          <Text style={styles.reportTitle}>Laporan Kandidat</Text>
          <Text style={styles.candidateName}>{data.candidateName}</Text>
          <Text style={styles.candidateEmail}>{data.candidateEmail}</Text>
          <Text style={styles.reportDate}>
            Tanggal laporan: {formatDateId(data.reportDate)}
          </Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data.totalAssessments}</Text>
            <Text style={styles.statLabel}>Total Assessment</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data.avgScore}%</Text>
            <Text style={styles.statLabel}>Rata-rata Skor</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data.passRate}%</Text>
            <Text style={styles.statLabel}>Tingkat Lulus</Text>
          </View>
        </View>

        {/* Recent Scores Table */}
        <Text style={styles.sectionTitle}>Riwayat Skor</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.colTitle]}>Assessment</Text>
          <Text style={[styles.headerText, styles.colScore]}>Skor</Text>
          <Text style={[styles.headerText, styles.colStatus]}>Status</Text>
          <Text style={[styles.headerText, styles.colDate]}>Tanggal</Text>
        </View>
        {data.recentScores.length === 0 ? (
          <Text style={styles.noData}>Belum ada data assessment.</Text>
        ) : (
          data.recentScores.map((item, idx) => (
            <View style={styles.tableRow} key={idx}>
              <Text style={[styles.cellText, styles.colTitle]}>{item.assessmentTitle}</Text>
              <Text style={[styles.cellText, styles.colScore]}>{item.score}%</Text>
              <Text style={[
                item.passed ? styles.passedText : styles.failedText,
                styles.colStatus,
              ]}>
                {item.passed ? 'Lulus' : 'Gagal'}
              </Text>
              <Text style={[styles.cellText, styles.colDate]}>
                {formatDateId(item.date)}
              </Text>
            </View>
          ))
        )}

        {/* Skill Scores */}
        {data.skillScores.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Skor Skill</Text>
            {data.skillScores.map((skill, idx) => (
              <View style={styles.skillRow} key={idx}>
                <Text style={styles.skillName}>{skill.skillName}</Text>
                <Text style={styles.skillScore}>
                  {skill.score !== null ? `${skill.score}%` : '-'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Digenerate oleh {data.orgName} via Cekatan
        </Text>
      </Page>
    </Document>
  )
}
