'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { InsurancePayment, VenmoPayment } from '@/lib/types';

export default function PatientDetailsPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string; // Format: memberID|||patientName

  const [insurancePayments, setInsurancePayments] = useState<InsurancePayment[]>([]);
  const [venmoPayments, setVenmoPayments] = useState<VenmoPayment[]>([]);
  const [patientInfo, setPatientInfo] = useState<{ memberID: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      loadPatientData();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, patientId]);

  const loadPatientData = async () => {
    try {
      const response = await fetch(`/api/patients/${patientId}`);
      if (response.ok) {
        const data = await response.json();
        setPatientInfo(data.patientInfo);
        setInsurancePayments(data.insurancePayments);
        setVenmoPayments(data.venmoPayments);
      } else {
        alert('Error loading patient data');
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
      alert('Error loading patient data');
    } finally {
      setLoading(false);
    }
  };

  const totalInsurance = insurancePayments.reduce((sum, p) => sum + p.checkEFTAmount, 0);
  const totalVenmo = venmoPayments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalInsurance - totalVenmo;

  const handleDeleteInsurance = async (id: string) => {
    if (confirm('Are you sure you want to delete this insurance payment?')) {
      try {
        const response = await fetch(`/api/insurance-payments/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          loadPatientData();
        } else {
          alert('Error deleting payment');
        }
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment');
      }
    }
  };

  const handleDeleteVenmo = async (id: string) => {
    if (confirm('Are you sure you want to delete this Venmo payment?')) {
      try {
        const response = await fetch(`/api/venmo-payments/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          loadPatientData();
        } else {
          alert('Error deleting payment');
        }
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment');
      }
    }
  };

  if (status === 'loading' || loading) {
    return <div className="text-center py-8">Loading patient details...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Patient Details</h1>
        <p className="text-gray-600 mb-6">Please sign in to view patient details.</p>
      </div>
    );
  }

  if (!patientInfo) {
    return <div className="text-center py-8">Patient not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
        >
          &larr; Back
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{patientInfo.name}</h1>
            <p className="text-gray-600">Member ID: {patientInfo.memberID}</p>
          </div>
          <div className="text-right">
            <div className="bg-white rounded-lg shadow p-4 mb-2">
              <p className="text-sm text-gray-500">Total Insurance Payments</p>
              <p className="text-2xl font-bold text-blue-600">${totalInsurance.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 mb-2">
              <p className="text-sm text-gray-500">Total Patient Paid</p>
              <p className="text-2xl font-bold text-green-600">${totalVenmo.toFixed(2)}</p>
            </div>
            <div className={`rounded-lg shadow p-4 ${
              balance === 0 ? 'bg-green-50' : balance > 0 ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <p className="text-sm text-gray-500">Balance</p>
              <p className={`text-2xl font-bold ${
                balance === 0 ? 'text-green-600' : balance > 0 ? 'text-red-600' : 'text-yellow-600'
              }`}>
                ${Math.abs(balance).toFixed(2)} {balance < 0 && '(overpaid)'}
              </p>
              <p className="text-xs mt-1">
                {balance === 0 ? 'Paid in Full' : balance > 0 ? 'Outstanding' : 'Overpaid'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Insurance Payments Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Insurance Payments</h2>
          <span className="text-sm text-gray-600">
            {insurancePayments.length} payment{insurancePayments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {insurancePayments.length === 0 ? (
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-600">No insurance payments recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Claim Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Service Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Payment Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Check Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {insurancePayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{payment.claimStatus}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{payment.datesOfService}</td>
                      <td className="px-4 py-3 text-sm">{payment.providerName}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{payment.paymentDate}</td>
                      <td className="px-4 py-3 text-sm">{payment.checkNumber}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600 whitespace-nowrap">
                        ${payment.checkEFTAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate" title={payment.payeeAddress}>
                        {payment.payeeAddress}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteInsurance(payment.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-blue-50 font-semibold">
                    <td colSpan={5} className="px-4 py-3 text-sm text-right">Total Insurance:</td>
                    <td className="px-4 py-3 text-sm text-blue-600">${totalInsurance.toFixed(2)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Venmo Payments Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Venmo Payments</h2>
          <span className="text-sm text-gray-600">
            {venmoPayments.length} payment{venmoPayments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {venmoPayments.length === 0 ? (
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-600">No Venmo payments recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {venmoPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{payment.date}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600 whitespace-nowrap">
                        ${payment.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">{payment.notes || '-'}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteVenmo(payment.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-green-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-right">Total Venmo:</td>
                    <td className="px-4 py-3 text-sm text-green-600">${totalVenmo.toFixed(2)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Payment Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border-r pr-4">
            <div className="mb-3">
              <p className="text-sm text-gray-600">Total Insurance Received</p>
              <p className="text-2xl font-bold text-blue-600">${totalInsurance.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{insurancePayments.length} payment(s)</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Patient Paid</p>
              <p className="text-2xl font-bold text-green-600">${totalVenmo.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{venmoPayments.length} payment(s)</p>
            </div>
          </div>
          <div className="pl-4">
            <div className="mb-3">
              <p className="text-sm text-gray-600">Outstanding Balance</p>
              <p className={`text-3xl font-bold ${
                balance === 0 ? 'text-green-600' : balance > 0 ? 'text-red-600' : 'text-yellow-600'
              }`}>
                ${Math.abs(balance).toFixed(2)}
              </p>
              {balance < 0 && <p className="text-xs text-yellow-600">Patient overpaid by ${Math.abs(balance).toFixed(2)}</p>}
              {balance > 0 && <p className="text-xs text-red-600">Patient still owes ${balance.toFixed(2)}</p>}
              {balance === 0 && <p className="text-xs text-green-600">Account is settled</p>}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Status</p>
              {balance === 0 && (
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                  Paid in Full
                </span>
              )}
              {balance > 0 && (
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                  Outstanding Balance
                </span>
              )}
              {balance < 0 && (
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  Overpaid
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
