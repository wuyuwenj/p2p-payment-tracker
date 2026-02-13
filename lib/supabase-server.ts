import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function createClient() {
  const cookieStore = await cookies()

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase Auth credentials not configured.')
  }

  return createServerClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

// Helper to get current user from Supabase Auth
// Also ensures the user exists in the Prisma users table (for FK constraints)
export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Ensure user exists in Prisma DB (handles Google OAuth and other sign-in methods
  // where the user may exist in Supabase Auth but not in the local users table).
  // Also handles migration from NextAuth where an old user record may exist with the
  // same email but a different ID — we reassign their data to the new Supabase Auth ID.
  const existing = await prisma.user.findUnique({ where: { id: user.id } })
  if (!existing) {
    const email = user.email || `${user.id}@unknown.local`
    const oldUser = await prisma.user.findUnique({ where: { email } })

    if (oldUser) {
      // Migrate from old NextAuth user to new Supabase Auth user:
      // 1. Clear old user's email to free the unique constraint
      // 2. Create new user with correct Supabase Auth ID
      // 3. Migrate payment FKs from old ID to new ID
      // 4. Delete old user (cascades Account/Session — fine, those are stale NextAuth records)
      await prisma.$transaction([
        prisma.user.update({
          where: { id: oldUser.id },
          data: { email: `migrating-${oldUser.id}@placeholder.local` },
        }),
        prisma.user.create({
          data: {
            id: user.id,
            email,
            username: user.user_metadata?.username || oldUser.username,
            name: user.user_metadata?.name || user.user_metadata?.full_name || oldUser.name,
            image: user.user_metadata?.avatar_url || oldUser.image,
          },
        }),
        prisma.insurancePayment.updateMany({
          where: { userId: oldUser.id },
          data: { userId: user.id },
        }),
        prisma.venmoPayment.updateMany({
          where: { userId: oldUser.id },
          data: { userId: user.id },
        }),
        prisma.user.delete({ where: { id: oldUser.id } }),
      ])
    } else {
      await prisma.user.create({
        data: {
          id: user.id,
          email,
          username: user.user_metadata?.username || null,
          name: user.user_metadata?.name || user.user_metadata?.full_name || null,
          image: user.user_metadata?.avatar_url || null,
        },
      })
    }
  }

  return user
}

// Helper to require auth (throws if not authenticated)
export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized - Please sign in')
  }
  return { user, userId: user.id }
}
