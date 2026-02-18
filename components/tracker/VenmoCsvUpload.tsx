'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Upload, FileText, X, CheckCircle, AlertCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

/** Split raw CSV text into logical records, handling quoted fields that contain newlines. */
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        // Escaped quote ""
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === '\n' || (char === '\r' && text[i + 1] === '\n')) && !inQuotes) {
      if (char === '\r') i++; // skip the \n of \r\n
      records.push(current);
      current = '';
    } else if (char === '\r' && !inQuotes) {
      // bare \r as line ending
      records.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) records.push(current);
  return records;
}

/** Parse a CSV line into fields, handling quoted values, empty fields, and embedded commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

interface VenmoTransaction {
  datetime: string;
  type: string;
  status: string;
  note: string;
  from: string;
  to: string;
  amount: number;
  direction: 'received' | 'sent';
  counterparty: string;
  id?: string;
}

export interface ParsedPayment {
  patientName: string;
  memberSubscriberID: string;
  amount: number;
  date: string;
  notes: string;
  rawFrom?: string; // For mapping
}

interface VenmoCsvUploadProps {
  onImportComplete: (payments: ParsedPayment[]) => void;
  existingPatients: Array<{ name: string; memberId: string }>;
}

export function VenmoCsvUpload({ onImportComplete, existingPatients }: VenmoCsvUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<VenmoTransaction[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [mappings, setMappings] = useState<Map<string, { name: string; memberId: string }>>(new Map());
  const [expandedPayers, setExpandedPayers] = useState<Set<string>>(new Set());
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQueries, setSearchQueries] = useState<Map<string, string>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const parseVenmoCsv = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = splitCsvRecords(text);

      if (lines.length < 2) {
        throw new Error('CSV file appears to be empty');
      }

      // Find the column header row (contains "ID", "Datetime", "Type")
      let headerRowIndex = -1;
      let header: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        const normalized = fields.map(f => f.replace(/"/g, '').trim().toLowerCase());

        if (normalized.some(f => f === 'id') &&
            normalized.some(f => f === 'datetime') &&
            normalized.some(f => f === 'type')) {
          headerRowIndex = i;
          header = fields.map(f => f.replace(/"/g, '').trim().toLowerCase());
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error(
          'Could not find column headers in CSV. Expected columns: ID, Datetime, Type. ' +
          'Make sure this is a Venmo Account Statement CSV export.'
        );
      }

      // Find column indices with exact matching
      const idIndex = header.findIndex(h => h === 'id');
      const dateIndex = header.findIndex(h => h === 'datetime');
      const typeIndex = header.findIndex(h => h === 'type');
      const statusIndex = header.findIndex(h => h === 'status');
      const noteIndex = header.findIndex(h => h === 'note');
      const fromIndex = header.findIndex(h => h === 'from');
      const toIndex = header.findIndex(h => h === 'to');
      const amountIndex = header.findIndex(h => h === 'amount (total)');

      if (dateIndex === -1 || amountIndex === -1) {
        throw new Error('Could not find required columns (Datetime and Amount (total)) in CSV');
      }

      // Parse transaction rows (start after header)
      const allTransactions: VenmoTransaction[] = [];
      const ownerCandidates = new Map<string, number>();

      for (let i = headerRowIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = parseCsvLine(line);

        // Skip rows without a numeric ID (balance summary rows, footer rows)
        const rowId = idIndex !== -1 && idIndex < values.length ? values[idIndex] : '';
        if (!rowId || !/^\d+$/.test(rowId.trim())) continue;

        const type = typeIndex !== -1 && typeIndex < values.length ? values[typeIndex].trim() : '';
        const status = statusIndex !== -1 && statusIndex < values.length ? values[statusIndex].trim() : '';
        const fromVal = fromIndex !== -1 && fromIndex < values.length ? values[fromIndex].trim() : '';
        const toVal = toIndex !== -1 && toIndex < values.length ? values[toIndex].trim() : '';
        const amountStr = amountIndex < values.length ? values[amountIndex].trim() : '';
        const note = noteIndex !== -1 && noteIndex < values.length ? values[noteIndex].trim() : '';
        const datetime = dateIndex < values.length ? values[dateIndex].trim() : '';

        // Only import "Payment" type with "Complete" status
        if (type.toLowerCase() !== 'payment') continue;
        if (status.toLowerCase() !== 'complete') continue;

        const amount = parseFloat(amountStr.replace(/[$,\s+]/g, ''));
        if (isNaN(amount)) continue;

        const direction: 'received' | 'sent' = amount >= 0 ? 'received' : 'sent';

        // Track name frequency to detect account owner
        if (fromVal) ownerCandidates.set(fromVal, (ownerCandidates.get(fromVal) || 0) + 1);
        if (toVal) ownerCandidates.set(toVal, (ownerCandidates.get(toVal) || 0) + 1);

        allTransactions.push({
          datetime,
          type,
          status,
          note,
          from: fromVal,
          to: toVal,
          amount: Math.abs(amount),
          direction,
          counterparty: '', // filled after owner detection
          id: rowId,
        });
      }

      // Detect account owner (name appearing most frequently across all Payment rows)
      let accountOwner = '';
      if (ownerCandidates.size > 0) {
        accountOwner = [...ownerCandidates.entries()]
          .sort((a, b) => b[1] - a[1])[0][0];
      }

      // Set counterparty on each transaction
      for (const tx of allTransactions) {
        if (tx.direction === 'received') {
          tx.counterparty = tx.from === accountOwner ? tx.to : tx.from;
        } else {
          tx.counterparty = tx.to === accountOwner ? tx.from : tx.to;
        }
        if (!tx.counterparty) {
          tx.counterparty = tx.from === accountOwner ? tx.to : tx.from;
        }
      }

      // Only import received payments
      const transactions = allTransactions.filter(tx => tx.direction === 'received');

      if (transactions.length === 0) {
        throw new Error(
          `No received payment transactions found in CSV. ` +
          `Found ${allTransactions.length} total Payment row(s), but none with positive amounts. ` +
          `Only completed payments you received are imported.`
        );
      }

      setParsedTransactions(transactions);
      setShowMapping(true);

      // Auto-map known patient names
      const autoMappings = new Map<string, { name: string; memberId: string }>();
      transactions.forEach(tx => {
        const counterpartyName = tx.counterparty.toLowerCase().trim();
        const match = existingPatients.find(p =>
          p.name.toLowerCase().includes(counterpartyName) || counterpartyName.includes(p.name.toLowerCase())
        );
        if (match) {
          autoMappings.set(tx.counterparty, { name: match.name, memberId: match.memberId });
        }
      });
      setMappings(autoMappings);

    } catch (err: any) {
      console.error('CSV parsing error:', err);
      setError(err.message || 'Failed to parse CSV file');
    } finally {
      setParsing(false);
    }
  };

  const handleMapping = (venmoName: string, patientName: string, memberId: string) => {
    const newMappings = new Map(mappings);
    if (patientName) {
      newMappings.set(venmoName, { name: patientName, memberId });
    } else {
      newMappings.delete(venmoName);
    }
    setMappings(newMappings);
  };

  const dismissTransaction = (txId: string) => {
    setParsedTransactions(prev => prev.filter(tx => tx.id !== txId));
  };

  const dismissPayer = (venmoName: string) => {
    setParsedTransactions(prev => prev.filter(tx => tx.counterparty !== venmoName));
    const newMappings = new Map(mappings);
    newMappings.delete(venmoName);
    setMappings(newMappings);
  };

  const toggleExpanded = (venmoName: string) => {
    setExpandedPayers(prev => {
      const next = new Set(prev);
      if (next.has(venmoName)) next.delete(venmoName);
      else next.add(venmoName);
      return next;
    });
  };

  const handleImport = () => {
    const payments: ParsedPayment[] = parsedTransactions
      .filter(tx => mappings.has(tx.counterparty))
      .map(tx => {
        const mapping = mappings.get(tx.counterparty)!;

        // Parse Venmo date format (e.g., "2024-01-15T10:30:00")
        let dateStr = tx.datetime;
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }

        return {
          patientName: mapping.name,
          memberSubscriberID: mapping.memberId,
          amount: tx.amount,
          date: dateStr,
          notes: tx.note || `Venmo from ${tx.counterparty}`,
          rawFrom: tx.counterparty
        };
      });

    onImportComplete(payments);
    
    // Reset
    setFile(null);
    setParsedTransactions([]);
    setShowMapping(false);
    setMappings(new Map());
  };

  const cancel = () => {
    setFile(null);
    setParsedTransactions([]);
    setShowMapping(false);
    setMappings(new Map());
    setError(null);
  };

  // Get unique payers from transactions
  const uniquePayers = Array.from(new Set(parsedTransactions.map(tx => tx.counterparty)));
  const unmappedCount = uniquePayers.filter(name => !mappings.has(name)).length;
  const totalAmount = parsedTransactions
    .filter(tx => mappings.has(tx.counterparty))
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Import Venmo CSV</h3>
        </div>

        {!showMapping ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a Venmo Account Statement CSV. Only completed payments you received will be imported.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="venmo-csv-upload"
                  />
                  <label
                    htmlFor="venmo-csv-upload"
                    className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {file ? file.name : 'Choose Venmo CSV file'}
                    </span>
                  </label>
                </label>

                {file && (
                  <Button onClick={parseVenmoCsv} disabled={parsing}>
                    {parsing ? 'Parsing...' : 'Parse CSV'}
                  </Button>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p><strong>How to export from Venmo:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Log in to Venmo on the web (venmo.com)</li>
                <li>Go to Statements &amp; History</li>
                <li>Select the date range and click Download CSV</li>
                <li>Upload the Account Statement CSV file here</li>
              </ol>
              <p className="mt-1 text-gray-400 dark:text-gray-500">
                Supports Venmo Account Statement CSV format. Only completed payments with positive amounts are imported.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Found {parsedTransactions.length} payment(s) from {uniquePayers.length} person(s)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Map Venmo usernames to patients in your system
                  </p>
                </div>
                <Button variant="ghost" onClick={cancel}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {unmappedCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {unmappedCount} person(s) not mapped. They will be skipped during import.
                  </p>
                </div>
              )}

              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-6"></th>
                      <th className="px-3 py-2 text-left font-medium">Venmo Name</th>
                      <th className="px-3 py-2 text-left font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Patient Name</th>
                      <th className="px-3 py-2 text-left font-medium">Member ID</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                      <th className="px-3 py-2 text-center font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {uniquePayers.map((venmoName, idx) => {
                      const payerTxs = parsedTransactions.filter(tx => tx.counterparty === venmoName);
                      const txCount = payerTxs.length;
                      const txTotal = payerTxs.reduce((sum, tx) => sum + tx.amount, 0);
                      const mapping = mappings.get(venmoName);
                      const isMapped = !!mapping;
                      const isExpanded = expandedPayers.has(venmoName);

                      return (
                        <React.Fragment key={idx}>
                          <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(venmoName)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />
                                }
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <div>
                                <div className="font-medium">{venmoName}</div>
                                <div className="text-xs text-gray-500">
                                  {txCount} payment{txCount > 1 ? 's' : ''}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-green-600 dark:text-green-400">
                              ${txTotal.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="relative" ref={activeDropdown === venmoName ? dropdownRef : undefined}>
                                <input
                                  type="text"
                                  placeholder="Select or type patient name"
                                  value={activeDropdown === venmoName ? (searchQueries.get(venmoName) ?? mapping?.name ?? '') : (mapping?.name || '')}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchQueries(prev => new Map(prev).set(venmoName, value));
                                    setActiveDropdown(venmoName);
                                    // If typed value exactly matches a patient, auto-map
                                    const match = existingPatients.find(p => p.name === value);
                                    if (match) {
                                      handleMapping(venmoName, match.name, match.memberId);
                                    } else {
                                      handleMapping(venmoName, value, mapping?.memberId || '');
                                    }
                                  }}
                                  onFocus={() => {
                                    setActiveDropdown(venmoName);
                                    if (!searchQueries.has(venmoName)) {
                                      setSearchQueries(prev => new Map(prev).set(venmoName, mapping?.name || ''));
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:bg-gray-800"
                                />
                                {activeDropdown === venmoName && (() => {
                                  const query = (searchQueries.get(venmoName) || '').toLowerCase();
                                  const seen = new Set<string>();
                                  const filtered = existingPatients.filter(p => {
                                    const nameKey = p.name.toLowerCase().trim();
                                    if (seen.has(nameKey)) return false;
                                    if (!nameKey.includes(query) && !p.memberId.toLowerCase().includes(query)) return false;
                                    seen.add(nameKey);
                                    return true;
                                  });
                                  return filtered.length > 0 ? (
                                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                      {filtered.map((p, i) => (
                                        <div
                                          key={`${p.name}-${p.memberId}-${i}`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleMapping(venmoName, p.name, p.memberId);
                                            setActiveDropdown(null);
                                            setSearchQueries(prev => { const next = new Map(prev); next.delete(venmoName); return next; });
                                          }}
                                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                        >
                                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{p.name}</div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">Member ID: {p.memberId}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                placeholder="Member ID"
                                value={mapping?.memberId || ''}
                                onChange={(e) => {
                                  handleMapping(venmoName, mapping?.name || '', e.target.value);
                                }}
                                className="w-full px-2 py-1 text-sm font-mono border dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:bg-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isMapped ? (
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-gray-400 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => dismissPayer(venmoName)}
                                className="text-red-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Dismiss all payments from this person"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && payerTxs.map((tx) => (
                            <tr key={tx.id} className="bg-gray-50/50 dark:bg-gray-800/30">
                              <td className="px-3 py-1.5"></td>
                              <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                                ID: {tx.id}
                              </td>
                              <td className="px-3 py-1.5 text-xs font-mono text-gray-600 dark:text-gray-400">
                                ${tx.amount.toFixed(2)}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                                {tx.datetime?.split('T')[0] || tx.datetime}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={tx.note}>
                                {tx.note || '—'}
                              </td>
                              <td className="px-3 py-1.5"></td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => dismissTransaction(tx.id!)}
                                  className="text-red-300 hover:text-red-500 dark:hover:text-red-400"
                                  title="Remove this transaction"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{parsedTransactions.filter(tx => mappings.has(tx.counterparty)).length}</strong> payment(s) ready to import
                  <span className="ml-2 font-mono text-green-600 dark:text-green-400">
                    (${totalAmount.toFixed(2)})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={mappings.size === 0}
                  >
                    Import {mappings.size > 0 && `${parsedTransactions.filter(tx => mappings.has(tx.counterparty)).length} Payments`}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
