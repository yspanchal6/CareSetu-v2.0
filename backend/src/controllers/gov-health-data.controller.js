const { GovHealthDataService } = require('../services/gov-health-data/gov-health-data.service');

/**
 * GET /api/admin/gov-health-data/summary
 */
exports.getGovHealthDataSummary = async (req, res, next) => {
  try {
    const summary = await GovHealthDataService.getSummary();
    return res.json({
      success: true,
      ...summary
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/gov-health-data/sync
 * Body: { datasetKey: 'district_hospitals' | 'pmjay_admissions' }
 */
exports.syncGovHealthData = async (req, res, next) => {
  try {
    const { datasetKey } = req.body || {};
    if (!datasetKey) {
      return res.status(400).json({
        success: false,
        error: 'datasetKey is required (e.g. "district_hospitals" or "pmjay_admissions").'
      });
    }

    const result = await GovHealthDataService.syncDataset(datasetKey);
    return res.json({
      success: true,
      message: `Sync completed for dataset ${datasetKey}`,
      result
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/gov-health-data/records
 * Query: page, limit, source, state, search
 */
exports.getGovHealthRecords = async (req, res, next) => {
  try {
    const { page, limit, source, state, search } = req.query;
    const data = await GovHealthDataService.getRecords({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      source,
      state,
      search
    });

    return res.json({
      success: true,
      ...data
    });
  } catch (err) {
    return next(err);
  }
};
