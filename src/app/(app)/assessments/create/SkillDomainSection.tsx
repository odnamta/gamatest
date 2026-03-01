'use client'

/**
 * Skill Domain Linking Section (V19)
 * Extracted from create/page.tsx for code splitting.
 *
 * Manages its own skill domain state for a given deck.
 * Dynamically imported with { ssr: false } since it's conditionally rendered
 * (only when skillsEnabled && deckTemplateId are truthy).
 */

import { useState, useEffect, useTransition } from 'react'
import { Target, Link2, Unlink } from 'lucide-react'
import { getSkillDomainsForDeck, linkDeckToSkill, unlinkDeckFromSkill } from '@/actions/skill-actions'
import { Button } from '@/components/ui/Button'

interface SkillDomainSectionProps {
  deckTemplateId: string
  /** Whether the current user can modify links (always true on create, depends on role on edit) */
  canEdit?: boolean
}

export default function SkillDomainSection({ deckTemplateId, canEdit = true }: SkillDomainSectionProps) {
  const [linkedSkills, setLinkedSkills] = useState<{ id: string; name: string; color: string }[]>([])
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string; color: string }[]>([])
  const [skillLinking, startSkillTransition] = useTransition()
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)

  async function loadSkills() {
    const result = await getSkillDomainsForDeck(deckTemplateId)
    if (result.ok && result.data) {
      setLinkedSkills(result.data.linked)
      setAvailableSkills(result.data.available)
    }
  }

  useEffect(() => {
    loadSkills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckTemplateId])

  function handleLinkSkill(skillDomainId: string) {
    startSkillTransition(async () => {
      const result = await linkDeckToSkill(deckTemplateId, skillDomainId)
      if (result.ok) {
        setShowSkillDropdown(false)
        await loadSkills()
      }
    })
  }

  function handleUnlinkSkill(skillDomainId: string) {
    startSkillTransition(async () => {
      const result = await unlinkDeckFromSkill(deckTemplateId, skillDomainId)
      if (result.ok) {
        await loadSkills()
      }
    })
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Skill Domains
          </h3>
        </div>
        {canEdit && availableSkills.length > 0 && (
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowSkillDropdown(!showSkillDropdown)}
              disabled={skillLinking}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Link Skill
            </Button>
            {showSkillDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
                {availableSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleLinkSkill(skill.id)}
                    disabled={skillLinking}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: skill.color }}
                    />
                    <span className="truncate">{skill.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Linked skill domains receive score updates when candidates complete this assessment.
      </p>

      {linkedSkills.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          No skill domains linked yet. Link skill domains to track competencies.
        </p>
      ) : (
        <div className="space-y-2">
          {linkedSkills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: skill.color }}
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {skill.name}
                </span>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnlinkSkill(skill.id)}
                  disabled={skillLinking}
                  title="Unlink skill domain"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
