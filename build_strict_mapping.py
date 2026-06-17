import json
import os
import re

DATA_DIR = r'pipeline_data/haryana'
OFFICERS_DIR = os.path.join(DATA_DIR, 'officers')

def load_json(filename):
    path = os.path.join(OFFICERS_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def clean_str(s):
    if not s: return ""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

def main():
    print("Building strict mapping from provided files...")
    
    pwd = load_json('pwd_roads_officers.json')
    master = load_json('officers_master.json')
    nhai = load_json('nhai_officers.json')
    
    officers = []
    
    # 1. Load highly trusted PWD officers
    if pwd:
        for o in pwd.get('officers_with_phones', []):
            officers.append({
                'name': o['name'],
                'designation': o['designation'],
                'tier': o['tier'], # usually 'EE', 'SE', 'CE', 'EIC'
                'mobile': o['mobile'],
                'email': o.get('email', ''),
                'phone': o.get('phone', ''),
                'department': o.get('department', 'Haryana PWD B&R'),
                'circle': o.get('circle', ''),
                'division': o.get('division', '')
            })
            
    # 2. Load Master officers
    if master:
        for o in master:
            if o['name'] != 'Unknown' and o['name'] != 'Vacant':
                tier = ""
                desig = o['designation'].upper()
                if 'EIC' in desig or 'ENGINEER_IN_CHIEF' in desig: tier = 'EIC'
                elif 'CE' in desig or 'CHIEF_ENGINEER' in desig: tier = 'CE'
                elif 'SE' in desig or 'SUPERINTENDING' in desig: tier = 'SE'
                elif 'EE' in desig or 'EXECUTIVE' in desig: tier = 'EE'
                elif 'SDE' in desig or 'SDO' in desig or 'SUB DIVISIONAL' in desig: tier = 'SDE'
                
                if not tier:
                    tier = o.get('tier', '')
                
                officers.append({
                    'name': o['name'],
                    'designation': o['designation'],
                    'tier': tier,
                    'mobile': o.get('phone', ''),
                    'email': o.get('email', ''),
                    'phone': '',
                    'department': o.get('department', ''),
                    'circle': o.get('circle', ''),
                    'division': o.get('division', ''),
                    'district': o.get('district', '')
                })

    # 3. Load NHAI officers
    if nhai:
        for o in nhai:
            if o['name'] and o['name'] != 'Unknown':
                officers.append({
                    'name': o['name'],
                    'designation': o['designation'],
                    'tier': 'CE', # Map NHAI Regional/CGM to L4
                    'mobile': o.get('mobile', ''),
                    'email': o.get('email', ''),
                    'phone': o.get('office_telephone', ''),
                    'department': 'NHAI',
                    'circle': '',
                    'division': ''
                })

    # Build Index
    index = {
        'L4': [], # EIC, CE
        'L3': [], # SE
        'L2': [], # EE
    }
    
    seen = set()
    
    for o in officers:
        tier = o['tier']
        
        # Determine strict tier
        mapped_tier = None
        desig_upper = o['designation'].upper()
        if tier in ['EIC', 'CE', 'L4'] or 'ENGINEER_IN_CHIEF' in desig_upper or 'CHIEF_ENGINEER' in desig_upper or 'EIC' in desig_upper or ' CE ' in desig_upper or 'CE(' in desig_upper: 
            mapped_tier = 'L4'
        elif tier in ['SE', 'L3'] or 'SUPERINTENDING' in desig_upper or ' SE ' in desig_upper or 'SE(' in desig_upper or '- SE' in desig_upper: 
            mapped_tier = 'L3'
        elif tier in ['EE', 'L2'] or 'EXECUTIVE' in desig_upper or ' EE ' in desig_upper or 'EE(' in desig_upper or 'EE,' in desig_upper: 
            mapped_tier = 'L2'
        
        if not mapped_tier: continue
        
        # Deduplicate
        key = f"{o['name']}_{o['designation']}_{mapped_tier}"
        if key in seen: continue
        seen.add(key)
        
        entry = {
            'name': o['name'],
            'designation': o['designation'],
            'email': o['email'],
            'mobile': o['mobile'],
            'phone': o['phone'],
            'department': o['department'],
            'search_text': clean_str(o['designation'] + " " + o['department'] + " " + o.get('circle', '') + " " + o.get('division', '') + " " + o.get('district', ''))
        }
        
        index[mapped_tier].append(entry)

    with open('src/app/api/resolve-road/strict_officers_index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=4)
        
    print(f"Generated strict index: L4={len(index['L4'])}, L3={len(index['L3'])}, L2={len(index['L2'])}")

if __name__ == "__main__":
    main()
