'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { VenmoPayment } from '@/lib/types';

interface PatientSuggestion {
  name: string;
  memberId: string;
}

export default function VenmoPaymentsPage() {
  const { data: session, status } = useSession();
  const [payments, setPayments] = useState<VenmoPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state for batch adding
  const [patientName, setPatientName] = useState('');
  const [memberSubscriberID, setMemberSubscriberID] = useState('');
  const [batchPayments, setBatchPayments] = useState<Array<{ amount: string; date: string; notes: string }>>([
    { amount: '', date: '', notes: '' }
  ]);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPayments();
      loadPatientSuggestions();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/venmo-payments');
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

  const loadPatientSuggestions = async () => {
    try {
      const response = await fetch('/api/insurance-payments');
      if (response.ok) {
        const insurancePayments = await response.json();
        // Create unique patient list from insurance records
        const uniquePatients = new Map<string, PatientSuggestion>();

        insurancePayments.forEach((payment: any) => {
          const key = `${payment.memberSubscriberID}|||${payment.payeeName}`.toLowerCase();
          if (!uniquePatients.has(key) && payment.payeeName && payment.memberSubscriberID) {
            uniquePatients.set(key, {
              name: payment.payeeName,
              memberId: payment.memberSubscriberID,
            });
          }
        });

        setAllPatients(Array.from(uniquePatients.values()));
      }
    } catch (error) {
      console.error('Error loading patient suggestions:', error);
    }
  };

  const addPaymentRow = () => {
    setBatchPayments([...batchPayments, { amount: '', date: '', notes: '' }]);
  };

  const removePaymentRow = (index: number) => {
    setBatchPayments(batchPayments.filter((_, i) => i !== index));
  };

  const updatePaymentRow = (index: number, field: 'amount' | 'date' | 'notes', value: string) => {
    const updated = [...batchPayments];
    updated[index][field] = value;
    setBatchPayments(updated);
  };

  const handlePatientNameChange = (value: string) => {
    setPatientName(value);

    if (value.trim().length >= 1) {
      const filtered = allPatients.filter(patient =>
        patient.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const selectPatient = (patient: PatientSuggestion) => {
    setPatientName(patient.name);
    setMemberSubscriberID(patient.memberId);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName || !memberSubscriberID) {
      alert('Please enter patient name and member ID');
      return;
    }

    const validPayments = batchPayments.filter(p => p.amount && p.date);
    if (validPayments.length === 0) {
      alert('Please add at least one payment with amount and date');
      return;
    }

    const newPayments = validPayments.map(p => ({
      patientName,
      memberSubscriberID,
      amount: parseFloat(p.amount),
      date: p.date,
      notes: p.notes,
    }));

    try {
      const response = await fetch('/api/venmo-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: newPayments }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully added ${result.count} payment(s)`);
        fetchPayments();

        // Reset form
        setPatientName('');
        setMemberSubscriberID('');
        setBatchPayments([{ amount: '', date: '', notes: '' }]);
        setShowSuggestions(false);
        setSuggestions([]);
        setShowForm(false);
      } else {
        alert('Error adding payments');
      }
    } catch (error) {
      console.error('Error adding payments:', error);
      alert('Error adding payments');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this payment record?')) {
      try {
        const response = await fetch(`/api/venmo-payments/${id}`, {
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
    if (confirm('Are you sure you want to delete ALL Venmo payment records?')) {
      try {
        const response = await fetch('/api/venmo-payments', {
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

  if (status === 'loading' || loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Venmo Payments</h1>
        <p className="text-gray-600 mb-6">Please sign in to manage your Venmo payments.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Venmo Payment Records</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Add Payments'}
          </button>
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

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Batch Add Payments for Single Patient</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name *
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={patientName}
                  onChange={(e) => handlePatientNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => {
                    if (patientName.length >= 1) {
                      handlePatientNameChange(patientName);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Start typing to search..."
                  required
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((patient, index) => (
                      <div
                        key={index}
                        onClick={() => selectPatient(patient)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{patient.name}</div>
                        <div className="text-xs text-gray-500">Member ID: {patient.memberId}</div>
                      </div>
                    ))}
                  </div>
                )}
                {showSuggestions && suggestions.length === 0 && patientName.length >= 1 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No matching patients found in insurance records
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Member Subscriber ID *
                </label>
                <input
                  type="text"
                  value={memberSubscriberID}
                  onChange={(e) => setMemberSubscriberID(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Payments</h3>
                <button
                  type="button"
                  onClick={addPaymentRow}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                  + Add Row
                </button>
              </div>

              {batchPayments.map((payment, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={payment.amount}
                      onChange={(e) => updatePaymentRow(index, 'amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="date"
                      value={payment.date}
                      onChange={(e) => updatePaymentRow(index, 'date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={payment.notes}
                      onChange={(e) => updatePaymentRow(index, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-1">
                    {batchPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePaymentRow(index)}
                        className="w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setPatientName('');
                  setMemberSubscriberID('');
                  setBatchPayments([{ amount: '', date: '', notes: '' }]);
                  setShowSuggestions(false);
                  setSuggestions([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Save Payments
              </button>
            </div>
          </form>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">No Venmo payment records yet</p>
          <p className="text-gray-500">Click "Add Payments" to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{payment.patientName}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.memberSubscriberID}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600">${payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">{payment.date}</td>
                    <td className="px-4 py-4 text-sm">{payment.notes}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Total Records: <span className="font-semibold">{payments.length}</span>
              {' | '}
              Total Amount: <span className="font-semibold text-green-600">
                ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
