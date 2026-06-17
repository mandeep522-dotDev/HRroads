import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Spatial Math Functions
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const delta_phi = ((lat2 - lat1) * Math.PI) / 180;
  const delta_lambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(delta_phi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(delta_lambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function distToSegment(p_lat: number, p_lon: number, v_lat: number, v_lon: number, w_lat: number, w_lon: number) {
  const x_p = p_lon * 96000, y_p = p_lat * 111000;
  const x_v = v_lon * 96000, y_v = v_lat * 111000;
  const x_w = w_lon * 96000, y_w = w_lat * 111000;

  const l2 = (x_w - x_v) ** 2 + (y_w - y_v) ** 2;
  if (l2 === 0) return Math.sqrt((x_p - x_v) ** 2 + (y_p - y_v) ** 2);

  let t = ((x_p - x_v) * (x_w - x_v) + (y_p - y_v) * (y_w - y_v)) / l2;
  t = Math.max(0, Math.min(1, t));

  const proj_x = x_v + t * (x_w - x_v);
  const proj_y = y_v + t * (y_w - y_v);

  return Math.sqrt((x_p - proj_x) ** 2 + (y_p - proj_y) ** 2);
}

// In-memory cache for the data
let roadsData: any = null;
let officersData: any = null;

function loadData() {
  if (!roadsData) {
    const roadsPath = path.join(process.cwd(), 'data/haryana_roads.geojson');
    const highwaysPath = path.join(process.cwd(), 'data/highways.geojson');
    
    roadsData = { type: "FeatureCollection", features: [] };
    
    if (fs.existsSync(roadsPath)) {
      const data = JSON.parse(fs.readFileSync(roadsPath, 'utf8'));
      roadsData.features = roadsData.features.concat(data.features);
    }
    
    if (fs.existsSync(highwaysPath)) {
      const data = JSON.parse(fs.readFileSync(highwaysPath, 'utf8'));
      roadsData.features = roadsData.features.concat(data.features);
    }
    
    console.log(`Loaded ${roadsData.features.length} roads into memory`);
  }
  if (!officersData) {
    const pwdOfficersPath = path.join(process.cwd(), 'data/hierarchical_officers.json');
    const nhaiOfficersPath = path.join(process.cwd(), 'data/nhai_officers.json');
    
    officersData = [];
    if (fs.existsSync(pwdOfficersPath)) {
      officersData = officersData.concat(JSON.parse(fs.readFileSync(pwdOfficersPath, 'utf8')));
    }
    if (fs.existsSync(nhaiOfficersPath)) {
      officersData = officersData.concat(JSON.parse(fs.readFileSync(nhaiOfficersPath, 'utf8')));
    }
  }
}

export async function POST(request: Request) {
  try {
    const { latitude, longitude } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json({ status: "INVALID_COORDINATES" }, { status: 400 });
    }

    if (latitude < 27.6 || latitude > 30.9 || longitude < 74.4 || longitude > 77.6) {
      return NextResponse.json({ status: "OUTSIDE_HARYANA" }, { status: 400 });
    }

    loadData();

    if (!roadsData || !officersData) {
      return NextResponse.json({ status: "ERROR", message: "System data not initialized." }, { status: 500 });
    }
    
    console.log(`System Initialized: ${roadsData.features.length} roads, ${officersData.length} officers`);

    const startTime = performance.now();
    let min_dist = Infinity;
    let closest_road: any = null;

    // Search nearest road
    for (const feature of roadsData.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      let lines = [];
      if (geom.type === "LineString") lines = [geom.coordinates];
      else if (geom.type === "MultiLineString") lines = geom.coordinates;
      else continue;

      for (const coords of lines) {
        for (let i = 0; i < coords.length - 1; i++) {
          const [v_lon, v_lat] = coords[i];
          const [w_lon, w_lat] = coords[i + 1];
          const d = distToSegment(latitude, longitude, v_lat, v_lon, w_lat, w_lon);
          if (d < min_dist) {
            min_dist = d;
            closest_road = feature.properties;
          }
        }
      }
    }
    const roadLookupTime = performance.now() - startTime;

    if (!closest_road || min_dist > 100) {
      return NextResponse.json({ status: "ROAD_NOT_FOUND" }, { status: 404 });
    }

    // Search officers
    const offStartTime = performance.now();
    const targetDept = closest_road.DEPT_NAME?.toLowerCase() || 'pwd';
    const targetDistrict = closest_road.DIST_NAME?.toLowerCase() || '';
    const targetCircle = closest_road.CIRCLE_NAM?.toLowerCase() || '';
    const targetDivision = closest_road.DIV_NAME?.toLowerCase() || '';
    
    console.log(`Matching officers for Dept: ${targetDept}, District: ${targetDistrict}, Circle: ${targetCircle}, Div: ${targetDivision}`);

    const officers: any = { L1: null, L2: null, L3: null, L4: null };

    // Set L1 directly from the road's ground-truth metadata
    officers['L1'] = {
      name: closest_road.DISPLAY_NA || "Local Engineer",
      designation: "Field Officer (L1)",
      email: closest_road.MAILID || "",
      phone: "",
      mobile: closest_road.MOBILE || "",
      tier: "L1",
      circle: closest_road.CIRCLE_NAM || "",
      division: closest_road.DIV_NAME || "",
      district: closest_road.DIST_NAME || ""
    };

    const fuzzyMatch = (a: string, b: string) => {
      if (!a || !b) return false;
      const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const ca = clean(a);
      const cb = clean(b);
      return ca.includes(cb) || cb.includes(ca);
    };

    // Helper to find officer by tier and location
    const findOfficer = (tierLevel: string, locationMatch: (o: any) => boolean) => {
      const candidates = officersData.filter((o: any) => {
        const oDept = (o.authority_type || o.department || '').toLowerCase();
        const isOfficerNhai = oDept.includes('nhai');
        
        // Check tier level strictly unless it's missing
        if (o.tier && o.tier !== tierLevel) return false;
        
        // NHAI specific matching
        const isTargetNhai = targetDept.includes('nhai') || targetDept.includes('national highway');
        
        if (isTargetNhai !== isOfficerNhai) return false;
        
        let deptMatch = oDept.includes(targetDept) || targetDept.includes(oDept) || (isTargetNhai && isOfficerNhai);
        if (!deptMatch) return false;

        // Exclude Buildings for roads
        const searchStr = ((o.name || "") + " " + (o.designation || "") + " " + (o.email || "")).toLowerCase();
        if (searchStr.includes('building') && !searchStr.includes('road')) return false;

        const match = locationMatch(o);
        if (isOfficerNhai && !match && o.email?.includes('piu')) {
           // console.log(`  NHAI miss: ${o.email} vs roadMail=${closest_road.MAILID}`);
        }
        return match;
      });
      return candidates.length > 0 ? candidates[0] : null;
    };

    let sde = null, ee = null, se = null;
    const isNhai = targetDept.includes('nhai') || targetDept.includes('national highway');

    if (isNhai) {
      console.log(`NHAI Matching: targetDistrict=${targetDistrict}, roadMail=${closest_road.MAILID}`);
      // For NHAI, use email parsing (e.g. piuambala) or district match
      const nhaiMatch = (o: any) => {
        const email = (o.email || '').toLowerCase();
        const roadMail = (closest_road.MAILID || '').toLowerCase();
        const piuName = roadMail.split('@')[0].replace(/[^a-z]/g, ''); // piuambala

        const match = (piuName && email.includes(piuName)) || 
               (targetDistrict && email.includes(targetDistrict)) || 
               fuzzyMatch(o.district, targetDistrict);

        if (match) console.log(`  Candidate Match: ${o.name} (${o.designation}) - ${o.email}`);
        return match;
      };

      // NHAI L4: RO (Regional Officer) or CGM
      se = findOfficer('L4', (o: any) => (o.email || '').toLowerCase().includes('rochandigarh'));
      if (!se) se = findOfficer('L4', nhaiMatch);

      // NHAI L3: PD (Project Director)
      ee = findOfficer('L3', nhaiMatch);
      if (!ee) ee = findOfficer('L2', (o: any) => (o.designation || '').includes('Project Director') && nhaiMatch(o));
      if (!ee) ee = findOfficer('L4', (o: any) => (o.designation || '').includes('Project Director') && nhaiMatch(o));

      // NHAI L2: DGM/Manager
      sde = findOfficer('L2', (o: any) => !(o.designation || '').includes('Project Director') && nhaiMatch(o));
    } else {

      // Map the remaining hierarchy based on the parsed PDF database
      // L2 = SDE (Sub-Division / District level)
      sde = findOfficer('L2', (o) => fuzzyMatch(o.division, targetDivision) || fuzzyMatch(o.district, targetDistrict));
      
      // L3 = EE (Division level)
      ee = findOfficer('L3', (o) => fuzzyMatch(o.division, targetDivision) || fuzzyMatch(o.circle, targetCircle));
      
      // L4 = SE / CE (Circle / HQ level)
      se = findOfficer('L4', (o) => fuzzyMatch(o.circle, targetCircle));
      if (!se) se = findOfficer('L4', (o) => fuzzyMatch(o.district, targetDistrict));
      if (!se) se = findOfficer('L4', (o) => o.district === 'Haryana');
    }

    if (sde) officers['L2'] = { ...sde, tier: 'L2' };
    if (ee) officers['L3'] = { ...ee, tier: 'L3' };
    if (se) officers['L4'] = { ...se, tier: 'L4' };

    const officerLookupTime = performance.now() - offStartTime;
    console.log(`Found officers: L1: ${!!officers.L1}, L2: ${!!officers.L2}, L3: ${!!officers.L3}, L4: ${!!officers.L4}`);

    return NextResponse.json({
      road: {
        road_id: closest_road.ROAD_ID,
        road_name: closest_road.ROAD_NAME,
        road_category: closest_road.ROAD_CATEG,
        road_type: closest_road.ROAD_TYPE,
      },
      authority: {
        department: closest_road.DEPT_NAME,
        district: closest_road.DIST_NAME,
        circle: closest_road.CIRCLE_NAM,
        division: closest_road.DIV_NAME,
        subdivision: "",
      },
      officers,
      debug: {
        match_distance_meters: Math.round(min_dist),
        road_lookup_ms: Math.round(roadLookupTime),
        officer_lookup_ms: Math.round(officerLookupTime)
      }
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ status: "ERROR", message: error.message }, { status: 500 });
  }
}
