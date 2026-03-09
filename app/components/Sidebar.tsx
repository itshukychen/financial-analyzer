'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/app/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: 'Markets',
    href: '/markets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="10" width="3" height="5" rx="0.5" fill="currentColor" />
        <rect x="5" y="6" width="3" height="9" rx="0.5" fill="currentColor" />
        <rect x="9" y="3" width="3" height="12" rx="0.5" fill="currentColor" />
        <rect x="13" y="7" width="3" height="8" rx="0.5" fill="currentColor" />
        <path d="M2.5 9L6.5 5L10.5 2L14.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Option Projection',
    href: '/reports/option-projection',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <polyline points="2,14 5,8 9,11 14,2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Watchlist',
    href: '/watchlist',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1.5l1.854 3.756 4.146.603-3 2.924.708 4.131L8 10.77l-3.708 1.944.708-4.131-3-2.924 4.146-.603L8 1.5z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Alerts',
    href: '/alerts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        // Base — always fixed on mobile, static on desktop
        'fixed inset-y-0 left-0 z-50 flex flex-col h-screen w-60 shrink-0 border-r',
        'transition-transform duration-300 ease-in-out',
        // Desktop — always visible, in normal flow
        'lg:static lg:translate-x-0',
        // Mobile — slide in/out
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      aria-label="Main navigation"
    >
      {/* Logo + mobile close button */}
      <div
        className="flex items-center justify-between px-5 py-5 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect width="22" height="22" rx="5" fill="var(--accent)" opacity="0.15" />
            <polyline
              points="3,16 8,10 12,13 19,5"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            FinAnalyzer
          </span>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close navigation"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 px-2 py-4 flex-1" aria-label="Site navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}   /* auto-close on mobile when navigating */
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors relative',
                isActive ? 'active-nav-link' : 'inactive-nav-link',
              )}
              style={
                isActive
                  ? {
                      color: 'var(--accent)',
                      background: 'rgba(79,142,247,0.08)',
                      borderLeft: '2px solid var(--accent)',
                    }
                  : {
                      color: 'var(--text-muted)',
                      borderLeft: '2px solid transparent',
                    }
              }
            >
              <span className="shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-4 border-t text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        v0.1.0 — alpha
      </div>
    </aside>
  );
}
