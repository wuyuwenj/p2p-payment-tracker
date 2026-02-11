'use client'

import { AuthProvider as SupabaseAuthProvider } from '@/contexts/AuthContext'
import { ReactNode } from 'react'

export default function AuthProvider({ children }: { children: ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}
