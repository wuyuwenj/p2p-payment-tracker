'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export default function AuthProvider({ children }: { children: ReactNode }) {
  // @ts-expect-error - React 19 type compatibility issue with next-auth
  return <SessionProvider>{children}</SessionProvider>
}
