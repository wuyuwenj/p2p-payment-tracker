import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"
import { TrackingStatus } from "@prisma/client"

// PATCH - Update tracking status for a specific insurance payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { trackingStatus } = await request.json()

    // Validate tracking status
    const validStatuses: TrackingStatus[] = ['PENDING', 'RECORDED', 'NOTIFIED', 'COLLECTED']
    if (!validStatuses.includes(trackingStatus)) {
      return NextResponse.json({ error: "Invalid tracking status" }, { status: 400 })
    }

    // Verify ownership before updating
    const payment = await prisma.insurancePayment.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    const updated = await prisma.insurancePayment.update({
      where: { id },
      data: { trackingStatus },
    })

    return NextResponse.json({
      id: updated.id,
      trackingStatus: updated.trackingStatus,
    })
  } catch (error) {
    console.error("Error updating insurance payment:", error)
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a specific insurance payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership before deleting
    const payment = await prisma.insurancePayment.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    await prisma.insurancePayment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting insurance payment:", error)
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    )
  }
}
