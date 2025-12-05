import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET - Fetch specific patient data (insurance + venmo payments)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    // Decode the patient ID (format: memberID|||patientName or just memberID for backwards compat)
    const decoded = decodeURIComponent(id)
    const separatorIndex = decoded.indexOf("|||")

    // Support both old format (memberID|||name) and new format (just memberID)
    const memberID = separatorIndex === -1
      ? decoded
      : decoded.substring(0, separatorIndex)
    const patientNameFromUrl = separatorIndex === -1
      ? null
      : decoded.substring(separatorIndex + 3)

    if (!memberID) {
      return NextResponse.json(
        { error: "Member ID is required" },
        { status: 400 }
      )
    }

    // Fetch payments for this patient by memberID only (name formats may differ)
    const [insurancePayments, venmoPayments] = await Promise.all([
      prisma.insurancePayment.findMany({
        where: {
          userId: session.user.id,
          memberSubscriberID: { equals: memberID, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.venmoPayment.findMany({
        where: {
          userId: session.user.id,
          memberSubscriberID: { equals: memberID, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    // Determine the display name (prefer insurance payment name, fall back to venmo, then URL)
    const patientName = insurancePayments[0]?.payeeName
      || venmoPayments[0]?.patientName
      || patientNameFromUrl
      || "Unknown"

    // Transform to frontend format
    const transformedInsurance = insurancePayments.map((p) => ({
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

    const transformedVenmo = venmoPayments.map((p) => ({
      id: p.id,
      patientName: p.patientName,
      memberSubscriberID: p.memberSubscriberID,
      amount: Number(p.amount),
      date: p.date,
      notes: p.notes || "",
    }))

    return NextResponse.json({
      patientInfo: { memberID, name: patientName },
      insurancePayments: transformedInsurance,
      venmoPayments: transformedVenmo,
    })
  } catch (error) {
    console.error("Error fetching patient details:", error)
    return NextResponse.json(
      { error: "Failed to fetch patient details" },
      { status: 500 }
    )
  }
}
