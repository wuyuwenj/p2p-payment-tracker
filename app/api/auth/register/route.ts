import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const { password, username, name } = await request.json()

    // Validate required fields
    if (!password || !username) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      )
    }

    // Auto-generate internal email from username
    const email = `${username.toLowerCase()}@internal.local`

    // Validate username format (alphanumeric, underscores, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters and contain only letters, numbers, and underscores" },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      )
    }

    // Create user via Supabase Admin API (skips email confirmation)
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username.toLowerCase(),
        name: name || username,
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      )
    }

    // Create or update user in our database
    await prisma.user.upsert({
      where: { id: authData.user.id },
      update: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        name: name || username,
      },
      create: {
        id: authData.user.id,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        name: name || username,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
    })
  } catch (error) {
    console.error("Registration error:", error)
    const message = error instanceof Error ? error.message : "Failed to create account"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
