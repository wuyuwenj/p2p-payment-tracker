'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Search, ChevronDown } from 'lucide-react';
import { Card } from '@/components/tracker/Card';
import { Badge } from '@/components/tracker/Badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { InsurancePayment, VenmoPayment, TrackingStatus } from '@/lib/types';

type StatusVariant = 'secondary' | 'info' | 'warning' | 'success';

const TRACKING_STATUSES: { value: TrackingStatus; label: string; variant: StatusVariant }[] = [
  { value: 'PENDING', label: 'Pending', variant: 'secondary' },
  { value: 'RECORDED', label: 'Recorded', variant: 'info' },
  { value: 'NOTIFIED', label: 'Notified', variant: 'warning' },
  { value: 'COLLECTED', label: 'Collected', variant: 'success' },
];

interface PatientSummary {
  memberID: string;
  name: string;
  totalInsurance: number;
  totalVenmo: number;
  balance: number;
  insuranceCount: number;
  venmoCount: number;
}

interface PatientDetails {
  insurancePayments: InsurancePayment[];
  venmoPayments: VenmoPayment[];
}

export default function PatientsPage() {
  const { data: session, status } = useSession();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<PatientSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'outstanding' | 'paid' | 'overpaid'>('all');
  const [loading, setLoading] = useState(true);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [patientDetails, setPatientDetails] = useState<Record<string, PatientDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      loadPatients();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterStatus, patients]);

  const loadPatients = async () => {
    try {
      const response = await fetch('/api/patients');
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...patients];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        p => p.name.toLowerCase().includes(search) ||
             p.memberID.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (filterStatus === 'outstanding') {
      filtered = filtered.filter(p => p.balance > 0);
    } else if (filterStatus === 'paid') {
      filtered = filtered.filter(p => p.balance === 0);
    } else if (filterStatus === 'overpaid') {
      filtered = filtered.filter(p => p.balance < 0);
    }

    setFilteredPatients(filtered);
  };

  const getPatientKey = (patient: PatientSummary) => {
    return `${patient.memberID}|||${patient.name}`;
  };

  const togglePatientDetails = async (patient: PatientSummary) => {
    const key = getPatientKey(patient);

    if (expandedPatient === key) {
      setExpandedPatient(null);
      return;
    }

    setExpandedPatient(key);

    // Load details if not already loaded
    if (!patientDetails[key]) {
      setLoadingDetails(key);
      try {
        const patientId = encodeURIComponent(key);
        const response = await fetch(`/api/patients/${patientId}`);
        if (response.ok) {
          const data = await response.json();
          setPatientDetails(prev => ({
            ...prev,
            [key]: {
              insurancePayments: data.insurancePayments,
              venmoPayments: data.venmoPayments,
            }
          }));
        }
      } catch (error) {
        console.error('Error loading patient details:', error);
      } finally {
        setLoadingDetails(null);
      }
    }
  };

  const updateTrackingStatus = async (paymentId: string, newStatus: TrackingStatus, patientKey: string) => {
    try {
      const response = await fetch(`/api/insurance-payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingStatus: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setPatientDetails(prev => ({
          ...prev,
          [patientKey]: {
            ...prev[patientKey],
            insurancePayments: prev[patientKey].insurancePayments.map(p =>
              p.id === paymentId ? { ...p, trackingStatus: newStatus } : p
            ),
          }
        }));
      }
    } catch (error) {
      console.error('Error updating tracking status:', error);
    }
  };

  const getStatusConfig = (status: TrackingStatus) => {
    return TRACKING_STATUSES.find(s => s.value === status) || TRACKING_STATUSES[0];
  };

  const formatServiceDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    // Handle "05/18/2025-05/18/2025" format - show only once if same date
    if (dateStr.includes('-')) {
      const [start, end] = dateStr.split('-');
      if (start.trim() === end.trim()) {
        return start.trim();
      }
    }
    return dateStr;
  };

  const getStatusBadge = (balance: number) => {
    if (balance === 0) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Paid in Full</span>;
    } else if (balance < 0) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Overpaid</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Outstanding</span>;
    }
  };

  if (status === 'loading' || loading) {
    return <div className="text-center py-8">Loading patients...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">All Patients</h1>
        <p className="text-gray-600 mb-6">Please sign in to view patients.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Patients</h1>
            <p className="text-muted-foreground mt-1">View patient balances and payment history</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name or member ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | 'outstanding' | 'paid' | 'overpaid')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="outstanding">Outstanding</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overpaid">Overpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Total Patients</p>
            <p className="text-2xl font-bold">{filteredPatients.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Outstanding Balance</p>
            <p className="text-2xl font-bold text-red-600">
              ${filteredPatients.filter(p => p.balance > 0).reduce((sum, p) => sum + p.balance, 0).toFixed(2)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Total Insurance</p>
            <p className="text-2xl font-bold text-blue-600">
              ${filteredPatients.reduce((sum, p) => sum + p.totalInsurance, 0).toFixed(2)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">
              ${filteredPatients.reduce((sum, p) => sum + p.totalVenmo, 0).toFixed(2)}
            </p>
          </Card>
        </div>

      {/* Patient List */}
      <Card className="animate-fade-in overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Insurance</th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Paid</th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="w-[17%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm || filterStatus !== 'all'
                      ? 'No patients match your search or filter criteria.'
                      : 'No patients found. Import insurance payments to get started.'}
                  </td>
                </tr>
              )}
              {filteredPatients.map((patient, index) => {
                const key = getPatientKey(patient);
                const isExpanded = expandedPatient === key;
                const details = patientDetails[key];
                const isLoadingDetails = loadingDetails === key;

                return (
                  <>
                    <tr key={`row-${index}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                        <div className="text-xs text-gray-500">
                          {patient.insuranceCount} insurance, {patient.venmoCount} venmo
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {patient.memberID || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                        ${patient.totalInsurance.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        ${patient.totalVenmo.toFixed(2)}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm font-semibold ${
                        patient.balance > 0 ? 'text-red-600' : patient.balance < 0 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        ${Math.abs(patient.balance).toFixed(2)}
                        {patient.balance < 0 && ' (overpaid)'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(patient.balance)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-3">
                          <button
                            onClick={() => togglePatientDetails(patient)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                          <a
                            href={`/patient/${encodeURIComponent(key)}`}
                            className="text-gray-600 hover:text-gray-900 font-medium"
                          >
                            Details
                          </a>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`expanded-${index}`}>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          {isLoadingDetails ? (
                            <div className="text-center py-4 text-gray-500">Loading details...</div>
                          ) : details ? (
                            <div className="grid grid-cols-2 gap-6">
                              {/* Insurance Payments */}
                              <div>
                                <h4 className="font-semibold mb-3 text-blue-700">
                                  Insurance Payments ({details.insurancePayments.length})
                                </h4>
                                {details.insurancePayments.length > 0 ? (
                                  <div>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Amount</th>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Service Date</th>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Payment Date</th>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.insurancePayments.map(payment => (
                                          <tr key={payment.id}>
                                            <td className="px-2 py-1 font-medium text-gray-900">
                                              ${payment.checkEFTAmount.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1 text-gray-600">
                                              {formatServiceDate(payment.datesOfService)}
                                            </td>
                                            <td className="px-2 py-1 text-gray-600">
                                              {payment.paymentDate || '-'}
                                            </td>
                                            <td className="px-2 py-1">
                                              <Select
                                                value={payment.trackingStatus}
                                                onValueChange={(value) => updateTrackingStatus(payment.id, value as TrackingStatus, key)}
                                              >
                                                <SelectTrigger
                                                  className="w-fit h-fit border-0 bg-transparent p-0 m-0 hover:bg-transparent focus:ring-0 focus:outline-none [&>svg]:hidden"
                                                  onClick={(e) => e.stopPropagation()}
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
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm">No insurance payments</p>
                                )}
                              </div>

                              {/* Venmo Payments */}
                              <div>
                                <h4 className="font-semibold mb-3 text-green-700">
                                  Venmo Payments ({details.venmoPayments.length})
                                </h4>
                                {details.venmoPayments.length > 0 ? (
                                  <div>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Amount</th>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Date</th>
                                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Notes</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.venmoPayments.map(payment => (
                                          <tr key={payment.id}>
                                            <td className="px-2 py-1 font-medium text-gray-900">
                                              ${payment.amount.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1 text-gray-600">
                                              {payment.date}
                                            </td>
                                            <td className="px-2 py-1 text-gray-600">
                                              {payment.notes || '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm">No Venmo payments</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500">Unable to load details</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
                {(searchTerm || filterStatus !== 'all') && ` (filtered from ${patients.length} total)`}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                Outstanding: ${filteredPatients.filter(p => p.balance > 0).reduce((sum, p) => sum + p.balance, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
