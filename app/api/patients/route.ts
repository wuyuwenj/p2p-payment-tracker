import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET - Fetch aggregated patient data for the authenticated user
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch both payment types
    const [insurancePayments, venmoPayments] = await Promise.all([
      prisma.insurancePayment.findMany({
        where: { userId: session.user.id },
      }),
      prisma.venmoPayment.findMany({
        where: { userId: session.user.id },
      }),
    ])

    // Group by patient (memberID + name)
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

    // Process insurance payments
    insurancePayments.forEach((payment) => {
      const key =
        `${payment.memberSubscriberID}|||${payment.payeeName}`.toLowerCase()
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

    // Process Venmo payments
    venmoPayments.forEach((payment) => {
      const key =
        `${payment.memberSubscriberID}|||${payment.patientName}`.toLowerCase()
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
