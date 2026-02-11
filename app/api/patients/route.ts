import { NextResponse } from "next/server"
import { getUser } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"

// GET - Fetch aggregated patient data for the authenticated user
export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch both payment types
    const [insurancePayments, venmoPayments] = await Promise.all([
      prisma.insurancePayment.findMany({
        where: { userId: user.id },
      }),
      prisma.venmoPayment.findMany({
        where: { userId: user.id },
      }),
    ])

    // Group by patient using memberSubscriberID only (name formats may differ between sources)
    const patientMap = new Map<
      string,
      {
        memberID: string
        name: string
        totalInsurance: number
        totalVenmo: number
        insuranceCount: number
        venmoCount: number
      }
    >()

    // Process insurance payments first (these typically have the canonical name format)
    insurancePayments.forEach((payment) => {
      const key = payment.memberSubscriberID.toLowerCase()
      if (!patientMap.has(key)) {
        patientMap.set(key, {
          memberID: payment.memberSubscriberID,
          name: payment.payeeName,
          totalInsurance: 0,
          totalVenmo: 0,
          insuranceCount: 0,
          venmoCount: 0,
        })
      }
      const patient = patientMap.get(key)!
      patient.totalInsurance += Number(payment.checkEFTAmount)
      patient.insuranceCount++
    })

    // Process Venmo payments (link to existing patient by memberID, or create new if not found)
    venmoPayments.forEach((payment) => {
      const key = payment.memberSubscriberID.toLowerCase()
      if (!patientMap.has(key)) {
        patientMap.set(key, {
          memberID: payment.memberSubscriberID,
          name: payment.patientName,
          totalInsurance: 0,
          totalVenmo: 0,
          insuranceCount: 0,
          venmoCount: 0,
        })
      }
      const patient = patientMap.get(key)!
      patient.totalVenmo += Number(payment.amount)
      patient.venmoCount++
    })

    // Calculate balances and format output
    const patients = Array.from(patientMap.values()).map((p) => ({
      ...p,
      balance: p.totalInsurance - p.totalVenmo,
    }))

    // Sort by balance (descending)
    patients.sort((a, b) => b.balance - a.balance)

    return NextResponse.json(patients)
  } catch (error) {
    console.error("Error fetching patients:", error)
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    )
  }
}
