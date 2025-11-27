export type TrackingStatus = 'PENDING' | 'RECORDED' | 'NOTIFIED' | 'COLLECTED';

export interface InsurancePayment {
  id: string;
  claimStatus: string;
  datesOfService: string;
  memberSubscriberID: string;
  providerName: string;
  paymentDate: string;
  checkNumber: string;
  checkEFTAmount: number;
  payeeName: string;
  payeeAddress: string;
  trackingStatus: TrackingStatus;
}

export interface VenmoPayment {
  id: string;
  patientName: string;
  memberSubscriberID: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface ReconciliationRecord {
  memberSubscriberID: string;
  patientName: string;
  totalInsuranceAmount: number;
  totalPatientPaid: number;
  balance: number;
  insurancePayments: InsurancePayment[];
  venmoPayments: VenmoPayment[];
}
