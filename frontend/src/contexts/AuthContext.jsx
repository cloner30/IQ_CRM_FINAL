import { createContext, useContext, useState, useEffect } from 'react';
import authApi, { getAuthErrorMessage } from '../utils/authApi';

const AuthContext = createContext(null);

const SYSTEM_ROLES = ['system_admin', 'system_staff', 'system_accounts', 'super_admin', 'admin'];
const VENDOR_ROLES = ['vendor_admin', 'vendor_staff', 'vendor_accounts'];
const ACCOUNTS_ROLES = ['system_accounts', 'client_accounts', 'vendor_accounts'];
const CLIENT_ROLES = ['client_admin', 'client_staff', 'client_accounts'];

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
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await authApi.get('/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        setUser(data);
        setToken(savedToken);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (!data?.access_token) {
        throw new Error('Invalid login response from server');
      }

      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data.user;
    } catch (error) {
      throw new Error(getAuthErrorMessage(error, 'Login failed'));
    }
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
  const canViewGlobalAccounting = () => hasPermission('can_view_global_accounting');
  const canViewClientLedger = () => hasPermission('can_view_client_ledger');
  const canViewVendorLedger = () => hasPermission('can_view_vendor_ledger');
  const canViewOperational = () => {
    if (isAccountsRole()) return false;
    if (user?.permissions) return user.permissions.can_view_operational === true;
    return isSystemAdmin() || isClientAdmin() || isVendor() || getRole() === 'client_staff' || getRole() === 'system_staff';
  };

  const canManageFinancial = () => hasPermission('can_manage_financial');
  const canPostJournalEntries = () => hasPermission('can_post_journal_entries');
  const canAssignVendor = () => hasPermission('can_assign_vendor');
  const canSplitGroups = () => hasPermission('can_split_groups');
  const canRecordReceipts = () => hasPermission('can_record_receipts');
  const canSubmitGroup = () => hasPermission('can_submit_group');
  const canUpdateGroupStatus = () => hasPermission('can_update_group_status');
  const canUpdatePassportStatus = () => hasPermission('can_update_passport_status');
  const canManageSubmissionDetails = () => hasPermission('can_manage_submission_details');
  const isClientRole = () => CLIENT_ROLES.includes(getRole());

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
    canViewGlobalAccounting,
    canViewClientLedger,
    canViewVendorLedger,
    canViewOperational,
    canManageFinancial,
    canPostJournalEntries,
    canAssignVendor,
    canSplitGroups,
    canRecordReceipts,
    canSubmitGroup,
    canUpdateGroupStatus,
    canUpdatePassportStatus,
    canManageSubmissionDetails,
    isClientRole,
    getRole,
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
