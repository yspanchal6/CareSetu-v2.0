# PostGIS Documentation

This folder documents how CareSetu uses PostGIS for geographical tracking and hospital matching.

## PostGIS Purpose
CareSetu requires spatial queries to find the nearest hospitals with emergency capabilities when an SOS is triggered. PostGIS extends PostgreSQL with spatial data types and functions to perform these calculations accurately on a spherical earth (using Geography/WGS 84).

## Current Version
- PostGIS 3.4 (Running inside the `caresetu-db` Docker container)

## Current CareSetu Location Representation
**IMPORTANT:** The current CareSetu database schema stores coordinates natively as standard PostgreSQL `JSON` columns, NOT as PostGIS `Geography` columns.

Example JSON stored in `location` column:
```json
{
  "latitude": 23.0225,
  "longitude": 72.5714
}
```

## How PostGIS is Used
Because the database stores JSON, CareSetu extracts the `latitude` (Y) and `longitude` (X) values at query time and dynamically casts them into PostGIS `Geography` points using:

- `ST_MakePoint(longitude, latitude)`: Creates a geometric point. Note that PostGIS expects Longitude (X) first, then Latitude (Y).
- `ST_SetSRID(point, 4326)`: Sets the Spatial Reference System Identifier to 4326 (WGS 84).
- `ST_Distance(point1, point2)`: Calculates the shortest distance in meters between two geography points.
- `ST_DWithin(point1, point2, radius)`: Checks if two geography points are within a specified distance (in meters).
