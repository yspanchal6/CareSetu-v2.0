class SafetyRuleEngineService {
  /**
   * Evaluate the emergency and determine priority/severity.
   * Rules:
   * - Manual SOS / direct SOS / unspecified source for direct SOS -> RED (Priority 1) by default
   * - CARDIAC, BREATHING, TRAUMA -> RED (Priority 1)
   * - ACCIDENT, POISONING -> ORANGE (Priority 2)
   * - MEDICAL -> YELLOW (Priority 3)
   * - OTHER -> GREEN (Priority 4) for non-SOS symptom assessments, BUT manual/direct SOS defaults to RED (Priority 1)
   * - Critical symptoms (e.g. 'chest pain', 'unconscious') force RED (Priority 1)
   */
  evaluateEmergency(emergencyType, severityFromUser, symptoms = '', source = '') {
    let severity = 'GREEN';
    let priority = 4; // 1 = highest, 4 = lowest
    let matchedRule = 'Default';

    const normalizedSource = String(source || '').toUpperCase();
    const isManualSOS = !source || normalizedSource === 'DIRECT' || normalizedSource === 'PATIENT_APP' || normalizedSource === 'MANUAL' || normalizedSource === 'SOS';

    // 1. Evaluate by Emergency Type
    switch (String(emergencyType || '').toUpperCase()) {
      case 'CARDIAC':
      case 'BREATHING':
      case 'TRAUMA':
        severity = 'RED';
        priority = 1;
        matchedRule = 'Critical Emergency Type';
        break;
      case 'ACCIDENT':
      case 'POISONING':
        severity = 'ORANGE';
        priority = 2;
        matchedRule = 'Urgent Emergency Type';
        break;
      case 'MEDICAL':
        severity = 'YELLOW';
        priority = 3;
        matchedRule = 'Medical Emergency Type';
        break;
      default:
        if (isManualSOS && (!severityFromUser || severityFromUser === 'CRITICAL')) {
          severity = 'RED';
          priority = 1;
          matchedRule = 'Manual SOS Alert Default (RED - Critical)';
        } else {
          severity = 'GREEN';
          priority = 4;
          matchedRule = 'Default Low-Severity Assessment';
        }
        break;
    }

    // 2. Override for Manual/Direct SOS Trigger: Defaults to RED - Critical Emergency
    if (isManualSOS && (!severityFromUser || severityFromUser === 'CRITICAL') && priority > 1) {
      severity = 'RED';
      priority = 1;
      matchedRule = 'Manual SOS Escalation to RED';
    }

    // 3. Override with User/Client-reported Severity
    if (severityFromUser === 'CRITICAL' && priority > 1) {
      severity = 'RED';
      priority = 1;
      matchedRule = 'User-reported Severity: CRITICAL';
    } else if (severityFromUser === 'URGENT' && priority > 2) {
      severity = 'ORANGE';
      priority = 2;
      matchedRule = 'User-reported Severity: URGENT';
    }

    // 4. Override based on critical symptoms (deterministic rules)
    const criticalKeywords = ['chest pain', 'heart attack', 'unconscious', 'not breathing', 'severe bleeding', 'stroke'];
    const lowerSymptoms = (symptoms || '').toLowerCase();
    
    for (const keyword of criticalKeywords) {
      if (lowerSymptoms.includes(keyword)) {
        severity = 'RED';
        priority = 1;
        matchedRule = `Critical Symptom Matched: ${keyword}`;
        break;
      }
    }

    return { severity, priority, matchedRule };
  }
}

module.exports = new SafetyRuleEngineService();
