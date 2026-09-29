const prisma = require('../../config/prisma');
const { DataGovInAdapter } = require('./gov-data-gov-in.adapter');
const { PmjayAdmissionsAdapter } = require('./gov-pmjay-admissions.adapter');

class GovHealthDataService {
  /**
   * Sync a dataset using adapter
   */
  static async syncDataset(datasetKey) {
    let adapter;
    if (datasetKey === 'district_hospitals') {
      adapter = new DataGovInAdapter();
    } else if (datasetKey === 'pmjay_admissions') {
      adapter = new PmjayAdmissionsAdapter();
    } else {
      throw new Error(`Unknown dataset key: ${datasetKey}`);
    }

    const now = new Date();
    
    // Log Syncing start using upsert
    await prisma.governmentSyncLog.upsert({
      where: {
        source_sourceDataset: {
          source: adapter.source,
          sourceDataset: adapter.sourceDataset
        }
      },
      update: {
        status: 'SYNCING',
        errorMessage: null,
        lastSyncAt: now
      },
      create: {
        source: adapter.source,
        sourceDataset: adapter.sourceDataset,
        status: 'SYNCING',
        recordsCount: 0,
        lastSyncAt: now
      }
    });

    try {
      const rawRecords = await adapter.fetchRawData();
      const normalizedRecords = adapter.normalize(rawRecords);

      let importedCount = 0;
      const syncTime = new Date();

      for (const rec of normalizedRecords) {
        await prisma.governmentHealthRecord.upsert({
          where: {
            source_sourceRecordId: {
              source: rec.source,
              sourceRecordId: rec.sourceRecordId
            }
          },
          update: {
            hospitalName: rec.hospitalName,
            state: rec.state,
            district: rec.district,
            address: rec.address,
            pincode: rec.pincode,
            hospitalType: rec.hospitalType,
            latitude: rec.latitude,
            longitude: rec.longitude,
            bedCount: rec.bedCount,
            category: rec.category,
            admissionData: rec.admissionData,
            rawData: rec.rawData,
            sourceDataset: rec.sourceDataset,
            sourceUrl: rec.sourceUrl,
            licenseInfo: rec.licenseInfo,
            lastSyncedAt: syncTime
          },
          create: {
            source: rec.source,
            sourceDataset: rec.sourceDataset,
            sourceRecordId: rec.sourceRecordId,
            sourceUrl: rec.sourceUrl,
            licenseInfo: rec.licenseInfo,
            hospitalName: rec.hospitalName,
            state: rec.state,
            district: rec.district,
            address: rec.address,
            pincode: rec.pincode,
            hospitalType: rec.hospitalType,
            latitude: rec.latitude,
            longitude: rec.longitude,
            bedCount: rec.bedCount,
            category: rec.category,
            admissionData: rec.admissionData,
            rawData: rec.rawData,
            lastSyncedAt: syncTime
          }
        });
        importedCount++;
      }

      await prisma.governmentSyncLog.upsert({
        where: {
          source_sourceDataset: {
            source: adapter.source,
            sourceDataset: adapter.sourceDataset
          }
        },
        update: {
          status: 'SUCCESS',
          recordsCount: importedCount,
          errorMessage: null,
          lastSyncAt: syncTime
        },
        create: {
          source: adapter.source,
          sourceDataset: adapter.sourceDataset,
          status: 'SUCCESS',
          recordsCount: importedCount,
          lastSyncAt: syncTime
        }
      });

      return {
        success: true,
        sourceDataset: adapter.sourceDataset,
        recordsImported: importedCount,
        lastSyncedAt: syncTime
      };
    } catch (error) {
      console.error(`[GovHealthDataService] Error syncing ${datasetKey}:`, error);

      const errTime = new Date();
      if (adapter) {
        await prisma.governmentSyncLog.upsert({
          where: {
            source_sourceDataset: {
              source: adapter.source,
              sourceDataset: adapter.sourceDataset
            }
          },
          update: {
            status: 'FAILED',
            errorMessage: error.message || 'Sync failed',
            lastSyncAt: errTime
          },
          create: {
            source: adapter.source,
            sourceDataset: adapter.sourceDataset,
            status: 'FAILED',
            errorMessage: error.message || 'Sync failed',
            lastSyncAt: errTime
          }
        });
      }

      throw error;
    }
  }

  /**
   * Get summary of all integrated government data sources
   */
  static async getSummary() {
    // 1. District Hospitals summary
    const dhCount = await prisma.governmentHealthRecord.count({
      where: { source: 'DATA_GOV_IN' }
    });
    const dhLastLog = await prisma.governmentSyncLog.findFirst({
      where: { source: 'DATA_GOV_IN' }
    });

    // 2. AB PM-JAY Admissions summary
    const pmjayCount = await prisma.governmentHealthRecord.count({
      where: { source: 'PM_JAY' }
    });
    const pmjayLastLog = await prisma.governmentSyncLog.findFirst({
      where: { source: 'PM_JAY' }
    });

    // 3. Total External Records
    const totalRecords = await prisma.governmentHealthRecord.count();

    return {
      datasets: [
        {
          key: 'district_hospitals',
          name: 'District Hospitals Directory',
          source: 'DATA_GOV_IN',
          sourceUrl: 'https://data.gov.in/resource/district-hospitals-india-directory',
          period: 'Live / 2026',
          records: dhCount,
          lastSync: dhLastLog ? dhLastLog.lastSyncAt : null,
          status: dhLastLog ? dhLastLog.status : 'NOT_CONFIGURED',
          lastLogMessage: dhLastLog ? dhLastLog.errorMessage : null
        },
        {
          key: 'pmjay_admissions',
          name: 'AB PM-JAY Authorized Admissions',
          source: 'PM_JAY',
          sourceUrl: 'https://data.gov.in/resource/state-ut-wise-authorized-hospital-admissions-under-ab-pmjay',
          period: '2019-20 → 2024-25',
          records: pmjayCount,
          lastSync: pmjayLastLog ? pmjayLastLog.lastSyncAt : null,
          status: pmjayLastLog ? pmjayLastLog.status : 'NOT_CONFIGURED',
          lastLogMessage: pmjayLastLog ? pmjayLastLog.errorMessage : null
        }
      ],
      apiSetu: {
        name: 'API Setu Discovery Framework',
        publisher: 'National Informatics Centre (NIC) / Ministry of Electronics & IT',
        purpose: 'Verified health API discovery, ABHA integration, and government hospital registry search',
        authentication: 'OAuth2 / API Key (Configurable)',
        accessRequirements: 'Requires official government sandbox / production API Key approval',
        status: process.env.API_SETU_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
        documentationUrl: 'https://apisetu.gov.in/'
      },
      totalRecords
    };
  }

  /**
   * Get paginated records list
   */
  static async getRecords({ page = 1, limit = 20, source, state, search }) {
    const where = {};
    if (source && source !== 'ALL') {
      where.source = source;
    }
    if (state && state !== 'ALL') {
      where.state = state;
    }
    if (search) {
      where.OR = [
        { hospitalName: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      prisma.governmentHealthRecord.findMany({
        where,
        skip,
        take: parseInt(limit, 10),
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.governmentHealthRecord.count({ where })
    ]);

    return {
      records,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = { GovHealthDataService };
