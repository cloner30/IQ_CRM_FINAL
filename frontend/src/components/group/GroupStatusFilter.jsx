import { useGroupStatus } from '../../contexts/GroupStatusContext';

export const GroupStatusFilter = ({ groups, value, onChange }) => {
  const { statuses, getLabel } = useGroupStatus();

  const counts = { all: groups.length };
  statuses.forEach((s) => {
    counts[s] = groups.filter((g) => g.status === s).length;
  });

  const chips = [
    { key: 'all', label: 'All' },
    ...statuses.map((s) => ({ key: s, label: getLabel(s) })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            value === key
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {label}
          <span className="ml-1 opacity-75">({counts[key] ?? 0})</span>
        </button>
      ))}
    </div>
  );
};

export default GroupStatusFilter;
