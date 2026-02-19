import { Card } from '@/components/ui/Card'

/**
 * Terms of Service Page
 * Requirements: 2.1
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <Card variant="elevated" padding="lg" className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Terms of Service
        </h1>
        
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Last updated: December 2024
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            1. Acceptance of Terms
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            By accessing and using Cekatan, you accept and agree to be bound by the terms
            and provision of this agreement. If you do not agree to abide by these terms,
            please do not use this service.
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            2. Description of Service
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Cekatan is an assessment and study platform designed for organizational
            learning. The service provides flashcards, multiple choice questions, and
            study tracking features.
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            3. User Accounts
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            You are responsible for maintaining the confidentiality of your account and 
            password. You agree to accept responsibility for all activities that occur 
            under your account.
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            4. Content Disclaimer
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            The content provided through Cekatan is for educational purposes only and
            should not be considered professional advice. Always consult with qualified
            professionals for domain-specific decisions.
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            5. Intellectual Property
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            All content, features, and functionality of Cekatan are owned by us and are
            protected by international copyright, trademark, and other intellectual property laws.
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            6. Changes to Terms
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            We reserve the right to modify these terms at any time. We will notify users of 
            any material changes by posting the new terms on this page.
          </p>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
            7. Contact
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            If you have any questions about these Terms, please contact us.
          </p>
        </div>
      </Card>
    </div>
  )
}
