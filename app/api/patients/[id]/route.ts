import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"

// DELETE - Remove all payments for a patient (dev only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 })
  }

  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const decoded = decodeURIComponent(id)
    const separatorIndex = decoded.indexOf("|||")
    const memberID = (separatorIndex === -1 ? decoded : decoded.substring(0, separatorIndex)).trim()
    const patientName = separatorIndex === -1 ? null : decoded.substring(separatorIndex + 3).trim()

    // Build conditions matching the same logic as GET
    const insuranceWhere = memberID
      ? {
          userId: user.id,
          OR: [
            { memberSubscriberID: { equals: memberID, mode: "insensitive" as const } },
            ...(patientName ? [{ payeeName: { equals: patientName, mode: "insensitive" as const }, memberSubscriberID: "" }] : []),
          ],
        }
      : { userId: user.id, payeeName: { equals: patientName!, mode: "insensitive" as const } }

    const venmoWhere = memberID
      ? {
          userId: user.id,
          OR: [
            { memberSubscriberID: { equals: memberID, mode: "insensitive" as const } },
            ...(patientName ? [{ patientName: { equals: patientName, mode: "insensitive" as const }, memberSubscriberID: "" }] : []),
          ],
        }
      : { userId: user.id, patientName: { equals: patientName!, mode: "insensitive" as const } }

    const [insurance, venmo] = await Promise.all([
      prisma.insurancePayment.deleteMany({ where: insuranceWhere }),
      prisma.venmoPayment.deleteMany({ where: venmoWhere }),
    ])

    return NextResponse.json({ deletedInsurance: insurance.count, deletedVenmo: venmo.count })
  } catch (error) {
    console.error("Error deleting patient:", error)
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 })
  }
}

// GET - Fetch specific patient data (insurance + venmo payments)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    // Decode the patient ID (format: memberID|||patientName or just memberID)
    const decoded = decodeURIComponent(id)
    const separatorIndex = decoded.indexOf("|||")

    const memberID = (separatorIndex === -1
      ? decoded
      : decoded.substring(0, separatorIndex)).trim()
    const patientNameFromUrl = separatorIndex === -1
      ? null
      : decoded.substring(separatorIndex + 3).trim()

    // Determine if we're looking up by name (no member ID) or by member ID
    const lookupByName = !memberID && patientNameFromUrl

    if (!memberID && !patientNameFromUrl) {
      return NextResponse.json(
        { error: "Member ID or patient name is required" },
        { status: 400 }
      )
    }

    // Fetch payments — by memberID if available, otherwise by patient name
    // When looking up by memberID, also include records with the same name but no memberID
    let insurancePayments, venmoPayments

    if (lookupByName) {
      [insurancePayments, venmoPayments] = await Promise.all([
        prisma.insurancePayment.findMany({
          where: { userId: user.id, payeeName: { equals: patientNameFromUrl, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.venmoPayment.findMany({
          where: { userId: user.id, patientName: { equals: patientNameFromUrl, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
        }),
      ])
    } else {
      // First fetch by memberID to find the patient name
      const byMemberId = await prisma.insurancePayment.findFirst({
        where: { userId: user.id, memberSubscriberID: { equals: memberID, mode: "insensitive" } },
        select: { payeeName: true },
      })
      const resolvedName = (byMemberId?.payeeName || patientNameFromUrl || '').trim();

      console.log('[patient-detail] memberID:', memberID)
      console.log('[patient-detail] patientNameFromUrl:', patientNameFromUrl)
      console.log('[patient-detail] resolvedName:', resolvedName)

      // Fetch by memberID OR by name with empty/null memberID
      const nameCondition = resolvedName
        ? [
            { memberSubscriberID: { equals: memberID, mode: "insensitive" as const } },
            { payeeName: { equals: resolvedName, mode: "insensitive" as const }, memberSubscriberID: "" },
          ]
        : [{ memberSubscriberID: { equals: memberID, mode: "insensitive" as const } }]

      const venmoNameCondition = resolvedName
        ? [
            { memberSubscriberID: { equals: memberID, mode: "insensitive" as const } },
            { patientName: { equals: resolvedName, mode: "insensitive" as const }, memberSubscriberID: "" },
          ]
        : [{ memberSubscriberID: { equals: memberID, mode: "insensitive" as const } }]

      console.log('[patient-detail] nameCondition:', JSON.stringify(nameCondition))

      ;[insurancePayments, venmoPayments] = await Promise.all([
        prisma.insurancePayment.findMany({
          where: { userId: user.id, OR: nameCondition },
          orderBy: { createdAt: "desc" },
        }),
        prisma.venmoPayment.findMany({
          where: { userId: user.id, OR: venmoNameCondition },
          orderBy: { createdAt: "desc" },
        }),
      ])

      console.log('[patient-detail] insurance count:', insurancePayments.length)
      // Log a sample of memberSubscriberID values to see what the no-memberID records actually have
      const byMemberIdCount = insurancePayments.filter(p => p.memberSubscriberID && p.memberSubscriberID.toLowerCase() === memberID.toLowerCase()).length
      const byNameCount = insurancePayments.filter(p => !p.memberSubscriberID || p.memberSubscriberID === '').length
      const otherCount = insurancePayments.length - byMemberIdCount - byNameCount
      console.log('[patient-detail] by memberID:', byMemberIdCount, 'by empty memberID:', byNameCount, 'other:', otherCount)
      // Log unique memberSubscriberID values
      const uniqueIds = [...new Set(insurancePayments.map(p => `"${p.memberSubscriberID}"`))]
      console.log('[patient-detail] unique memberSubscriberIDs:', uniqueIds.join(', '))
    }

    // Determine the display name
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
      patientInfo: { memberID: memberID || '', name: patientName },
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
