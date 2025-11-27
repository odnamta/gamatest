'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
}

/**
 * Sanitizes markdown content to prevent XSS attacks.
 * Removes script tags, javascript: URLs, and on* event handlers.
 * 
 * Requirements: 5.4
 */
export function sanitizeMarkdown(content: string): string {
  // Remove script tags (including variations)
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, '')
  
  // Remove on* event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '')
  
  // Remove data: URLs that could contain scripts
  sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '')
  
  // Remove vbscript: URLs
  sanitized = sanitized.replace(/vbscript\s*:/gi, '')
  
  return sanitized
}

/**
 * MarkdownContent component for rendering markdown with Tailwind Typography.
 * Uses react-markdown for safe rendering (no dangerouslySetInnerHTML).
 * Applies additional sanitization for XSS prevention.
 * 
 * Requirements: 5.1, 5.2, 5.4
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  const sanitizedContent = sanitizeMarkdown(content)
  
  return (
    <div className="prose dark:prose-invert prose-slate max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown>{sanitizedContent}</ReactMarkdown>
    </div>
  )
}
