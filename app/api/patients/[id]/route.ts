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
    // Decode the patient ID (format: memberID|||patientName)
    const decoded = decodeURIComponent(id)
    const separatorIndex = decoded.indexOf("|||")

    if (separatorIndex === -1) {
      return NextResponse.json(
        { error: "Invalid patient ID format" },
        { status: 400 }
      )
    }

    const memberID = decoded.substring(0, separatorIndex)
    const patientName = decoded.substring(separatorIndex + 3)

    if (!patientName) {
      return NextResponse.json(
        { error: "Patient name is required" },
        { status: 400 }
      )
    }

    // Fetch payments for this patient
    const [insurancePayments, venmoPayments] = await Promise.all([
      prisma.insurancePayment.findMany({
        where: {
          userId: session.user.id,
          memberSubscriberID: { equals: memberID, mode: "insensitive" },
          payeeName: { equals: patientName, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.venmoPayment.findMany({
        where: {
          userId: session.user.id,
          memberSubscriberID: { equals: memberID, mode: "insensitive" },
          patientName: { equals: patientName, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

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
