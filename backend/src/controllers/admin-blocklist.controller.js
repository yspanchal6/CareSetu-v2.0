const adminBlocklistService = require('../services/admin-blocklist.service');

exports.blockAccount = async (req, res, next) => {
  try {
    const { targetUserId, reason, expiresAt } = req.body;
    const adminUserId = req.user.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const restriction = await adminBlocklistService.blockAccount({
      adminUserId,
      targetUserId,
      reason,
      expiresAt,
    });

    res.json({
      success: true,
      message: 'Account restricted successfully',
      restriction,
    });
  } catch (err) {
    next(err);
  }
};

exports.unblockAccount = async (req, res, next) => {
  try {
    const { targetUserId, reason } = req.body;
    const adminUserId = req.user.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const result = await adminBlocklistService.unblockAccount({
      adminUserId,
      targetUserId,
      reason,
    });

    res.json({
      success: true,
      message: 'Account unblocked successfully',
      result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    const users = await adminBlocklistService.getUsers({ search, role, status });
    res.json({
      success: true,
      users,
    });
  } catch (err) {
    next(err);
  }
};

exports.getHospitals = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const users = await adminBlocklistService.getUsers({ search, role: 'HOSPITAL', status });
    res.json({
      success: true,
      hospitals: users.map((u) => ({
        id: u.hospital?.id || u.id,
        userId: u.id,
        name: u.name,
        address: u.hospital?.address || '',
        phone: u.hospital?.phone || '',
        status: u.status,
        isVerified: u.isVerified,
        activeRestriction: u.activeRestriction,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getPatients = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const users = await adminBlocklistService.getUsers({ search, role: 'PATIENT', status });
    res.json({
      success: true,
      patients: users.map((u) => ({
        id: u.patient?.id || u.id,
        userId: u.id,
        name: u.name,
        phone: u.patient?.phone || '',
        age: u.patient?.age,
        gender: u.patient?.gender,
        status: u.status,
        isVerified: u.isVerified,
        activeRestriction: u.activeRestriction,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getBlocklistHistory = async (req, res, next) => {
  try {
    const { targetUserId, targetType, status } = req.query;
    const history = await adminBlocklistService.getBlocklistHistory({
      targetUserId,
      targetType,
      status,
    });
    res.json({
      success: true,
      history,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const logs = await adminBlocklistService.getAuditLogs({});
    res.json({
      success: true,
      logs,
    });
  } catch (err) {
    next(err);
  }
};
