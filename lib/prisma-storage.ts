import { prisma, isPrismaConfigured } from './prisma'
import { InsurancePayment, VenmoPayment } from './types'
import { storage as localStorageBackup } from './storage'

// Prisma database storage layer with localStorage fallback
export const prismaStorage = {
  // Insurance Payments
  getInsurancePayments: async (userId?: string): Promise<InsurancePayment[]> => {
    if (!isPrismaConfigured()) {
      console.log('Using localStorage fallback - Prisma not configured')
      return localStorageBackup.getInsurancePayments()
    }

    try {
      const payments = await prisma.insurancePayment.findMany({
        where: userId ? { userId } : undefined,
        orderBy: {
          paymentDate: 'desc',
        },
      })

      // Convert Prisma Decimal to number for our interface
      return payments.map(p => ({
        id: p.id,
        claimStatus: p.claimStatus || '',
        datesOfService: p.datesOfService || '',
        memberSubscriberID: p.memberSubscriberID,
        providerName: p.providerName || '',
        paymentDate: p.paymentDate || '',
        checkNumber: p.checkNumber || '',
        checkEFTAmount: p.checkEFTAmount.toNumber(),
        payeeName: p.payeeName,
        payeeAddress: p.payeeAddress || '',
        trackingStatus: p.trackingStatus,
      }))
    } catch (error) {
      console.error('Error fetching insurance payments from Prisma:', error)
      console.log('Falling back to localStorage')
      return localStorageBackup.getInsurancePayments()
    }
  },

  addInsurancePayments: async (payments: InsurancePayment[], userId?: string): Promise<void> => {
    if (!isPrismaConfigured()) {
      localStorageBackup.addInsurancePayments(payments)
      return
    }

    if (!userId) {
      throw new Error('userId is required when using database storage')
    }

    // Type assertion to ensure TypeScript knows userId is a string here
    const userIdString = userId as string

    try {
      await prisma.insurancePayment.createMany({
        data: payments.map(p => ({
          id: p.id,
          userId: userIdString,
          claimStatus: p.claimStatus,
          datesOfService: p.datesOfService,
          memberSubscriberID: p.memberSubscriberID,
          providerName: p.providerName,
          paymentDate: p.paymentDate,
          checkNumber: p.checkNumber,
          checkEFTAmount: p.checkEFTAmount,
          payeeName: p.payeeName,
          payeeAddress: p.payeeAddress,
        })),
      })
      console.log(`✅ Added ${payments.length} insurance payments to database`)
    } catch (error) {
      console.error('Error adding insurance payments to Prisma:', error)
      throw error
    }
  },

  deleteInsurancePayment: async (id: string, userId?: string): Promise<void> => {
    if (!isPrismaConfigured()) {
      localStorageBackup.deleteInsurancePayment(id)
      return
    }

    try {
      await prisma.insurancePayment.delete({
        where: {
          id,
          ...(userId && { userId })
        },
      })
      console.log(`✅ Deleted insurance payment: ${id}`)
    } catch (error) {
      console.error('Error deleting insurance payment from Prisma:', error)
      throw error
    }
  },

  clearAllInsurancePayments: async (userId?: string): Promise<void> => {
    if (!isPrismaConfigured()) {
      localStorageBackup.saveInsurancePayments([])
      return
    }

    try {
      const result = await prisma.insurancePayment.deleteMany({
        where: userId ? { userId } : undefined,
      })
      console.log(`✅ Deleted ${result.count} insurance payments`)
    } catch (error) {
      console.error('Error clearing insurance payments from Prisma:', error)
      throw error
    }
  },

  // Venmo Payments
  getVenmoPayments: async (userId?: string): Promise<VenmoPayment[]> => {
    if (!isPrismaConfigured()) {
      return localStorageBackup.getVenmoPayments()
    }

    try {
      const payments = await prisma.venmoPayment.findMany({
        where: userId ? { userId } : undefined,
        orderBy: {
          date: 'desc',
        },
      })

      // Convert Prisma Decimal to number for our interface
      return payments.map(p => ({
        id: p.id,
        patientName: p.patientName,
        memberSubscriberID: p.memberSubscriberID,
        amount: p.amount.toNumber(),
        date: p.date,
        notes: p.notes || undefined,
      }))
    } catch (error) {
      console.error('Error fetching venmo payments from Prisma:', error)
      console.log('Falling back to localStorage')
      return localStorageBackup.getVenmoPayments()
    }
  },

  addVenmoPayments: async (payments: VenmoPayment[], userId?: string): Promise<void> => {
    if (!isPrismaConfigured()) {
      localStorageBackup.addVenmoPayments(payments)
      return
    }

    if (!userId) {
      throw new Error('userId is required when using database storage')
    }

    // Type assertion to ensure TypeScript knows userId is a string here
    const userIdString = userId as string

    try {
      await prisma.venmoPayment.createMany({
        data: payments.map(p => ({
          id: p.id,
          userId: userIdString,
          patientName: p.patientName,
          memberSubscriberID: p.memberSubscriberID,
          amount: p.amount,
          date: p.date,
          notes: p.notes || null,
        })),
      })
      console.log(`✅ Added ${payments.length} venmo payments to database`)
    } catch (error) {
      console.error('Error adding venmo payments to Prisma:', error)
      throw error
    }
  },

  deleteVenmoPayment: async (id: string, userId?: string): Promise<void> => {
    if (!isPrismaConfigured()) {
      localStorageBackup.deleteVenmoPayment(id)
      return
    }

    try {
      await prisma.venmoPayment.delete({
        where: {
          id,
          ...(userId && { userId })
        },
      })
      console.log(`✅ Deleted venmo payment: ${id}`)
    } catch (error) {
      console.error('Error deleting venmo payment from Prisma:', error)
      throw error
    }
  },

  clearAllVenmoPayments: async (userId?: string): Promise<void> => {
    if (!isPrismaConfigured()) {
      localStorageBackup.saveVenmoPayments([])
      return
    }

    try {
      const result = await prisma.venmoPayment.deleteMany({
        where: userId ? { userId } : undefined,
      })
      console.log(`✅ Deleted ${result.count} venmo payments`)
    } catch (error) {
      console.error('Error clearing venmo payments from Prisma:', error)
      throw error
    }
  },

  // Get unique patients for autocomplete
  getUniquePatients: async (userId?: string) => {
    const insurancePayments = await prismaStorage.getInsurancePayments(userId)

    // Create unique patient list
    const uniquePatients = new Map()
    insurancePayments.forEach(p => {
      const key = `${p.memberSubscriberID}|||${p.payeeName}`.toLowerCase()
      if (!uniquePatients.has(key) && p.payeeName && p.memberSubscriberID) {
        uniquePatients.set(key, {
          memberId: p.memberSubscriberID,
          name: p.payeeName
        })
      }
    })

    return Array.from(uniquePatients.values())
  }
}

// Export as default dbStorage for compatibility
export const dbStorage = prismaStorage
