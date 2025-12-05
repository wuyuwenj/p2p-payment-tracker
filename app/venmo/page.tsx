'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { VenmoPayment } from '@/lib/types';
import { Button } from '@/components/tracker/Button';
import { Input } from '@/components/tracker/Input';
import { Card } from '@/components/tracker/Card';
import { Trash2, Plus, Search } from 'lucide-react';

interface PatientSuggestion {
  name: string;
  memberId: string;
}

export default function VenmoPaymentsPage() {
  const { data: session, status } = useSession();
  const [payments, setPayments] = useState<VenmoPayment[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredPayments = payments.filter(p => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        p.patientName?.toLowerCase().includes(query) ||
        p.memberSubscriberID?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const total = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Venmo Payments</h1>
            <p className="text-muted-foreground mt-1">Record patient payments via Venmo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleClearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        <Card className="p-6 mb-6 animate-fade-in">
          <h3 className="font-medium text-gray-900 mb-4">Add Venmo Payment</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name *
                </label>
                <Input
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
                  placeholder="Start typing to search..."
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((patient, index) => (
                      <div
                        key={index}
                        onClick={() => selectPatient(patient)}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
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
                <Input
                  type="text"
                  value={memberSubscriberID}
                  onChange={(e) => setMemberSubscriberID(e.target.value)}
                />
              </div>
            </div>

            {/* Only show payment rows when patient name has input */}
            {patientName.trim().length > 0 && (
              <>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Payments</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addPaymentRow}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Row
                    </Button>
                  </div>

                  {batchPayments.map((payment, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount *"
                          value={payment.amount}
                          onChange={(e) => updatePaymentRow(index, 'amount', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="date"
                          placeholder="Date *"
                          value={payment.date}
                          onChange={(e) => updatePaymentRow(index, 'date', e.target.value)}
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          type="text"
                          placeholder="Notes (optional)"
                          value={payment.notes}
                          onChange={(e) => updatePaymentRow(index, 'notes', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        {batchPayments.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePaymentRow(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={addPaymentRow}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Row
                  </Button>
                  <Button variant="primary" size="sm" type="submit">
                    Save All
                  </Button>
                </div>
              </>
            )}
          </form>
        </Card>

        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name or member ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Card className="animate-fade-in overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{payment.patientName}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{payment.memberSubscriberID}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{payment.date}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{payment.notes}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(payment.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {searchQuery.trim() ? 'No payments match your search.' : 'No payments recorded. Add your first payment above.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
                {searchQuery.trim() && ` (filtered from ${payments.length} total)`}
              </span>
              <span className="text-sm font-semibold text-gray-900">Total: ${total.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
