import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import {
  FALLBACK_DEFINITIONS,
  STATUS_COLORS,
  STEPPER_LABELS,
  TRANSITION_ACTION_LABELS,
} from '../constants/groupStatus';

const GroupStatusContext = createContext(null);

export const GroupStatusProvider = ({ children, isAuthenticated }) => {
  const [definitions, setDefinitions] = useState(FALLBACK_DEFINITIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const fetchDefinitions = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/group-status-definitions');
        if (!cancelled && data?.statuses) {
          setDefinitions(data);
        }
      } catch {
        if (!cancelled) setDefinitions(FALLBACK_DEFINITIONS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDefinitions();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const getLabel = useCallback(
    (status) => definitions.labels?.[status] || status?.replace(/_/g, ' ') || '',
    [definitions],
  );

  const getStepperLabel = useCallback(
    (status) => STEPPER_LABELS[status] || getLabel(status),
    [getLabel],
  );

  const getAllowedTransitions = useCallback(
    (status) => definitions.transitions?.[status] || [],
    [definitions],
  );

  const getActionLabel = useCallback(
    (targetStatus) => TRANSITION_ACTION_LABELS[targetStatus] || getLabel(targetStatus),
    [getLabel],
  );

  const getStatusColor = useCallback(
    (status) => STATUS_COLORS[status] || 'bg-gray-100 text-gray-800',
    [],
  );

  const requiresReason = useCallback(
    (status) => (definitions.reason_required || []).includes(status),
    [definitions],
  );

  const value = useMemo(
    () => ({
      definitions,
      loading,
      statuses: definitions.statuses || [],
      stepperOrder: definitions.stepper_order || [],
      getLabel,
      getStepperLabel,
      getAllowedTransitions,
      getActionLabel,
      getStatusColor,
      requiresReason,
      defaultStatus: definitions.default_status || 'DATA_PROCESSING',
    }),
    [definitions, loading, getLabel, getStepperLabel, getAllowedTransitions, getActionLabel, getStatusColor, requiresReason],
  );

  return (
    <GroupStatusContext.Provider value={value}>
      {children}
    </GroupStatusContext.Provider>
  );
};

export const useGroupStatus = () => {
  const ctx = useContext(GroupStatusContext);
  if (!ctx) {
    throw new Error('useGroupStatus must be used within GroupStatusProvider');
  }
  return ctx;
};

export default GroupStatusContext;
