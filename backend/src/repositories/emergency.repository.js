const prisma = require('../config/prisma');

class EmergencyRepository {
  async getPatientByUserId(userId) {
    return prisma.patient.findUnique({
      where: { userId },
    });
  }

  async getEmergencyCaseByIdempotencyKey(idempotencyKey) {
    return prisma.emergencyCase.findUnique({
      where: { idempotencyKey },
    });
  }

  async createEmergencyCase(data) {
    return prisma.emergencyCase.create({
      data,
    });
  }

  async getActiveHospitals() {
    return prisma.hospital.findMany({
      where: { emergencyAvailable: true },
    });
  }

  async getActiveHospitalsInRadius(latitude, longitude, radiusKm) {
    const radiusMeters = radiusKm * 1000;
    const patientLat = parseFloat(latitude);
    const patientLng = parseFloat(longitude);

    return prisma.$queryRaw`
      SELECT * FROM (
        SELECT 
          h.id,
          h."userId",
          h.name,
          h.address,
          h.phone,
          h.city,
          h.capabilities,
          h."isVerified",
          h."emergencyAvailable",
          h."hasEmergencyDepartment",
          h."hasICU",
          h."hasTraumaUnit",
          h."hasCardiology",
          h."hasNeurology",
          (h.location->>'latitude')::float  AS latitude,
          (h.location->>'longitude')::float AS longitude,
          (h.location->>'accuracy')::text   AS "locationAccuracy",
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${patientLat})) * cos(radians((h.location->>'latitude')::float))
              * cos(radians((h.location->>'longitude')::float) - radians(${patientLng}))
              + sin(radians(${patientLat})) * sin(radians((h.location->>'latitude')::float))
            ))
          )) AS "distanceMeters"
        FROM hospitals h
        JOIN users u ON h."userId" = u.id
        WHERE h."emergencyAvailable" = true
          AND h."isVerified" = true
          AND u.status = 'ACTIVE'
          AND h.location IS NOT NULL
          AND (h.location->>'latitude') IS NOT NULL
          AND (h.location->>'longitude') IS NOT NULL
      ) AS candidates
      WHERE candidates."distanceMeters" <= ${radiusMeters}
      ORDER BY candidates."distanceMeters" ASC,
               CASE WHEN candidates."locationAccuracy" = 'city_center' THEN 1 ELSE 0 END ASC
      LIMIT 20
    `;
  }

  async createHospitalRequests(requestsData) {
    return prisma.hospitalRequest.createMany({
      data: requestsData,
    });
  }

  async createAuditLog(logData) {
    return prisma.auditLog.create({
      data: logData,
    });
  }

  async createNotifications(notificationsData) {
    return prisma.notification.createMany({
      data: notificationsData,
    });
  }
}

module.exports = new EmergencyRepository();
