import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Sun, Moon, Plus, LogIn, UserPlus, LogOut,
  Crown, Cloud, CloudOff, Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { useAuth, TRIGGER_SYNC_DIALOG_EVENT } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { SyncChoiceDialog } from '@/components/auth/SyncChoiceDialog';
import { processQueue, dispatchDataRefreshed } from '@/services/sync';
import api from '@/services/api';
import { toast } from 'sonner';

export function TopNav({ onMenuClick }) {
  const { theme, setTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const {
    user, isAuthenticated, logout, isOnline, pendingCount, syncing, dismissSyncChoice,
  } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [syncOpen, setSyncOpen] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [syncCounts, setSyncCounts] = useState({ local: null, cloud: null });

  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = async () => {
      const res = await api.health.check().catch(() => null);
      if (res && pendingCount > 0) {
        const count = await processQueue();
        if (count === 0 && pendingCount > 0) {
          toast.success('Changes synced to cloud');
          dispatchDataRefreshed();
        }
      }
    };
    window.addEventListener('auth-sync-needed', handler);
    return () => window.removeEventListener('auth-sync-needed', handler);
  }, [isAuthenticated, pendingCount]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSyncOpen(false);
      setSyncCounts({ local: null, cloud: null });
      return;
    }
    const handler = (evt) => {
      const d = (evt && evt.detail) || {};
      if (d.localCounts || d.cloudCounts) {
        setSyncCounts({ local: d.localCounts || null, cloud: d.cloudCounts || null });
      }
      // The TRIGGER_SYNC_DIALOG event is ONLY emitted by AuthContext.evaluateSyncDecision
      // when action === 'merge', i.e. BOTH guest AND cloud have data.
      // Therefore this open() fires EXACTLY when user needs to make a choice.
      setSyncOpen(true);
    };
    window.addEventListener(TRIGGER_SYNC_DIALOG_EVENT, handler);
    return () => window.removeEventListener(TRIGGER_SYNC_DIALOG_EVENT, handler);
  }, [isAuthenticated, TRIGGER_SYNC_DIALOG_EVENT]);

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(isDark ? 'light' : 'dark');
    } else {
      setTheme(isDark ? 'light' : 'dark');
    }
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const forceSync = useCallback(async () => {
    if (forceSyncing) return;
    setForceSyncing(true);
    try {
      const remaining = await processQueue();
      if (remaining === 0) {
        toast.success('All changes synced');
        dispatchDataRefreshed();
      } else {
        toast.info(`${remaining} changes still pending`);
      }
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setForceSyncing(false);
    }
  }, [forceSyncing]);

  const initials = (() => {
    if (!user?.name) return user?.email?.[0]?.toUpperCase() || '?';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 px-3 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">

          {isAuthenticated && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={forceSync}
                  disabled={forceSyncing || syncing}
                  aria-label={isOnline ? 'Sync to cloud' : 'Offline'}
                >
                  {forceSyncing || syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isOnline ? (
                    <div className="relative">
                      <Cloud className="h-4 w-4" />
                      {pendingCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </div>
                  ) : (
                    <CloudOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isOnline
                  ? pendingCount > 0
                    ? `${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}`
                    : 'All changes synced'
                  : 'Working offline'}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle theme</p>
            </TooltipContent>
          </Tooltip>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-full p-0">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.avatar || ''} alt={initials} />
                    <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-semibold truncate max-w-[220px]">
                      {user?.name || user?.email}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-normal truncate max-w-[220px]">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate('/subscription')}>
                    <Crown className="h-4 w-4" />
                    <span>Subscription</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={forceSync}>
                    <RefreshCw className="h-4 w-4" />
                    <span>Sync now</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} variant="destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => openAuth('login')}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Login</span>
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => openAuth('signup')}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Sign Up</span>
              </Button>
            </>
          )}
        </div>
      </header>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        initialMode={authMode}
      />
      <SyncChoiceDialog
        open={syncOpen}
        onOpenChange={(o) => {
          setSyncOpen(o);
          if (!o) {
            try { dismissSyncChoice?.(); } catch { void 0; }
          }
        }}
        onComplete={() => {
          setSyncOpen(false);
          try { dismissSyncChoice?.(); } catch { void 0; }
          dispatchDataRefreshed();
        }}
        localCounts={syncCounts.local}
        cloudCounts={syncCounts.cloud}
      />
    </>
  );
}

export default TopNav;
