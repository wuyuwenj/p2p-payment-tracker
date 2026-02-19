'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card } from '@/components/tracker/Card';
import { Button } from '@/components/tracker/Button';
import { X, Plus, MapPin } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { ignoredAddresses, addIgnoredAddress, removeIgnoredAddress, loading } = useSettings();
  const [newAddress, setNewAddress] = useState('');
  const [saving, setSaving] = useState(false);

  if (authLoading || loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Please sign in to view settings.</p>
      </div>
    );
  }

  const handleAdd = async () => {
    const trimmed = newAddress.trim();
    if (!trimmed) return;
    setSaving(true);
    await addIgnoredAddress(trimmed);
    setNewAddress('');
    setSaving(false);
  };

  const handleRemove = async (address: string) => {
    setSaving(true);
    await removeIgnoredAddress(address);
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your preferences</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ignored Addresses</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Insurance payments sent to these addresses will be hidden — they are payments to providers, not patients.
              </p>
            </div>
          </div>

          {/* Add new address */}
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
              placeholder="e.g. 98 BATTERY ST STE 501,SAN FRANCISCO,94111-5529"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <Button onClick={handleAdd} disabled={saving || !newAddress.trim()} className="self-start">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {/* List */}
          {ignoredAddresses.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No ignored addresses yet.</p>
          ) : (
            <ul className="space-y-2">
              {ignoredAddresses.map((address) => (
                <li
                  key={address}
                  className="flex items-start justify-between gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{address}</span>
                  <button
                    onClick={() => handleRemove(address)}
                    disabled={saving}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0 mt-0.5"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
