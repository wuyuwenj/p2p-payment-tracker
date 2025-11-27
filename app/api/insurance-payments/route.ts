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

    // Transform and create payments
    const dataToInsert = payments.map((p: any) => ({
      userId: session.user!.id,
      claimStatus: p.claimStatus || null,
      datesOfService: p.datesOfService || null,
      memberSubscriberID: p.memberSubscriberID || "",
      providerName: p.providerName || null,
      paymentDate: p.paymentDate || null,
      checkNumber: p.checkNumber || null,
      checkEFTAmount: p.checkEFTAmount || 0,
      payeeName: p.payeeName || "Unknown",
      payeeAddress: p.payeeAddress || null,
    }))

    console.log("Inserting payments:", dataToInsert.length)
    console.log("First record:", dataToInsert[0])

    const created = await prisma.insurancePayment.createMany({
      data: dataToInsert,
    })

    return NextResponse.json({ count: created.count })
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
