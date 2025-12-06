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

    // Fetch all existing records for this user in one query (optimized)
    const existingPayments = await prisma.insurancePayment.findMany({
      where: { userId },
      select: { id: true, memberSubscriberID: true, datesOfService: true },
    })

    // Create a map for fast lookup: key = memberSubscriberID|datesOfService
    const existingMap = new Map<string, string>()
    existingPayments.forEach(p => {
      const key = `${p.memberSubscriberID}|${p.datesOfService || ''}`
      existingMap.set(key, p.id)
    })

    // Separate into records to create vs update
    const toCreate: typeof payments = []
    const toUpdate: { id: string; data: Record<string, unknown> }[] = []

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

      const key = `${paymentData.memberSubscriberID}|${paymentData.datesOfService || ''}`
      const existingId = existingMap.get(key)

      if (existingId && existingId !== 'pending') {
        // Only update if we have a real existing record ID
        toUpdate.push({ id: existingId, data: paymentData })
        // Mark as pending to avoid duplicate updates from same import
        existingMap.set(key, 'pending')
      } else if (!existingId) {
        // New record - add to create list
        toCreate.push(paymentData)
        // Add to map to prevent duplicates within same import
        existingMap.set(key, 'pending')
      }
      // If existingId === 'pending', skip (duplicate in same import)
    }

    // Batch create new records
    let createdCount = 0
    if (toCreate.length > 0) {
      const result = await prisma.insurancePayment.createMany({
        data: toCreate,
        skipDuplicates: true,
      })
      createdCount = result.count
    }

    // Update existing records (still need individual updates for different data)
    let updatedCount = 0
    for (const { id, data } of toUpdate) {
      await prisma.insurancePayment.update({
        where: { id },
        data,
      })
      updatedCount++
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
