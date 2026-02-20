'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export interface OnboardingModalProps {
  isOpen: boolean;
  userName?: string;
  onComplete?: () => void;
}

/**
 * Determines if onboarding modal should be visible based on user metadata
 * Used for property testing
 */
export function shouldShowOnboardingModal(
  userMetadata: { onboarded?: boolean } | null | undefined
): boolean {
  if (!userMetadata) return true;
  return userMetadata.onboarded !== true;
}

/**
 * OnboardingModal - Simple name confirmation for new users
 */
export function OnboardingModal({ isOpen, userName, onComplete }: OnboardingModalProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(userName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleComplete() {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          onboarded: true,
          full_name: displayName.trim() || userName || 'User',
        },
      });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      onComplete?.();
      router.push('/dashboard');
    } catch {
      setError('Failed to save. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Welcome to Cekatan">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="text-center">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Welcome to Cekatan
          </h2>
          <p className="text-slate-600 mb-6">Confirm your display name to get started</p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full p-3 border border-slate-200 rounded-lg mb-6 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            onClick={handleComplete}
            loading={isLoading}
            disabled={!displayName.trim()}
            className="w-full"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
