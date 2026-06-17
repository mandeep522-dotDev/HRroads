const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'haryana_civic',
  password: 'password',
  port: 5432,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Starting Database Seeding...");

    // 1. Seed Officers
    const officersPath = path.join(__dirname, '../../civic_scraper/data/haryana/mappings/hierarchical_officers.json');
    if (fs.existsSync(officersPath)) {
      console.log("Found officers JSON. Seeding officers_master_haryana...");
      const officersData = JSON.parse(fs.readFileSync(officersPath, 'utf8'));
      
      let count = 0;
      for (const officer of officersData) {
        // Simplified division parsing: assume division name comes after 'Division' or from auth type.
        // For PWD_2003, division is "Division Kurukshetra P-1". We will rely on existing district for now.
        // Since we don't have all exact division matchings in the scraped json, we seed what we have.
        await client.query(`
          INSERT INTO officers_master_haryana 
          (officer_id, name, designation, email, phone, department, district, hierarchy_level)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (officer_id) DO NOTHING
        `, [
          `OFF_${count++}`, 
          officer.name, 
          officer.designation, 
          officer.email, 
          officer.mobile, 
          officer.authority_type, 
          officer.district, 
          officer.tier
        ]);
      }
      console.log(`Seeded ${count} officers.`);
    }

    // 2. Seed Roads
    const roadsPath = path.join(__dirname, '../../civic_scraper/data/haryana/roads/haryana_roads.geojson');
    if (fs.existsSync(roadsPath)) {
      console.log("Found roads GeoJSON. Seeding roads_master_haryana...");
      const geojsonData = JSON.parse(fs.readFileSync(roadsPath, 'utf8'));
      
      let count = 0;
      for (const feature of geojsonData.features) {
        if (!feature.geometry) continue;

        const props = feature.properties;
        const geom = JSON.stringify(feature.geometry);

        // Convert GeoJSON geometry to PostGIS GEOMETRY
        await client.query(`
          INSERT INTO roads_master_haryana 
          (road_id, road_name, road_category, road_type, authority, department, district, circle, division, geometry)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_GeomFromGeoJSON($10))
          ON CONFLICT (road_id) DO NOTHING
        `, [
          props.ROAD_ID || `temp_${count}`,
          props.ROAD_NAME,
          props.ROAD_CATEG,
          props.ROAD_TYPE,
          props.ENC_USERID,
          props.DEPT_NAME,
          props.DIST_NAME,
          props.CIRCLE_NAM,
          props.DIV_NAME,
          geom
        ]);
        count++;
        if (count % 1000 === 0) console.log(`Inserted ${count} roads...`);
      }
      console.log(`Seeded ${count} roads.`);
    }

    console.log("Seeding Complete!");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
