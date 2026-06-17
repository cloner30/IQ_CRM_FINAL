import { Check } from 'lucide-react';
import { useGroupStatus } from '../../contexts/GroupStatusContext';
import { GroupStatusBadge } from './GroupStatusBadge';

export const GroupStatusStepper = ({ status }) => {
  const { stepperOrder, getStepperLabel, defaultStatus } = useGroupStatus();
  const current = status || defaultStatus;
  const isRejected = current === 'VISA_REJECTED';
  const currentIdx = stepperOrder.indexOf(isRejected ? 'VISA_IN_PROCESS' : current);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 sm:gap-0">
        {stepperOrder.map((step, idx) => {
          const isComplete = currentIdx > idx;
          const isCurrent = !isRejected && current === step;
          const isFuture = currentIdx < idx;
          return (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                  isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                    : isComplete
                      ? 'bg-green-50 text-green-800'
                      : 'bg-slate-50 text-slate-400'
                }`}
              >
                {isComplete && <Check className="w-3 h-3" />}
                <span className={isFuture ? 'hidden sm:inline' : ''}>{getStepperLabel(step)}</span>
              </div>
              {idx < stepperOrder.length - 1 && (
                <div className={`hidden sm:block w-6 h-0.5 mx-0.5 ${isComplete ? 'bg-green-300' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      {isRejected && (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <GroupStatusBadge status="VISA_REJECTED" />
          <span className="text-muted-foreground">— rework required</span>
        </div>
      )}
    </div>
  );
};

export default GroupStatusStepper;
