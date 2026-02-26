'use client';

import { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Mobile backdrop — tap to close */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden"
        style={{
          opacity:        sidebarOpen ? 1 : 0,
          pointerEvents:  sidebarOpen ? 'auto' : 'none',
        }}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={openSidebar} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
