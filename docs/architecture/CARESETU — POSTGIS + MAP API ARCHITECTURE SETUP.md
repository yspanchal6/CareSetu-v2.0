┌──────────────────────────────────────────────────────────────┐
│                    HOSPITAL REGISTRATION FLOW                                   │
├──────────────────────────────────────────────────────────────┤
│                                                                		  │
│  Frontend Form (address, city, state, pincode)                 		  │
│         ↓                                                      		  │
│  Backend receives request                                     		  │
│         ↓                                                      		  │
│  ┌──────────────────────────────────────┐                     	  │
│  │  MAP API (Geocoding) — ADDRESS→LAT/LNG 	      │	                          │
│  │  Try in order:                         	      │	                          │
│  │  1. Mappls (if key works)              	      │	                          │
│  │  2. Nominatim (free, always works)     	      │	                          │
│  │  3. Local fallback (4 Gujarat cities)  	      │	                          │
│  └──────────────────────────────────────┘                     	  │
│         ↓                                                      	          │
│  Coordinate validation                                                          │
│         ↓                                                                       │
│  ┌──────────────────────────────────────┐                           │
│  │  POSTGIS (Storage + Spatial Queries)            │                           │
│  │  Store: ST_MakePoint(lng, lat)::geography       │     			  │
│  │  Index: GIST index on location                  │                           │
│  └──────────────────────────────────────┘                           │
│         ↓                                                                       │
│  Hospital record created with location                                          │
│                                                                                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              PATIENT SOS → HOSPITAL MATCHING FLOW              		  │
├──────────────────────────────────────────────────────────────┤
│                                                                		  │
│  Patient presses SOS with (lat, lng)                           		  │
│         ↓                                                      		  │
│  EmergencyCase created                                         		  │
│         ↓                                                      		  │
│  ┌──────────────────────────────────────┐                     	  │
│  │  POSTGIS Progressive Search           	      │         		  │
│  │  Radius: 2 → 4 → 8 → 16 → 32 → 64 km  	      │                           │
│  │  Query: ST_DWithin(location, point, radius)     │                           │
│  │  Sort: ST_Distance() ASC               	      │                           │
│  │  Filter: emergencyCapable, capability  	      │                           │
│  └──────────────────────────────────────┘                           │
│         ↓                                                                       │
│  Return ranked hospitals                                                        │
│                                                                                 │
│  ⚠️ NO MAP API CALL DURING SOS — PostGIS handles everything                     │
│                                                                                 │
└──────────────────────────────────────────────────────────────┘