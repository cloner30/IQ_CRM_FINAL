import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GroupStatusProvider } from "./contexts/GroupStatusContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { GroupsList } from "./pages/GroupsList";
import { CreateGroup } from "./pages/CreateGroup";
import { EditGroup } from "./pages/EditGroup";
import { GroupDetail } from "./pages/GroupDetail";
import { BulkUpload } from "./pages/BulkUpload";
import { Login } from "./pages/Login";
import { UsersManagement } from "./pages/UsersManagement";
import { ClientsManagement } from "./pages/ClientsManagement";
import { PassportScanner } from "./pages/PassportScanner";
import { VendorDashboard } from "./pages/VendorDashboard";
import { VendorGroupDetail } from "./pages/VendorGroupDetail";
import { VendorsManagement } from "./pages/VendorsManagement";
import { FinancialDashboard } from "./pages/FinancialDashboard";
import { AccountingDashboard } from "./pages/accounting/AccountingDashboard";
import { ClientReceipts } from "./pages/accounting/ClientReceipts";
import { VendorPayments } from "./pages/accounting/VendorPayments";
import { VendorLedgers } from "./pages/accounting/VendorLedgers";
import { VendorLedger } from "./pages/accounting/VendorLedger";
import { ClientLedgers } from "./pages/accounting/ClientLedgers";
import { ChartOfAccounts } from "./pages/accounting/ChartOfAccounts";
import { AccountLedger } from "./pages/accounting/AccountLedger";
import { AccountingReports } from "./pages/accounting/AccountingReports";
import { ClientLedger } from "./pages/accounting/ClientLedger";
import { VisaStatement } from "./pages/accounting/VisaStatement";

const ProtectedRoute = ({ children, adminOnly = false, userManagement = false, vendorOnly = false, financialOnly = false, globalAccountingOnly = false, clientLedgerOnly = false, vendorLedgerOnly = false, operationalOnly = false, noLayout = false }) => {
  const { isAuthenticated, loading, isAdmin, canManageUsers, isVendor, canAccessFinancial, canViewGlobalAccounting, canViewClientLedger, canViewVendorLedger, canViewOperational } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin()) return <Navigate to="/" replace />;
  if (userManagement && !canManageUsers()) return <Navigate to="/" replace />;
  if (vendorOnly && !isVendor()) return <Navigate to="/" replace />;
  if (financialOnly && !canAccessFinancial()) return <Navigate to="/" replace />;
  if (globalAccountingOnly && !canViewGlobalAccounting()) return <Navigate to="/groups" replace />;
  if (clientLedgerOnly && !canViewClientLedger()) return <Navigate to="/groups" replace />;
  if (vendorLedgerOnly && !canViewVendorLedger()) return <Navigate to="/groups" replace />;
  if (operationalOnly && !canViewOperational()) {
    if (canViewClientLedger()) return <Navigate to="/accounting/client-ledger" replace />;
    if (canViewVendorLedger()) return <Navigate to="/accounting/vendor-ledger" replace />;
    return <Navigate to="/accounting" replace />;
  }

  if (noLayout) return children;
  return <Layout>{children}</Layout>;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

const HomeRedirect = () => {
  const { isVendor, canViewClientLedger, canViewVendorLedger, canViewGlobalAccounting, getRole } = useAuth();
  const role = getRole();
  if (isVendor() && role !== 'vendor_accounts') return <Navigate to="/vendor" replace />;
  if (role === 'vendor_accounts' && canViewVendorLedger()) return <Navigate to="/accounting/vendor-ledger" replace />;
  if (role === 'client_accounts' && canViewClientLedger()) return <Navigate to="/accounting/client-ledger" replace />;
  if (role === 'system_accounts' && canViewGlobalAccounting()) return <Navigate to="/accounting" replace />;
  return <Dashboard />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute operationalOnly><HomeRedirect /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute operationalOnly><GroupsList /></ProtectedRoute>} />
      <Route path="/groups/new" element={<ProtectedRoute operationalOnly><CreateGroup /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute operationalOnly><GroupDetail /></ProtectedRoute>} />
      <Route path="/groups/:groupId/edit" element={<ProtectedRoute operationalOnly><EditGroup /></ProtectedRoute>} />
      <Route path="/groups/:groupId/upload" element={<ProtectedRoute operationalOnly><BulkUpload /></ProtectedRoute>} />
      <Route path="/scanner" element={<ProtectedRoute operationalOnly noLayout><PassportScanner /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute userManagement><UsersManagement /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute adminOnly><ClientsManagement /></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute adminOnly><VendorsManagement /></ProtectedRoute>} />
      <Route path="/vendor" element={<ProtectedRoute vendorOnly><VendorDashboard /></ProtectedRoute>} />
      <Route path="/vendor/groups/:groupId" element={<ProtectedRoute vendorOnly><VendorGroupDetail /></ProtectedRoute>} />
      <Route path="/financial" element={<ProtectedRoute financialOnly><FinancialDashboard /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute globalAccountingOnly><AccountingDashboard /></ProtectedRoute>} />
      <Route path="/accounting/client-ledger" element={<ProtectedRoute clientLedgerOnly><ClientLedger /></ProtectedRoute>} />
      <Route path="/accounting/client-ledger/:clientId" element={<ProtectedRoute globalAccountingOnly><ClientLedger /></ProtectedRoute>} />
      <Route path="/accounting/client-ledgers" element={<ProtectedRoute globalAccountingOnly><ClientLedgers /></ProtectedRoute>} />
      <Route path="/accounting/vendor-ledger" element={<ProtectedRoute vendorLedgerOnly><VendorLedger /></ProtectedRoute>} />
      <Route path="/accounting/vendor-ledger/:vendorId" element={<ProtectedRoute globalAccountingOnly><VendorLedger /></ProtectedRoute>} />
      <Route path="/accounting/vendor-ledgers" element={<LedgerHubRoute><VendorLedgers /></LedgerHubRoute>} />
      <Route path="/accounting/receipts" element={<ProtectedRoute globalAccountingOnly><ClientReceipts /></ProtectedRoute>} />
      <Route path="/accounting/payments" element={<ProtectedRoute globalAccountingOnly><VendorPayments /></ProtectedRoute>} />
      <Route path="/accounting/payables" element={<Navigate to="/accounting/vendor-ledgers" replace />} />
      <Route path="/accounting/accounts" element={<ProtectedRoute globalAccountingOnly><ChartOfAccounts /></ProtectedRoute>} />
      <Route path="/accounting/ledger/:accountId" element={<ProtectedRoute globalAccountingOnly><AccountLedger /></ProtectedRoute>} />
      <Route path="/accounting/reports" element={<ProtectedRoute globalAccountingOnly><AccountingReports /></ProtectedRoute>} />
      <Route path="/accounting/visa-statement" element={<ProtectedRoute globalAccountingOnly><VisaStatement /></ProtectedRoute>} />
    </Routes>
  );
}

function LedgerHubRoute({ children }) {
  const { isAuthenticated, loading, canViewGlobalAccounting, canViewVendorLedger } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!canViewGlobalAccounting() && !canViewVendorLedger()) return <Navigate to="/groups" replace />;
  return <Layout>{children}</Layout>;
}

function AppWithStatus() {
  const { isAuthenticated } = useAuth();
  return (
    <GroupStatusProvider isAuthenticated={isAuthenticated}>
      <AppRoutes />
    </GroupStatusProvider>
  );
}

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <AppWithStatus />
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
