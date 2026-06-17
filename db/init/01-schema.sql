-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create Roads Master Table
CREATE TABLE roads_master_haryana (
    id SERIAL PRIMARY KEY,
    road_id VARCHAR(255) UNIQUE NOT NULL,
    road_name VARCHAR(255),
    road_category VARCHAR(100),
    road_type VARCHAR(100),
    authority VARCHAR(100),
    department VARCHAR(100),
    district VARCHAR(100),
    circle VARCHAR(100),
    division VARCHAR(100),
    subdivision VARCHAR(100),
    geometry GEOMETRY(LineString, 4326)
);

-- Create Spatial Index
CREATE INDEX idx_roads_master_haryana_geom ON roads_master_haryana USING GIST(geometry);

-- Create Officers Master Table
CREATE TABLE officers_master_haryana (
    id SERIAL PRIMARY KEY,
    officer_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    department VARCHAR(100),
    district VARCHAR(100),
    circle VARCHAR(100),
    division VARCHAR(100),
    subdivision VARCHAR(100),
    hierarchy_level VARCHAR(10) CHECK (hierarchy_level IN ('L1', 'L2', 'L3', 'L4', 'UNKNOWN'))
);

-- Create Index for fast lookups
CREATE INDEX idx_officers_hierarchy ON officers_master_haryana(department, district, circle, division, hierarchy_level);
