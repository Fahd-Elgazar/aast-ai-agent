import json

file_path = "C:/Users/mh978/Downloads/AI_AGENT/neo4j_query_table_data_2026-4-22 (2).json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

keys = set()
for item in data:
    keys.update(item.keys())

print("Keys found in items:", keys)

if len(data) > 0:
    for k, v in data[0].items():
        print(f"Sample of {k}: {str(v)[:200]}")
