'use client'

/**
 * V19: Skill Domain Detail Page
 *
 * Shows a single skill domain with linked decks and employee scores.
 * Admin can link/unlink decks and view all employee scores.
 */

import { useState, useEffect, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { usePageTitle } from '@/hooks/use-page-title'
import { ArrowLeft, LinkIcon, Unlink, Target, Users } from 'lucide-react'
import { useOrg } from '@/components/providers/OrgProvider'
import {
  getOrgSkillDomains,
  getSkillDeckMappings,
  linkDeckToSkill,
  unlinkDeckFromSkill,
  getOrgSkillHeatmap,
} from '@/actions/skill-actions'
import { canManageSkillDomains, canLinkDeckToSkill } from '@/lib/skill-authorization'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'

const EmployeeSkillRadar = dynamic(() => import('@/components/skills/EmployeeSkillRadar').then(m => m.EmployeeSkillRadar), { ssr: false })
import type { SkillDomain } from '@/types/database'

interface LinkedDeck {
  deck_template_id: string
  title: string
}

export default function SkillDetailPage() {
  const params = useParams()
  const router = useRouter()
  const skillId = params.id as string
  const { org, role } = useOrg()
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const [domain, setDomain] = useState<SkillDomain | null>(null)
  const [linkedDecks, setLinkedDecks] = useState<LinkedDeck[]>([])
  const [availableDecks, setAvailableDecks] = useState<{ id: string; title: string }[]>([])
  const [employeeScores, setEmployeeScores] = useState<{
    userId: string
    email: string
    score: number | null
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)

  const canLink = canLinkDeckToSkill(role)
  const isAdmin = canManageSkillDomains(role)

  usePageTitle(domain?.name || 'Skill Detail')

  useEffect(() => {
    loadData()
  }, [skillId])

  async function loadData() {
    setLoading(true)

    // Load domain info
    const domainsResult = await getOrgSkillDomains()
    if (!domainsResult.ok || !domainsResult.data) {
      setLoading(false)
      return
    }
    const found = domainsResult.data.find((d) => d.id === skillId)
    if (!found) {
      setLoading(false)
      return
    }
    setDomain(found)

    // Load linked decks via supabase client-side query through server action
    // We'll use the heatmap action to get employee scores for this skill
    if (isAdmin) {
      const heatmapResult = await getOrgSkillHeatmap()
      if (heatmapResult.ok && heatmapResult.data) {
        const scores = heatmapResult.data.employees
          .map((emp) => ({
            userId: emp.userId,
            email: emp.email,
            score: emp.scores[skillId] ?? null,
          }))
          .filter((s) => s.score !== null)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        setEmployeeScores(scores)
      }
    }

    // Fetch linked decks for this skill domain
    const decksResult = await getSkillDeckMappings(skillId)
    if (decksResult.ok && decksResult.data) {
      setLinkedDecks(decksResult.data.linked)
      setAvailableDecks(decksResult.data.available)
    } else if (!decksResult.ok) {
      showToast(decksResult.error, 'error')
    }

    setLoading(false)
  }

  function handleLink(deckTemplateId: string) {
    startTransition(async () => {
      const result = await linkDeckToSkill(deckTemplateId, skillId)
      if (result.ok) {
        showToast('Deck linked to skill', 'success')
        setShowLinkDropdown(false)
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  function handleUnlink(deckTemplateId: string) {
    startTransition(async () => {
      const result = await unlinkDeckFromSkill(deckTemplateId, skillId)
      if (result.ok) {
        showToast('Deck unlinked from skill', 'success')
        await loadData()
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-8" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
    )
  }

  if (!domain) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-500">Skill domain not found.</p>
        <Button size="sm" variant="secondary" className="mt-4" onClick={() => router.push('/skills')}>
          Back to Skills
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back + Header */}
      <button
        onClick={() => router.push('/skills')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Skills
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: domain.color }}
        />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {domain.name}
        </h1>
      </div>
      {domain.description && (
        <p className="text-slate-600 dark:text-slate-400 mb-6">{domain.description}</p>
      )}

      {/* Linked Decks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Linked Decks
          </h2>
          {canLink && availableDecks.length > 0 && (
            <div className="relative">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowLinkDropdown(!showLinkDropdown)}
              >
                <LinkIcon className="h-3.5 w-3.5 mr-1" />
                Link Deck
              </Button>
              {showLinkDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
                  {availableDecks.map((deck) => (
                    <button
                      key={deck.id}
                      onClick={() => handleLink(deck.id)}
                      disabled={isPending}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 truncate"
                    >
                      {deck.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {linkedDecks.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
            No decks linked to this skill domain yet.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedDecks.map((deck) => (
              <div
                key={deck.deck_template_id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {deck.title}
                </span>
                {canLink && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnlink(deck.deck_template_id)}
                    disabled={isPending}
                    title="Unlink deck"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employee Scores (Admin) */}
      {isAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Users className="h-5 w-5" />
            Employee Scores
          </h2>

          {employeeScores.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
              No employees have been assessed in this skill domain yet.
            </p>
          ) : (
            <div className="space-y-2">
              {employeeScores.map((emp) => (
                <div
                  key={emp.userId}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300">{emp.email}</span>
                  <span className={`text-sm font-bold ${
                    (emp.score ?? 0) >= 70 ? 'text-green-600' :
                    (emp.score ?? 0) >= 40 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {emp.score?.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
