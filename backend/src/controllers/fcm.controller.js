const prisma = require('../config/prisma');

const registerToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.userId;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Upsert the token
    const fcmToken = await prisma.fcmToken.upsert({
      where: { token },
      update: {
        userId,
        platform,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        token,
        userId,
        platform,
        isActive: true,
      },
    });

    res.status(200).json({ success: true, message: 'Token registered successfully' });
  } catch (error) {
    console.error('[FCM_CONTROLLER] Error registering token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deactivateToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    await prisma.fcmToken.updateMany({
      where: { token },
      data: { isActive: false },
    });

    res.status(200).json({ success: true, message: 'Token deactivated successfully' });
  } catch (error) {
    console.error('[FCM_CONTROLLER] Error deactivating token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  registerToken,
  deactivateToken,
};
