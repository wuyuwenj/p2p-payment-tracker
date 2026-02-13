'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, ChevronUp, Trash2, Copy, Check, Settings2, Download, HelpCircle, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from '@/components/tracker/Badge';
import { Button } from '@/components/tracker/Button';
import { Card } from '@/components/tracker/Card';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { InsurancePayment, VenmoPayment, TrackingStatus } from '@/lib/types';

// Column configuration
type ColumnKey = 'tracking' | 'patientName' | 'claimStatus' | 'serviceDates' | 'provider' | 'paymentDate' | 'checkNumber' | 'amount' | 'address';

const INSURANCE_COLUMNS: { key: ColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: 'tracking', label: 'Tracking', defaultVisible: true },
  { key: 'patientName', label: 'Patient Name', defaultVisible: true },
  { key: 'claimStatus', label: 'Claim Status', defaultVisible: true },
  { key: 'serviceDates', label: 'Service Dates', defaultVisible: true },
  { key: 'provider', label: 'Provider', defaultVisible: true },
  { key: 'paymentDate', label: 'Payment Date', defaultVisible: true },
  { key: 'checkNumber', label: 'Check #', defaultVisible: true },
  { key: 'amount', label: 'Claim Amount Paid', defaultVisible: true },
  { key: 'address', label: 'Address', defaultVisible: true },
];

type StatusVariant = 'secondary' | 'info' | 'warning' | 'success';

const TRACKING_STATUSES: { value: TrackingStatus; label: string; variant: StatusVariant }[] = [
  { value: 'PENDING', label: 'Pending', variant: 'secondary' },
  { value: 'RECORDED', label: 'Recorded', variant: 'info' },
  { value: 'NOTIFIED', label: 'Notified', variant: 'warning' },
  { value: 'COLLECTED', label: 'Collected', variant: 'success' },
];

// Truncatable cell component with hover tooltip and click-to-copy
function TruncatableCell({ value, maxWidth = 'max-w-[150px]' }: { value: string | null | undefined; maxWidth?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!value) {
    return <span className="text-gray-400">-</span>;
  }

  return (
    <div
      className={`${maxWidth} flex items-center gap-1 cursor-pointer hover:text-blue-600 group`}
      onClick={handleCopy}
      title={`${value} (click to copy)`}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 flex-shrink-0" />
      )}
    </div>
  );
}

export default function PatientDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [insurancePayments, setInsurancePayments] = useState<InsurancePayment[]>([]);
  const [venmoPayments, setVenmoPayments] = useState<VenmoPayment[]>([]);
  const [patientInfo, setPatientInfo] = useState<{ memberID: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    () => INSURANCE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultVisible }), {} as Record<ColumnKey, boolean>)
  );

  // Selection state for PDF export
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [showExportHelp, setShowExportHelp] = useState(false);

  // Pagination state
  const [insurancePageSize, setInsurancePageSize] = useState<number>(10);
  const [insuranceCurrentPage, setInsuranceCurrentPage] = useState<number>(1);
  const [venmoPageSize, setVenmoPageSize] = useState<number>(10);
  const [venmoCurrentPage, setVenmoCurrentPage] = useState<number>(1);

  const PAGE_SIZE_OPTIONS = [10, 25, 100];

  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  // Insurance table sorting state
  type InsuranceSortField = 'trackingStatus' | 'payeeName' | 'claimStatus' | 'datesOfService' | 'providerName' | 'paymentDate' | 'checkNumber' | 'checkEFTAmount' | 'payeeAddress';
  type SortDirection = 'asc' | 'desc' | null;
  const [insuranceSortField, setInsuranceSortField] = useState<InsuranceSortField | null>(null);
  const [insuranceSortDirection, setInsuranceSortDirection] = useState<SortDirection>(null);

  // Venmo table sorting state
  type VenmoSortField = 'date' | 'amount' | 'notes';
  const [venmoSortField, setVenmoSortField] = useState<VenmoSortField | null>(null);
  const [venmoSortDirection, setVenmoSortDirection] = useState<SortDirection>(null);

  const handleInsuranceSort = (field: InsuranceSortField) => {
    if (insuranceSortField === field) {
      if (insuranceSortDirection === 'asc') {
        setInsuranceSortDirection('desc');
      } else if (insuranceSortDirection === 'desc') {
        setInsuranceSortField(null);
        setInsuranceSortDirection(null);
      }
    } else {
      setInsuranceSortField(field);
      setInsuranceSortDirection('asc');
    }
  };

  const handleVenmoSort = (field: VenmoSortField) => {
    if (venmoSortField === field) {
      if (venmoSortDirection === 'asc') {
        setVenmoSortDirection('desc');
      } else if (venmoSortDirection === 'desc') {
        setVenmoSortField(null);
        setVenmoSortDirection(null);
      }
    } else {
      setVenmoSortField(field);
      setVenmoSortDirection('asc');
    }
  };

  const InsuranceSortableHeader = ({ field, children }: { field: InsuranceSortField; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
      onClick={() => handleInsuranceSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="flex flex-col">
          <ChevronUp className={`w-3 h-3 -mb-1 ${insuranceSortField === field && insuranceSortDirection === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
          <ChevronDown className={`w-3 h-3 ${insuranceSortField === field && insuranceSortDirection === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </span>
      </div>
    </th>
  );

  const VenmoSortableHeader = ({ field, children }: { field: VenmoSortField; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
      onClick={() => handleVenmoSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="flex flex-col">
          <ChevronUp className={`w-3 h-3 -mb-1 ${venmoSortField === field && venmoSortDirection === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
          <ChevronDown className={`w-3 h-3 ${venmoSortField === field && venmoSortDirection === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </span>
      </div>
    </th>
  );

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isColumnVisible = (key: ColumnKey) => visibleColumns[key];

  useEffect(() => {
    if (!authLoading && user) {
      loadPatientData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, patientId]);

  // Reset page to 1 when filter or sort changes
  useEffect(() => {
    setInsuranceCurrentPage(1);
  }, [statusFilter, insuranceSortField, insuranceSortDirection]);

  useEffect(() => {
    setVenmoCurrentPage(1);
  }, [venmoSortField, venmoSortDirection]);

  const loadPatientData = async () => {
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`);
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

  const getStatusConfig = (status: TrackingStatus) => {
    return TRACKING_STATUSES.find(s => s.value === status) || TRACKING_STATUSES[0];
  };

  const formatServiceDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    // Handle "05/18/2025-05/18/2025" format - show only once if same date
    if (dateStr.includes('-')) {
      const [start, end] = dateStr.split('-');
      if (start.trim() === end.trim()) {
        return start.trim();
      }
    }
    return dateStr;
  };

  const exportToPDF = () => {
    if (!patientInfo) return;

    // Determine which payments to export: selected ones or all filtered
    const paymentsToExport = selectedPayments.size > 0
      ? sortedInsurancePayments.filter(p => selectedPayments.has(p.id))
      : sortedInsurancePayments;

    if (paymentsToExport.length === 0) {
      alert('No payments to export. Please select at least one payment or ensure there are payments in the filtered view.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(18);
    doc.text('Insurance Payments Report', pageWidth / 2, 20, { align: 'center' });

    // Patient Info
    doc.setFontSize(12);
    doc.text(`Patient: ${patientInfo.name}`, 14, 35);
    doc.text(`Member ID: ${patientInfo.memberID}`, 14, 42);

    // Address
    let tableStartY = 50;
    const address = insurancePayments[0]?.payeeAddress;
    if (address) {
      const addressParts = address.split(',').map(part => part.trim());
      doc.text(`Address: ${addressParts[0]}`, 14, 49);
      addressParts.slice(1).forEach((part, index) => {
        doc.text(part, 14, 54 + (index * 5));
      });
      tableStartY = 54 + ((addressParts.length - 1) * 5) + 5;
    }

    // Build table headers based on visible columns
    const headers: string[] = [];
    const columnKeys: ColumnKey[] = [];

    INSURANCE_COLUMNS.forEach(col => {
      if (isColumnVisible(col.key)) {
        headers.push(col.label);
        columnKeys.push(col.key);
      }
    });

    // Build table data from selected/filtered payments
    const tableData = paymentsToExport.map(payment => {
      const row: string[] = [];
      columnKeys.forEach(key => {
        switch (key) {
          case 'tracking':
            row.push(getStatusConfig(payment.trackingStatus).label);
            break;
          case 'patientName':
            row.push(payment.payeeName || '-');
            break;
          case 'claimStatus':
            row.push(payment.claimStatus || '-');
            break;
          case 'serviceDates':
            row.push(formatServiceDate(payment.datesOfService) || '-');
            break;
          case 'provider':
            row.push(payment.providerName || '-');
            break;
          case 'paymentDate':
            row.push(payment.paymentDate || '-');
            break;
          case 'checkNumber':
            row.push(payment.checkNumber || '-');
            break;
          case 'amount':
            row.push(`$${payment.checkEFTAmount.toFixed(2)}`);
            break;
          case 'address':
            row.push(payment.payeeAddress || '-');
            break;
        }
      });
      return row;
    });

    // Generate table
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: tableStartY,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    // Summary footer
    const exportTotal = paymentsToExport.reduce((sum, p) => sum + p.checkEFTAmount, 0);
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 200;
    doc.setFontSize(10);
    doc.text(`Total Payments: ${paymentsToExport.length}`, 14, finalY + 10);
    doc.text(`Total Amount: $${exportTotal.toFixed(2)}`, 14, finalY + 17);

    // Download
    const fileName = `${patientInfo.name.replace(/\s+/g, '_')}_insurance_payments_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const updateTrackingStatus = async (paymentId: string, newStatus: TrackingStatus) => {
    try {
      const response = await fetch(`/api/insurance-payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingStatus: newStatus }),
      });

      if (response.ok) {
        setInsurancePayments(prev =>
          prev.map(p => p.id === paymentId ? { ...p, trackingStatus: newStatus } : p)
        );
      }
    } catch (error) {
      console.error('Error updating tracking status:', error);
    }
  };

  // Filter insurance payments by tracking status
  const filteredInsurancePayments = statusFilter === 'all'
    ? insurancePayments
    : insurancePayments.filter(p => p.trackingStatus === statusFilter);

  // Apply sorting to insurance payments
  const sortedInsurancePayments = [...filteredInsurancePayments].sort((a, b) => {
    if (!insuranceSortField || !insuranceSortDirection) return 0;

    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (insuranceSortField) {
      case 'trackingStatus':
        const statusOrder = { PENDING: 0, RECORDED: 1, NOTIFIED: 2, COLLECTED: 3 };
        aVal = statusOrder[a.trackingStatus] ?? 0;
        bVal = statusOrder[b.trackingStatus] ?? 0;
        break;
      case 'checkEFTAmount':
        aVal = a.checkEFTAmount ?? 0;
        bVal = b.checkEFTAmount ?? 0;
        break;
      default:
        aVal = (a[insuranceSortField] ?? '').toString().toLowerCase();
        bVal = (b[insuranceSortField] ?? '').toString().toLowerCase();
    }

    if (aVal < bVal) return insuranceSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return insuranceSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Selection helpers (must be after sortedInsurancePayments is defined)
  const toggleSelectAll = () => {
    if (selectedPayments.size === sortedInsurancePayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(sortedInsurancePayments.map(p => p.id)));
    }
  };

  const isAllSelected = sortedInsurancePayments.length > 0 && selectedPayments.size === sortedInsurancePayments.length;
  const isSomeSelected = selectedPayments.size > 0 && selectedPayments.size < sortedInsurancePayments.length;

  // Apply sorting to venmo payments
  const sortedVenmoPayments = [...venmoPayments].sort((a, b) => {
    if (!venmoSortField || !venmoSortDirection) return 0;

    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (venmoSortField) {
      case 'amount':
        aVal = a.amount ?? 0;
        bVal = b.amount ?? 0;
        break;
      default:
        aVal = (a[venmoSortField] ?? '').toString().toLowerCase();
        bVal = (b[venmoSortField] ?? '').toString().toLowerCase();
    }

    if (aVal < bVal) return venmoSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return venmoSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const insuranceTotalPages = Math.ceil(sortedInsurancePayments.length / insurancePageSize);
  const paginatedInsurancePayments = sortedInsurancePayments.slice(
    (insuranceCurrentPage - 1) * insurancePageSize,
    insuranceCurrentPage * insurancePageSize
  );

  const venmoTotalPages = Math.ceil(sortedVenmoPayments.length / venmoPageSize);
  const paginatedVenmoPayments = sortedVenmoPayments.slice(
    (venmoCurrentPage - 1) * venmoPageSize,
    venmoCurrentPage * venmoPageSize
  );

  // Reset to page 1 when filters change
  const handleInsurancePageSizeChange = (newSize: number) => {
    setInsurancePageSize(newSize);
    setInsuranceCurrentPage(1);
  };

  const handleVenmoPageSizeChange = (newSize: number) => {
    setVenmoPageSize(newSize);
    setVenmoCurrentPage(1);
  };

  const totalInsurance = insurancePayments.reduce((sum, p) => sum + p.checkEFTAmount, 0);
  const filteredTotalInsurance = filteredInsurancePayments.reduce((sum, p) => sum + p.checkEFTAmount, 0);
  const totalVenmo = venmoPayments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalInsurance - totalVenmo;

  // Calculate which insurance payments are covered by Venmo payments
  // Start from oldest records first (oldest debts settled first)
  const paidPaymentIds = new Set<string>();
  let partialPaymentId: string | null = null;
  let partialCoveragePercent = 0;

  if (totalVenmo > 0) {
    let remainingVenmo = totalVenmo;
    const oldestFirst = [...sortedInsurancePayments].reverse();
    for (const payment of oldestFirst) {
      if (remainingVenmo <= 0) break;

      if (remainingVenmo >= payment.checkEFTAmount) {
        paidPaymentIds.add(payment.id);
        remainingVenmo -= payment.checkEFTAmount;
      } else {
        partialPaymentId = payment.id;
        partialCoveragePercent = (remainingVenmo / payment.checkEFTAmount) * 100;
        remainingVenmo = 0;
      }
    }
  }

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

  if (authLoading || loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading patient details...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Patient Details</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please sign in to view patient details.</p>
      </div>
    );
  }

  if (!patientInfo) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Patient not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 mb-4 flex items-center gap-2"
          >
            &larr; Back
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">{patientInfo.name}</h1>
              <p className="text-gray-600 dark:text-gray-400">Member ID: {patientInfo.memberID}</p>
              {insurancePayments[0]?.payeeAddress && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {insurancePayments[0].payeeAddress.split(',').map((part, index) => (
                    <p key={index}>{part.trim()}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Insurance Payments</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${totalInsurance.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Patient Paid</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalVenmo.toFixed(2)}</p>
              </div>
              <div className={`rounded-lg shadow p-4 ${
                balance === 0 ? 'bg-green-50 dark:bg-green-900/30' : balance > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30'
              }`}>
                <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
                <p className={`text-2xl font-bold ${
                  balance === 0 ? 'text-green-600 dark:text-green-400' : balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  ${Math.abs(balance).toFixed(2)} {balance < 0 && '(overpaid)'}
                </p>
                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                  {balance === 0 ? 'Paid in Full' : balance > 0 ? 'Outstanding' : 'Overpaid'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Export Help Panel */}
        {showExportHelp && (
          <Card className="p-6 mb-6 animate-fade-in bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">PDF Export Guide</h3>
              <button
                onClick={() => setShowExportHelp(false)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <p><strong>Select specific records:</strong> Use the checkboxes on the left of each row to select only the payments you want to export. The PDF will only include selected records.</p>
              <p><strong>Export all visible:</strong> If no records are selected, all currently visible (filtered) records will be exported.</p>
              <p><strong>Hide columns:</strong> Use the "Columns" button to hide columns you don't want in the PDF export. Hidden columns won't appear in the exported document.</p>
              <p><strong>Filter by status:</strong> Use the status dropdown to filter payments before export. Only filtered payments will be included.</p>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
              Tip: The export will respect your current sort order, column visibility, and row selections.
            </p>
          </Card>
        )}

        {/* Insurance Payments Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Insurance Payments</h2>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setShowExportHelp(!showExportHelp)}>
                <HelpCircle className="w-4 h-4 mr-2" />
                Help
              </Button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white border border-blue-600 rounded-md hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export PDF {selectedPayments.size > 0 && `(${selectedPayments.size})`}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Settings2 className="w-4 h-4" />
                    Columns
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel className="font-semibold text-gray-700 dark:text-gray-300">Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {INSURANCE_COLUMNS.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={isColumnVisible(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-9 bg-white">
                  <span className="text-sm">
                    {statusFilter === 'all' ? 'All Statuses' : TRACKING_STATUSES.find(s => s.value === statusFilter)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {TRACKING_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {statusFilter === 'all'
                  ? `${insurancePayments.length} payment${insurancePayments.length !== 1 ? 's' : ''}`
                  : `${filteredInsurancePayments.length} of ${insurancePayments.length} payment${insurancePayments.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
          </div>

          <Card className="animate-fade-in overflow-visible">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={el => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        title={isAllSelected ? 'Deselect all' : 'Select all'}
                      />
                    </th>
                    {isColumnVisible('tracking') && <InsuranceSortableHeader field="trackingStatus">Tracking</InsuranceSortableHeader>}
                    {isColumnVisible('patientName') && <InsuranceSortableHeader field="payeeName">Patient Name</InsuranceSortableHeader>}
                    {isColumnVisible('claimStatus') && <InsuranceSortableHeader field="claimStatus">Claim Status</InsuranceSortableHeader>}
                    {isColumnVisible('serviceDates') && <InsuranceSortableHeader field="datesOfService">Service Dates</InsuranceSortableHeader>}
                    {isColumnVisible('provider') && <InsuranceSortableHeader field="providerName">Provider</InsuranceSortableHeader>}
                    {isColumnVisible('paymentDate') && <InsuranceSortableHeader field="paymentDate">Payment Date</InsuranceSortableHeader>}
                    {isColumnVisible('checkNumber') && <InsuranceSortableHeader field="checkNumber">Check #</InsuranceSortableHeader>}
                    {isColumnVisible('amount') && <InsuranceSortableHeader field="checkEFTAmount">Claim Amount Paid</InsuranceSortableHeader>}
                    {isColumnVisible('address') && <InsuranceSortableHeader field="payeeAddress">Address</InsuranceSortableHeader>}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedInsurancePayments.map((payment) => {
                    const isPaid = paidPaymentIds.has(payment.id);
                    const isPartial = partialPaymentId === payment.id;

                    return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedPayments.has(payment.id)
                          ? 'bg-blue-50'
                          : isPaid
                          ? 'bg-green-50'
                          : isPartial
                          ? ''
                          : ''
                      }`}
                      style={{
                        ...(isPaid ? { borderLeft: '4px solid rgb(34 197 94)' } : {}),
                        ...(isPartial ? {
                          borderLeft: '4px solid rgb(34 197 94)',
                          background: `linear-gradient(to right, rgb(240 253 244) ${partialCoveragePercent}%, transparent ${partialCoveragePercent}%)`
                        } : {})
                      }}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <input
                          type="checkbox"
                          checked={selectedPayments.has(payment.id)}
                          onChange={() => togglePaymentSelection(payment.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      {isColumnVisible('tracking') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <Select
                            value={payment.trackingStatus}
                            onValueChange={(value) => updateTrackingStatus(payment.id, value as TrackingStatus)}
                          >
                            <SelectTrigger
                              className="w-fit h-fit border-0 bg-transparent p-0 m-0 hover:bg-transparent focus:ring-0 focus:outline-none [&>svg]:hidden"
                            >
                              <Badge variant={getStatusConfig(payment.trackingStatus).variant} className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs">
                                {getStatusConfig(payment.trackingStatus).label}
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
                      )}
                      {isColumnVisible('patientName') && (
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <TruncatableCell value={payment.payeeName} maxWidth="max-w-[150px]" />
                        </td>
                      )}
                      {isColumnVisible('claimStatus') && (
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <TruncatableCell value={payment.claimStatus} maxWidth="max-w-[100px]" />
                        </td>
                      )}
                      {isColumnVisible('serviceDates') && (
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <TruncatableCell value={formatServiceDate(payment.datesOfService)} maxWidth="max-w-[120px]" />
                        </td>
                      )}
                      {isColumnVisible('provider') && (
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <TruncatableCell value={payment.providerName} maxWidth="max-w-[120px]" />
                        </td>
                      )}
                      {isColumnVisible('paymentDate') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.paymentDate || '-'}</td>
                      )}
                      {isColumnVisible('checkNumber') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.checkNumber || '-'}</td>
                      )}
                      {isColumnVisible('amount') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          ${payment.checkEFTAmount.toFixed(2)}
                        </td>
                      )}
                      {isColumnVisible('address') && (
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <TruncatableCell value={payment.payeeAddress} maxWidth="max-w-[150px]" />
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteInsurance(payment.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                  {paginatedInsurancePayments.length === 0 && (
                    <tr>
                      <td colSpan={INSURANCE_COLUMNS.filter(col => isColumnVisible(col.key)).length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        {statusFilter === 'all'
                          ? 'No insurance payments recorded'
                          : `No payments with status "${TRACKING_STATUSES.find(s => s.value === statusFilter)?.label}"`
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedPayments.size > 0 ? (
                      <>
                        {selectedPayments.size} selected
                        <button
                          onClick={() => setSelectedPayments(new Set())}
                          className="ml-2 text-blue-600 hover:text-blue-800 underline"
                        >
                          Clear selection
                        </button>
                      </>
                    ) : (
                      <>
                        Showing {((insuranceCurrentPage - 1) * insurancePageSize) + 1}-{Math.min(insuranceCurrentPage * insurancePageSize, sortedInsurancePayments.length)} of {sortedInsurancePayments.length}
                        {statusFilter !== 'all' && ` (filtered from ${insurancePayments.length})`}
                      </>
                    )}
                  </span>
                </div>
                <span className="text-sm font-semibold text-blue-600">
                  {selectedPayments.size > 0
                    ? `Selected Total: $${sortedInsurancePayments.filter(p => selectedPayments.has(p.id)).reduce((sum, p) => sum + p.checkEFTAmount, 0).toFixed(2)}`
                    : statusFilter === 'all'
                      ? `Total: $${totalInsurance.toFixed(2)}`
                      : `Filtered Total: $${filteredTotalInsurance.toFixed(2)}`
                  }
                </span>
              </div>
              {/* Pagination Controls */}
              {sortedInsurancePayments.length > 10 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
                    <select
                      value={insurancePageSize}
                      onChange={(e) => handleInsurancePageSizeChange(Number(e.target.value))}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInsuranceCurrentPage(1)}
                      disabled={insuranceCurrentPage === 1}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setInsuranceCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={insuranceCurrentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                      Page {insuranceCurrentPage} of {insuranceTotalPages}
                    </span>
                    <button
                      onClick={() => setInsuranceCurrentPage(prev => Math.min(insuranceTotalPages, prev + 1))}
                      disabled={insuranceCurrentPage === insuranceTotalPages}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setInsuranceCurrentPage(insuranceTotalPages)}
                      disabled={insuranceCurrentPage === insuranceTotalPages}
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

        {/* Venmo Payments Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Venmo Payments</h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {venmoPayments.length} payment{venmoPayments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <Card className="animate-fade-in overflow-visible">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <VenmoSortableHeader field="date">Date</VenmoSortableHeader>
                    <VenmoSortableHeader field="amount">Amount</VenmoSortableHeader>
                    <VenmoSortableHeader field="notes">Notes</VenmoSortableHeader>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedVenmoPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.date}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${payment.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                        <TruncatableCell value={payment.notes} maxWidth="max-w-[200px]" />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteVenmo(payment.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {paginatedVenmoPayments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No Venmo payments recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {sortedVenmoPayments.length > 0
                    ? `Showing ${((venmoCurrentPage - 1) * venmoPageSize) + 1}-${Math.min(venmoCurrentPage * venmoPageSize, sortedVenmoPayments.length)} of ${sortedVenmoPayments.length}`
                    : `${venmoPayments.length} payment${venmoPayments.length !== 1 ? 's' : ''}`
                  }
                </span>
                <span className="text-sm font-semibold text-green-600">Total: ${totalVenmo.toFixed(2)}</span>
              </div>
              {/* Pagination Controls */}
              {sortedVenmoPayments.length > 10 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Rows per page:</span>
                    <select
                      value={venmoPageSize}
                      onChange={(e) => handleVenmoPageSizeChange(Number(e.target.value))}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVenmoCurrentPage(1)}
                      disabled={venmoCurrentPage === 1}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setVenmoCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={venmoCurrentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                      Page {venmoCurrentPage} of {venmoTotalPages}
                    </span>
                    <button
                      onClick={() => setVenmoCurrentPage(prev => Math.min(venmoTotalPages, prev + 1))}
                      disabled={venmoCurrentPage === venmoTotalPages}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setVenmoCurrentPage(venmoTotalPages)}
                      disabled={venmoCurrentPage === venmoTotalPages}
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

        {/* Summary Section */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Payment Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-r border-gray-200 dark:border-gray-700 pr-4">
              <div className="mb-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Insurance Received</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${totalInsurance.toFixed(2)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{insurancePayments.length} payment(s)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Patient Paid</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalVenmo.toFixed(2)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{venmoPayments.length} payment(s)</p>
              </div>
            </div>
            <div className="pl-4">
              <div className="mb-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding Balance</p>
                <p className={`text-3xl font-bold ${
                  balance === 0 ? 'text-green-600 dark:text-green-400' : balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  ${Math.abs(balance).toFixed(2)}
                </p>
                {balance < 0 && <p className="text-xs text-yellow-600 dark:text-yellow-400">Patient overpaid by ${Math.abs(balance).toFixed(2)}</p>}
                {balance > 0 && <p className="text-xs text-red-600 dark:text-red-400">Patient still owes ${balance.toFixed(2)}</p>}
                {balance === 0 && <p className="text-xs text-green-600 dark:text-green-400">Account is settled</p>}
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</p>
                {balance === 0 && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    Paid in Full
                  </span>
                )}
                {balance > 0 && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    Outstanding Balance
                  </span>
                )}
                {balance < 0 && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                    Overpaid
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
