import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Users, LayoutDashboard, Building2, UserCog, LogOut, ScanLine, Truck, DollarSign, Bell, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import api from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ROLE_LABELS = {
  system_admin: 'System Admin',
  system_staff: 'System Staff',
  system_accounts: 'System Accounts',
  client_admin: 'Client Admin',
  client_staff: 'Client Staff',
  client_accounts: 'Client Accounts',
  vendor_admin: 'Vendor Admin',
  vendor_staff: 'Vendor Staff',
  vendor_accounts: 'Vendor Accounts',
  super_admin: 'System Admin',
  admin: 'System Admin',
  staff: 'Staff',
};

export const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin, canManageUsers, isVendor, canManageVendors, canViewGlobalAccounting, canViewClientLedger, canViewVendorLedger, canViewOperational } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        setUnreadCount(res.data.count);
      } catch { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      setShowNotifs(true);
    } catch { /* ignore */ }
  };

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((n) => n.map((x) => x.id === id ? { ...x, read_at: new Date().toISOString() } : x));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: canViewOperational() && !isVendor() },
    { name: 'Groups', href: '/groups', icon: Users, show: canViewOperational() && !isVendor() },
    { name: 'Vendor Portal', href: '/vendor', icon: Truck, show: isVendor() },
    { name: 'Scanner', href: '/scanner', icon: ScanLine, show: canViewOperational() && !isVendor() },
    { name: 'Accounting', href: '/accounting', icon: DollarSign, show: canViewGlobalAccounting() },
    { name: 'Ledger', href: '/accounting/client-ledger', icon: DollarSign, show: canViewClientLedger() },
    { name: 'Ledger', href: '/accounting/vendor-ledger', icon: DollarSign, show: canViewVendorLedger() && !canViewGlobalAccounting() },
    { name: 'Clients', href: '/clients', icon: Building2, show: isSuperAdmin() },
    { name: 'Vendors', href: '/vendors', icon: Truck, show: canManageVendors() },
    { name: 'Users', href: '/users', icon: UserCog, show: canManageUsers() },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen flex" data-testid="main-layout">
      <aside className="w-64 bg-sidebar flex-shrink-0 flex flex-col" data-testid="sidebar">
        <div className="h-16 flex flex-col justify-center px-6 border-b border-sidebar-border">
          <h1 className="text-lg font-manrope font-bold text-sidebar-foreground leading-tight">ACF - VISA SYSTEM</h1>
          <p className="text-xs text-sidebar-foreground/60 tracking-wide">PRODUCT OF ACF</p>
        </div>
        <nav className="mt-6 px-3 flex-1" data-testid="sidebar-nav">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <NavLink
                key={item.name}
                to={item.href}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s/g, '-')}`}
                className={`flex items-center gap-3 px-4 py-3 mb-1 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            );
          })}
          {isAdmin() && (
            <a
              href={`${API_URL}/api/download/chrome-extension`}
              className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
            >
              <Download className="w-5 h-5" />
              Chrome Extension
            </a>
          )}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-sidebar-accent rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-accent-foreground">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {ROLE_LABELS[user?.role] || user?.role}
              </p>
            </div>
            <button className="relative p-1" onClick={loadNotifications}>
              <Bell className="w-5 h-5 text-sidebar-foreground/70" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
          {showNotifs && notifications.length > 0 && (
            <div className="mb-3 max-h-52 overflow-y-auto bg-sidebar-accent rounded-lg p-2 text-xs text-sidebar-accent-foreground">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`p-2 mb-1 rounded cursor-pointer transition-colors hover:bg-sidebar/40 ${
                    n.read_at ? '' : 'bg-sidebar/25'
                  }`}
                  onClick={() => !n.read_at && markRead(n.id)}
                >
                  <p className={`font-medium leading-snug ${n.read_at ? 'text-sidebar-accent-foreground/70' : 'text-sidebar-accent-foreground'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className={`mt-1 leading-relaxed break-words line-clamp-2 ${n.read_at ? 'text-sidebar-accent-foreground/55' : 'text-sidebar-accent-foreground/85'}`}>
                      {n.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 bg-background overflow-auto" data-testid="main-content">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};
