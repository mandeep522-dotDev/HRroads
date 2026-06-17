import json
import os

def check():
    path = r'../civic_scraper/data/haryana/roads/haryana_roads.geojson'
    if not os.path.exists(path):
        print("Path not found")
        return
        
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        nh_names = [f['properties'].get('ROAD_NAME', 'No Name') for f in data['features'] if f['properties'].get('ROAD_CATEG') == 'NH']
        print(f"NH Count: {len(nh_names)}")
        print(nh_names[:20])

if __name__ == "__main__":
    check()
