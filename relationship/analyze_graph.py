import json
import sys
from collections import Counter, defaultdict

file_path = "C:/Users/mh978/Downloads/AI_AGENT/neo4j_query_table_data_2026-4-22 (2).json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

nodes = {}
edges = []

for item in data:
    for key, val in item.items():
        if isinstance(val, dict) and "identity" in val and "labels" in val:
            nodes[val["identity"]] = val
        elif isinstance(val, dict) and "identity" in val and "type" in val and "start" in val and "end" in val:
            edges.append(val)

print("Total nodes:", len(nodes))
print("Total edges:", len(edges))

node_labels = Counter()
for n in nodes.values():
    node_labels.update(n["labels"])

print("\nNode Types:")
for label, count in node_labels.most_common():
    print(f"  {label}: {count}")

edge_types = Counter()
for e in edges:
    edge_types[e["type"]] += 1

print("\nEdge Types:")
for etype, count in edge_types.most_common():
    print(f"  {etype}: {count}")

# Find Hany Hanafy
print("\nHany Hanafy nodes:")
for n in nodes.values():
    if "name" in n.get("properties", {}) and "Hany Hanafy" in n["properties"]["name"]:
        print(f"  ID: {n['identity']}, Labels: {n['labels']}, Props: {n['properties']}")

# Find specific nodes
print("\nLooking for specific nodes:")
for label in ["Professor", "Instructor", "Department", "Quality Unit", "Role", "Dean", "Vice Dean", "Head", "Syllabus", "Curriculum"]:
    count = sum(1 for n in nodes.values() if label in n["labels"])
    print(f"  {label}: {count}")

# Check missing critical relationships
print("\nEdge connections:")
connections = Counter()
for e in edges:
    start_label = tuple(nodes[e["start"]]["labels"]) if e["start"] in nodes else "Unknown"
    end_label = tuple(nodes[e["end"]]["labels"]) if e["end"] in nodes else "Unknown"
    connections[(start_label, e["type"], end_label)] += 1

for (start, etype, end), count in connections.most_common():
    print(f"  {start} -[{etype}]-> {end}: {count}")

# Duplicate detection
names = defaultdict(list)
for n in nodes.values():
    if "name" in n.get("properties", {}):
        names[n["properties"]["name"]].append(n)

print("\nPotential duplicates (same name, multiple nodes):")
for name, n_list in names.items():
    if len(n_list) > 1:
        labels_str = [str(n["labels"]) for n in n_list]
        print(f"  {name}: {len(n_list)} nodes ({', '.join(labels_str)})")
