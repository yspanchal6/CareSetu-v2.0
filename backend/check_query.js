const prisma = require('./src/config/prisma');

async function check() {
  const latitude = 23.0225;
  const longitude = 72.5714;
  const radiusMeters = 2000;
  
  const h = await prisma.$queryRaw`
      SELECT *,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${parseFloat(longitude)}, ${parseFloat(latitude)}), 4326)::geography
        ) as "distanceMeters"
      FROM hospitals
      WHERE "emergencyAvailable" = true
      AND location->>'longitude' IS NOT NULL
      AND location->>'latitude' IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${parseFloat(longitude)}, ${parseFloat(latitude)}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY "distanceMeters" ASC
  `;
  console.log(h);
  await prisma.$disconnect();
}
check();
