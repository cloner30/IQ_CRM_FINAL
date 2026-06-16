import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
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

const ProtectedRoute = ({ children, adminOnly = false, userManagement = false, vendorOnly = false, financialOnly = false, operationalOnly = false, noLayout = false }) => {
  const { isAuthenticated, loading, isAdmin, canManageUsers, isVendor, canAccessFinancial, canViewOperational } = useAuth();

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
  if (operationalOnly && !canViewOperational()) return <Navigate to="/financial" replace />;

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
  const { isVendor, isAccountsRole } = useAuth();
  if (isVendor()) return <Navigate to="/vendor" replace />;
  if (isAccountsRole()) return <Navigate to="/financial" replace />;
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
    </Routes>
  );
}

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
