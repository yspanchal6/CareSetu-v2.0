const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const app = require('./app');
const prisma = require('./config/prisma');
const logger = require('./utils/logger');
const { initSocket } = require('./utils/socket');
const { startHospitalTimeoutSweeper, cleanupStaleRequests } = require('./services/hospital-timeout.service');
const registrationCleanupService = require('./services/registration-cleanup.service');

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully.');

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check endpoint: http://localhost:${PORT}/health`);
    });

    await cleanupStaleRequests();
    startHospitalTimeoutSweeper();
    registrationCleanupService.startSweeper();

    // Graceful Shutdown Handler
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await prisma.$disconnect();
          logger.info('Database connection pool disconnected.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during database disconnection:', { error: err.message });
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown takes too long (10 seconds timeout)
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing termination.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main();