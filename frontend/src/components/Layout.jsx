import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Users, LayoutDashboard, Upload, Settings, Building2, UserCog, LogOut, ScanLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

export const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin, canManageUsers } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get role display name
  const getRoleDisplay = (role) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return 'Super Admin';
      case 'client_admin':
        return 'Client Admin';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: true },
    { name: 'Groups', href: '/groups', icon: Users, show: true },
    { name: 'Scanner', href: '/scanner', icon: ScanLine, show: true },
    { name: 'Clients', href: '/clients', icon: Building2, show: isSuperAdmin() },
    { name: 'Users', href: '/users', icon: UserCog, show: canManageUsers() },
  ];

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => item.show);

  return (
    <div className="min-h-screen flex" data-testid="main-layout">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar flex-shrink-0 flex flex-col" data-testid="sidebar">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <h1 className="text-xl font-manrope font-bold text-sidebar-foreground">
            Passport Control
          </h1>
        </div>
        <nav className="mt-6 px-3 flex-1" data-testid="sidebar-nav">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <NavLink
                key={item.name}
                to={item.href}
                data-testid={`nav-${item.name.toLowerCase()}`}
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
        </nav>
        
        {/* User info and logout */}
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
                {getRoleDisplay(user?.role)}
              </p>
            </div>
          </div>
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

      {/* Main Content */}
      <main className="flex-1 bg-background overflow-auto" data-testid="main-content">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
