import json
import os
import re

# Paths
DATA_DIR = r'C:\Users\Mandeep\Desktop\web scraping\Haryana_Roads_Pipeline\data\haryana'
MAPPINGS_DIR = os.path.join(DATA_DIR, 'mappings')
OFFICERS_DIR = os.path.join(DATA_DIR, 'officers')
ROADS_DIR = os.path.join(DATA_DIR, 'roads')

def clean_name(s):
    if not s: return ""
    return re.sub(r'[^A-Za-z\s\.]', '', s).strip()

def build():
    print("Building Master Hierarchy...")
    
    # 1. Load Road Data to find all active administrative units
    circles = set()
    divisions = set()
    
    # We only need a sample or a list of names to avoid loading 100MB in memory if possible
    # but let's try to get unique Circle/Div from the complete data
    road_data_path = os.path.join(ROADS_DIR, 'haryana_roads_data.json')
    with open(road_data_path, 'r', encoding='utf-8') as f:
        roads = json.load(f)
        for road in roads:
            attr = road.get('attributes', {})
            c = attr.get('CIRCLE_NAM', '').strip()
            d = attr.get('DIV_NAME', '').strip()
            if c: circles.add(c)
            if d: divisions.add(d)

    print(f"Found {len(circles)} Circles and {len(divisions)} Divisions in road data.")

    # 2. Load Officers from all sources
    all_officers = []
    
    # Source A: PWD Roads Officers (Verified names)
    path_a = os.path.join(OFFICERS_DIR, 'pwd_roads_officers.json')
    if os.path.exists(path_a):
        with open(path_a, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for o in data.get('officers_with_phones', []):
                all_officers.append({
                    'name': o['name'],
                    'designation': o['designation'],
                    'tier': o['tier'],
                    'mobile': o['mobile'],
                    'email': o.get('email', ''),
                    'phone': o.get('phone', ''),
                    'department': 'PWD (B&R)',
                    'circle': '', # To be matched
                    'division': '' # To be matched
                })

    # Source B: Officers Master
    path_b = os.path.join(OFFICERS_DIR, 'officers_master.json')
    if os.path.exists(path_b):
        with open(path_b, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for o in data:
                # Only add if name is not "Unknown" or if we don't have this designation yet
                if o['name'] != 'Unknown':
                    all_officers.append({
                        'name': o['name'],
                        'designation': o['designation'],
                        'tier': o.get('tier', ''),
                        'mobile': o.get('phone', ''),
                        'email': o['email'],
                        'phone': '',
                        'department': o['department'],
                        'circle': o['circle'],
                        'division': o['division']
                    })

    # 3. Create Lookups
    # Hierarchy Mapping:
    # L4: EIC, CE
    # L3: SE
    # L2: EE
    # L1: SDE, SDO, JE
    
    hierarchy = {
        'L4': [], # HQ
        'L3': {}, # Circle -> Officer
        'L2': {}, # Division -> Officer
        'L1': {}  # Road -> Officer (from road data)
    }

    def fuzzy_match(target, candidates):
        if not target: return None
        target_clean = re.sub(r'[^A-Z0-9]', '', target.upper())
        for c in candidates:
            c_clean = re.sub(r'[^A-Z0-9]', '', c.upper())
            if target_clean in c_clean or c_clean in target_clean:
                return c
        return None

    for o in all_officers:
        desig = o['designation'].upper()
        tier = o['tier']
        
        # HQ Officers (L4)
        if 'ENGINEER_IN_CHIEF' in desig or 'CHIEF_ENGINEER' in desig or 'EIC' in desig or 'CE' in desig:
            # Filter for Roads/NH/Bridges (Exclude Building if possible)
            context = (o['name'] + " " + o['designation'] + " " + o.get('division', '')).upper()
            if 'BUILDING' in context and 'ROAD' not in context:
                continue
            hierarchy['L4'].append(o)
            
        # Circle Officers (L3)
        elif 'SUPERINTENDING_ENGINEER' in desig or ' SE ' in desig or 'SE(' in desig:
            # Check if circle is in the officer object
            c_name = o.get('circle') or o.get('division') or ""
            if 'CIRCLE' in c_name.upper():
                hierarchy['L3'][c_name] = o
            else:
                # Try to extract from designation
                match = re.search(r'SE\s*[\(\-]?\s*([A-Z\s]+)', desig)
                if match:
                    hierarchy['L3'][match.group(1).strip()] = o

        # Division Officers (L2)
        elif 'EXECUTIVE_ENGINEER' in desig or ' EE ' in desig or 'EE(' in desig:
            d_name = o.get('division') or o.get('circle') or ""
            if 'DIV' in d_name.upper() or 'EE' in d_name.upper():
                hierarchy['L2'][d_name] = o
            else:
                match = re.search(r'EE\s*[\(\-]?\s*([A-Z\s]+)', desig)
                if match:
                    hierarchy['L2'][match.group(1).strip()] = o

    # 4. Save the processed mapping
    output = {
        'hq': hierarchy['L4'],
        'circles': hierarchy['L3'],
        'divisions': hierarchy['L2']
    }
    
    with open('master_officer_mapping.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=4)
        
    print(f"Built master mapping with {len(output['hq'])} HQ, {len(output['circles'])} Circle, and {len(output['divisions'])} Division officers.")

if __name__ == "__main__":
    build()
