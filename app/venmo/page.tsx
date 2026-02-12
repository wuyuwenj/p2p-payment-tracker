'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { VenmoPayment } from '@/lib/types';
import { Button } from '@/components/tracker/Button';
import { Input } from '@/components/tracker/Input';
import { Card } from '@/components/tracker/Card';
import { VenmoCsvUpload } from '@/components/tracker/VenmoCsvUpload';
import { Trash2, Plus, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface PatientSuggestion {
  name: string;
  memberId: string;
}

export default function VenmoPaymentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE_OPTIONS = [10, 25, 100];

  // Sorting state
  type SortField = 'patientName' | 'memberSubscriberID' | 'amount' | 'date' | 'notes';
  type SortDirection = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="flex flex-col">
          <ChevronUp className={`w-3 h-3 -mb-1 ${sortField === field && sortDirection === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
          <ChevronDown className={`w-3 h-3 ${sortField === field && sortDirection === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </span>
      </div>
    </th>
  );

  useEffect(() => {
    if (!authLoading && user) {
      fetchPayments();
      loadPatientSuggestions();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

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
          if (!payment.payeeName) return;
          const key = payment.payeeName.toLowerCase().trim();
          const existing = uniquePatients.get(key);
          // Keep entry with a member ID if available
          if (!existing || (!existing.memberId && payment.memberSubscriberID)) {
            uniquePatients.set(key, {
              name: payment.payeeName,
              memberId: payment.memberSubscriberID || '',
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

  const handleCsvImport = async (parsedPayments: Array<{
    patientName: string;
    memberSubscriberID?: string;
    amount: number;
    date: string;
    notes: string;
  }>) => {
    try {
      const response = await fetch('/api/venmo-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: parsedPayments }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully imported ${result.count} payment(s) from CSV`);
        fetchPayments();
      } else {
        alert('Error importing CSV payments');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV payments');
    }
  };

  if (authLoading || loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Venmo Payments</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please sign in to manage your Venmo payments.</p>
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

  // Apply sorting
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField) {
      case 'amount':
        aVal = a.amount ?? 0;
        bVal = b.amount ?? 0;
        break;
      default:
        aVal = (a[sortField] ?? '').toString().toLowerCase();
        bVal = (b[sortField] ?? '').toString().toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedPayments.length / pageSize);
  const paginatedPayments = sortedPayments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when page size changes
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const total = sortedPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Venmo Payments</h1>
            <p className="text-muted-foreground mt-1">Record patient payments via Venmo</p>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}
        </div>

        <div className="mb-6">
          <VenmoCsvUpload
            existingPatients={allPatients}
            onImportComplete={handleCsvImport}
          />
        </div>

        <Card className="p-6 mb-6 animate-fade-in">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Add Venmo Payment Manually</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((patient, index) => (
                      <div
                        key={index}
                        onClick={() => selectPatient(patient)}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">{patient.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Member ID: {patient.memberId}</div>
                      </div>
                    ))}
                  </div>
                )}
                {showSuggestions && suggestions.length === 0 && patientName.length >= 1 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No matching patients found in insurance records
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Payments</h3>
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
                    <div key={index} className="grid grid-cols-12 gap-2 mb-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
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
                  <Button type="button" variant="ghost" size="sm" onClick={addPaymentRow}>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Card className="animate-fade-in overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <SortableHeader field="patientName">Patient Name</SortableHeader>
                  <SortableHeader field="memberSubscriberID">Member ID</SortableHeader>
                  <SortableHeader field="amount">Amount</SortableHeader>
                  <SortableHeader field="date">Date</SortableHeader>
                  <SortableHeader field="notes">Notes</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => router.push(`/patient/${encodeURIComponent(`${payment.memberSubscriberID || ''}|||${payment.patientName}`)}`)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{payment.patientName}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.memberSubscriberID}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.date}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{payment.notes}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(payment.id); }}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {paginatedPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {searchQuery.trim() ? 'No payments match your search.' : 'No payments recorded. Add your first payment above.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {sortedPayments.length > 0
                  ? `Showing ${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, sortedPayments.length)} of ${sortedPayments.length}`
                  : '0 payments'
                }
                {searchQuery.trim() && ` (filtered from ${payments.length} total)`}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total: ${total.toFixed(2)}</span>
            </div>
            {/* Pagination Controls */}
            {sortedPayments.length > 10 && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
