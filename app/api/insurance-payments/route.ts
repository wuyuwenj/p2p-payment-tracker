import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"
import { normalizeDate } from "@/lib/utils"

// GET - Fetch all insurance payments for the authenticated user
export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payments = await prisma.insurancePayment.findMany({
      where: { userId: user.id },
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
    const user = await getUser()
    if (!user) {
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
    const userId = user.id

    // Fetch all existing records for this user in one query (optimized)
    const existingPayments = await prisma.insurancePayment.findMany({
      where: { userId },
      select: { id: true, payeeName: true, memberSubscriberID: true, datesOfService: true, checkNumber: true, paymentDate: true },
    })

    // Create a map for fast lookup: key = payeeName|memberSubscriberID|datesOfService|checkNumber
    // Payment date excluded so same service date is treated as duplicate regardless of payment date
    // Normalize dates so MM/DD/YY and MM/DD/YYYY are treated as the same
    const existingMap = new Map<string, string>()
    existingPayments.forEach(p => {
      const key = `${p.payeeName}|${p.memberSubscriberID}|${normalizeDate(p.datesOfService || '')}|${p.checkNumber || ''}`
      existingMap.set(key, p.id)
    })

    // Separate into records to create vs update
    const toCreate: typeof payments = []
    const toUpdate: { id: string; data: Record<string, unknown> }[] = []

    for (const p of payments) {
      const paymentData = {
        userId,
        claimStatus: p.claimStatus || null,
        datesOfService: normalizeDate(p.datesOfService || '') || null,
        memberSubscriberID: p.memberSubscriberID || "",
        providerName: p.providerName || null,
        paymentDate: normalizeDate(p.paymentDate || '') || null,
        claimNumber: p.claimNumber || null,
        checkNumber: p.checkNumber || null,
        checkEFTAmount: p.checkEFTAmount || 0,
        payeeName: p.payeeName || "Unknown",
        payeeAddress: p.payeeAddress || null,
      }

      const key = `${paymentData.payeeName}|${paymentData.memberSubscriberID}|${paymentData.datesOfService || ''}|${paymentData.checkNumber || ''}`
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
      // If existingId === 'pending', skip (exact duplicate in same import)
    }

    // Create new records and collect their IDs
    const createdIds: string[] = []
    if (toCreate.length > 0) {
      // Use individual creates to get IDs back
      const createPromises = toCreate.map(data =>
        prisma.insurancePayment.create({ data, select: { id: true } })
      )
      const createdRecords = await Promise.all(createPromises)
      createdIds.push(...createdRecords.map(r => r.id))
    }

    // Update existing records and collect their IDs
    const updatedIds: string[] = []
    for (const { id, data } of toUpdate) {
      await prisma.insurancePayment.update({
        where: { id },
        data,
      })
      updatedIds.push(id)
    }

    return NextResponse.json({
      created: createdIds.length,
      updated: updatedIds.length,
      total: createdIds.length + updatedIds.length,
      ids: [...createdIds, ...updatedIds],
      count: createdIds.length + updatedIds.length
    })
  } catch (error) {
    console.error("Error creating insurance payments:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payments" },
      { status: 500 }
    )
  }
}

// PATCH - Merge duplicate insurance payments (same service date + amount + patient)
export async function PATCH() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const allPayments = await prisma.insurancePayment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    // Group by normalized service date + amount + patient key
    const groups = new Map<string, typeof allPayments>()
    for (const p of allPayments) {
      const normService = normalizeDate(p.datesOfService || '')
      const key = `${p.payeeName}|${p.memberSubscriberID}|${normService}|${Number(p.checkEFTAmount)}`
      const group = groups.get(key) || []
      group.push(p)
      groups.set(key, group)
    }

    const idsToDelete: string[] = []
    const toNormalize: { id: string; datesOfService: string; paymentDate: string }[] = []

    for (const [, group] of groups) {
      if (group.length <= 1) {
        // Single record - just normalize its dates
        const p = group[0]
        const normService = normalizeDate(p.datesOfService || '')
        const normPayment = normalizeDate(p.paymentDate || '')
        if (normService !== (p.datesOfService || '') || normPayment !== (p.paymentDate || '')) {
          toNormalize.push({ id: p.id, datesOfService: normService, paymentDate: normPayment })
        }
        continue
      }

      // Pick the best record: prefer 4-digit year payment date, non-PENDING status, most fields filled
      group.sort((a, b) => {
        const aHas4Digit = /\/\d{4}$/.test(a.paymentDate || '') ? 1 : 0
        const bHas4Digit = /\/\d{4}$/.test(b.paymentDate || '') ? 1 : 0
        if (bHas4Digit !== aHas4Digit) return bHas4Digit - aHas4Digit
        const aNonPending = a.trackingStatus !== 'PENDING' ? 1 : 0
        const bNonPending = b.trackingStatus !== 'PENDING' ? 1 : 0
        if (bNonPending !== aNonPending) return bNonPending - aNonPending
        return 0
      })

      const keeper = group[0]
      // Normalize the keeper's dates
      const normService = normalizeDate(keeper.datesOfService || '')
      const normPayment = normalizeDate(keeper.paymentDate || '')
      if (normService !== (keeper.datesOfService || '') || normPayment !== (keeper.paymentDate || '')) {
        toNormalize.push({ id: keeper.id, datesOfService: normService, paymentDate: normPayment })
      }

      // Mark the rest for deletion
      for (let i = 1; i < group.length; i++) {
        idsToDelete.push(group[i].id)
      }
    }

    // Normalize dates on kept records
    for (const { id, datesOfService, paymentDate } of toNormalize) {
      await prisma.insurancePayment.update({
        where: { id },
        data: { datesOfService, paymentDate },
      })
    }

    // Delete duplicates
    if (idsToDelete.length > 0) {
      await prisma.insurancePayment.deleteMany({
        where: { id: { in: idsToDelete } },
      })
    }

    return NextResponse.json({
      merged: idsToDelete.length,
      normalized: toNormalize.length,
    })
  } catch (error) {
    console.error("Error merging duplicates:", error)
    return NextResponse.json(
      { error: "Failed to merge duplicates" },
      { status: 500 }
    )
  }
}

// DELETE - Clear all insurance payments for the authenticated user (dev only)
export async function DELETE() {
  try {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Bulk delete is only available in development" }, { status: 403 })
    }

    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.insurancePayment.deleteMany({
      where: { userId: user.id },
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
