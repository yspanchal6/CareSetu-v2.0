const { HospitalMatchingService } = require('../services/hospital-matching.service');

exports.getStats = async (req, res, next) => {
  try {
    const stats = await HospitalMatchingService.getStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    next(error);
  }
};

exports.getCandidates = async (req, res, next) => {
  try {
    const { page, limit, search, status, confidenceLevel, source, state, district, type } = req.query;
    const result = await HospitalMatchingService.getCandidates({
      page,
      limit,
      search,
      status,
      confidenceLevel,
      source,
      state,
      district,
      hospitalType: type
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getMatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const match = await HospitalMatchingService.getMatchById(id);
    if (!match) {
      return res.status(404).json({ success: false, error: 'Match candidate not found.' });
    }
    return res.status(200).json({ success: true, match });
  } catch (error) {
    next(error);
  }
};

exports.generateCandidates = async (req, res, next) => {
  try {
    const result = await HospitalMatchingService.generateCandidates();
    return res.status(200).json({
      success: true,
      message: 'Candidate generation run completed successfully.',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.approveMatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user.id;
    const reqInfo = {
      endpoint: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };
    const updated = await HospitalMatchingService.approveMatch(id, adminUserId, reqInfo);
    return res.status(200).json({
      success: true,
      message: 'Hospital match successfully approved and linked.',
      match: updated
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectMatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user.id;
    const reqInfo = {
      endpoint: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };
    const updated = await HospitalMatchingService.rejectMatch(id, adminUserId, reason, reqInfo);
    return res.status(200).json({
      success: true,
      message: 'Hospital match rejected.',
      match: updated
    });
  } catch (error) {
    next(error);
  }
};

exports.unmatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user.id;
    const reqInfo = {
      endpoint: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };
    const updated = await HospitalMatchingService.unmatch(id, adminUserId, reason, reqInfo);
    return res.status(200).json({
      success: true,
      message: 'Hospital match relationship removed.',
      match: updated
    });
  } catch (error) {
    next(error);
  }
};
