'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loginSchema, registerSchema } from '@/lib/validations'
import { formatZodErrors } from '@/lib/zod-utils'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Server Action for user login.
 * Validates input with Zod and authenticates via Supabase Auth.
 * Requirements: 1.1, 1.2, 9.3
 */
export async function loginAction(formData: FormData): Promise<ActionResultV2> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  // Server-side Zod validation (Requirement 9.3)
  const validationResult = loginSchema.safeParse(rawData)
  
  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const { email, password } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // Authenticate via Supabase Auth (Requirement 1.2)
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  // Redirect to dashboard on success (Requirement 1.2)
  redirect('/dashboard')
}


/**
 * Server Action for user registration.
 * Validates input with Zod and creates account via Supabase Auth.
 * Requirements: 1.1, 9.3
 */
export async function registerAction(formData: FormData): Promise<ActionResultV2> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  }

  // Server-side Zod validation (Requirement 9.3)
  const validationResult = registerSchema.safeParse(rawData)
  
  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const { email, password } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // Create new user account via Supabase Auth (Requirement 1.1)
  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  // Redirect to dashboard on success (Requirement 1.1)
  redirect('/dashboard')
}

/**
 * Server Action for user logout.
 * Terminates the session and redirects to landing page.
 * Requirements: 1.5
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  
  // Terminate session (Requirement 1.5)
  await supabase.auth.signOut()
  
  // Redirect to landing page (Requirement 1.5)
  redirect('/')
}
