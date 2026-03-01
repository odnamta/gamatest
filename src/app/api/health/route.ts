import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type ServiceStatus = 'ok' | 'degraded' | 'down'

const HEALTH_API_KEY = process.env.HEALTH_API_KEY

async function checkSupabase(): Promise<{ status: ServiceStatus; latencyMs: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { status: 'down', latencyMs: 0 }

  const start = Date.now()
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    })
    const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true })
    const latencyMs = Date.now() - start
    if (error) return { status: 'degraded', latencyMs }
    return { status: latencyMs > 2000 ? 'degraded' : 'ok', latencyMs }
  } catch {
    return { status: 'down', latencyMs: Date.now() - start }
  }
}

async function checkResend(): Promise<{ status: ServiceStatus }> {
  if (!process.env.RESEND_API_KEY) return { status: 'degraded' }
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    })
    return { status: res.ok ? 'ok' : 'degraded' }
  } catch {
    return { status: 'down' }
  }
}

export async function GET(request: NextRequest) {
  // If HEALTH_API_KEY is set, require Bearer token auth
  if (HEALTH_API_KEY) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${HEALTH_API_KEY}`) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }
  }

  const [supabase, resend] = await Promise.all([checkSupabase(), checkResend()])

  const services = { supabase, resend }
  const allOk = Object.values(services).every((s) => s.status === 'ok')
  const anyDown = Object.values(services).some((s) => s.status === 'down')

  return NextResponse.json({
    status: anyDown ? 'degraded' : allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services,
  })
}
