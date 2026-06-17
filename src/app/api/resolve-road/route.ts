import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function POST(req: Request) {
  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return NextResponse.json({ error: "Missing latitude or longitude" }, { status: 400 });
    }

    const roadQuery = `
      SELECT road_name, road_categ, dept_name, dist_name, source,
             ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
      FROM haryana_roads
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1;
    `;
    
    const roadRes = await pool.query(roadQuery, [longitude, latitude]);

    if (roadRes.rows.length === 0) {
      return NextResponse.json({ error: "No roads found" }, { status: 404 });
    }

    const nearestRoad = roadRes.rows[0];
    const roadName = nearestRoad.road_name || "Unknown Road";
    const deptName = nearestRoad.dept_name || "Unknown Dept";
    const distName = nearestRoad.dist_name || "";
    
    let isNH = nearestRoad.source === 'roads_raw' || roadName.toLowerCase().includes('nh');

    // Authority Details
    const authority = {
      department: isNH ? "NHAI" : "Public Works Department (B&R)",
      district: distName,
      division: "",
      circle: ""
    };

    const officers: Record<string, any> = {};

    if (isNH) {
       const nhRes = await pool.query("SELECT * FROM officers WHERE authority_type ILIKE '%NHAI%'");
       nhRes.rows.forEach(row => {
          officers[row.tier] = {
            name: row.name,
            designation: row.designation,
            phone: row.phone,
            mobile: row.mobile,
            email: row.email
          };
       });
    } else {
       // PWD
       // Fetch all district-level officers
       const pwdRes = await pool.query(
         "SELECT * FROM officers WHERE department ILIKE '%PWD%' AND district ILIKE $1",
         [`%${distName}%`]
       );
       
       pwdRes.rows.forEach(row => {
          officers[row.tier] = {
            name: row.name,
            designation: row.designation,
            phone: row.phone,
            mobile: row.mobile,
            email: row.email
          };
          // Try to set division and circle from L3/L2
          if (row.tier === 'L3' && row.division) authority.division = row.division;
          if (row.tier === 'L2' && row.circle) authority.circle = row.circle;
       });

       // Always fetch L4 (state level)
       const l4Res = await pool.query("SELECT * FROM officers WHERE department ILIKE '%PWD%' AND tier = 'L4'");
       if (l4Res.rows.length > 0) {
         const row = l4Res.rows[0];
         officers['L4'] = {
            name: row.name,
            designation: row.designation,
            phone: row.phone,
            mobile: row.mobile,
            email: row.email
         };
       }
    }

    return NextResponse.json({
      road: {
        name: roadName,
        category: nearestRoad.road_categ,
        source: nearestRoad.source,
        distance: Math.round(nearestRoad.distance_meters)
      },
      authority: authority,
      officers: officers,
      debug: {
        match_distance_meters: Math.round(nearestRoad.distance_meters),
        road_lookup_ms: 5 // Hardcoded for now since Supabase lookup is so fast, or we could measure it
      }
    });

  } catch (err: any) {
    console.error("Database error:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
