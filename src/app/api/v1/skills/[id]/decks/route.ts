import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { resolveActiveOrg } from '@/lib/org-context'

/**
 * V19: Get linked and available decks for a skill domain.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: skillDomainId } = await params

  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgContext = await resolveActiveOrg()
  if (!orgContext) {
    return NextResponse.json({ error: 'No active org' }, { status: 403 })
  }

  const supabase = await createSupabaseServerClient()

  // Get linked decks
  const { data: mappings } = await supabase
    .from('deck_skill_mappings')
    .select('deck_template_id')
    .eq('skill_domain_id', skillDomainId)

  const linkedIds = (mappings ?? []).map((m) => m.deck_template_id)

  let linked: { deck_template_id: string; title: string }[] = []
  if (linkedIds.length > 0) {
    const { data: decks } = await supabase
      .from('deck_templates')
      .select('id, title')
      .in('id', linkedIds)

    linked = (decks ?? []).map((d) => ({
      deck_template_id: d.id,
      title: d.title,
    }))
  }

  // Get available (unlinked) decks for this org
  const { data: orgDecks } = await supabase
    .from('deck_templates')
    .select('id, title')
    .eq('org_id', orgContext.org.id)
    .order('title')

  const available = (orgDecks ?? []).filter((d) => !linkedIds.includes(d.id))

  return NextResponse.json({ linked, available })
}
