const prisma = require('../config/prisma');
const {
  normalizeName,
  normalizeAddress,
  normalizePincode,
  normalizeState,
  normalizeDistrict,
  normalizePhone,
  calculateHaversineDistance,
  calculateTokenSimilarity
} = require('../utils/hospital-matching-normalizer');

function extractCoordinates(location) {
  if (!location || typeof location !== 'object') return null;
  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

class HospitalMatchingService {
  /**
   * Evaluate multi-signal candidate relationship between a GovernmentHealthRecord and a CareSetu Hospital
   */
  static evaluateMatch(govRecord, careSetuHospital) {
    const matchReasons = [];
    const conflictReasons = [];
    let score = 0;

    const govStateNorm = normalizeState(govRecord.state);
    const careStateNorm = normalizeState(careSetuHospital.state);
    const govDistrictNorm = normalizeDistrict(govRecord.district);
    const careDistrictNorm = normalizeDistrict(careSetuHospital.city);

    // Extract pincode from careSetuHospital pincode property OR address string
    let carePincodeRaw = careSetuHospital.pincode;
    if (!carePincodeRaw && careSetuHospital.address) {
      const pinMatch = careSetuHospital.address.match(/\b\d{6}\b/);
      if (pinMatch) carePincodeRaw = pinMatch[0];
    }
    const govPincodeNorm = normalizePincode(govRecord.pincode);
    const carePincodeNorm = normalizePincode(carePincodeRaw);

    const careCoords = extractCoordinates(careSetuHospital.location);

    // 1. State Check (Crucial Boundary)
    const isStateMatch = govStateNorm && careStateNorm && govStateNorm === careStateNorm;
    if (isStateMatch) {
      matchReasons.push(`Same State (${govRecord.state})`);
      score += 20;
    } else if (govStateNorm && careStateNorm) {
      conflictReasons.push(`Cross-State Mismatch: Government record is in ${govRecord.state}, CareSetu hospital is in ${careSetuHospital.state}`);
      score -= 50;
    }

    // 2. District Check
    const isDistrictMatch = govDistrictNorm && careDistrictNorm && govDistrictNorm === careDistrictNorm;
    if (isDistrictMatch) {
      matchReasons.push(`Same District (${govRecord.district})`);
      score += 25;
    } else if (govDistrictNorm && careDistrictNorm) {
      conflictReasons.push(`District Mismatch (${govRecord.district || 'N/A'} vs ${careSetuHospital.city || 'N/A'})`);
      score -= 15;
    }

    // 3. Pincode Check
    if (govPincodeNorm && carePincodeNorm) {
      if (govPincodeNorm === carePincodeNorm) {
        matchReasons.push(`Exact Pincode Match (${govPincodeNorm})`);
        score += 25;
      } else {
        conflictReasons.push(`Pincode Mismatch (${govPincodeNorm} vs ${carePincodeNorm})`);
        score -= 20;
      }
    }

    // 4. Name Token Similarity
    const nameSimilarity = calculateTokenSimilarity(govRecord.hospitalName, careSetuHospital.name);
    if (nameSimilarity >= 0.7) {
      matchReasons.push(`Strong Hospital Name Agreement (${Math.round(nameSimilarity * 100)}% token similarity)`);
      score += 40;
    } else if (nameSimilarity >= 0.4) {
      matchReasons.push(`Moderate Hospital Name Similarity (${Math.round(nameSimilarity * 100)}% token similarity)`);
      score += 20;
    } else if (nameSimilarity >= 0.2) {
      matchReasons.push(`Partial Name Similarity (${Math.round(nameSimilarity * 100)}%)`);
      score += 5;
    } else {
      conflictReasons.push('Weak Hospital Name Similarity');
      score -= 10;
    }

    // 5. Geographic Distance Proximity
    let distanceKm = null;
    if (
      Number.isFinite(govRecord.latitude) &&
      Number.isFinite(govRecord.longitude) &&
      careCoords
    ) {
      distanceKm = calculateHaversineDistance(
        govRecord.latitude,
        govRecord.longitude,
        careCoords.latitude,
        careCoords.longitude
      );

      if (distanceKm !== null) {
        if (distanceKm <= 5.0) {
          matchReasons.push(`Geographic Proximity (${distanceKm} km apart)`);
          score += 25;
        } else if (distanceKm <= 15.0) {
          matchReasons.push(`Moderate Geographic Proximity (${distanceKm} km apart)`);
          score += 10;
        } else if (distanceKm > 50.0) {
          conflictReasons.push(`Geographic Distance Conflict (${distanceKm} km apart)`);
          score -= 30;
        }
      }
    }

    // 6. Phone Number Check
    if (govRecord.phone && careSetuHospital.phone) {
      const govPhoneNorm = normalizePhone(govRecord.phone);
      const carePhoneNorm = normalizePhone(careSetuHospital.phone);
      if (govPhoneNorm && carePhoneNorm && govPhoneNorm === carePhoneNorm) {
        matchReasons.push('Exact Public Phone Match');
        score += 30;
      } else if (govPhoneNorm && carePhoneNorm) {
        conflictReasons.push('Phone Number Mismatch');
        score -= 15;
      }
    } else {
      conflictReasons.push('Phone unavailable in Government Data');
    }

    // Clamp score to 0..100
    const confidenceScore = Math.min(100, Math.max(0, score));

    // Determine Confidence Level
    const isCrossState = govStateNorm && careStateNorm && govStateNorm !== careStateNorm;
    let confidenceLevel = 'LOW';

    if (isCrossState || confidenceScore < 35) {
      confidenceLevel = 'LOW';
    } else if (confidenceScore >= 65 && !isCrossState) {
      confidenceLevel = 'HIGH';
    } else if (confidenceScore >= 35) {
      confidenceLevel = 'MEDIUM';
    }

    // Build Field Comparison Snapshot
    const evidenceSnapshot = {
      hospitalName: {
        government: govRecord.hospitalName,
        careSetu: careSetuHospital.name,
        match: nameSimilarity >= 0.4,
        status: nameSimilarity >= 0.7 ? 'MATCH' : nameSimilarity >= 0.4 ? 'PARTIAL' : 'CONFLICT'
      },
      state: {
        government: govRecord.state,
        careSetu: careSetuHospital.state || 'N/A',
        match: isStateMatch,
        status: isStateMatch ? 'MATCH' : 'CONFLICT'
      },
      district: {
        government: govRecord.district || 'N/A',
        careSetu: careSetuHospital.city || 'N/A',
        match: isDistrictMatch,
        status: isDistrictMatch ? 'MATCH' : govRecord.district && careSetuHospital.city ? 'CONFLICT' : 'MISSING'
      },
      address: {
        government: govRecord.address || 'N/A',
        careSetu: careSetuHospital.address || 'N/A',
        status: govRecord.address ? 'PRESENT' : 'MISSING'
      },
      pincode: {
        government: govRecord.pincode || 'N/A',
        careSetu: carePincodeRaw || 'N/A',
        status: govRecord.pincode && carePincodeRaw ? (govPincodeNorm === carePincodeNorm ? 'MATCH' : 'CONFLICT') : 'MISSING'
      },
      coordinates: {
        government: Number.isFinite(govRecord.latitude) ? `${govRecord.latitude}, ${govRecord.longitude}` : 'N/A',
        careSetu: careCoords ? `${careCoords.latitude}, ${careCoords.longitude}` : 'N/A',
        distanceKm,
        status: distanceKm !== null ? (distanceKm <= 15.0 ? 'MATCH' : 'CONFLICT') : 'MISSING'
      }
    };

    return {
      confidenceLevel,
      confidenceScore,
      distanceKm,
      matchReasons,
      conflictReasons,
      evidenceSnapshot
    };
  }

  /**
   * Run candidate generation across all government records and CareSetu hospitals
   */
  static async generateCandidates() {
    const [govRecords, careSetuHospitals] = await Promise.all([
      prisma.governmentHealthRecord.findMany(),
      prisma.hospital.findMany({
        where: { user: { status: 'ACTIVE' } }
      })
    ]);

    let createdCount = 0;
    let evaluatedCount = 0;

    for (const gov of govRecords) {
      for (const care of careSetuHospitals) {
        evaluatedCount++;
        const evalResult = this.evaluateMatch(gov, care);
        const nameSimilarity = calculateTokenSimilarity(gov.hospitalName, care.name);
        const isSameState = normalizeState(gov.state) === normalizeState(care.state);

        // Include candidate if score >= 20 OR same state OR name similarity >= 0.2
        if (evalResult.confidenceScore >= 20 || (isSameState && nameSimilarity >= 0.2)) {
          // Check if candidate already exists
          const existing = await prisma.hospitalMatch.findUnique({
            where: {
              careSetuHospitalId_governmentRecordId: {
                careSetuHospitalId: care.id,
                governmentRecordId: gov.id
              }
            }
          });

          if (!existing) {
            await prisma.hospitalMatch.create({
              data: {
                careSetuHospitalId: care.id,
                governmentRecordId: gov.id,
                status: 'PENDING_REVIEW',
                confidenceLevel: evalResult.confidenceLevel,
                confidenceScore: evalResult.confidenceScore,
                matchingMethod: 'DETERMINISTIC_MULTI_SIGNAL',
                matchReasons: evalResult.matchReasons,
                conflictReasons: evalResult.conflictReasons,
                evidenceSnapshot: evalResult.evidenceSnapshot,
                distanceKm: evalResult.distanceKm
              }
            });
            createdCount++;
          } else if (existing.status === 'PENDING_REVIEW') {
            await prisma.hospitalMatch.update({
              where: { id: existing.id },
              data: {
                confidenceLevel: evalResult.confidenceLevel,
                confidenceScore: evalResult.confidenceScore,
                matchReasons: evalResult.matchReasons,
                conflictReasons: evalResult.conflictReasons,
                evidenceSnapshot: evalResult.evidenceSnapshot,
                distanceKm: evalResult.distanceKm
              }
            });
          }
        }
      }
    }

    return { evaluatedCount, createdCount };
  }

  /**
   * Fetch statistics for Admin Hospital Matching dashboard
   */
  static async getStats() {
    const [
      totalGovRecords,
      totalCareSetuHospitals,
      pendingReview,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      matched,
      rejected,
      unmatched
    ] = await Promise.all([
      prisma.governmentHealthRecord.count(),
      prisma.hospital.count({ where: { user: { status: 'ACTIVE' } } }),
      prisma.hospitalMatch.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.hospitalMatch.count({ where: { confidenceLevel: 'HIGH', status: 'PENDING_REVIEW' } }),
      prisma.hospitalMatch.count({ where: { confidenceLevel: 'MEDIUM', status: 'PENDING_REVIEW' } }),
      prisma.hospitalMatch.count({ where: { confidenceLevel: 'LOW', status: 'PENDING_REVIEW' } }),
      prisma.hospitalMatch.count({ where: { status: 'MATCHED' } }),
      prisma.hospitalMatch.count({ where: { status: 'REJECTED' } }),
      prisma.hospitalMatch.count({ where: { status: 'UNMATCHED' } })
    ]);

    return {
      totalGovernmentRecords: totalGovRecords,
      totalCareSetuHospitals,
      pendingReview,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      matched,
      rejected,
      unmatched
    };
  }

  /**
   * Fetch paginated match candidates with search and multi-filtering
   */
  static async getCandidates({
    page = 1,
    limit = 20,
    search = '',
    status = 'ALL',
    confidenceLevel = 'ALL',
    source = 'ALL',
    state = 'ALL',
    district = 'ALL',
    hospitalType = 'ALL'
  }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skipNum = (pageNum - 1) * limitNum;

    const where = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (confidenceLevel && confidenceLevel !== 'ALL') {
      where.confidenceLevel = confidenceLevel;
    }

    if (source && source !== 'ALL') {
      where.governmentRecord = { ...where.governmentRecord, source };
    }
    if (state && state !== 'ALL') {
      where.governmentRecord = { ...where.governmentRecord, state: { equals: state, mode: 'insensitive' } };
    }
    if (district && district !== 'ALL') {
      where.governmentRecord = { ...where.governmentRecord, district: { equals: district, mode: 'insensitive' } };
    }
    if (hospitalType && hospitalType !== 'ALL') {
      where.governmentRecord = { ...where.governmentRecord, hospitalType: { equals: hospitalType, mode: 'insensitive' } };
    }

    if (search) {
      where.OR = [
        { governmentRecord: { hospitalName: { contains: search, mode: 'insensitive' } } },
        { careSetuHospital: { name: { contains: search, mode: 'insensitive' } } },
        { governmentRecord: { pincode: { contains: search, mode: 'insensitive' } } },
        { governmentRecord: { district: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, totalCount, stats] = await Promise.all([
      prisma.hospitalMatch.findMany({
        where,
        include: {
          careSetuHospital: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
              city: true,
              state: true,
              isVerified: true,
              emergencyAvailable: true,
              location: true
            }
          },
          governmentRecord: true
        },
        orderBy: [
          { status: 'asc' },
          { confidenceScore: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: skipNum,
        take: limitNum
      }),
      prisma.hospitalMatch.count({ where }),
      this.getStats()
    ]);

    return {
      candidates: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      stats
    };
  }

  /**
   * Get single candidate by ID with side-by-side comparison details
   */
  static async getMatchById(id) {
    if (!id) throw new Error('Match ID is required.');

    const match = await prisma.hospitalMatch.findUnique({
      where: { id },
      include: {
        careSetuHospital: true,
        governmentRecord: true
      }
    });

    if (!match) return null;

    // Recalculate fresh evidence snapshot if missing
    if (!match.evidenceSnapshot) {
      const evalRes = this.evaluateMatch(match.governmentRecord, match.careSetuHospital);
      match.evidenceSnapshot = evalRes.evidenceSnapshot;
    }

    return match;
  }

  /**
   * Approve candidate match (Transaction Safe + Concurrency Guard)
   */
  static async approveMatch(id, adminUserId, reqInfo = {}) {
    if (!id) throw new Error('Match ID is required.');
    if (!adminUserId) throw new Error('Admin User ID is required.');

    return await prisma.$transaction(async (tx) => {
      const match = await tx.hospitalMatch.findUnique({
        where: { id },
        include: { governmentRecord: true, careSetuHospital: true }
      });

      if (!match) {
        const error = new Error('Match candidate not found.');
        error.status = 404;
        throw error;
      }

      // Concurrency check: Ensure government record is not ALREADY matched to another hospital
      const existingConflict = await tx.hospitalMatch.findFirst({
        where: {
          governmentRecordId: match.governmentRecordId,
          status: 'MATCHED',
          id: { not: id }
        }
      });

      if (existingConflict) {
        const error = new Error('This government health record is already matched to another CareSetu hospital.');
        error.status = 409; // HTTP 409 Conflict
        throw error;
      }

      const updated = await tx.hospitalMatch.update({
        where: { id },
        data: {
          status: 'MATCHED',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectionReason: null
        },
        include: {
          careSetuHospital: true,
          governmentRecord: true
        }
      });

      // Audit Log Entry
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'HOSPITAL_MATCHING',
          entity: 'HospitalMatch',
          entityId: updated.id,
          endpoint: reqInfo.endpoint || '/api/admin/hospital-matching/approve',
          ipAddress: reqInfo.ipAddress || null,
          userAgent: reqInfo.userAgent || null,
          details: {
            event: 'APPROVE_MATCH',
            matchId: updated.id,
            careSetuHospitalId: updated.careSetuHospitalId,
            governmentRecordId: updated.governmentRecordId,
            confidenceLevel: updated.confidenceLevel,
            confidenceScore: updated.confidenceScore,
            reviewedBy: adminUserId
          }
        }
      });

      return updated;
    });
  }

  /**
   * Reject candidate match
   */
  static async rejectMatch(id, adminUserId, reason = 'Manually rejected by administrator', reqInfo = {}) {
    if (!id) throw new Error('Match ID is required.');
    if (!adminUserId) throw new Error('Admin User ID is required.');

    return await prisma.$transaction(async (tx) => {
      const match = await tx.hospitalMatch.findUnique({ where: { id } });
      if (!match) {
        const error = new Error('Match candidate not found.');
        error.status = 404;
        throw error;
      }

      const updated = await tx.hospitalMatch.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedBy: adminUserId,
          rejectedAt: new Date(),
          rejectionReason: reason
        },
        include: {
          careSetuHospital: true,
          governmentRecord: true
        }
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'HOSPITAL_MATCHING',
          entity: 'HospitalMatch',
          entityId: updated.id,
          endpoint: reqInfo.endpoint || '/api/admin/hospital-matching/reject',
          ipAddress: reqInfo.ipAddress || null,
          userAgent: reqInfo.userAgent || null,
          details: {
            event: 'REJECT_MATCH',
            matchId: updated.id,
            rejectedBy: adminUserId,
            reason
          }
        }
      });

      return updated;
    });
  }

  /**
   * Unmatch an approved hospital link
   */
  static async unmatch(id, adminUserId, reason = 'Unmatched by administrator', reqInfo = {}) {
    if (!id) throw new Error('Match ID is required.');
    if (!adminUserId) throw new Error('Admin User ID is required.');

    return await prisma.$transaction(async (tx) => {
      const match = await tx.hospitalMatch.findUnique({ where: { id } });
      if (!match) {
        const error = new Error('Match candidate not found.');
        error.status = 404;
        throw error;
      }

      const updated = await tx.hospitalMatch.update({
        where: { id },
        data: {
          status: 'UNMATCHED',
          unmatchedBy: adminUserId,
          unmatchedAt: new Date(),
          unmatchReason: reason
        },
        include: {
          careSetuHospital: true,
          governmentRecord: true
        }
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'HOSPITAL_MATCHING',
          entity: 'HospitalMatch',
          entityId: updated.id,
          endpoint: reqInfo.endpoint || '/api/admin/hospital-matching/unmatch',
          ipAddress: reqInfo.ipAddress || null,
          userAgent: reqInfo.userAgent || null,
          details: {
            event: 'UNMATCH_RELATIONSHIP',
            matchId: updated.id,
            unmatchedBy: adminUserId,
            reason
          }
        }
      });

      return updated;
    });
  }

  /**
   * Find best matched nearby hospitals for emergency dispatch.
   * Accepts patient coordinates and emergency type (CARDIAC, TRAUMA, ACCIDENT, BREATHING, MEDICAL, etc.)
   */
  static async findBestHospitals({
    latitude,
    longitude,
    emergencyType = 'MEDICAL',
    radiusKm = 50,
    limit = 5
  } = {}) {
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return [];
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return [];
    }

    const careSetuHospitals = await prisma.hospital.findMany({
      where: {
        user: { status: 'ACTIVE' },
        emergencyAvailable: true
      },
      include: {
        user: {
          select: { id: true, email: true, status: true }
        }
      }
    });

    const candidates = [];

    for (const hospital of careSetuHospitals) {
      const coords = extractCoordinates(hospital.location);
      if (!coords) continue;

      const distanceKm = calculateHaversineDistance(
        latNum,
        lngNum,
        coords.latitude,
        coords.longitude
      );

      if (distanceKm === null) continue;

      const typeUpper = String(emergencyType || '').toUpperCase();
      let capabilityMatched = true;

      if (typeUpper === 'CARDIAC') {
        capabilityMatched = hospital.hasCardiology === true || (Array.isArray(hospital.capabilities) && hospital.capabilities.some(c => c.toLowerCase().includes('cardio')));
      } else if (typeUpper === 'TRAUMA' || typeUpper === 'ACCIDENT') {
        capabilityMatched = hospital.hasTraumaUnit === true || (Array.isArray(hospital.capabilities) && hospital.capabilities.some(c => c.toLowerCase().includes('trauma')));
      } else if (typeUpper === 'BREATHING') {
        capabilityMatched = hospital.hasICU === true || hospital.hasEmergencyDepartment === true;
      }

      const proximityScore = Math.max(0, 100 - distanceKm * 2);
      const capabilityBonus = capabilityMatched ? 25 : 0;
      const verificationBonus = hospital.isVerified ? 10 : 0;
      const matchScore = Math.round(proximityScore + capabilityBonus + verificationBonus);

      candidates.push({
        hospital,
        distanceKm: Math.round(distanceKm * 100) / 100,
        capabilityMatched,
        availabilityMatched: Boolean(hospital.emergencyAvailable),
        matchScore
      });
    }

    let filtered = candidates.filter(c => c.distanceKm <= radiusKm);

    if (filtered.length === 0 && candidates.length > 0) {
      filtered = candidates;
    }

    filtered.sort((a, b) => {
      if (a.capabilityMatched !== b.capabilityMatched) {
        return a.capabilityMatched ? -1 : 1;
      }
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return a.distanceKm - b.distanceKm;
    });

    return filtered.slice(0, limit);
  }
}

const serviceExport = {
  HospitalMatchingService,
  findBestHospitals: (opts) => HospitalMatchingService.findBestHospitals(opts),
  evaluateMatch: (gov, care) => HospitalMatchingService.evaluateMatch(gov, care),
  generateCandidates: () => HospitalMatchingService.generateCandidates(),
  getStats: () => HospitalMatchingService.getStats(),
  getCandidates: (params) => HospitalMatchingService.getCandidates(params),
  getMatchById: (id) => HospitalMatchingService.getMatchById(id),
  approveMatch: (id, adminId, info) => HospitalMatchingService.approveMatch(id, adminId, info),
  rejectMatch: (id, adminId, reason, info) => HospitalMatchingService.rejectMatch(id, adminId, reason, info),
  unmatch: (id, adminId, reason, info) => HospitalMatchingService.unmatch(id, adminId, reason, info),
};

module.exports = serviceExport;

