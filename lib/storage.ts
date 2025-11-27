import { InsurancePayment, VenmoPayment } from './types';

const INSURANCE_PAYMENTS_KEY = 'insurancePayments';
const VENMO_PAYMENTS_KEY = 'venmoPayments';

export const storage = {
  // Insurance Payments
  getInsurancePayments: (): InsurancePayment[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(INSURANCE_PAYMENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveInsurancePayments: (payments: InsurancePayment[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(INSURANCE_PAYMENTS_KEY, JSON.stringify(payments));
  },

  addInsurancePayments: (newPayments: InsurancePayment[]): void => {
    const existing = storage.getInsurancePayments();
    storage.saveInsurancePayments([...existing, ...newPayments]);
  },

  deleteInsurancePayment: (id: string): void => {
    const existing = storage.getInsurancePayments();
    storage.saveInsurancePayments(existing.filter(p => p.id !== id));
  },

  // Venmo Payments
  getVenmoPayments: (): VenmoPayment[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(VENMO_PAYMENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveVenmoPayments: (payments: VenmoPayment[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(VENMO_PAYMENTS_KEY, JSON.stringify(payments));
  },

  addVenmoPayments: (newPayments: VenmoPayment[]): void => {
    const existing = storage.getVenmoPayments();
    storage.saveVenmoPayments([...existing, ...newPayments]);
  },

  deleteVenmoPayment: (id: string): void => {
    const existing = storage.getVenmoPayments();
    storage.saveVenmoPayments(existing.filter(p => p.id !== id));
  },

  // Clear all data
  clearAll: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(INSURANCE_PAYMENTS_KEY);
    localStorage.removeItem(VENMO_PAYMENTS_KEY);
  }
};
