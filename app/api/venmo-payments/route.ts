import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET - Fetch all venmo payments for the authenticated user
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payments = await prisma.venmoPayment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })

    // Transform to match frontend interface
    const transformed = payments.map((p) => ({
      id: p.id,
      patientName: p.patientName,
      memberSubscriberID: p.memberSubscriberID,
      amount: Number(p.amount),
      date: p.date,
      notes: p.notes || "",
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error fetching venmo payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}

// POST - Create new venmo payments (bulk)
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
    const created = await prisma.venmoPayment.createMany({
      data: payments.map((p: any) => ({
        userId: session.user!.id,
        patientName: p.patientName,
        memberSubscriberID: p.memberSubscriberID,
        amount: p.amount,
        date: p.date,
        notes: p.notes || null,
      })),
    })

    return NextResponse.json({ count: created.count })
  } catch (error) {
    console.error("Error creating venmo payments:", error)
    return NextResponse.json(
      { error: "Failed to create payments" },
      { status: 500 }
    )
  }
}

// DELETE - Clear all venmo payments for the authenticated user
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.venmoPayment.deleteMany({
      where: { userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting venmo payments:", error)
    return NextResponse.json(
      { error: "Failed to delete payments" },
      { status: 500 }
    )
  }
}
