import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { GroupsList } from "./pages/GroupsList";
import { CreateGroup } from "./pages/CreateGroup";
import { GroupDetail } from "./pages/GroupDetail";
import { BulkUpload } from "./pages/BulkUpload";
import { Login } from "./pages/Login";
import { UsersManagement } from "./pages/UsersManagement";
import { ClientsManagement } from "./pages/ClientsManagement";

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route - redirect to home if already logged in
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      
      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><GroupsList /></ProtectedRoute>} />
      <Route path="/groups/new" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
      <Route path="/groups/:groupId/upload" element={<ProtectedRoute><BulkUpload /></ProtectedRoute>} />
      
      {/* Admin Only Routes */}
      <Route path="/users" element={<ProtectedRoute adminOnly><UsersManagement /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute adminOnly><ClientsManagement /></ProtectedRoute>} />
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
