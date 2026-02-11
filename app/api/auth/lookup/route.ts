import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Look up email by username for login
export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ email: user.email })
  } catch (error) {
    console.error("Lookup error:", error)
    return NextResponse.json(
      { error: "Failed to lookup user" },
      { status: 500 }
    )
  }
}
