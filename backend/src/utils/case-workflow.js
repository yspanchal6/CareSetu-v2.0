const ACTIVE_OPERATIONAL_STATUSES = Object.freeze([
  'ACCEPTED',
  'TRANSFER',
  'IN_PROGRESS',
  'TREATMENT',
]);
const CASE_HISTORY_STATUSES = Object.freeze(['CLOSED', 'CANCELLED']);

const VALID_STATUS_TRANSITIONS = {
  ACCEPTED: ['TRANSFER'],
  TRANSFER: ['IN_PROGRESS'],
  IN_PROGRESS: ['TREATMENT'],
  TREATMENT: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

function canTransitionCase(currentStatus, targetStatus) {
  return (VALID_STATUS_TRANSITIONS[String(currentStatus || '').toUpperCase()] || [])
    .includes(String(targetStatus || '').toUpperCase());
}

function canActorTransitionCase(role, targetStatus) {
  const normalizedRole = String(role || '').toUpperCase();
  const normalizedStatus = String(targetStatus || '').toUpperCase();
  if (normalizedRole === 'HOSPITAL') {
    return ['TRANSFER', 'IN_PROGRESS', 'CLOSED'].includes(normalizedStatus);
  }
  if (normalizedRole === 'DOCTOR') {
    return ['TRANSFER', 'IN_PROGRESS', 'TREATMENT'].includes(normalizedStatus);
  }
  return normalizedRole === 'ADMIN';
}

const DIAGNOSIS_REVIEW_STATUSES = Object.freeze([
  'DRAFT',
  'SUBMITTED_FOR_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED',
]);

const VALID_DIAGNOSIS_TRANSITIONS = {
  NONE: ['DRAFT', 'SUBMITTED_FOR_REVIEW'],
  DRAFT: ['DRAFT', 'SUBMITTED_FOR_REVIEW'],
  SUBMITTED_FOR_REVIEW: ['APPROVED', 'CHANGES_REQUESTED'],
  APPROVED: ['SUBMITTED_FOR_REVIEW', 'DRAFT'],
  CHANGES_REQUESTED: ['DRAFT', 'SUBMITTED_FOR_REVIEW'],
};

function canTransitionDiagnosis(currentStatus, targetStatus) {
  const currentKey = currentStatus ? String(currentStatus).toUpperCase() : 'NONE';
  const targetKey = String(targetStatus || '').toUpperCase();
  return (VALID_DIAGNOSIS_TRANSITIONS[currentKey] || []).includes(targetKey);
}

function canActorReviewDiagnosis(role) {
  const normalizedRole = String(role || '').toUpperCase();
  return ['HOSPITAL', 'ADMIN'].includes(normalizedRole);
}

function isCaseEligibleForClosure(emergencyCase) {
  if (!emergencyCase) return false;
  const status = String(emergencyCase.status || '').toUpperCase();
  if (status !== 'TREATMENT') return false;
  const diagReport = emergencyCase.medicalSummary?.diagnosisReport;
  if (!diagReport || String(diagReport.status || '').toUpperCase() !== 'APPROVED') {
    return false;
  }
  return true;
}

module.exports = {
  ACTIVE_OPERATIONAL_STATUSES,
  CASE_HISTORY_STATUSES,
  DIAGNOSIS_REVIEW_STATUSES,
  VALID_STATUS_TRANSITIONS,
  VALID_DIAGNOSIS_TRANSITIONS,
  canTransitionCase,
  canActorTransitionCase,
  canTransitionDiagnosis,
  canActorReviewDiagnosis,
  isCaseEligibleForClosure,
};

