const prisma = require('./src/config/prisma.js');

async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT PostGIS_Version();`;
    console.log("PostGIS version:", res);
  } catch (err) {
    console.error("Error querying PostGIS:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
