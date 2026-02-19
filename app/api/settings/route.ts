import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"

// GET - Return settings for the authenticated user
export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await prisma.userSetting.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({
      ignoredAddresses: settings?.ignoredAddresses ?? [],
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

// PATCH - Update settings for the authenticated user
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { ignoredAddresses } = body

    if (!Array.isArray(ignoredAddresses)) {
      return NextResponse.json({ error: "ignoredAddresses must be an array" }, { status: 400 })
    }

    const settings = await prisma.userSetting.upsert({
      where: { userId: user.id },
      update: { ignoredAddresses },
      create: { userId: user.id, ignoredAddresses },
    })

    return NextResponse.json({ ignoredAddresses: settings.ignoredAddresses })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
