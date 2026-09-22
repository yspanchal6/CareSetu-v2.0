const settingsService = require('../services/settings.service');

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await settingsService.getProfile(req.user.userId);
    res.json({
      success: true,
      data: profile,
      profile, // Compatibility
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const updated = await settingsService.updateProfile(req.user.userId, req.body);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
      profile: updated,
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const result = await settingsService.updatePassword(req.user.userId, req.body);
    res.json({
      success: true,
      message: result.message,
      ...(result.token ? { token: result.token } : {}),
    });
  } catch (err) {
    next(err);
  }
};

exports.updateNotifications = async (req, res, next) => {
  try {
    const result = await settingsService.updateNotifications(req.user.userId, req.body);
    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences: result.notificationPreferences,
    });
  } catch (err) {
    next(err);
  }
};

const credentialUpdateService = require('../services/credential-update.service');

exports.requestCredentialChange = async (req, res, next) => {
  try {
    const { currentPassword, type, newValue } = req.body;
    const result = await credentialUpdateService.requestCredentialChange({
      userId: req.user.userId,
      currentPassword,
      type,
      newValue,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.verifyCredentialOtp = async (req, res, next) => {
  try {
    const { requestId, type, otp } = req.body;
    const result = await credentialUpdateService.verifyCredentialChange({
      userId: req.user.userId,
      requestId,
      type,
      otp,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.cancelCredentialChange = async (req, res, next) => {
  try {
    const { requestId, type } = req.body;
    const result = await credentialUpdateService.cancelCredentialChange({
      userId: req.user.userId,
      requestId,
      type,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
