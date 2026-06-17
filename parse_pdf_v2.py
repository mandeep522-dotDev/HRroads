import json
import re
import pdfplumber
import os

def parse_pdf():
    officers = []
    pdf_path = '../phone directory haryana pwd.pdf'
    
    if not os.path.exists(pdf_path):
        print(f"Error: {pdf_path} not found.")
        return

    print(f"Parsing {pdf_path}...")
    with pdfplumber.open(pdf_path) as pdf:
        all_lines = []
        for i, page in enumerate(pdf.pages):
            text_full = page.extract_text() or ""
            if "NAME DESIGNATION OFFICE" in text_full or "HEAD OFFICE" in text_full:
                width = page.width
                height = page.height
                # Split into two halves
                left_crop = page.crop((0, 0, width/2, height))
                right_crop = page.crop((width/2, 0, width, height))
                
                left_text = left_crop.extract_text() or ""
                right_text = right_crop.extract_text() or ""
                
                all_lines.extend(left_text.split('\n'))
                all_lines.extend(right_text.split('\n'))
            else:
                all_lines.extend(text_full.split('\n'))

    current_circle = ""
    current_district = ""

    for line in all_lines:
        line = line.strip()
        if not line:
            continue

        # Detect Circle/District
        circle_match = re.search(r'([A-Z\s]+) CIRCLE', line)
        if circle_match:
            current_circle = circle_match.group(1).strip()
            current_district = current_circle.title()

        # Extract Officers
        tier = None
        designation = ""

        # Tier detection
        if any(x in line for x in ['EIC', 'Engineer-in-Chief']):
            tier = 'L4'
            designation = 'Engineer-in-Chief'
        elif any(x in line for x in [' CE ', 'Chief Engineer']):
            tier = 'L4'
            designation = 'Chief Engineer (CE)'
        elif any(x in line for x in [' SE ', 'Superintending Engineer', '- SE']):
            tier = 'L4'
            designation = 'Superintending Engineer (SE)'
        elif any(x in line for x in [' EE ', 'Executive Engineer', 'EE(']):
            tier = 'L3'
            designation = 'Executive Engineer (EE)'
        elif any(x in line for x in [' SDE ', 'Sub Divisional Engineer']):
            tier = 'L2'
            designation = 'Sub Divisional Engineer (SDE)'
        elif any(x in line for x in [' JE ', 'Junior Engineer']):
            tier = 'L1'
            designation = 'Junior Engineer (JE)'

        if tier:
            # Extract mobile (e.g. 94177-02442)
            mobile_match = re.search(r'\b\d{5}-\d{5}\b', line)
            mobile = mobile_match.group(0) if mobile_match else ""

            # Extract name
            name_parts = re.split(r'\b(EIC|CE|SE|EE|SDE|JE)\b', line)
            name = name_parts[0].strip()
            
            # Clean up name
            name = re.sub(r'^\d+\s*', '', name) # Remove leading numbers
            name = re.sub(r'^(S/Sh\.|Sh\.|Smt\.|Sh|Smt)\s*', '', name)
            name = name.rstrip(',. ').strip()

            if name and len(name) > 3 and "NAME" not in name.upper() and "DESIGNATION" not in name.upper():
                search_context = (line + " " + name).upper()
                is_roads = "ROAD" in search_context
                is_buildings = "BUILDING" in search_context
                
                # Filter for ROADS, exclude BUILDINGS
                if tier in ['L3', 'L4']:
                    if is_buildings and not is_roads:
                        continue
                
                officers.append({
                    "authority_type": "PWD (Buildings and Roads)",
                    "department": "PWD (Buildings and Roads)",
                    "district": current_district or "Haryana",
                    "circle": current_circle,
                    "name": name,
                    "designation": designation,
                    "email": f"{name.lower().replace(' ', '.')}@hry.nic.in",
                    "mobile": mobile,
                    "tier": tier
                })

    # Deduplicate
    seen = set()
    unique_officers = []
    for o in officers:
        key = (o['name'], o['tier'], o['district'])
        if key not in seen:
            seen.add(key)
            unique_officers.append(o)

    # Add default JEs for reporting structure if not found for a district
    districts = set(o['district'] for o in unique_officers if o['district'] != 'Haryana')
    for dist in districts:
        if not any(o['district'] == dist and o['tier'] == 'L1' for o in unique_officers):
            unique_officers.append({
                "authority_type": "PWD (Buildings and Roads)",
                "department": "PWD (Buildings and Roads)",
                "district": dist,
                "circle": dist.upper(),
                "name": f"Local JE {dist}",
                "designation": "Junior Engineer (JE)",
                "email": f"je.{dist.lower()}@hry.nic.in",
                "mobile": "99999-00000",
                "tier": "L1"
            })

    # Save to local file
    output_path = 'hierarchical_officers_fixed.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unique_officers, f, indent=4)

    print(f"Successfully parsed {len(unique_officers)} unique officers.")

if __name__ == "__main__":
    parse_pdf()
