const prisma = require('../config/prisma');

function coordinates(location) {
  if (!location || typeof location !== 'object') return null;
  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

class HospitalDirectoryService {
  /**
   * Fetch normalized directory results
   */
  static async getDirectory({
    page = 1,
    limit = 20,
    search = '',
    state = '',
    district = '',
    type = '',
    category = 'HOSPITALS',
    source = 'ALL',
    sort = 'name_asc'
  }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skipNum = (pageNum - 1) * limitNum;

    const normalizedCategory = (category || 'HOSPITALS').toUpperCase();
    const isCareSetuType = !type || type === 'ALL' || type.toLowerCase().includes('caresetu');
    const fetchHospitals = (normalizedCategory === 'HOSPITALS' || normalizedCategory === 'ALL');
    const fetchStatistics = (normalizedCategory === 'STATISTICS' || normalizedCategory === 'ALL');
    const fetchCareSetu = fetchHospitals && (source === 'ALL' || source === 'CARESETU_REGISTERED') && isCareSetuType;
    const fetchGov = (fetchHospitals || fetchStatistics) && (source === 'ALL' || source === 'GOVERNMENT_DATA');
    const fetchClinics = normalizedCategory === 'CLINICS' || normalizedCategory === 'ALL';
    const fetchDoctors = normalizedCategory === 'DOCTORS' || normalizedCategory === 'ALL';

    let registeredItems = [];
    let registeredTotal = 0;

    let govItems = [];
    let govTotal = 0;

    let clinicItems = [];
    let clinicTotal = 0;

    let doctorItems = [];
    let doctorTotal = 0;

    // 1. Build CareSetu Hospital Query
    if (fetchCareSetu) {
      const whereHosp = {
        user: { status: 'ACTIVE' }
      };

      if (state && state !== 'ALL') {
        whereHosp.state = { equals: state, mode: 'insensitive' };
      }
      if (district && district !== 'ALL') {
        whereHosp.city = { equals: district, mode: 'insensitive' };
      }
      if (search) {
        whereHosp.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } }
        ];
      }

      [registeredItems, registeredTotal] = await Promise.all([
        prisma.hospital.findMany({
          where: whereHosp,
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            city: true,
            state: true,
            capabilities: true,
            emergencyAvailable: true,
            isVerified: true,
            location: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { name: sort === 'name_desc' ? 'desc' : 'asc' }
        }),
        prisma.hospital.count({ where: whereHosp })
      ]);
    }

    // 2. Build Government Health Record Query
    if (fetchGov) {
      const whereGov = {};

      if (normalizedCategory === 'HOSPITALS') {
        whereGov.source = { not: 'PM_JAY' };
      } else if (normalizedCategory === 'STATISTICS') {
        whereGov.source = 'PM_JAY';
      }

      if (state && state !== 'ALL') {
        whereGov.state = { equals: state, mode: 'insensitive' };
      }
      if (district && district !== 'ALL') {
        whereGov.district = { equals: district, mode: 'insensitive' };
      }
      if (type && type !== 'ALL') {
        whereGov.hospitalType = { equals: type, mode: 'insensitive' };
      }
      if (search) {
        whereGov.OR = [
          { hospitalName: { contains: search, mode: 'insensitive' } },
          { district: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { pincode: { contains: search, mode: 'insensitive' } }
        ];
      }

      [govItems, govTotal] = await Promise.all([
        prisma.governmentHealthRecord.findMany({
          where: whereGov,
          orderBy: { hospitalName: sort === 'name_desc' ? 'desc' : 'asc' }
        }),
        prisma.governmentHealthRecord.count({ where: whereGov })
      ]);
    }

    // 3. Build Verified Clinics Query (Strictly APPROVED)
    if (fetchClinics && normalizedCategory === 'CLINICS') {
      const whereClinic = {
        user: { status: 'ACTIVE' },
        verificationStatus: 'APPROVED'
      };

      if (state && state !== 'ALL') whereClinic.state = { equals: state, mode: 'insensitive' };
      if (district && district !== 'ALL') whereClinic.city = { equals: district, mode: 'insensitive' };
      if (search) {
        whereClinic.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } }
        ];
      }

      [clinicItems, clinicTotal] = await Promise.all([
        prisma.clinic.findMany({
          where: whereClinic,
          orderBy: { name: sort === 'name_desc' ? 'desc' : 'asc' }
        }),
        prisma.clinic.count({ where: whereClinic })
      ]);
    }

    // 4. Build Verified Independent Doctors Query (Strictly APPROVED)
    if (fetchDoctors && normalizedCategory === 'DOCTORS') {
      const whereDoctor = {
        user: { status: 'ACTIVE' },
        verificationStatus: 'APPROVED',
        isIndependent: true
      };

      if (state && state !== 'ALL') whereDoctor.state = { equals: state, mode: 'insensitive' };
      if (district && district !== 'ALL') whereDoctor.city = { equals: district, mode: 'insensitive' };
      if (search) {
        whereDoctor.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { specialty: { contains: search, mode: 'insensitive' } },
          { clinicAddress: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } }
        ];
      }

      [doctorItems, doctorTotal] = await Promise.all([
        prisma.doctorProfile.findMany({
          where: whereDoctor,
          orderBy: { fullName: sort === 'name_desc' ? 'desc' : 'asc' }
        }),
        prisma.doctorProfile.count({ where: whereDoctor })
      ]);
    }

    // 3. Query active MATCHED relationships
    const matchedLinks = await prisma.hospitalMatch.findMany({
      where: { status: 'MATCHED' },
      include: {
        careSetuHospital: { select: { id: true, name: true, isVerified: true } },
        governmentRecord: { select: { id: true, sourceRecordId: true, source: true, hospitalName: true } }
      }
    });

    const govMatchMap = new Map();
    const careMatchMap = new Map();

    matchedLinks.forEach(m => {
      govMatchMap.set(m.governmentRecordId, {
        matchId: m.id,
        confidenceLevel: m.confidenceLevel,
        confidenceScore: m.confidenceScore,
        careSetuHospitalId: m.careSetuHospitalId,
        careSetuHospitalName: m.careSetuHospital.name,
        isCareSetuVerified: m.careSetuHospital.isVerified
      });

      if (!careMatchMap.has(m.careSetuHospitalId)) {
        careMatchMap.set(m.careSetuHospitalId, []);
      }
      careMatchMap.get(m.careSetuHospitalId).push({
        matchId: m.id,
        confidenceLevel: m.confidenceLevel,
        governmentRecordId: m.governmentRecordId,
        sourceRecordId: m.governmentRecord.sourceRecordId,
        source: m.governmentRecord.source,
        hospitalName: m.governmentRecord.hospitalName
      });
    });

    // 4. Normalize & Combine Results
    const normalizedRegistered = registeredItems.map(h => {
      const coords = coordinates(h.location);
      const linkedGov = careMatchMap.get(h.id) || [];
      return {
        id: h.id,
        sourceType: 'CARESETU_REGISTERED',
        source: 'CARESETU',
        sourceRecordId: h.id,
        hospitalName: h.name,
        hospitalType: 'CareSetu Network Hospital',
        state: h.state || 'N/A',
        district: h.city || 'N/A',
        address: h.address,
        pincode: null,
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null,
        phone: h.phone || null,
        email: h.email || null,
        isVerified: Boolean(h.isVerified),
        emergencyAvailable: Boolean(h.emergencyAvailable),
        capabilities: h.capabilities || [],
        bedCount: null,
        admissionData: null,
        licenseInfo: 'CareSetu Verified Healthcare Network',
        sourceUrl: null,
        lastSyncedAt: h.updatedAt,
        updatedAt: h.updatedAt,
        hasGovernmentLink: linkedGov.length > 0,
        linkedGovernmentRecords: linkedGov
      };
    });

    const normalizedGov = govItems.map(rec => {
      const matchedLink = govMatchMap.get(rec.id);
      return {
        id: rec.id,
        sourceType: 'GOVERNMENT_DATA',
        source: rec.source,
        sourceRecordId: rec.sourceRecordId,
        hospitalName: rec.hospitalName,
        hospitalType: rec.hospitalType || 'Government Health Facility',
        state: rec.state,
        district: rec.district || 'N/A',
        address: rec.address || null,
        pincode: rec.pincode || null,
        latitude: rec.latitude,
        longitude: rec.longitude,
        phone: null,
        email: null,
        isVerified: false,
        emergencyAvailable: false,
        capabilities: [],
        bedCount: rec.bedCount,
        category: rec.category,
        admissionData: rec.admissionData,
        licenseInfo: rec.licenseInfo || 'Government Open Data License - India',
        sourceUrl: rec.sourceUrl,
        lastSyncedAt: rec.lastSyncedAt,
        updatedAt: rec.updatedAt,
        rawData: rec.rawData,
        isMatched: Boolean(matchedLink),
        matchStatus: matchedLink ? 'MATCHED' : 'UNLINKED',
        linkedCareSetuHospital: matchedLink ? {
          id: matchedLink.careSetuHospitalId,
          name: matchedLink.careSetuHospitalName,
          isVerified: matchedLink.isCareSetuVerified
        } : null
      };
    });

    const normalizedClinics = clinicItems.map(c => {
      const coords = coordinates(c.location);
      return {
        id: c.id,
        sourceType: 'CLINIC',
        source: 'CARESETU',
        sourceRecordId: c.id,
        hospitalName: c.name,
        hospitalType: 'Licensed Clinic',
        category: 'CLINICS',
        state: c.state || 'N/A',
        district: c.city || 'N/A',
        address: c.address,
        pincode: c.pincode,
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null,
        phone: c.phone || null,
        email: c.email || null,
        isVerified: true,
        emergencyAvailable: false,
        capabilities: c.services || [],
        specialties: c.specialties || [],
        operatingHours: c.operatingHours || null,
        bedCount: null,
        admissionData: null,
        licenseInfo: `Reg #${c.registrationNumber}`,
        updatedAt: c.updatedAt,
      };
    });

    const normalizedDoctors = doctorItems.map(d => {
      const coords = coordinates(d.location);
      return {
        id: d.id,
        sourceType: 'DOCTOR',
        source: 'CARESETU',
        sourceRecordId: d.id,
        hospitalName: `Dr. ${d.fullName}`,
        hospitalType: d.specialty || 'Independent Practitioner',
        category: 'DOCTORS',
        state: d.state || 'N/A',
        district: d.city || 'N/A',
        address: d.clinicAddress || 'Private Practice',
        pincode: d.pincode,
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null,
        phone: null,
        email: null,
        isVerified: true,
        emergencyAvailable: false,
        capabilities: [d.specialty, ...(d.subSpecialties || [])],
        specialties: [d.specialty, ...(d.subSpecialties || [])],
        qualification: d.qualification,
        experienceYears: d.experienceYears,
        bedCount: null,
        admissionData: null,
        licenseInfo: `License #${d.licenseNumber} (${d.medicalCouncil})`,
        updatedAt: d.updatedAt,
      };
    });

    let combined = [];
    let totalCount = 0;

    if (normalizedCategory === 'CLINICS') {
      combined = normalizedClinics;
      totalCount = clinicTotal;
    } else if (normalizedCategory === 'DOCTORS') {
      combined = normalizedDoctors;
      totalCount = doctorTotal;
    } else if (normalizedCategory === 'STATISTICS') {
      combined = normalizedGov;
      totalCount = govTotal;
    } else if (source === 'CARESETU_REGISTERED') {
      combined = normalizedRegistered;
      totalCount = registeredTotal;
    } else if (source === 'GOVERNMENT_DATA') {
      combined = normalizedGov;
      totalCount = govTotal;
    } else {
      // Combined ALL sources
      combined = [...normalizedRegistered, ...normalizedGov, ...normalizedClinics, ...normalizedDoctors];
      totalCount = registeredTotal + govTotal + clinicTotal + doctorTotal;
    }

    // Apply global sorting across combined list
    if (sort === 'name_desc') {
      combined.sort((a, b) => b.hospitalName.localeCompare(a.hospitalName));
    } else if (sort === 'beds_desc') {
      combined.sort((a, b) => (b.bedCount || 0) - (a.bedCount || 0));
    } else {
      combined.sort((a, b) => a.hospitalName.localeCompare(b.hospitalName));
    }

    // Apply stable pagination slice
    const paginatedData = combined.slice(skipNum, skipNum + limitNum);

    return {
      data: paginatedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        registeredCount: registeredTotal,
        governmentCount: govTotal
      }
    };
  }

  /**
   * Fetch distinct filter options (states, districts, types)
   */
  static async getFilterOptions(selectedState) {
    // 1. Fetch CareSetu registered states & cities
    const registeredHospitals = await prisma.hospital.findMany({
      select: { state: true, city: true },
      where: { user: { status: 'ACTIVE' } }
    });

    // 2. Fetch Government records states, districts, types
    const govRecords = await prisma.governmentHealthRecord.findMany({
      select: { state: true, district: true, hospitalType: true }
    });

    const statesSet = new Set();
    const districtsSet = new Set();
    const typesSet = new Set();

    registeredHospitals.forEach(h => {
      if (h.state) statesSet.add(h.state.trim());
      if (h.city && (!selectedState || selectedState === 'ALL' || h.state?.toLowerCase() === selectedState.toLowerCase())) {
        districtsSet.add(h.city.trim());
      }
    });

    govRecords.forEach(rec => {
      if (rec.state) statesSet.add(rec.state.trim());
      if (rec.district && (!selectedState || selectedState === 'ALL' || rec.state?.toLowerCase() === selectedState.toLowerCase())) {
        districtsSet.add(rec.district.trim());
      }
      if (rec.hospitalType) typesSet.add(rec.hospitalType.trim());
    });

    return {
      sources: [
        { label: 'All Sources', value: 'ALL' },
        { label: 'CareSetu Registered', value: 'CARESETU_REGISTERED' },
        { label: 'Government Open Data', value: 'GOVERNMENT_DATA' }
      ],
      states: Array.from(statesSet).sort(),
      districts: Array.from(districtsSet).sort(),
      hospitalTypes: Array.from(typesSet).sort()
    };
  }

  /**
   * Fetch a single hospital record by ID (from either Registered or Government data)
   */
  static async getDirectoryById(id) {
    if (!id) throw new Error('Hospital ID is required.');

    // 1. Check CareSetu Registered Hospital
    const registered = await prisma.hospital.findFirst({
      where: {
        OR: [{ id: id }, { userId: id }]
      },
      select: {
        id: true,
        userId: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        city: true,
        state: true,
        capabilities: true,
        emergencyAvailable: true,
        isVerified: true,
        hasEmergencyDepartment: true,
        hasICU: true,
        hasTraumaUnit: true,
        hasCardiology: true,
        hasNeurology: true,
        hasAmbulance: true,
        location: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (registered) {
      const coords = coordinates(registered.location);
      const activeMatches = await prisma.hospitalMatch.findMany({
        where: { careSetuHospitalId: registered.id, status: 'MATCHED' },
        include: { governmentRecord: true }
      });

      return {
        id: registered.id,
        sourceType: 'CARESETU_REGISTERED',
        source: 'CARESETU',
        sourceRecordId: registered.id,
        hospitalName: registered.name,
        hospitalType: 'CareSetu Network Hospital',
        state: registered.state || 'N/A',
        district: registered.city || 'N/A',
        address: registered.address,
        pincode: null,
        latitude: coords ? coords.latitude : null,
        longitude: coords ? coords.longitude : null,
        phone: registered.phone || null,
        email: registered.email || null,
        isVerified: Boolean(registered.isVerified),
        emergencyAvailable: Boolean(registered.emergencyAvailable),
        capabilities: registered.capabilities || [],
        hasEmergencyDepartment: Boolean(registered.hasEmergencyDepartment),
        hasICU: Boolean(registered.hasICU),
        hasTraumaUnit: Boolean(registered.hasTraumaUnit),
        hasCardiology: Boolean(registered.hasCardiology),
        hasNeurology: Boolean(registered.hasNeurology),
        hasAmbulance: Boolean(registered.hasAmbulance),
        bedCount: null,
        admissionData: null,
        licenseInfo: 'CareSetu Verified Healthcare Network',
        sourceUrl: null,
        lastSyncedAt: registered.updatedAt,
        updatedAt: registered.updatedAt,
        hasGovernmentLink: activeMatches.length > 0,
        linkedGovernmentRecords: activeMatches.map(m => ({
          matchId: m.id,
          confidenceLevel: m.confidenceLevel,
          matchedAt: m.reviewedAt || m.createdAt,
          source: m.governmentRecord.source,
          sourceRecordId: m.governmentRecord.sourceRecordId,
          hospitalName: m.governmentRecord.hospitalName,
          state: m.governmentRecord.state,
          district: m.governmentRecord.district
        }))
      };
    }

    // 2. Check Government Health Record
    const govRec = await prisma.governmentHealthRecord.findFirst({
      where: {
        OR: [{ id: id }, { sourceRecordId: id }]
      }
    });

    if (govRec) {
      const activeMatch = await prisma.hospitalMatch.findFirst({
        where: { governmentRecordId: govRec.id, status: 'MATCHED' },
        include: { careSetuHospital: { select: { id: true, name: true, isVerified: true, city: true, state: true } } }
      });

      return {
        id: govRec.id,
        sourceType: 'GOVERNMENT_DATA',
        source: govRec.source,
        sourceRecordId: govRec.sourceRecordId,
        hospitalName: govRec.hospitalName,
        hospitalType: govRec.hospitalType || 'Government Health Facility',
        state: govRec.state,
        district: govRec.district || 'N/A',
        address: govRec.address || null,
        pincode: govRec.pincode || null,
        latitude: govRec.latitude,
        longitude: govRec.longitude,
        phone: null,
        email: null,
        isVerified: false,
        emergencyAvailable: false,
        capabilities: [],
        bedCount: govRec.bedCount,
        category: govRec.category,
        admissionData: govRec.admissionData,
        licenseInfo: govRec.licenseInfo || 'Government Open Data License - India',
        sourceUrl: govRec.sourceUrl,
        lastSyncedAt: govRec.lastSyncedAt,
        updatedAt: govRec.updatedAt,
        rawData: govRec.rawData,
        isMatched: Boolean(activeMatch),
        matchStatus: activeMatch ? 'MATCHED' : 'UNLINKED',
        linkedCareSetuHospital: activeMatch ? {
          matchId: activeMatch.id,
          id: activeMatch.careSetuHospital.id,
          name: activeMatch.careSetuHospital.name,
          isVerified: activeMatch.careSetuHospital.isVerified,
          city: activeMatch.careSetuHospital.city,
          state: activeMatch.careSetuHospital.state,
          confidenceLevel: activeMatch.confidenceLevel,
          matchedAt: activeMatch.reviewedAt || activeMatch.createdAt
        } : null
      };
    }

    return null;
  }
}

module.exports = { HospitalDirectoryService };
