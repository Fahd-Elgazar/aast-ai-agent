import json

file_path = "C:/Users/mh978/Downloads/AI_AGENT/neo4j_query_table_data_2026-4-22 (2).json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

nodes = [item.get("n", {}) for item in data]

print("=== ALL NODES SUMMARY ===")
for n in nodes:
    labels = n.get("labels", [])
    props = n.get("properties", {})
    ident = n.get("identity", "N/A")
    name = props.get("name", props.get("degree_name", props.get("scope", "NO_NAME")))
    if name == "NO_NAME":
        name = str(props)
    print(f"[{ident}] {labels} - {name}")

print("\n=== DUPLICATES AND ISSUES ===")
# Course duplicates
course_names = {}
for n in nodes:
    if "Course" in n.get("labels", []):
        name = n.get("properties", {}).get("name", "")
        if name in course_names:
            course_names[name].append(n)
        else:
            course_names[name] = [n]

for name, lst in course_names.items():
    if len(lst) > 1:
        print(f"DUPLICATE COURSE: {name} ({len(lst)} times)")
        for c in lst:
            print(f"   -> ID: {c.get('identity')} Props: {c.get('properties')}")

# Unknown Professors
print("\n=== UNKNOWN PROFESSORS ===")
for n in nodes:
    if "Professor" in n.get("labels", []) and "name" not in n.get("properties", {}):
        print(f"UNKNOWN PROFESSOR: ID {n.get('identity')} Props: {n.get('properties')}")

