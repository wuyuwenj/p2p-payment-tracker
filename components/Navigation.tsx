'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserButton from './UserButton';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Insurance Payments' },
    { href: '/venmo', label: 'Venmo Payments' },
    { href: '/patients', label: 'All Patients' },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-xl font-bold">Insurance Payment Tracker</h1>
          <div className="flex items-center space-x-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-md transition-colors ${
                  pathname === link.href
                    ? 'bg-blue-800'
                    : 'hover:bg-blue-500'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <UserButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
