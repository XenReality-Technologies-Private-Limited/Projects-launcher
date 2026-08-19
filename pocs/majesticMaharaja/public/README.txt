This folder is served statically by Vite.

Expected assets:
- kpi_results.db
- Remote videos served from CloudFront:
- https://d2uimaqek2eby3.cloudfront.net/reliance_demos/footfall_comp.mp4
- https://d2uimaqek2eby3.cloudfront.net/reliance_demos/apple_zone_comp.mp4

Database: public/kpi_results.db

Schema (rows ordered by time, one row per video second):

  footfall
  - id INTEGER PRIMARY KEY (optional; use ORDER BY id ASC or video_time ASC)
  - video_time TEXT
  - in_count TEXT  (JSON array of 3 numbers: [male, female, child], e.g. "[1,1,1]")

  trials (Apple Zone)
  - id INTEGER PRIMARY KEY (optional)
  - video_time TEXT
  - employee INTEGER/BOOLEAN  (0/1 or true/false: present/absent)
  - customer INTEGER  (number of customers in zone)
  - customer_id TEXT  (JSON array of customer IDs at this timestamp)
  - unique_customer TEXT  (JSON array of customer_id values that are new to the zone)

Videos (current setup uses remote URLs, not local files):
- https://d2uimaqek2eby3.cloudfront.net/reliance_demos/footfall_comp.mp4
- https://d2uimaqek2eby3.cloudfront.net/reliance_demos/apple_zone_comp.mp4
