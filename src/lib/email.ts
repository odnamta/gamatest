import { Resend } from 'resend'
import { logger } from '@/lib/logger'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('email.send', 'RESEND_API_KEY not set, skipping email')
    return { ok: true as const }
  }

  let lastError: string = 'Unknown error'

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error } = await getResend().emails.send({
      from: 'Cekatan <noreply@cekatan.com>',
      to,
      subject,
      react,
    })

    if (!error) {
      return { ok: true as const }
    }

    lastError = error.message

    if (attempt < MAX_RETRIES - 1) {
      const delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt)
      logger.warn('sendEmail', `Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, { to, error: lastError })
      await sleep(delayMs)
    }
  }

  logger.error('sendEmail', `All ${MAX_RETRIES} attempts failed`, { to, error: lastError })
  return { ok: false as const, error: lastError }
}
