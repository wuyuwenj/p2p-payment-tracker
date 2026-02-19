'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface SettingsContextType {
  ignoredAddresses: string[]
  addIgnoredAddress: (address: string) => Promise<void>
  removeIgnoredAddress: (address: string) => Promise<void>
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [ignoredAddresses, setIgnoredAddresses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user) {
      fetch('/api/settings')
        .then(r => r.json())
        .then(data => setIgnoredAddresses(data.ignoredAddresses ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, user])

  const save = async (addresses: string[]) => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignoredAddresses: addresses }),
    })
    setIgnoredAddresses(addresses)
  }

  const addIgnoredAddress = async (address: string) => {
    const trimmed = address.trim()
    if (!trimmed || ignoredAddresses.includes(trimmed)) return
    await save([...ignoredAddresses, trimmed])
  }

  const removeIgnoredAddress = async (address: string) => {
    await save(ignoredAddresses.filter(a => a !== address))
  }

  return (
    <SettingsContext.Provider value={{ ignoredAddresses, addIgnoredAddress, removeIgnoredAddress, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}
