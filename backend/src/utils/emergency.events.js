const { getIo } = require('../utils/socket');

/**
 * Emit a real-time emergency event to a user's socket room.
 * Emits to both the bare userId room and the user:{userId} room for
 * compatibility with existing listeners.
 */
function emitToUser(userId, event, payload) {
  if (!userId) return;
  let io = null;
  try {
    io = getIo();
  } catch (err) {
    console.warn(`[EmergencyEvents] Socket.IO not available — skipping ${event}`);
    return;
  }
  io.to(userId).to(`user:${userId}`).emit(event, payload);
}

/**
 * Emit an event to every socket connected to a hospital's room.
 */
function emitToHospital(hospitalUserId, event, payload) {
  if (!hospitalUserId) return;
  let io = null;
  try {
    io = getIo();
  } catch (err) {
    console.warn(`[EmergencyEvents] Socket.IO not available — skipping ${event}`);
    return;
  }
  io.to(`hospital:${hospitalUserId}`).to(`hospitalId:${hospitalUserId}`).to(hospitalUserId).emit(event, payload);
}

function emitToCaseRoom(caseId, event, payload) {
  if (!caseId) return;
  let io = null;
  try {
    io = getIo();
  } catch (err) {
    return;
  }
  io.to(`case:${caseId}`).to(caseId).emit(event, payload);
}

module.exports = { emitToUser, emitToHospital, emitToCaseRoom };