import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { CloudUpload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const { isAuthenticated } = useAuth();

  useKeyboardShortcuts();

  const showGuestBanner = !isAuthenticated && !guestBannerDismissed;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div
        className={`hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'
        }`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-border bg-sidebar lg:hidden"
            >
              <Sidebar
                collapsed={false}
                onClose={() => setSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav
          onMenuClick={() => setSidebarOpen(true)}
        />
        {showGuestBanner && (
          <div className="border-b border-border bg-gradient-to-r from-amber-50 via-amber-50/80 to-amber-50 dark:from-amber-950/30 dark:via-amber-950/20 dark:to-amber-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <CloudUpload className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-100 flex-1">
                <span className="font-semibold">You're using Guest Mode.</span>{' '}
                <span className="opacity-90">Sign in to sync your data across devices and never lose work.</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10"
                onClick={() => setGuestBannerDismissed(true)}
                aria-label="Dismiss Guest Mode notice"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
