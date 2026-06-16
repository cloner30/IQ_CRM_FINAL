import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SYSTEM_ROLES = ['system_admin', 'system_staff', 'system_accounts', 'super_admin', 'admin'];
const VENDOR_ROLES = ['vendor_admin', 'vendor_staff', 'vendor_accounts'];
const ACCOUNTS_ROLES = ['system_accounts', 'client_accounts', 'vendor_accounts'];

const normalizeRole = (role) => {
  if (role === 'admin' || role === 'super_admin') return 'system_admin';
  if (role === 'staff') return 'client_staff';
  return role;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setToken(savedToken);
          } else {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    const data = await response.json();
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const getRole = () => normalizeRole(user?.role);

  const hasPermission = (perm) => {
    if (!user) return false;
    return user.permissions?.[perm] === true;
  };

  const isAdmin = () => getRole() === 'system_admin' || user?.role === 'admin' || user?.role === 'super_admin';
  const isSystemAdmin = () => getRole() === 'system_admin';
  const isSystemStaff = () => getRole() === 'system_staff';
  const isClientAdmin = () => getRole() === 'client_admin';
  const isVendor = () => VENDOR_ROLES.includes(getRole());
  const isVendorAdmin = () => getRole() === 'vendor_admin';
  const isAccountsRole = () => ACCOUNTS_ROLES.includes(getRole());
  const canManageUsers = () => hasPermission('can_manage_users') || isSystemAdmin() || isClientAdmin() || isVendorAdmin();
  const canManageVendors = () => hasPermission('can_manage_vendors') || isSystemAdmin();
  const canAccessFinancial = () => hasPermission('can_access_financial');
  const canViewOperational = () => {
    if (isAccountsRole()) return false;
    if (user?.permissions) return user.permissions.can_view_operational === true;
    return isSystemAdmin() || isClientAdmin() || isVendor() || getRole() === 'client_staff' || getRole() === 'system_staff';
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin,
    isSystemAdmin,
    isSystemStaff,
    isClientAdmin,
    isVendor,
    isVendorAdmin,
    isAccountsRole,
    canManageUsers,
    canManageVendors,
    canAccessFinancial,
    canViewOperational,
    hasPermission,
    isSuperAdmin: isSystemAdmin,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
