import { NavLink, useLocation } from 'react-router-dom';
import { Users, LayoutDashboard, Upload, Settings } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Groups', href: '/groups', icon: Users },
];

export const Layout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex" data-testid="main-layout">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar flex-shrink-0" data-testid="sidebar">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <h1 className="text-xl font-manrope font-bold text-sidebar-foreground">
            Passport Control
          </h1>
        </div>
        <nav className="mt-6 px-3" data-testid="sidebar-nav">
          {navigation.map((item) => {
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
