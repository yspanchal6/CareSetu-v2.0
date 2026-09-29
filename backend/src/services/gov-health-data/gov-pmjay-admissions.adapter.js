const fs = require('fs');
const path = require('path');

function toTitleCase(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

class PmjayAdmissionsAdapter {
  constructor() {
    this.source = 'PM_JAY';
    this.sourceDataset = 'State/UT-wise Authorized Hospital Admissions under AB PM-JAY (2019-20 to 2024-25)';
    this.license = 'Government Open Data License - India';
  }

  async fetchRawData() {
    const filePath = path.join(__dirname, '../../data/gov/ab_pmjay_admissions_data_gov_in.json');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found at ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  normalize(rawRecords) {
    const normalized = [];
    for (const raw of rawRecords) {
      if (!raw.state) {
        console.warn(`[PmjayAdmissionsAdapter] Skipping record missing state:`, raw);
        continue;
      }

      normalized.push({
        source: this.source,
        sourceDataset: this.sourceDataset,
        sourceRecordId: raw.recordId || `PMJAY-ADM-${raw.state}`.replace(/\s+/g, '-').toUpperCase(),
        sourceUrl: raw.sourceUrl || 'https://data.gov.in',
        licenseInfo: this.license,
        hospitalName: `AB PM-JAY Admissions Data - ${toTitleCase(raw.state)}`,
        state: toTitleCase(raw.state),
        district: null,
        address: null,
        pincode: null,
        hospitalType: 'State Cumulative Admissions',
        latitude: null,
        longitude: null,
        bedCount: null,
        category: raw.category || 'AB PM-JAY Authorized Admissions',
        admissionData: raw.admissionData || {},
        rawData: raw
      });
    }
    return normalized;
  }
}

module.exports = { PmjayAdmissionsAdapter };
