import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const FinancialDashboard = () => {
  const { canViewGlobalAccounting, canViewClientLedger } = useAuth();
  if (canViewGlobalAccounting()) return <Navigate to="/accounting" replace />;
  if (canViewClientLedger()) return <Navigate to="/accounting/client-ledger" replace />;
  return <Navigate to="/groups" replace />;
};
