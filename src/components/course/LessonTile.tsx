'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lesson, LessonStatus } from '@/types/database';

/**
 * LessonTile Component
 *
 * Displays a lesson as a tappable tile with status indicator.
 * Navigates to lesson overview if unlocked, shows message if locked.
 *
 * Requirements: 6.6, 6.7
 */

export interface LessonTileProps {
  lesson: Lesson;
  status: LessonStatus;
  bestScore: number | null;
}

export const LessonTile = memo(function LessonTile({ lesson, status, bestScore }: LessonTileProps) {
  const router = useRouter();
  const [showLockedMessage, setShowLockedMessage] = useState(false);

  const handleClick = () => {
    if (status === 'locked') {
      // Show locked message (Requirement 6.7)
      setShowLockedMessage(true);
      setTimeout(() => setShowLockedMessage(false), 2000);
    } else {
      // Navigate to lesson overview (Requirement 6.6)
      router.push(`/lesson/${lesson.id}/overview`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`
          w-full aspect-square rounded-xl p-3 flex flex-col items-center justify-center
          transition-all duration-200 relative overflow-hidden
          ${getStatusStyles(status)}
        `}
        aria-label={`${lesson.title} - ${getStatusLabel(status)}`}
      >
        {/* Status Icon */}
        <div className="mb-2">
          <StatusIcon status={status} />
        </div>

        {/* Lesson Title */}
        <span className={`
          text-sm font-medium text-center line-clamp-2
          ${status === 'locked' 
            ? 'text-slate-400 dark:text-slate-500' 
            : 'text-slate-700 dark:text-slate-200'}
        `}>
          {lesson.title}
        </span>

        {/* Best Score Badge (for completed lessons) */}
        {status === 'completed' && bestScore !== null && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            {bestScore}%
          </div>
        )}
      </button>

      {/* Locked Message Tooltip */}
      {showLockedMessage && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-10">
          Complete the previous lesson first
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800 dark:bg-slate-700" />
        </div>
      )}
    </div>
  );
})


function getStatusStyles(status: LessonStatus): string {
  switch (status) {
    case 'completed':
      return `
        bg-green-50 dark:bg-green-900/20 
        border-2 border-green-500 dark:border-green-400
        hover:bg-green-100 dark:hover:bg-green-900/30
        cursor-pointer
      `;
    case 'unlocked':
      return `
        bg-indigo-50 dark:bg-indigo-900/20 
        border-2 border-indigo-500 dark:border-indigo-400
        hover:bg-indigo-100 dark:hover:bg-indigo-900/30
        cursor-pointer
        ring-2 ring-indigo-300 dark:ring-indigo-600 ring-offset-2 dark:ring-offset-slate-900
      `;
    case 'locked':
      return `
        bg-slate-100 dark:bg-slate-800 
        border-2 border-slate-300 dark:border-slate-600
        cursor-not-allowed opacity-60
      `;
  }
}

function getStatusLabel(status: LessonStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'unlocked':
      return 'Ready to start';
    case 'locked':
      return 'Locked';
  }
}

function StatusIcon({ status }: { status: LessonStatus }) {
  switch (status) {
    case 'completed':
      // Checkmark icon
      return (
        <svg 
          className="w-8 h-8 text-green-500 dark:text-green-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'unlocked':
      // Play/Start icon
      return (
        <svg 
          className="w-8 h-8 text-indigo-500 dark:text-indigo-400" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    case 'locked':
      // Lock icon
      return (
        <svg 
          className="w-8 h-8 text-slate-400 dark:text-slate-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
          />
        </svg>
      );
  }
}
