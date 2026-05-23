import json
from collections import Counter, defaultdict

file_path = "C:/Users/mh978/Downloads/AI_AGENT/relationship.json"
out_path = "C:/Users/mh978/Downloads/AI_AGENT/relationship_analysis_clean.txt"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error: {e}")
    exit(1)

nodes = {}
edges = []

for row in data:
    for key, val in row.items():
        if isinstance(val, dict):
            if "labels" in val and "identity" in val:
                # remove embedding
                if "embedding" in val.get("properties", {}):
                    del val["properties"]["embedding"]
                nodes[val["identity"]] = val
            elif "type" in val and "start" in val and "end" in val:
                edges.append(val)

with open(out_path, "w", encoding="utf-8") as out:
    out.write(f"Total Unique Nodes: {len(nodes)}\n")
    out.write(f"Total Edges: {len(edges)}\n\n")

    node_labels = Counter()
    for n in nodes.values():
        for label in n.get("labels", []):
            if label != "Entity":
                node_labels[label] += 1

    out.write("Node Inventory:\n")
    for label, count in node_labels.most_common():
        out.write(f"  {label}: {count}\n")

    edge_types = Counter()
    for e in edges:
        edge_types[e.get("type", "UNKNOWN")] += 1

    out.write("\nRelationship Inventory:\n")
    for etype, count in edge_types.most_common():
        out.write(f"  {etype}: {count}\n")

    names = defaultdict(list)
    for n in nodes.values():
        name = n.get("properties", {}).get("name", n.get("properties", {}).get("degree_name", ""))
        if name:
            names[name].append(n)

    out.write("\nDuplicates (Same Name, Multiple Nodes):\n")
    for name, n_list in names.items():
        if len(n_list) > 1:
            out.write(f"  {name}: {len(n_list)} nodes\n")
            for n in n_list:
                out.write(f"    -> {n.get('labels')} : {n.get('identity')} : {n.get('properties')}\n")

    out.write("\nEdge connections summary:\n")
    connections = Counter()
    for e in edges:
        start_id = e.get("start")
        end_id = e.get("end")
        start_node = nodes.get(start_id, {})
        end_node = nodes.get(end_id, {})
        
        start_label = tuple(l for l in start_node.get("labels", ["UNKNOWN"]) if l != "Entity")
        end_label = tuple(l for l in end_node.get("labels", ["UNKNOWN"]) if l != "Entity")
        
        connections[(start_label, e.get("type"), end_label)] += 1

    for (start, etype, end), count in connections.most_common():
        out.write(f"  {start} -[{etype}]-> {end}: {count}\n")

    out.write("\nHany Hanafy nodes:\n")
    for n in nodes.values():
        props = n.get("properties", {})
        if "Hany" in props.get("name", "") or "Hany" in props.get("id", ""):
            out.write(f"  - ID: {n.get('identity')}, Labels: {n.get('labels')}, Props: {props}\n")

    out.write("\nSpecific missing structural relationships to check:\n")
    for n in nodes.values():
        if "Course" in n.get("labels", []):
             pass # just structural logic output
