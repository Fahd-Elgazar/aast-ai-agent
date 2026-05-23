import json

file_path = "C:/Users/mh978/Downloads/AI_AGENT/neo4j_query_table_data_2026-4-22 (2).json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("Professors:")
for item in data:
    n = item.get("n", {})
    labels = n.get("labels", [])
    if "Professor" in labels:
        print(f"  - {n.get('properties', {}).get('name', 'UNKNOWN')}")
        
print("\nAny node with 'Hany' in name:")
for item in data:
    n = item.get("n", {})
    name = n.get("properties", {}).get("name", "")
    if "Hany" in name:
        print(f"  - {name} ({labels})")

print("\nAny node with 'Qual' or 'Unit' in name:")
for item in data:
    n = item.get("n", {})
    name = n.get("properties", {}).get("name", "")
    if "Qual" in name or "Unit" in name:
        print(f"  - {name} ({labels})")

print("\nAny node with 'Dept' or 'Department' in name/label:")
for item in data:
    n = item.get("n", {})
    labels = n.get("labels", [])
    name = n.get("properties", {}).get("name", "")
    if "Dept" in name or "Department" in name or "Department" in labels:
        print(f"  - {name} ({labels})")
