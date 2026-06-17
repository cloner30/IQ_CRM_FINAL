/** Fallback group status definitions when API is unavailable. */

export const GROUP_STATUSES = [
  'DATA_PROCESSING',
  'SUBMITTED_FOR_PROCESS',
  'VENDOR_ASSIGNED',
  'VISA_IN_PROCESS',
  'VISA_ISSUED',
  'VISA_REJECTED',
];

export const STATUS_LABELS = {
  DATA_PROCESSING: 'Data Processing',
  SUBMITTED_FOR_PROCESS: 'Submitted for Process',
  VENDOR_ASSIGNED: 'Vendor Assigned',
  VISA_IN_PROCESS: 'Visa In Process',
  VISA_ISSUED: 'Visa Issued',
  VISA_REJECTED: 'Visa Rejected',
};

export const STATUS_COLORS = {
  DATA_PROCESSING: 'bg-slate-100 text-slate-800',
  SUBMITTED_FOR_PROCESS: 'bg-blue-100 text-blue-800',
  VENDOR_ASSIGNED: 'bg-amber-100 text-amber-800',
  VISA_IN_PROCESS: 'bg-indigo-100 text-indigo-800',
  VISA_ISSUED: 'bg-green-100 text-green-800',
  VISA_REJECTED: 'bg-red-100 text-red-800',
};

export const STATUS_STEPPER_ORDER = [
  'DATA_PROCESSING',
  'SUBMITTED_FOR_PROCESS',
  'VENDOR_ASSIGNED',
  'VISA_IN_PROCESS',
  'VISA_ISSUED',
];

export const VALID_TRANSITIONS = {
  DATA_PROCESSING: ['SUBMITTED_FOR_PROCESS'],
  SUBMITTED_FOR_PROCESS: ['DATA_PROCESSING'],
  VENDOR_ASSIGNED: ['VISA_IN_PROCESS'],
  VISA_IN_PROCESS: ['VISA_ISSUED', 'VISA_REJECTED'],
  VISA_ISSUED: [],
  VISA_REJECTED: ['DATA_PROCESSING', 'VENDOR_ASSIGNED'],
};

export const TERMINAL_STATUSES = ['VISA_ISSUED'];
export const REASON_REQUIRED = ['VISA_REJECTED'];
export const DEFAULT_STATUS = 'DATA_PROCESSING';

/** Short labels for stepper UI */
export const STEPPER_LABELS = {
  DATA_PROCESSING: 'Data Processing',
  SUBMITTED_FOR_PROCESS: 'Submitted',
  VENDOR_ASSIGNED: 'Vendor Assigned',
  VISA_IN_PROCESS: 'Visa In Process',
  VISA_ISSUED: 'Visa Issued',
};

/** Action button labels for status transitions */
export const TRANSITION_ACTION_LABELS = {
  SUBMITTED_FOR_PROCESS: 'Submit for Process',
  DATA_PROCESSING: 'Return to Data Processing',
  VISA_IN_PROCESS: 'Mark Visa In Process',
  VISA_ISSUED: 'Mark Visa Issued',
  VISA_REJECTED: 'Reject Visa',
};

export const FALLBACK_DEFINITIONS = {
  statuses: GROUP_STATUSES,
  labels: STATUS_LABELS,
  transitions: VALID_TRANSITIONS,
  stepper_order: STATUS_STEPPER_ORDER,
  terminal: TERMINAL_STATUSES,
  reason_required: REASON_REQUIRED,
  default_status: DEFAULT_STATUS,
};
