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

class DataGovInAdapter {
  constructor() {
    this.source = 'DATA_GOV_IN';
    this.sourceDataset = 'District Hospitals Directory (data.gov.in)';
    this.license = 'Government Open Data License - India';
  }

  async fetchRawData() {
    const filePath = path.join(__dirname, '../../data/gov/district_hospitals_data_gov_in.json');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found at ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  normalize(rawRecords) {
    const normalized = [];
    for (const raw of rawRecords) {
      if (!raw.hospitalName || !raw.state) {
        console.warn(`[DataGovInAdapter] Skipping record missing hospitalName or state:`, raw);
        continue;
      }

      normalized.push({
        source: this.source,
        sourceDataset: this.sourceDataset,
        sourceRecordId: raw.recordId || `GOV-DH-${raw.state}-${raw.hospitalName}`.replace(/\s+/g, '-').toUpperCase(),
        sourceUrl: raw.sourceUrl || 'https://data.gov.in',
        licenseInfo: this.license,
        hospitalName: toTitleCase(raw.hospitalName),
        state: toTitleCase(raw.state),
        district: raw.district ? toTitleCase(raw.district) : null,
        address: raw.address ? raw.address.trim() : null,
        pincode: raw.pincode ? String(raw.pincode).trim() : null,
        hospitalType: raw.hospitalType ? toTitleCase(raw.hospitalType) : 'District Hospital',
        latitude: raw.latitude ? parseFloat(raw.latitude) : null,
        longitude: raw.longitude ? parseFloat(raw.longitude) : null,
        bedCount: raw.bedCount ? parseInt(raw.bedCount, 10) : null,
        category: raw.category || 'Public / Government',
        admissionData: null,
        rawData: raw
      });
    }
    return normalized;
  }
}

module.exports = { DataGovInAdapter };
