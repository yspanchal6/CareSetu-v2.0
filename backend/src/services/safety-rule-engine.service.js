class SafetyRuleEngineService {
  /**
   * Evaluate the emergency and determine priority/severity.
   * Rules:
   * - CARDIAC, BREATHING, TRAUMA -> RED
   * - ACCIDENT, POISONING -> ORANGE
   * - MEDICAL -> YELLOW
   * - OTHER -> GREEN
   * - Critical symptoms (e.g. 'chest pain', 'unconscious') force RED.
   */
  evaluateEmergency(emergencyType, severityFromUser, symptoms = '') {
    let severity = 'GREEN';
    let priority = 4; // 1 = highest, 4 = lowest
    let matchedRule = 'Default';

    // 1. Evaluate by Emergency Type
    switch (emergencyType) {
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
        severity = 'GREEN';
        priority = 4;
        matchedRule = 'Default Type';
        break;
    }

    // 2. Override with User Severity if higher (e.g. user says CRITICAL)
    // Note: User provides 'CRITICAL', 'URGENT', 'STABLE'
    if (severityFromUser === 'CRITICAL' && priority > 1) {
      severity = 'RED';
      priority = 1;
      matchedRule = 'User User-reported Severity: CRITICAL';
    } else if (severityFromUser === 'URGENT' && priority > 2) {
      severity = 'ORANGE';
      priority = 2;
      matchedRule = 'User User-reported Severity: URGENT';
    }

    // 3. Override based on critical symptoms (deterministic rules)
    const criticalKeywords = ['chest pain', 'heart attack', 'unconscious', 'not breathing', 'severe bleeding', 'stroke'];
    const lowerSymptoms = symptoms.toLowerCase();
    
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
