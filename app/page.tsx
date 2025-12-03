'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import * as XLSX from 'xlsx';
import { InsurancePayment, TrackingStatus } from '@/lib/types';

const TRACKING_STATUSES: { value: TrackingStatus; label: string; color: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  { value: 'RECORDED', label: 'Recorded', color: 'bg-blue-100 text-blue-800' },
  { value: 'NOTIFIED', label: 'Notified', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'COLLECTED', label: 'Collected', color: 'bg-green-100 text-green-800' },
];

interface ManualPaymentForm {
  claimStatus: string;
  datesOfService: string;
  memberSubscriberID: string;
  providerName: string;
  paymentDate: string;
  checkNumber: string;
  checkEFTAmount: string;
  payeeName: string;
  payeeAddress: string;
}

const emptyPaymentForm: ManualPaymentForm = {
  claimStatus: '',
  datesOfService: '',
  memberSubscriberID: '',
  providerName: '',
  paymentDate: '',
  checkNumber: '',
  checkEFTAmount: '',
  payeeName: '',
  payeeAddress: '',
};

export default function InsurancePaymentsPage() {
  const { data: session, status } = useSession();
  const [payments, setPayments] = useState<InsurancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPayments, setManualPayments] = useState<ManualPaymentForm[]>([{ ...emptyPaymentForm }]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPayments();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/insurance-payments');
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Log the first row's column names for debugging
        if (jsonData.length > 0) {
          console.log('Excel columns found:', Object.keys(jsonData[0] as object));
        }

        // Helper to find column value with flexible matching
        const getColumnValue = (row: any, possibleNames: string[]): string => {
          for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== null) {
              return String(row[name]);
            }
          }
          // Also try case-insensitive match
          const rowKeys = Object.keys(row);
          for (const name of possibleNames) {
            const found = rowKeys.find(k => k.toLowerCase() === name.toLowerCase());
            if (found && row[found] !== undefined && row[found] !== null) {
              return String(row[found]);
            }
          }
          return '';
        };

        const newPayments = jsonData.map((row: any) => ({
          claimStatus: getColumnValue(row, ['Claim status', 'Claim Status', 'ClaimStatus']),
          datesOfService: getColumnValue(row, ['Dates of service', 'Dates of Service', 'DatesOfService', 'Service Date', 'Service Dates']),
          memberSubscriberID: getColumnValue(row, ['Member nbscriber ID', 'Member Subscriber ID', 'Member subscriber ID', 'MemberSubscriberID', 'Member ID', 'MemberID', 'Subscriber ID']),
          providerName: getColumnValue(row, ['Provider name', 'Provider Name', 'ProviderName', 'Provider']),
          paymentDate: getColumnValue(row, ['Payment date', 'Payment Date', 'PaymentDate']),
          checkNumber: getColumnValue(row, ['Check/EFT number', 'Check/EFT Number', 'Chumber', 'Check Number', 'Check number', 'CheckNumber', 'Check #', 'Check#', 'EFT Number']),
          checkEFTAmount: parseFloat(getColumnValue(row, ['Claim amount paid', 'Claim Amount Paid', 'ClaimAmountPaid', 'Check/EFT amount', 'Check/EFT Amount', 'CheckEFTAmount', 'Amount', 'Payment Amount'])) || 0,
          payeeName: getColumnValue(row, ['Member Name', 'Member name', 'MemberName', 'Patient Name', 'Patient name', 'PatientName', 'Patient']),
          payeeAddress: getColumnValue(row, ['Payee address', 'Payee Address', 'PayeeAddress', 'Address']),
        }));

        // Log first payment for debugging
        if (newPayments.length > 0) {
          console.log('First payment to import:', newPayments[0]);
        }

        // Send to API
        const response = await fetch('/api/insurance-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payments: newPayments }),
        });

        if (response.ok) {
          const result = await response.json();
          alert(`Successfully imported ${result.count} payment records`);
          fetchPayments();
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('API error:', response.status, errorData);
          alert(`Error importing payments: ${errorData.error || response.statusText}`);
        }
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsBinaryString(file);

    // Reset input
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this payment record?')) {
      try {
        const response = await fetch(`/api/insurance-payments/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchPayments();
        } else {
          alert('Error deleting payment');
        }
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete ALL insurance payment records?')) {
      try {
        const response = await fetch('/api/insurance-payments', {
          method: 'DELETE',
        });
        if (response.ok) {
          setPayments([]);
        } else {
          alert('Error clearing payments');
        }
      } catch (error) {
        console.error('Error clearing payments:', error);
        alert('Error clearing payments');
      }
    }
  };

  const handleStatusChange = async (paymentId: string, newStatus: TrackingStatus) => {
    try {
      const response = await fetch(`/api/insurance-payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingStatus: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setPayments(payments.map(p =>
          p.id === paymentId ? { ...p, trackingStatus: newStatus } : p
        ));
      } else {
        alert('Error updating status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const getStatusConfig = (status: TrackingStatus) => {
    return TRACKING_STATUSES.find(s => s.value === status) || TRACKING_STATUSES[0];
  };

  // Manual payment form handlers
  const addManualPaymentRow = () => {
    setManualPayments([...manualPayments, { ...emptyPaymentForm }]);
  };

  const removeManualPaymentRow = (index: number) => {
    setManualPayments(manualPayments.filter((_, i) => i !== index));
  };

  const updateManualPayment = (index: number, field: keyof ManualPaymentForm, value: string) => {
    const updated = [...manualPayments];
    updated[index][field] = value;
    setManualPayments(updated);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validPayments = manualPayments.filter(p => p.payeeName && p.checkEFTAmount);
    if (validPayments.length === 0) {
      alert('Please add at least one payment with Payee Name and Amount');
      return;
    }

    const paymentsToSubmit = validPayments.map(p => ({
      claimStatus: p.claimStatus,
      datesOfService: p.datesOfService,
      memberSubscriberID: p.memberSubscriberID,
      providerName: p.providerName,
      paymentDate: p.paymentDate,
      checkNumber: p.checkNumber,
      checkEFTAmount: parseFloat(p.checkEFTAmount) || 0,
      payeeName: p.payeeName,
      payeeAddress: p.payeeAddress,
    }));

    try {
      const response = await fetch('/api/insurance-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: paymentsToSubmit }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully added ${result.count} payment(s)`);
        fetchPayments();
        setManualPayments([{ ...emptyPaymentForm }]);
        setShowManualForm(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Error adding payments: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding payments:', error);
      alert('Error adding payments');
    }
  };

  if (status === 'loading' || loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Welcome to Insurance Payment Tracker</h1>
        <p className="text-gray-600 mb-6">Please sign in to manage your insurance payments.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Insurance Payment Records</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            {showManualForm ? 'Cancel' : 'Add Manual'}
          </button>
          <div className="relative">
            <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowImportHelp(!showImportHelp)}
              className="ml-1 text-blue-600 hover:text-blue-800 text-sm"
              title="Show import help"
            >
              ?
            </button>
          </div>
          {payments.length > 0 && (
            <button
              onClick={handleClearAll}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Import Help Panel */}
      {showImportHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-blue-800">Excel Import Guide</h3>
            <button
              onClick={() => setShowImportHelp(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              &times;
            </button>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            Upload an Excel file (.xlsx or .xls) with insurance payment data. The system will automatically match columns based on the following names:
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Patient/Member Name:</span>
              <span className="text-gray-600 ml-1">Member Name, Patient Name, Patient</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Amount (Priority):</span>
              <span className="text-gray-600 ml-1">Claim amount paid, Check/EFT amount, Amount</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Member ID:</span>
              <span className="text-gray-600 ml-1">Member Subscriber ID, Member ID, Subscriber ID</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Check Number:</span>
              <span className="text-gray-600 ml-1">Check/EFT number, Check Number, Check #, EFT Number</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Payment Date:</span>
              <span className="text-gray-600 ml-1">Payment date, Payment Date</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Claim Status:</span>
              <span className="text-gray-600 ml-1">Claim status, Claim Status</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Service Dates:</span>
              <span className="text-gray-600 ml-1">Dates of service, Service Date, Service Dates</span>
            </div>
            <div className="bg-white p-2 rounded">
              <span className="font-medium">Provider:</span>
              <span className="text-gray-600 ml-1">Provider name, Provider</span>
            </div>
            <div className="bg-white p-2 rounded col-span-2">
              <span className="font-medium">Payee Address:</span>
              <span className="text-gray-600 ml-1">Payee address, Address</span>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            Tip: Column matching is case-insensitive. Check your browser console (F12) to see detected columns.
          </p>
        </div>
      )}

      {/* Manual Payment Form */}
      {showManualForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add Insurance Payment(s) Manually</h2>
          <form onSubmit={handleManualSubmit}>
            <div className="space-y-4">
              {manualPayments.map((payment, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-gray-700">Payment #{index + 1}</span>
                    {manualPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeManualPaymentRow(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payee Name *</label>
                      <input
                        type="text"
                        value={payment.payeeName}
                        onChange={(e) => updateManualPayment(index, 'payeeName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Patient name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Member/Subscriber ID</label>
                      <input
                        type="text"
                        value={payment.memberSubscriberID}
                        onChange={(e) => updateManualPayment(index, 'memberSubscriberID', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Member ID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={payment.checkEFTAmount}
                        onChange={(e) => updateManualPayment(index, 'checkEFTAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={payment.paymentDate}
                        onChange={(e) => updateManualPayment(index, 'paymentDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Check/EFT Number</label>
                      <input
                        type="text"
                        value={payment.checkNumber}
                        onChange={(e) => updateManualPayment(index, 'checkNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Check number"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Claim Status</label>
                      <input
                        type="text"
                        value={payment.claimStatus}
                        onChange={(e) => updateManualPayment(index, 'claimStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Paid, Pending"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dates of Service</label>
                      <input
                        type="text"
                        value={payment.datesOfService}
                        onChange={(e) => updateManualPayment(index, 'datesOfService', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Service dates"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Provider Name</label>
                      <input
                        type="text"
                        value={payment.providerName}
                        onChange={(e) => updateManualPayment(index, 'providerName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Provider"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payee Address</label>
                      <input
                        type="text"
                        value={payment.payeeAddress}
                        onChange={(e) => updateManualPayment(index, 'payeeAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Address"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                type="button"
                onClick={addManualPaymentRow}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                + Add Another Payment
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false);
                    setManualPayments([{ ...emptyPaymentForm }]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Save Payment(s)
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {payments.length === 0 && !showManualForm ? (
        <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">No insurance payment records yet</p>
          <p className="text-gray-500">Upload an Excel file or add payments manually to get started</p>
        </div>
      ) : payments.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => {
                  const statusConfig = getStatusConfig(payment.trackingStatus);
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <select
                          value={payment.trackingStatus}
                          onChange={(e) => handleStatusChange(payment.id, e.target.value as TrackingStatus)}
                          className={`px-2 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer ${statusConfig.color}`}
                        >
                          {TRACKING_STATUSES.map(status => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.claimStatus || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.datesOfService || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{payment.memberSubscriberID || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.providerName || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.paymentDate || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.checkNumber || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold">${payment.checkEFTAmount.toFixed(2)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.payeeName}</td>
                      <td className="px-4 py-4 text-sm">{payment.payeeAddress || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Total Records: <span className="font-semibold">{payments.length}</span>
              {' | '}
              Total Amount: <span className="font-semibold">
                ${payments.reduce((sum, p) => sum + p.checkEFTAmount, 0).toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
