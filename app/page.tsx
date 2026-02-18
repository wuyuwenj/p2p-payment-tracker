'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { Upload, Trash2, HelpCircle, X, ChevronDown, ChevronUp, Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/tracker/Button';
import { Input } from '@/components/tracker/Input';
import { Badge } from '@/components/tracker/Badge';
import { Card } from '@/components/tracker/Card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { InsurancePayment, TrackingStatus } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

type StatusVariant = 'secondary' | 'info' | 'warning' | 'success';

const TRACKING_STATUSES: { value: TrackingStatus; label: string; variant: StatusVariant }[] = [
  { value: 'PENDING', label: 'Pending', variant: 'secondary' },
  { value: 'RECORDED', label: 'Recorded', variant: 'info' },
  { value: 'NOTIFIED', label: 'Notified', variant: 'warning' },
  { value: 'COLLECTED', label: 'Collected', variant: 'success' },
];

interface ManualPaymentForm {
  claimStatus: string;
  datesOfService: string;
  memberSubscriberID: string;
  providerName: string;
  paymentDate: string;
  claimNumber: string;
  checkNumber: string;
  checkEFTAmount: string;
  payeeName: string;
  payeeAddress: string;
  trackingStatus: TrackingStatus;
}

const emptyPaymentForm: ManualPaymentForm = {
  claimStatus: '',
  datesOfService: '',
  memberSubscriberID: '',
  providerName: '',
  paymentDate: '',
  claimNumber: '',
  checkNumber: '',
  checkEFTAmount: '',
  payeeName: '',
  payeeAddress: '',
  trackingStatus: 'PENDING',
};

interface PatientSuggestion {
  name: string;
  memberId: string;
}

export default function InsurancePaymentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<InsurancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [showManualForm, setShowManualForm] = useState(true);
  const [manualPayments, setManualPayments] = useState<ManualPaymentForm[]>([{ ...emptyPaymentForm }]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE_OPTIONS = [10, 25, 100];

  // Sorting state
  type SortField = 'trackingStatus' | 'payeeName' | 'memberSubscriberID' | 'claimNumber' | 'checkEFTAmount' | 'datesOfService' | 'paymentDate' | 'checkNumber';
  type SortDirection = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
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

  // Autocomplete state for manual form
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientSuggestion[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchPayments();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortField, sortDirection]);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/insurance-payments');
      if (response.ok) {
        const data = await response.json();
        setPayments(data);

        // Build unique patient list for autocomplete
        const uniquePatients = new Map<string, PatientSuggestion>();
        data.forEach((payment: InsurancePayment) => {
          if (!payment.payeeName) return;
          const key = payment.payeeName.toLowerCase().trim();
          const existing = uniquePatients.get(key);
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
      console.error('Error fetching payments:', error);
      toast({ title: 'Error loading payments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePayeeNameChange = (index: number, value: string) => {
    updateManualPayment(index, 'payeeName', value);
    setActiveRowIndex(index);

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

  const selectPatient = (index: number, patient: PatientSuggestion) => {
    updateManualPayment(index, 'payeeName', patient.name);
    updateManualPayment(index, 'memberSubscriberID', patient.memberId);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveRowIndex(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { dateNF: 'mm/dd/yyyy' });

        if (jsonData.length > 0) {
          console.log('Columns found:', Object.keys(jsonData[0] as object));
        }

        const formatValue = (val: unknown): string => {
          if (val instanceof Date) {
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${m}/${d}/${val.getFullYear()}`;
          }
          return String(val);
        };

        const getColumnValue = (row: any, possibleNames: string[]): string => {
          for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== null) {
              return formatValue(row[name]);
            }
          }
          const rowKeys = Object.keys(row);
          for (const name of possibleNames) {
            const found = rowKeys.find(k => k.toLowerCase() === name.toLowerCase());
            if (found && row[found] !== undefined && row[found] !== null) {
              return formatValue(row[found]);
            }
          }
          return '';
        };

        const newPayments = jsonData.map((row: any) => ({
          claimStatus: getColumnValue(row, ['Claim status', 'Claim Status', 'ClaimStatus', 'Reasons']),
          datesOfService: getColumnValue(row, ['Dates of service', 'Dates of Service', 'DatesOfService', 'Service Date', 'Service Dates']),
          memberSubscriberID: getColumnValue(row, ['Member nbscriber ID', 'Member Subscriber ID', 'Member subscriber ID', 'MemberSubscriberID', 'Member ID', 'MemberID', 'Subscriber ID']),
          providerName: getColumnValue(row, ['Provider name', 'Provider Name', 'ProviderName', 'Provider', 'Doctor Name']),
          paymentDate: getColumnValue(row, ['Payment date', 'Payment Date', 'PaymentDate', 'Record Date']),
          claimNumber: getColumnValue(row, ['Claim number', 'Claim Number', 'ClaimNumber', 'Claim #', 'Claim#']),
          checkNumber: getColumnValue(row, ['Check/EFT number', 'Check/EFT Number', 'Chumber', 'Check Number', 'Check number', 'CheckNumber', 'Check #', 'Check#', 'EFT Number']),
          checkEFTAmount: parseFloat(getColumnValue(row, ['Claim amount paid', 'Claim Amount Paid', 'ClaimAmountPaid', 'Check/EFT amount', 'Check/EFT Amount', 'CheckEFTAmount', 'Amount', 'Payment Amount']).replace(/[$,]/g, '')) || 0,
          payeeName: getColumnValue(row, ['Member Name', 'Member name', 'MemberName', 'Patient Name', 'Patient name', 'PatientName', 'Patient']),
          payeeAddress: getColumnValue(row, ['Payee address', 'Payee Address', 'PayeeAddress', 'Address']),
        })).filter(p => p.payeeName && p.datesOfService && p.paymentDate);

        // Merge member IDs: if the same patient name has records with and without a member ID,
        // fill in the missing ones from the record that has it
        const nameToMemberId = new Map<string, string>();
        newPayments.forEach(p => {
          if (p.memberSubscriberID) {
            nameToMemberId.set(p.payeeName.toLowerCase().trim(), p.memberSubscriberID);
          }
        });
        newPayments.forEach(p => {
          if (!p.memberSubscriberID) {
            const memberId = nameToMemberId.get(p.payeeName.toLowerCase().trim());
            if (memberId) p.memberSubscriberID = memberId;
          }
        });

        if (newPayments.length > 0) {
          console.log('First payment to import:', newPayments[0]);
        }

        // Process in batches of 50 for progress tracking
        const BATCH_SIZE = 50;
        const totalRecords = newPayments.length;
        let totalCreated = 0;
        let totalUpdated = 0;
        const newIds: string[] = [];

        setImportProgress({ current: 0, total: totalRecords });

        for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
          const batch = newPayments.slice(i, i + BATCH_SIZE);

          const response = await fetch('/api/insurance-payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payments: batch }),
          });

          if (response.ok) {
            const result = await response.json();
            totalCreated += result.created || 0;
            totalUpdated += result.updated || 0;
            if (result.ids) {
              newIds.push(...result.ids);
            }
            setImportProgress({ current: Math.min(i + BATCH_SIZE, totalRecords), total: totalRecords });
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error:', response.status, errorData);
            toast({ title: `Error importing batch: ${errorData.error || response.statusText}`, variant: 'destructive' });
            break;
          }
        }

        toast({ title: `Successfully imported ${totalCreated + totalUpdated} payment records (${totalCreated} new, ${totalUpdated} updated)` });
        setRecentlyAddedIds(new Set(newIds));
        fetchPayments();
      } catch (error) {
        console.error('Error parsing file:', error);
        toast({ title: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this payment record?')) {
      try {
        const response = await fetch(`/api/insurance-payments/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          toast({ title: 'Payment deleted' });
          fetchPayments();
        } else {
          toast({ title: 'Error deleting payment', variant: 'destructive' });
        }
      } catch (error) {
        console.error('Error deleting payment:', error);
        toast({ title: 'Error deleting payment', variant: 'destructive' });
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete ALL insurance payment records? This cannot be undone.')) {
      try {
        const response = await fetch('/api/insurance-payments', {
          method: 'DELETE',
        });
        if (response.ok) {
          setPayments([]);
          toast({ title: 'All payments cleared' });
        } else {
          toast({ title: 'Error clearing payments', variant: 'destructive' });
        }
      } catch (error) {
        console.error('Error clearing payments:', error);
        toast({ title: 'Error clearing payments', variant: 'destructive' });
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
        setPayments(payments.map(p =>
          p.id === paymentId ? { ...p, trackingStatus: newStatus } : p
        ));
      } else {
        toast({ title: 'Error updating status', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error updating status', variant: 'destructive' });
    }
  };

  const getStatusConfig = (status: TrackingStatus) => {
    return TRACKING_STATUSES.find(s => s.value === status) || TRACKING_STATUSES[0];
  };

  const addManualPaymentRow = () => {
    setManualPayments([...manualPayments, { ...emptyPaymentForm }]);
  };

  const removeManualPaymentRow = (index: number) => {
    if (manualPayments.length > 1) {
      setManualPayments(manualPayments.filter((_, i) => i !== index));
    }
  };

  const updateManualPayment = (index: number, field: keyof ManualPaymentForm, value: string) => {
    const updated = [...manualPayments];
    updated[index][field] = value as any;
    setManualPayments(updated);
  };

  const handleManualSubmit = async () => {
    const validPayments = manualPayments.filter(p => p.payeeName && p.memberSubscriberID && p.checkEFTAmount);
    if (validPayments.length === 0) {
      toast({ title: 'Please add at least one payment with Payee Name, Member ID, and Amount', variant: 'destructive' });
      return;
    }

    const paymentsToSubmit = validPayments.map(p => ({
      claimStatus: p.claimStatus,
      datesOfService: p.datesOfService,
      memberSubscriberID: p.memberSubscriberID,
      providerName: p.providerName,
      paymentDate: p.paymentDate,
      claimNumber: p.claimNumber,
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
        toast({ title: `Successfully added ${result.count} payment(s)` });
        if (result.ids) {
          setRecentlyAddedIds(new Set(result.ids));
        }
        fetchPayments();
        setManualPayments([{ ...emptyPaymentForm }]);
        setShowManualForm(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({ title: `Error adding payments: ${errorData.error || 'Unknown error'}`, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error adding payments:', error);
      toast({ title: 'Error adding payments', variant: 'destructive' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Welcome to Insurance Payment Tracker</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please sign in to manage your insurance payments.</p>
      </div>
    );
  }

  const filteredPayments = payments.filter(p => {
    // Filter by status
    if (statusFilter !== 'all' && p.trackingStatus !== statusFilter) {
      return false;
    }
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        p.payeeName?.toLowerCase().includes(query) ||
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
      case 'trackingStatus':
        const statusOrder = { PENDING: 0, RECORDED: 1, NOTIFIED: 2, COLLECTED: 3 };
        aVal = statusOrder[a.trackingStatus] ?? 0;
        bVal = statusOrder[b.trackingStatus] ?? 0;
        break;
      case 'checkEFTAmount':
        aVal = a.checkEFTAmount ?? 0;
        bVal = b.checkEFTAmount ?? 0;
        break;
      case 'datesOfService':
      case 'paymentDate': {
        const aTime = new Date(a[sortField] ?? '').getTime();
        const bTime = new Date(b[sortField] ?? '').getTime();
        aVal = isNaN(aTime) ? 0 : aTime;
        bVal = isNaN(bTime) ? 0 : bTime;
        break;
      }
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

  const total = sortedPayments.reduce((sum, p) => sum + p.checkEFTAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Import Loading Overlay */}
      {importing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4 shadow-xl min-w-[300px]">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            <div className="text-center w-full">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Importing payments...</p>
              {importProgress.total > 0 && (
                <>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    {importProgress.current} / {importProgress.total}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {Math.round((importProgress.current / importProgress.total) * 100)}% complete
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Insurance Payments</h1>
            <p className="text-muted-foreground mt-1">Track and manage insurance payment records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowImportHelp(!showImportHelp)}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help
            </Button>
            <label className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors px-3 py-1.5 text-sm ${importing ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'}`}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import File
                </>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
            </label>
            {process.env.NODE_ENV === 'development' && (
              <Button variant="destructive" size="sm" onClick={handleClearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </div>

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
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Status:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="RECORDED">Recorded</SelectItem>
                <SelectItem value="NOTIFIED">Notified</SelectItem>
                <SelectItem value="COLLECTED">Collected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

      {/* Import Help Panel */}
      {showImportHelp && (
        <Card className="p-6 mb-6 animate-fade-in bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">Import Guide</h3>
            <button
              onClick={() => setShowImportHelp(false)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Upload an Excel (.xlsx, .xls) or CSV (.csv) file with insurance payment data. The system will automatically match columns based on the following names:
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Patient/Member Name:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Member Name, Patient Name, Patient</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Amount (Priority):</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Claim amount paid, Check/EFT amount, Amount</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Member ID:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Member Subscriber ID, Member ID, Subscriber ID</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Check Number:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Check/EFT number, Check Number, Check #, EFT Number</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Payment Date:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Payment date, Payment Date</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Claim Status:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Claim status, Claim Status</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Amount:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Check/EFT amount, Amount, Payment Amount</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Payee Name:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Payee name, Patient Name, Name</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Claim Number:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Claim number, Claim Number, Claim #</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-gray-100">Payee Address:</span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">Payee address, Address</span>
            </div>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
            Tip: Column matching is case-insensitive. Check your browser console (F12) to see detected columns.
          </p>
        </Card>
      )}

      {/* Manual Payment Form */}
      <Card className="p-6 mb-6 animate-fade-in">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Add Manual Payment</h3>
        <div className="space-y-4">
          {manualPayments.map((row, index) => (
            <div key={index}>
              {/* Payee Name and Member ID Row */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payee Name *
                  </label>
                  <Input
                    ref={index === activeRowIndex ? inputRef : undefined}
                    type="text"
                    value={row.payeeName}
                    onChange={(e) => handlePayeeNameChange(index, e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => {
                      setActiveRowIndex(index);
                      if (row.payeeName.length >= 1) {
                        handlePayeeNameChange(index, row.payeeName);
                      }
                    }}
                    placeholder="Start typing to search..."
                  />
                  {showSuggestions && activeRowIndex === index && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {suggestions.map((patient, pIndex) => (
                        <div
                          key={pIndex}
                          onClick={() => selectPatient(index, patient)}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">{patient.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Member ID: {patient.memberId}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showSuggestions && activeRowIndex === index && suggestions.length === 0 && row.payeeName.length >= 1 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No matching patients found
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Member ID *
                  </label>
                  <Input
                    type="text"
                    value={row.memberSubscriberID}
                    onChange={(e) => updateManualPayment(index, 'memberSubscriberID', e.target.value)}
                  />
                </div>
              </div>

              {/* Show other fields only after payee name is entered */}
              {row.payeeName.trim().length > 0 && (
                <>
                  <div className="grid grid-cols-7 gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Claim #
                      </label>
                      <Input
                        placeholder="Optional"
                        value={row.claimNumber}
                        onChange={(e) => updateManualPayment(index, 'claimNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Check #
                      </label>
                      <Input
                        placeholder="Optional"
                        value={row.checkNumber}
                        onChange={(e) => updateManualPayment(index, 'checkNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={row.checkEFTAmount}
                        onChange={(e) => updateManualPayment(index, 'checkEFTAmount', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Service Date
                      </label>
                      <Input
                        type="date"
                        value={row.datesOfService}
                        onChange={(e) => updateManualPayment(index, 'datesOfService', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Date
                      </label>
                      <Input
                        type="date"
                        value={row.paymentDate}
                        onChange={(e) => updateManualPayment(index, 'paymentDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <Select
                        value={row.trackingStatus}
                        onValueChange={(value) => updateManualPayment(index, 'trackingStatus', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {TRACKING_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {manualPayments.length > 1 && (
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeManualPaymentRow(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {manualPayments.some(row => row.payeeName.trim().length > 0) && (
          <div className="flex items-center gap-3 mt-4">
            <Button variant="ghost" size="sm" onClick={addManualPaymentRow}>
              <Plus className="w-4 h-4 mr-2" />
              Add Row
            </Button>
            <Button variant="primary" size="sm" onClick={handleManualSubmit}>
              Save All
            </Button>
          </div>
        )}
      </Card>

      {/* Payments Table */}
      <Card className="animate-fade-in overflow-visible">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">All Payments</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sorted by most recently added</p>
        </div>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <SortableHeader field="trackingStatus">Status</SortableHeader>
                <SortableHeader field="payeeName">Payee Name</SortableHeader>
                <SortableHeader field="memberSubscriberID">Member ID</SortableHeader>
                <SortableHeader field="claimNumber">Claim #</SortableHeader>
                <SortableHeader field="checkEFTAmount">Amount</SortableHeader>
                <SortableHeader field="datesOfService">Service Date</SortableHeader>
                <SortableHeader field="paymentDate">Payment Date</SortableHeader>
                <SortableHeader field="checkNumber">Check #</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedPayments.map((payment) => {
                const statusConfig = getStatusConfig(payment.trackingStatus);

                return (
                  <tr
                    key={payment.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${recentlyAddedIds.has(payment.id) ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                    onClick={() => router.push(`/patient/${encodeURIComponent(`${payment.memberSubscriberID || ''}|||${payment.payeeName}`)}`)}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <Select
                        value={payment.trackingStatus}
                        onValueChange={(value) => handleStatusChange(payment.id, value as TrackingStatus)}
                      >
                        <SelectTrigger
                          className="w-fit h-fit border-0 bg-transparent p-0 m-0 hover:bg-transparent focus:ring-0 focus:outline-none [&>svg]:hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Badge variant={statusConfig.variant} className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs">
                            {statusConfig.label}
                            <ChevronDown className="h-3 w-3" />
                          </Badge>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 w-[120px]">
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="RECORDED">Recorded</SelectItem>
                          <SelectItem value="NOTIFIED">Notified</SelectItem>
                          <SelectItem value="COLLECTED">Collected</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{payment.payeeName}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.memberSubscriberID || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.claimNumber || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${payment.checkEFTAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.datesOfService || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.paymentDate || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.checkNumber || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(payment.id); }}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {paginatedPayments.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No payments recorded. Add your first payment above.
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
              {(statusFilter !== 'all' || searchQuery.trim()) && ` (filtered from ${payments.length} total)`}
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
