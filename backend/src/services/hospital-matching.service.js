const emergencyRepository = require('../repositories/emergency.repository');

class HospitalMatchingService {
  /**
   * Determine if a hospital has the required capabilities for the emergency type.
   */
  hasRequiredCapability(hospital, emergencyType) {
    switch (emergencyType) {
      case 'CARDIAC':
        return hospital.hasCardiology === true;
      case 'TRAUMA':
      case 'ACCIDENT':
        return hospital.hasTraumaUnit === true;
      case 'BREATHING':
        return hospital.hasICU === true;
      default:
        return hospital.hasEmergencyDepartment === true || hospital.emergencyAvailable === true;
    }
  }

  /**
   * Find and rank the best hospitals for a given emergency using progressive radii.
   */
  async findBestHospitals({ latitude, longitude, emergencyType }) {
    const radii = [2, 4, 8, 16, 32, 64];
    let allCapableHospitals = [];
    
    for (const radius of radii) {
      const hospitals = await emergencyRepository.getActiveHospitalsInRadius(latitude, longitude, radius);
      
      // Filter out ones we already found in smaller radii
      const newHospitals = hospitals.filter(h => !allCapableHospitals.find(existing => existing.hospital.id === h.id));
      
      const capableHospitals = newHospitals.filter(h => this.hasRequiredCapability(h, emergencyType));
      
      if (capableHospitals.length > 0) {
        const scoredHospitals = capableHospitals.map(h => {
          const distanceKm = h.distanceMeters / 1000;
          return {
            hospital: h,
            distanceKm,
            capabilityMatched: true,
            availabilityMatched: h.emergencyAvailable,
            matchScore: distanceKm // Lower is better
          };
        });
        allCapableHospitals = allCapableHospitals.concat(scoredHospitals);
      }
      
      if (allCapableHospitals.length >= 5) {
        break;
      }
    }
    
    allCapableHospitals.sort((a, b) => a.matchScore - b.matchScore);
    return allCapableHospitals.slice(0, 5);
  }
}

module.exports = new HospitalMatchingService();
