import { useGroupStatus } from '../../contexts/GroupStatusContext';

export const GroupStatusBadge = ({ status, className = '' }) => {
  const { getLabel, getStatusColor, defaultStatus } = useGroupStatus();
  const code = status || defaultStatus;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(code)} ${className}`}>
      {getLabel(code)}
    </span>
  );
};

export default GroupStatusBadge;
