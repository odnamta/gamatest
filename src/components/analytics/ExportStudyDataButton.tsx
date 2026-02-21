'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportStudyData } from '@/actions/analytics-actions'
import { Button } from '@/components/ui/Button'

export function ExportStudyDataButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const result = await exportStudyData()
      if (!result.ok || !result.data?.csv) return

      const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `study-data-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleExport} loading={loading}>
      <Download className="h-4 w-4 mr-1" />
      Export CSV
    </Button>
  )
}
