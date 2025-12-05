import { supabase, isSupabaseConfigured } from './supabase'
import { InsurancePayment, VenmoPayment } from './types'
import { storage as localStorageBackup } from './storage'

// Database storage layer with localStorage fallback
export const dbStorage = {
  // Insurance Payments
  getInsurancePayments: async (): Promise<InsurancePayment[]> => {
    if (!isSupabaseConfigured()) {
      console.log('Using localStorage fallback')
      return localStorageBackup.getInsurancePayments()
    }

    try {
      const { data, error } = await supabase
        .from('insurance_payments')
        .select('*')
        .order('payment_date', { ascending: false })

      if (error) throw error

      // Map database fields to TypeScript interface
      return (data || []).map(row => ({
        id: row.id,
        claimStatus: row.claim_status || '',
        datesOfService: row.dates_of_service || '',
        memberSubscriberID: row.member_subscriber_id || '',
        providerName: row.provider_name || '',
        paymentDate: row.payment_date || '',
        claimNumber: row.claim_number || '',
        checkNumber: row.check_number || '',
        checkEFTAmount: parseFloat(row.check_eft_amount) || 0,
        payeeName: row.payee_name || '',
        payeeAddress: row.payee_address || '',
        trackingStatus: row.tracking_status || 'PENDING',
      }))
    } catch (error) {
      console.error('Error fetching insurance payments:', error)
      return []
    }
  },

  addInsurancePayments: async (payments: InsurancePayment[]): Promise<void> => {
    if (!isSupabaseConfigured()) {
      localStorageBackup.addInsurancePayments(payments)
      return
    }

    try {
      // Map TypeScript interface to database fields
      const dbPayments = payments.map(p => ({
        id: p.id,
        claim_status: p.claimStatus,
        dates_of_service: p.datesOfService,
        member_subscriber_id: p.memberSubscriberID,
        provider_name: p.providerName,
        payment_date: p.paymentDate,
        claim_number: p.claimNumber,
        check_number: p.checkNumber,
        check_eft_amount: p.checkEFTAmount,
        payee_name: p.payeeName,
        payee_address: p.payeeAddress,
      }))

      const { error } = await supabase
        .from('insurance_payments')
        .insert(dbPayments)

      if (error) throw error
    } catch (error) {
      console.error('Error adding insurance payments:', error)
      throw error
    }
  },

  deleteInsurancePayment: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      localStorageBackup.deleteInsurancePayment(id)
      return
    }

    try {
      const { error } = await supabase
        .from('insurance_payments')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting insurance payment:', error)
      throw error
    }
  },

  clearAllInsurancePayments: async (): Promise<void> => {
    if (!isSupabaseConfigured()) {
      localStorageBackup.saveInsurancePayments([])
      return
    }

    try {
      const { error } = await supabase
        .from('insurance_payments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (error) throw error
    } catch (error) {
      console.error('Error clearing insurance payments:', error)
      throw error
    }
  },

  // Venmo Payments
  getVenmoPayments: async (): Promise<VenmoPayment[]> => {
    if (!isSupabaseConfigured()) {
      return localStorageBackup.getVenmoPayments()
    }

    try {
      const { data, error } = await supabase
        .from('venmo_payments')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error

      // Map database fields to TypeScript interface
      return (data || []).map(row => ({
        id: row.id,
        patientName: row.patient_name || '',
        memberSubscriberID: row.member_subscriber_id || '',
        amount: parseFloat(row.amount) || 0,
        date: row.date || '',
        notes: row.notes || '',
      }))
    } catch (error) {
      console.error('Error fetching venmo payments:', error)
      return []
    }
  },

  addVenmoPayments: async (payments: VenmoPayment[]): Promise<void> => {
    if (!isSupabaseConfigured()) {
      localStorageBackup.addVenmoPayments(payments)
      return
    }

    try {
      // Map TypeScript interface to database fields
      const dbPayments = payments.map(p => ({
        id: p.id,
        patient_name: p.patientName,
        member_subscriber_id: p.memberSubscriberID,
        amount: p.amount,
        date: p.date,
        notes: p.notes || null,
      }))

      const { error } = await supabase
        .from('venmo_payments')
        .insert(dbPayments)

      if (error) throw error
    } catch (error) {
      console.error('Error adding venmo payments:', error)
      throw error
    }
  },

  deleteVenmoPayment: async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      localStorageBackup.deleteVenmoPayment(id)
      return
    }

    try {
      const { error } = await supabase
        .from('venmo_payments')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting venmo payment:', error)
      throw error
    }
  },

  clearAllVenmoPayments: async (): Promise<void> => {
    if (!isSupabaseConfigured()) {
      localStorageBackup.saveVenmoPayments([])
      return
    }

    try {
      const { error } = await supabase
        .from('venmo_payments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (error) throw error
    } catch (error) {
      console.error('Error clearing venmo payments:', error)
      throw error
    }
  },

  // Get unique patients for autocomplete
  getUniquePatients: async () => {
    const insurancePayments = await dbStorage.getInsurancePayments()

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
