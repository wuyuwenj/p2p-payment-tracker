import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET - Fetch all insurance payments for the authenticated user
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payments = await prisma.insurancePayment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })

    // Transform to match frontend interface (snake_case to camelCase)
    const transformed = payments.map((p) => ({
      id: p.id,
      claimStatus: p.claimStatus || "",
      datesOfService: p.datesOfService || "",
      memberSubscriberID: p.memberSubscriberID,
      providerName: p.providerName || "",
      paymentDate: p.paymentDate || "",
      claimNumber: p.claimNumber || "",
      checkNumber: p.checkNumber || "",
      checkEFTAmount: Number(p.checkEFTAmount),
      payeeName: p.payeeName,
      payeeAddress: p.payeeAddress || "",
      trackingStatus: p.trackingStatus,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error fetching insurance payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}

// POST - Create new insurance payments (bulk import)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { payments } = await request.json()

    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: "No payments provided" },
        { status: 400 }
      )
    }

    // Get userId and ensure it's a string
    const userId = session.user.id as string

    // Upsert payments based on memberSubscriberID + datesOfService
    let createdCount = 0
    let updatedCount = 0

    for (const p of payments) {
      const paymentData = {
        userId,
        claimStatus: p.claimStatus || null,
        datesOfService: p.datesOfService || null,
        memberSubscriberID: p.memberSubscriberID || "",
        providerName: p.providerName || null,
        paymentDate: p.paymentDate || null,
        claimNumber: p.claimNumber || null,
        checkNumber: p.checkNumber || null,
        checkEFTAmount: p.checkEFTAmount || 0,
        payeeName: p.payeeName || "Unknown",
        payeeAddress: p.payeeAddress || null,
      }

      // Try to find existing record by memberSubscriberID + datesOfService
      const existing = await prisma.insurancePayment.findFirst({
        where: {
          userId,
          memberSubscriberID: paymentData.memberSubscriberID,
          datesOfService: paymentData.datesOfService,
        },
      })

      if (existing) {
        // Update existing record
        await prisma.insurancePayment.update({
          where: { id: existing.id },
          data: paymentData,
        })
        updatedCount++
      } else {
        // Create new record
        await prisma.insurancePayment.create({
          data: paymentData,
        })
        createdCount++
      }
    }

    return NextResponse.json({
      created: createdCount,
      updated: updatedCount,
      total: createdCount + updatedCount
    })
  } catch (error) {
    console.error("Error creating insurance payments:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payments" },
      { status: 500 }
    )
  }
}

// DELETE - Clear all insurance payments for the authenticated user
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.insurancePayment.deleteMany({
      where: { userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting insurance payments:", error)
    return NextResponse.json(
      { error: "Failed to delete payments" },
      { status: 500 }
    )
  }
}
