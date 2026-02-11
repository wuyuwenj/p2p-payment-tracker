import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"

// DELETE - Delete a specific venmo payment
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
    const payment = await prisma.venmoPayment.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    await prisma.venmoPayment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting venmo payment:", error)
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    )
  }
}
