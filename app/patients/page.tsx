'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { InsurancePayment, VenmoPayment } from '@/lib/types';

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
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">All Patients</h1>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Patients
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or member ID..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('outstanding')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    filterStatus === 'outstanding'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Outstanding
                </button>
                <button
                  onClick={() => setFilterStatus('paid')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    filterStatus === 'paid'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Paid
                </button>
                <button
                  onClick={() => setFilterStatus('overpaid')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    filterStatus === 'overpaid'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Overpaid
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Patients</p>
            <p className="text-2xl font-bold">{filteredPatients.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Outstanding Balance</p>
            <p className="text-2xl font-bold text-red-600">
              ${filteredPatients.filter(p => p.balance > 0).reduce((sum, p) => sum + p.balance, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Insurance</p>
            <p className="text-2xl font-bold text-blue-600">
              ${filteredPatients.reduce((sum, p) => sum + p.totalInsurance, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">
              ${filteredPatients.reduce((sum, p) => sum + p.totalVenmo, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Patient List */}
      {filteredPatients.length === 0 ? (
        <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-2">No patients found</p>
          <p className="text-gray-500">
            {searchTerm || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Import insurance payments to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Insurance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient, index) => {
                  const key = getPatientKey(patient);
                  const isExpanded = expandedPatient === key;
                  const details = patientDetails[key];
                  const isLoadingDetails = loadingDetails === key;

                  return (
                    <tr key={index}>
                      <td colSpan={7} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap" style={{width: '20%'}}>
                                <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                                <div className="text-xs text-gray-500">
                                  {patient.insuranceCount} insurance, {patient.venmoCount} venmo
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700" style={{width: '15%'}}>
                                {patient.memberID || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600" style={{width: '12%'}}>
                                ${patient.totalInsurance.toFixed(2)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600" style={{width: '12%'}}>
                                ${patient.totalVenmo.toFixed(2)}
                              </td>
                              <td className={`px-4 py-4 whitespace-nowrap text-sm font-semibold ${
                                patient.balance > 0 ? 'text-red-600' : patient.balance < 0 ? 'text-yellow-600' : 'text-green-600'
                              }`} style={{width: '12%'}}>
                                ${Math.abs(patient.balance).toFixed(2)}
                                {patient.balance < 0 && ' (overpaid)'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm" style={{width: '12%'}}>
                                {getStatusBadge(patient.balance)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm" style={{width: '17%'}}>
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
                              <tr>
                                <td colSpan={7} className="px-4 py-4 bg-gray-50">
                                  {isLoadingDetails ? (
                                    <div className="text-center py-4 text-gray-500">Loading details...</div>
                                  ) : details ? (
                                    <div className="grid grid-cols-2 gap-4">
                                      {/* Insurance Payments */}
                                      <div>
                                        <h4 className="font-semibold mb-2 text-blue-700">
                                          Insurance Payments ({details.insurancePayments.length})
                                        </h4>
                                        {details.insurancePayments.length > 0 ? (
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {details.insurancePayments.map(payment => (
                                              <div key={payment.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <div>
                                                    <span className="font-medium">Amount:</span> ${payment.checkEFTAmount.toFixed(2)}
                                                  </div>
                                                  <div>
                                                    <span className="font-medium">Date:</span> {payment.paymentDate || '-'}
                                                  </div>
                                                  <div>
                                                    <span className="font-medium">Check #:</span> {payment.checkNumber || '-'}
                                                  </div>
                                                  <div>
                                                    <span className="font-medium">Status:</span> {payment.claimStatus || '-'}
                                                  </div>
                                                  <div className="col-span-2">
                                                    <span className="font-medium">Service Dates:</span> {payment.datesOfService || '-'}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-gray-500 text-sm">No insurance payments</p>
                                        )}
                                      </div>

                                      {/* Venmo Payments */}
                                      <div>
                                        <h4 className="font-semibold mb-2 text-green-700">
                                          Venmo Payments ({details.venmoPayments.length})
                                        </h4>
                                        {details.venmoPayments.length > 0 ? (
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {details.venmoPayments.map(payment => (
                                              <div key={payment.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <div>
                                                    <span className="font-medium">Amount:</span> ${payment.amount.toFixed(2)}
                                                  </div>
                                                  <div>
                                                    <span className="font-medium">Date:</span> {payment.date}
                                                  </div>
                                                  {payment.notes && (
                                                    <div className="col-span-2">
                                                      <span className="font-medium">Notes:</span> {payment.notes}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
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
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
