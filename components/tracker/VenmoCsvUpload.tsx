'use client';

import { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface VenmoTransaction {
  datetime: string;
  type: string;
  status: string;
  note: string;
  from: string;
  to: string;
  amount: number;
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
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file appears to be empty');
      }

      // Parse header to find column indices
      const header = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
      
      const dateIndex = header.findIndex(h => h.includes('datetime') || h.includes('date'));
      const typeIndex = header.findIndex(h => h.includes('type'));
      const statusIndex = header.findIndex(h => h.includes('status'));
      const noteIndex = header.findIndex(h => h.includes('note'));
      const fromIndex = header.findIndex(h => h.includes('from'));
      const toIndex = header.findIndex(h => h.includes('to'));
      const amountIndex = header.findIndex(h => 
        (h.includes('amount') && !h.includes('fee') && !h.includes('tax')) || h.includes('total')
      );

      if (dateIndex === -1 || amountIndex === -1) {
        throw new Error('Could not find required columns (Date and Amount) in CSV');
      }

      // Parse transactions (skip header)
      const transactions: VenmoTransaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Handle quoted CSV values
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        
        if (values.length < header.length) continue;

        const type = typeIndex !== -1 ? values[typeIndex] : '';
        const status = statusIndex !== -1 ? values[statusIndex] : '';
        const amountStr = values[amountIndex];
        
        // Skip charges (we only want payments received)
        if (type.toLowerCase().includes('charge') || type.toLowerCase() === 'payment' && amountStr.startsWith('-')) {
          continue;
        }

        // Only include completed transactions
        if (status && !status.toLowerCase().includes('complete')) {
          continue;
        }

        const amount = parseFloat(amountStr.replace(/[$,\s+]/g, ''));
        if (isNaN(amount) || amount <= 0) continue;

        transactions.push({
          datetime: values[dateIndex],
          type: type,
          status: status,
          note: noteIndex !== -1 ? values[noteIndex] : '',
          from: fromIndex !== -1 ? values[fromIndex] : '',
          to: toIndex !== -1 ? values[toIndex] : '',
          amount: amount
        });
      }

      if (transactions.length === 0) {
        throw new Error('No valid payment transactions found in CSV (only completed payments are imported)');
      }

      setParsedTransactions(transactions);
      setShowMapping(true);
      
      // Auto-map known patient names
      const autoMappings = new Map<string, { name: string; memberId: string }>();
      transactions.forEach(tx => {
        const fromName = tx.from.toLowerCase().trim();
        const match = existingPatients.find(p => 
          p.name.toLowerCase().includes(fromName) || fromName.includes(p.name.toLowerCase())
        );
        if (match) {
          autoMappings.set(tx.from, { name: match.name, memberId: match.memberId });
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
    if (patientName && memberId) {
      newMappings.set(venmoName, { name: patientName, memberId });
    } else {
      newMappings.delete(venmoName);
    }
    setMappings(newMappings);
  };

  const handleImport = () => {
    const payments: ParsedPayment[] = parsedTransactions
      .filter(tx => mappings.has(tx.from))
      .map(tx => {
        const mapping = mappings.get(tx.from)!;
        
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
          notes: tx.note || `Venmo from ${tx.from}`,
          rawFrom: tx.from
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
  const uniquePayers = Array.from(new Set(parsedTransactions.map(tx => tx.from)));
  const unmappedCount = uniquePayers.filter(name => !mappings.has(name)).length;
  const totalAmount = parsedTransactions
    .filter(tx => mappings.has(tx.from))
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
              Upload a Venmo transaction CSV export. Only completed payments received will be imported.
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
              <p>📝 <strong>How to export from Venmo:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open Venmo on web or app</li>
                <li>Go to Settings → Privacy → Download My Venmo Data</li>
                <li>Wait for email with download link</li>
                <li>Extract and upload the transactions CSV</li>
              </ol>
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
                      <th className="px-3 py-2 text-left font-medium">Venmo User</th>
                      <th className="px-3 py-2 text-left font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Patient Name</th>
                      <th className="px-3 py-2 text-left font-medium">Member ID</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {uniquePayers.map((venmoName, idx) => {
                      const txCount = parsedTransactions.filter(tx => tx.from === venmoName).length;
                      const txTotal = parsedTransactions
                        .filter(tx => tx.from === venmoName)
                        .reduce((sum, tx) => sum + tx.amount, 0);
                      const mapping = mappings.get(venmoName);
                      const isMapped = !!mapping;

                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
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
                            <input
                              type="text"
                              list={`patients-${idx}`}
                              placeholder="Select or type patient name"
                              value={mapping?.name || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                const match = existingPatients.find(p => p.name === value);
                                if (match) {
                                  handleMapping(venmoName, match.name, match.memberId);
                                } else {
                                  handleMapping(venmoName, value, mapping?.memberId || '');
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:bg-gray-800"
                            />
                            <datalist id={`patients-${idx}`}>
                              {existingPatients.map(p => (
                                <option key={p.memberId} value={p.name} />
                              ))}
                            </datalist>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{parsedTransactions.filter(tx => mappings.has(tx.from)).length}</strong> payment(s) ready to import
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
                    Import {mappings.size > 0 && `${parsedTransactions.filter(tx => mappings.has(tx.from)).length} Payments`}
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
