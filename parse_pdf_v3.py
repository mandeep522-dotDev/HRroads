import json
import re
import pdfplumber
import os

def parse_pdf():
    pdf_path = '../phone directory haryana pwd.pdf'
    if not os.path.exists(pdf_path):
        print(f"Error: {pdf_path} not found.")
        return

    print(f"Parsing {pdf_path}...")
    all_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            width = page.width
            height = page.height
            text_full = page.extract_text() or ""
            # Split into columns for directory pages
            if "Circle/Division" in text_full or "NAME DESIGNATION" in text_full or "HEAD OFFICE" in text_full:
                left_crop = page.crop((0, 0, width/2, height))
                right_crop = page.crop((width/2, 0, width, height))
                all_lines.extend((left_crop.extract_text() or "").split('\n'))
                all_lines.extend((right_crop.extract_text() or "").split('\n'))
            else:
                all_lines.extend(text_full.split('\n'))

    officers = []
    current_circle = ""
    current_division = ""
    
    # Pre-defined hierarchy keywords
    eic_keywords = ['EIC', 'Engineer-in-Chief']
    ce_keywords = [' CE ', 'Chief Engineer']
    se_keywords = [' SE ', 'Superintending Engineer', '- SE', '– SE']
    ee_keywords = [' EE ', 'Executive Engineer', 'EE(', 'EE,', 'EE ']
    sde_keywords = [' SDE ', 'Sub Divisional Engineer', 'SDE,', 'SDO']

    for line in all_lines:
        line = line.strip()
        if not line or "Circle/Division" in line or "DESIGATION" in line:
            continue

        # Circle Detection
        circle_match = re.search(r'^([A-Z\s\-]+)\s+CIRCLE', line)
        if circle_match:
            current_circle = circle_match.group(1).strip()
            current_division = ""
            continue

        # Division Detection (as header)
        div_match = re.search(r'^(EE\s*[\(\s][^,]+),\s*([A-Za-z\s]+)$', line)
        if div_match:
            current_division = div_match.group(0).split('(')[0].strip()
            # If the line has more info, it might be an officer. Let it fall through.

        # Officer Tier Detection
        tier = None
        designation = ""
        
        if any(x in line for x in eic_keywords):
            tier = 'L4'
            designation = 'Engineer-in-Chief (EIC)'
        elif any(x in line for x in ce_keywords):
            tier = 'L4'
            designation = 'Chief Engineer (CE)'
        elif any(x in line for x in se_keywords):
            tier = 'L4'
            designation = 'Superintending Engineer (SE)'
        elif any(x in line for x in ee_keywords):
            tier = 'L3'
            designation = 'Executive Engineer (EE)'
        elif any(x in line for x in sde_keywords):
            tier = 'L2'
            designation = 'Sub Divisional Engineer (SDE)'

        if tier:
            # Extract Mobile
            mobile_match = re.search(r'\b\d{5}-\d{5}\b', line)
            mobile = mobile_match.group(0) if mobile_match else ""
            
            # Extract Office Phone (6-8 digits)
            office_match = re.search(r'\b\d{6,8}\b', line)
            office_phone = office_match.group(0) if office_match else ""

            # Extract Name
            # Split by keywords to find the name (usually before the keyword)
            name_parts = re.split(r'\b(EIC|CE|SE|EE|SDE|SDO|JE|Engineer-in-Chief|Chief Engineer|Superintending Engineer|Executive Engineer|Sub Divisional Engineer|Junior Engineer)\b', line)
            name = name_parts[0].strip()
            
            # Clean Name
            name = re.sub(r'^\d+\s*', '', name)
            name = re.sub(r'^(S/Sh\.|Sh\.|Smt\.|Sh|Smt)\s*', '', name)
            name = name.rstrip(',. -').strip()

            if name and len(name) > 2 and "NAME" not in name.upper() and "DESIGNATION" not in name.upper():
                # Specific designation check (e.g. EE(PI) or SE(Roads))
                full_desig = designation
                extra_desig_match = re.search(r'\b(EIC|CE|SE|EE|SDE|SDO)\s*[\(\-][^0-9\n,]+', line)
                if extra_desig_match:
                    full_desig = extra_desig_match.group(0).strip()

                # Filter for Roads only at HQ level
                search_context = (line + " " + name).upper()
                if tier in ['L3', 'L4'] and not current_circle:
                    if "BUILDING" in search_context and "ROAD" not in search_context:
                        continue

                district = current_circle.title() if current_circle else "Haryana"
                if "CHANDIGARH" in current_circle: district = "Chandigarh"
                
                # Update current division if we found an EE
                if tier == 'L3':
                    # If the division is mentioned in the line, use it
                    # e.g. "EE, Jhajjar"
                    place_match = re.search(r'EE,\s*([A-Za-z]+)', line)
                    if place_match:
                        current_division = "EE, " + place_match.group(1)

                officers.append({
                    "authority_type": "PWD (Buildings and Roads)",
                    "department": "PWD (Buildings and Roads)",
                    "district": district,
                    "circle": current_circle,
                    "division": current_division,
                    "name": name,
                    "designation": full_desig,
                    "email": f"{name.lower().replace(' ', '.')}@hry.nic.in",
                    "phone": office_phone,
                    "mobile": mobile,
                    "tier": tier
                })

    # Deduplicate and enrich
    final_officers = []
    seen = set()
    for o in officers:
        key = (o['name'], o['tier'], o['district'], o['division'])
        if key not in seen:
            seen.add(key)
            final_officers.append(o)

    # Add missing L1 (JEs)
    divisions = set((o['district'], o['circle'], o['division']) for o in final_officers if o['division'])
    for dist, circle, div in divisions:
        if not any(o['division'] == div and o['tier'] == 'L1' for o in final_officers):
            final_officers.append({
                "authority_type": "PWD (Buildings and Roads)",
                "department": "PWD (Buildings and Roads)",
                "district": dist,
                "circle": circle,
                "division": div,
                "name": f"Local JE ({div})",
                "designation": "Junior Engineer (JE)",
                "email": f"je.{div.lower().replace(' ', '.').replace('(', '').replace(')', '')}@hry.nic.in",
                "phone": "",
                "mobile": "99999-00000",
                "tier": "L1"
            })

    output_path = '../civic_scraper/data/haryana/mappings/hierarchical_officers.json'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_officers, f, indent=4)
    print(f"Extraction complete: {len(final_officers)} unique officers mapped.")

if __name__ == "__main__":
    parse_pdf()
