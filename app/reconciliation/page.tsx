'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ReconciliationRecord, InsurancePayment, VenmoPayment } from '@/lib/types';

export default function ReconciliationPage() {
  const { user, loading: authLoading } = useAuth();
  const [reconciliationData, setReconciliationData] = useState<ReconciliationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      loadReconciliationData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  const loadReconciliationData = async () => {
    try {
      // Fetch both payment types
      const [insuranceRes, venmoRes] = await Promise.all([
        fetch('/api/insurance-payments'),
        fetch('/api/venmo-payments'),
      ]);

      if (!insuranceRes.ok || !venmoRes.ok) {
        throw new Error('Failed to fetch payments');
      }

      const insurancePayments: InsurancePayment[] = await insuranceRes.json();
      const venmoPayments: VenmoPayment[] = await venmoRes.json();

      // Group by combination of Member Subscriber ID + Patient Name
      const groupedData = new Map<string, ReconciliationRecord>();

      // Helper function to create unique key
      const createKey = (memberId: string, patientName: string) => {
        return `${memberId}|||${patientName}`.toLowerCase();
      };

      // Process insurance payments
      insurancePayments.forEach((payment) => {
        const key = createKey(payment.memberSubscriberID, payment.payeeName);
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            memberSubscriberID: payment.memberSubscriberID,
            patientName: payment.payeeName,
            totalInsuranceAmount: 0,
            totalPatientPaid: 0,
            balance: 0,
            insurancePayments: [],
            venmoPayments: [],
          });
        }
        const record = groupedData.get(key)!;
        record.insurancePayments.push(payment);
        record.totalInsuranceAmount += payment.checkEFTAmount;
      });

      // Process Venmo payments
      venmoPayments.forEach((payment) => {
        const key = createKey(payment.memberSubscriberID, payment.patientName);
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            memberSubscriberID: payment.memberSubscriberID,
            patientName: payment.patientName,
            totalInsuranceAmount: 0,
            totalPatientPaid: 0,
            balance: 0,
            insurancePayments: [],
            venmoPayments: [],
          });
        }
        const record = groupedData.get(key)!;
        record.venmoPayments.push(payment);
        record.totalPatientPaid += payment.amount;
      });

      // Calculate balances
      groupedData.forEach((record) => {
        record.balance = record.totalInsuranceAmount - record.totalPatientPaid;
      });

      setReconciliationData(Array.from(groupedData.values()));
    } catch (error) {
      console.error('Error loading reconciliation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (uniqueKey: string) => {
    setExpandedRow(expandedRow === uniqueKey ? null : uniqueKey);
  };

  const getUniqueKey = (record: ReconciliationRecord) => {
    return `${record.memberSubscriberID}|||${record.patientName}`.toLowerCase();
  };

  const getPatientDetailLink = (record: ReconciliationRecord) => {
    const patientId = encodeURIComponent(`${record.memberSubscriberID}|||${record.patientName}`);
    return `/patient/${patientId}`;
  };

  const getStatusBadge = (balance: number) => {
    if (balance === 0) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Paid in Full</span>;
    } else if (balance < 0) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">Overpaid</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">Outstanding</span>;
    }
  };

  if (authLoading || loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Payment Reconciliation</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please sign in to view reconciliation data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Payment Reconciliation</h1>
        <button
          onClick={loadReconciliationData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {reconciliationData.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">No reconciliation data available</p>
          <p className="text-gray-500 dark:text-gray-500">Add insurance and Venmo payments to see reconciliation</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Patients</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reconciliationData.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Insurance Payments</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ${reconciliationData.reduce((sum, r) => sum + r.totalInsuranceAmount, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Patient Payments</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${reconciliationData.reduce((sum, r) => sum + r.totalPatientPaid, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Outstanding</h3>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                ${reconciliationData.reduce((sum, r) => sum + Math.max(0, r.balance), 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Insurance Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {reconciliationData.map((record) => {
                  const uniqueKey = getUniqueKey(record);
                  return (
                    <tr key={uniqueKey}>
                      <td colSpan={7} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100" style={{width: '14%'}}>{record.memberSubscriberID}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300" style={{width: '14%'}}>{record.patientName}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400" style={{width: '14%'}}>
                                ${record.totalInsuranceAmount.toFixed(2)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400" style={{width: '14%'}}>
                                ${record.totalPatientPaid.toFixed(2)}
                              </td>
                              <td className={`px-4 py-4 whitespace-nowrap text-sm font-semibold ${
                                record.balance > 0 ? 'text-red-600 dark:text-red-400' : record.balance < 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                              }`} style={{width: '14%'}}>
                                ${Math.abs(record.balance).toFixed(2)} {record.balance < 0 && '(overpaid)'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm" style={{width: '14%'}}>
                                {getStatusBadge(record.balance)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm" style={{width: '14%'}}>
                                <div className="flex gap-2">
                                  <Link
                                    href={getPatientDetailLink(record)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 font-medium"
                                  >
                                    View Details
                                  </Link>
                                  <span className="text-gray-300 dark:text-gray-600">|</span>
                                  <button
                                    onClick={() => toggleRow(uniqueKey)}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                  >
                                    {expandedRow === uniqueKey ? 'Hide' : 'Show'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedRow === uniqueKey && (
                              <tr>
                                <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-900">
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* Insurance Payments */}
                                    <div>
                                      <h4 className="font-semibold mb-2 text-blue-700 dark:text-blue-400">Insurance Payments ({record.insurancePayments.length})</h4>
                                      {record.insurancePayments.length > 0 ? (
                                        <div className="space-y-2">
                                          {record.insurancePayments.map(payment => (
                                            <div key={payment.id} className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm">
                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Amount:</span> <span className="text-gray-700 dark:text-gray-300">${payment.checkEFTAmount.toFixed(2)}</span>
                                                </div>
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Date:</span> <span className="text-gray-700 dark:text-gray-300">{payment.paymentDate}</span>
                                                </div>
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Check #:</span> <span className="text-gray-700 dark:text-gray-300">{payment.checkNumber}</span>
                                                </div>
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Status:</span> <span className="text-gray-700 dark:text-gray-300">{payment.claimStatus}</span>
                                                </div>
                                                <div className="col-span-2">
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Service Dates:</span> <span className="text-gray-700 dark:text-gray-300">{payment.datesOfService}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">No insurance payments</p>
                                      )}
                                    </div>

                                    {/* Venmo Payments */}
                                    <div>
                                      <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">Venmo Payments ({record.venmoPayments.length})</h4>
                                      {record.venmoPayments.length > 0 ? (
                                        <div className="space-y-2">
                                          {record.venmoPayments.map(payment => (
                                            <div key={payment.id} className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm">
                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Amount:</span> <span className="text-gray-700 dark:text-gray-300">${payment.amount.toFixed(2)}</span>
                                                </div>
                                                <div>
                                                  <span className="font-medium text-gray-900 dark:text-gray-100">Date:</span> <span className="text-gray-700 dark:text-gray-300">{payment.date}</span>
                                                </div>
                                                {payment.notes && (
                                                  <div className="col-span-2">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">Notes:</span> <span className="text-gray-700 dark:text-gray-300">{payment.notes}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">No Venmo payments</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
