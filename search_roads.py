import json
import os

def search():
    path = r'pipeline_data/haryana/roads/roads_raw.geojson'
    if not os.path.exists(path):
        print("Path not found")
        return
        
    print(f"Searching in {path}...")
    with open(path, 'r', encoding='utf-8') as f:
        # Since it's a GeoJSON, it might be one giant line or one feature per line
        # Let's try to read it carefully
        found = 0
        for line in f:
            if 'National Highway' in line or 'Highway' in line or 'NH-' in line:
                found += 1
                if found < 5:
                    print(line[:500])
        print(f"Total found: {found}")

if __name__ == "__main__":
    search()
