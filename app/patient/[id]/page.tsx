'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronDown, Trash2, Copy, Check, Settings2, Download } from 'lucide-react';
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
  const { data: session, status } = useSession();
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

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isColumnVisible = (key: ColumnKey) => visibleColumns[key];

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

    // Build table data
    const tableData = filteredInsurancePayments.map(payment => {
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
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 200;
    doc.setFontSize(10);
    doc.text(`Total Payments: ${filteredInsurancePayments.length}`, 14, finalY + 10);
    doc.text(`Total Amount: $${filteredTotalInsurance.toFixed(2)}`, 14, finalY + 17);

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

  const totalInsurance = insurancePayments.reduce((sum, p) => sum + p.checkEFTAmount, 0);
  const filteredTotalInsurance = filteredInsurancePayments.reduce((sum, p) => sum + p.checkEFTAmount, 0);
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              {insurancePayments[0]?.payeeAddress && (
                <div className="mt-2 text-sm text-gray-500">
                  {insurancePayments[0].payeeAddress.split(',').map((part, index) => (
                    <p key={index}>{part.trim()}</p>
                  ))}
                </div>
              )}
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
            <div className="flex items-center gap-4">
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white border border-blue-600 rounded-md hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50">
                    <Settings2 className="w-4 h-4" />
                    Columns
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel className="font-semibold text-gray-700">Toggle Columns</DropdownMenuLabel>
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
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {TRACKING_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">
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
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {isColumnVisible('tracking') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking</th>}
                    {isColumnVisible('patientName') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>}
                    {isColumnVisible('claimStatus') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim Status</th>}
                    {isColumnVisible('serviceDates') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Dates</th>}
                    {isColumnVisible('provider') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>}
                    {isColumnVisible('paymentDate') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>}
                    {isColumnVisible('checkNumber') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check #</th>}
                    {isColumnVisible('amount') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claim Amount Paid</th>}
                    {isColumnVisible('address') && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInsurancePayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
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
                            <SelectContent className="bg-white w-[120px]">
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="RECORDED">Recorded</SelectItem>
                              <SelectItem value="NOTIFIED">Notified</SelectItem>
                              <SelectItem value="COLLECTED">Collected</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {isColumnVisible('patientName') && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <TruncatableCell value={payment.payeeName} maxWidth="max-w-[150px]" />
                        </td>
                      )}
                      {isColumnVisible('claimStatus') && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <TruncatableCell value={payment.claimStatus} maxWidth="max-w-[100px]" />
                        </td>
                      )}
                      {isColumnVisible('serviceDates') && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <TruncatableCell value={formatServiceDate(payment.datesOfService)} maxWidth="max-w-[120px]" />
                        </td>
                      )}
                      {isColumnVisible('provider') && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <TruncatableCell value={payment.providerName} maxWidth="max-w-[120px]" />
                        </td>
                      )}
                      {isColumnVisible('paymentDate') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{payment.paymentDate || '-'}</td>
                      )}
                      {isColumnVisible('checkNumber') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{payment.checkNumber || '-'}</td>
                      )}
                      {isColumnVisible('amount') && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          ${payment.checkEFTAmount.toFixed(2)}
                        </td>
                      )}
                      {isColumnVisible('address') && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <TruncatableCell value={payment.payeeAddress} maxWidth="max-w-[150px]" />
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteInsurance(payment.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredInsurancePayments.length === 0 && (
                    <tr>
                      <td colSpan={INSURANCE_COLUMNS.filter(col => isColumnVisible(col.key)).length + 1} className="px-4 py-8 text-center text-gray-500">
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
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {statusFilter === 'all'
                    ? `${insurancePayments.length} payment${insurancePayments.length !== 1 ? 's' : ''}`
                    : `Showing ${filteredInsurancePayments.length} of ${insurancePayments.length} payment${insurancePayments.length !== 1 ? 's' : ''}`
                  }
                </span>
                <span className="text-sm font-semibold text-blue-600">
                  {statusFilter === 'all'
                    ? `Total: $${totalInsurance.toFixed(2)}`
                    : `Filtered Total: $${filteredTotalInsurance.toFixed(2)}`
                  }
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Venmo Payments Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Venmo Payments</h2>
            <span className="text-sm text-gray-600">
              {venmoPayments.length} payment{venmoPayments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <Card className="animate-fade-in overflow-visible">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {venmoPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{payment.date}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${payment.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <TruncatableCell value={payment.notes} maxWidth="max-w-[200px]" />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteVenmo(payment.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {venmoPayments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No Venmo payments recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {venmoPayments.length} payment{venmoPayments.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-semibold text-green-600">Total: ${totalVenmo.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Summary Section */}
        <Card className="p-6">
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
        </Card>
      </div>
    </div>
  );
}
