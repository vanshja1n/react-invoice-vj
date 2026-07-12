import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Settings,
  HardDriveDownload,
  PanelLeftClose,
  PanelLeft,
  X,
  Receipt,
  Package,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices/new', icon: FilePlus, label: 'Create Invoice' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/invoices', icon: FileText, label: 'Invoice History' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/backup', icon: HardDriveDownload, label: 'Backup & Restore' },
];

export function Sidebar({ collapsed = false, onToggleCollapse, onClose }) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Receipt className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm text-sidebar-foreground truncate">
              InvoiceHub
            </span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Receipt className="h-4 w-4" />
          </div>
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden shrink-0 text-sidebar-foreground"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const content = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  } ${collapsed ? 'justify-center px-2' : ''}`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            if (collapsed) {
              return (
                <li key={item.to}>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return <li key={item.to}>{content}</li>;
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={`w-full text-sidebar-foreground/70 hover:text-sidebar-foreground ${
              collapsed ? 'justify-center px-2' : 'justify-start'
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        )}
        {!collapsed && !onToggleCollapse && (
          <p className="text-[10px] text-sidebar-foreground/40 text-center">
            InvoiceHub v2.0
          </p>
        )}
      </div>
    </div>
  );
}
