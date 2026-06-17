import json
import psycopg2
from psycopg2.extras import execute_batch
import os

DB_URI = "postgresql://postgres.jirshlhcthallntqfira:AnkiMan%40522@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

def migrate():
    print("Connecting to Supabase...")
    conn = psycopg2.connect(DB_URI)
    cur = conn.cursor()

    print("Enabling PostGIS...")
    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    print("Creating tables...")
    cur.execute("""
    DROP TABLE IF EXISTS officers;
    CREATE TABLE officers (
        id SERIAL PRIMARY KEY,
        authority_type TEXT,
        department TEXT,
        district TEXT,
        circle TEXT,
        division TEXT,
        name TEXT,
        designation TEXT,
        email TEXT,
        phone TEXT,
        mobile TEXT,
        tier TEXT
    );
    """)

    cur.execute("""
    DROP TABLE IF EXISTS haryana_roads;
    CREATE TABLE haryana_roads (
        id SERIAL PRIMARY KEY,
        road_id TEXT,
        road_name TEXT,
        road_categ TEXT,
        road_type TEXT,
        dept_name TEXT,
        dist_name TEXT,
        source TEXT,
        geom GEOMETRY(Geometry, 4326)
    );
    """)

    print("Loading officers data...")
    officers = []
    for filename in ['data/hierarchical_officers.json', 'data/nhai_officers.json']:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                officers.extend(json.load(f))
    
    officers_data = []
    for o in officers:
        officers_data.append((
            o.get('authority_type', ''),
            o.get('department', ''),
            o.get('district', ''),
            o.get('circle', ''),
            o.get('division', ''),
            o.get('name', ''),
            o.get('designation', ''),
            o.get('email', ''),
            o.get('phone', ''),
            o.get('mobile', ''),
            o.get('tier', '')
        ))

    print(f"Inserting {len(officers_data)} officers...")
    execute_batch(cur, """
        INSERT INTO officers (authority_type, department, district, circle, division, name, designation, email, phone, mobile, tier)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, officers_data)

    print("Loading roads data... (This may take a minute)")
    roads_data = []
    for filename in ['data/haryana_roads.geojson', 'data/highways.geojson']:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                fc = json.load(f)
                for feature in fc.get('features', []):
                    props = feature.get('properties', {})
                    geom = feature.get('geometry')
                    if not geom: continue
                    
                    roads_data.append((
                        str(props.get('ROAD_ID', '')),
                        str(props.get('ROAD_NAME', '')),
                        str(props.get('ROAD_CATEG', '')),
                        str(props.get('ROAD_TYPE', '')),
                        str(props.get('DEPT_NAME', '')),
                        str(props.get('DIST_NAME', '')),
                        str(props.get('source', '')),
                        json.dumps(geom)
                    ))
    
    print(f"Inserting {len(roads_data)} roads into PostGIS...")
    execute_batch(cur, """
        INSERT INTO haryana_roads (road_id, road_name, road_categ, road_type, dept_name, dist_name, source, geom)
        VALUES (%s, %s, %s, %s, %s, %s, %s, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
    """, roads_data, page_size=1000)

    print("Creating spatial index for super-fast lookups...")
    cur.execute("CREATE INDEX idx_haryana_roads_geom ON haryana_roads USING GIST(geom);")

    conn.commit()
    cur.close()
    conn.close()
    print("Migration Complete!")

if __name__ == "__main__":
    migrate()
