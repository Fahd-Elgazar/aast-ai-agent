import json
from collections import Counter, defaultdict

file_path = "C:/Users/mh978/Downloads/AI_AGENT/relationship.json"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"Error: File not found at {file_path}")
    exit(1)
except json.JSONDecodeError as e:
    print(f"Error decoding JSON: {e}")
    exit(1)

nodes = {}
edges = []

# Typical Neo4j export structure:
# [{"n": {...}}, {"r": {...}}, {"m": {...}}] or row-based dicts
for row in data:
    for key, val in row.items():
        if isinstance(val, dict):
            if "labels" in val and "identity" in val:
                nodes[val["identity"]] = val
            elif "type" in val and "start" in val and "end" in val:
                edges.append(val)

print(f"Total Unique Nodes: {len(nodes)}")
print(f"Total Edges: {len(edges)}")

node_labels = Counter()
for n in nodes.values():
    node_labels.update(n.get("labels", []))

print("\nNode Inventory:")
for label, count in node_labels.most_common():
    print(f"  {label}: {count}")

edge_types = Counter()
for e in edges:
    edge_types[e.get("type", "UNKNOWN")] += 1

print("\nRelationship Inventory:")
for etype, count in edge_types.most_common():
    print(f"  {etype}: {count}")

# Check specific entities
names = defaultdict(list)
for n in nodes.values():
    name = n.get("properties", {}).get("name", n.get("properties", {}).get("degree_name", ""))
    if name:
        names[name].append(n)

print("\nCheck Specific Nodes:")
print("Hany Hanafy nodes:")
for n in nodes.values():
    props = n.get("properties", {})
    if "Hany" in props.get("name", "") or "Hany" in props.get("id", ""):
        print(f"  - ID: {n.get('identity')}, Labels: {n.get('labels')}, Props: {props}")

print("\nDuplicates (Same Name, Multiple Nodes):")
for name, n_list in names.items():
    if len(n_list) > 1:
        print(f"  {name}: {len(n_list)} nodes")
        for n in n_list:
            print(f"    -> {n.get('labels')} : {n.get('properties')}")

print("\nEdge connections summary:")
connections = Counter()
for e in edges:
    start_id = e.get("start")
    end_id = e.get("end")
    start_node = nodes.get(start_id, {})
    end_node = nodes.get(end_id, {})
    
    start_label = tuple(start_node.get("labels", ["UNKNOWN"]))
    end_label = tuple(end_node.get("labels", ["UNKNOWN"]))
    
    connections[(start_label, e.get("type"), end_label)] += 1

for (start, etype, end), count in connections.most_common():
    print(f"  {start} -[{etype}]-> {end}: {count}")
