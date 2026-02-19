'use client'

import Link from 'next/link'
import { Brain, BookOpen, TrendingUp, Shield } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'

function GradientBlob() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-teal-400/30 to-blue-400/30 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-300/20 to-pink-300/20 rounded-full blur-3xl" />
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative z-10 pt-20 pb-16 px-4 text-center">
      <div className="mb-6">
        <span className="text-6xl font-bold text-blue-600">C</span>
      </div>
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
        Cekatan
      </h1>
      <p className="text-xl md:text-2xl text-slate-600 mb-2">
        Asesmen. Kompetensi. Sertifikasi.
      </p>
      <p className="text-lg text-slate-500 mb-8 max-w-xl mx-auto">
        Platform asesmen & pemetaan kompetensi untuk organisasi
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25 active:scale-95"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium rounded-xl bg-white/70 backdrop-blur-md border border-white/20 text-slate-700 hover:bg-white/90 transition-colors active:scale-95"
        >
          Sign In
        </Link>
      </div>
    </section>
  )
}

function FeatureCards() {
  const features = [
    {
      icon: <Brain className="h-8 w-8" />,
      title: 'Smart Study',
      description: 'SM-2 spaced repetition optimizes review timing for maximum knowledge retention.',
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: 'Secure Assessment',
      description: 'Timed, proctored tests with auto-grading, scoring, and pass/fail determination.',
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: 'Analytics',
      description: 'Track progress with skill gap analysis, mastery radar, and activity heatmaps.',
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: 'AI-Powered Content',
      description: 'Generate questions from PDFs and study materials with AI extraction and quality scanning.',
    },
  ]

  return (
    <section className="relative z-10 px-4 pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <GlassCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      <GradientBlob />
      <HeroSection />
      <FeatureCards />
    </div>
  )
}
