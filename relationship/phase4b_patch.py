#!/usr/bin/env python3
"""
Phase 4B Neo4j graph restoration and demo-hardening patch.

This script is intentionally conservative:
- It backs up the live graph before any mutation.
- It uses MERGE-safe Cypher and small transaction stages.
- It bridges identities instead of destructive merging.
- It isolates weak duplicates by default; deletion requires an explicit flag.
- It tags every Phase 4B write for auditability and rollback.

Default mode is dry-run. Use --apply to mutate Neo4j.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUTS = {
    "backup": "backup_pre_phase4b.json",
    "export": "relationship_phase4b.json",
    "metrics": "graph_metrics_phase4b.md",
    "log": "phase4b_patch_log.json",
}

COLLEGE_ID = "COLLEGE_CAI_EL_ALAMEIN"
INTELLIGENT_SYSTEMS_ID = "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_INTELLIGENT_SYSTEMS"
DATA_SCIENCE_ID = "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_DATA_SCIENCE"
HANY_CANONICAL_ID = "PROF_HANY_HANAFY_MAHMOUD_SAID"
HANY_ALIAS_IDS = ["PROF_HANY_HANAFY", "PROF_HANY_HANAFY_MAHMOUD_SAID"]
HANY_NAME = "Hany Hanafy Mahmoud Said"
HANY_TITLE = "Head of the Quality Unit at the College of Artificial Intelligence, El Alamein Branch"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_env_file(path: Path | None) -> None:
    if not path or not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def json_ready(value: Any) -> Any:
    """Convert Neo4j/Python values into deterministic JSON-safe values."""
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(k): json_ready(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_ready(v) for v in value]
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass
    if hasattr(value, "to_native"):
        try:
            return json_ready(value.to_native())
        except Exception:
            pass
    if hasattr(value, "toNumber"):
        try:
            return value.toNumber()
        except Exception:
            pass
    return str(value)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(json_ready(payload), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def stable_checksum(payload: Any) -> str:
    encoded = json.dumps(json_ready(payload), ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@dataclass
class PatchConfig:
    root: Path
    output_dir: Path
    uri: str
    user: str
    password: str
    database: str
    dry_run: bool
    patch_id: str
    source_relationship: Path
    source_historical: Path
    source_analysis_clean: Path
    source_analysis_raw: Path
    delete_isolated_duplicates: bool = False
    validate_only: bool = False
    export_only: bool = False
    metrics_only: bool = False
    detect_only: bool = False
    rollback: bool = False
    backup_file: Path | None = None

    @property
    def backup_path(self) -> Path:
        return self.output_dir / DEFAULT_OUTPUTS["backup"]

    @property
    def export_path(self) -> Path:
        return self.output_dir / DEFAULT_OUTPUTS["export"]

    @property
    def metrics_path(self) -> Path:
        return self.output_dir / DEFAULT_OUTPUTS["metrics"]

    @property
    def log_path(self) -> Path:
        return self.output_dir / DEFAULT_OUTPUTS["log"]


@dataclass
class CypherOperation:
    name: str
    cypher: str
    params: dict[str, Any] = field(default_factory=dict)
    risk: str = "low"


@dataclass
class StageResult:
    stage: str
    started_at: str
    finished_at: str | None = None
    dry_run: bool = True
    operations: list[dict[str, Any]] = field(default_factory=list)
    status: str = "pending"
    error: str | None = None
    validation: dict[str, Any] | None = None


@dataclass
class ValidationResult:
    name: str
    success: bool
    path_quality: str
    node_count: int
    link_count: int
    deterministic_ready: bool
    evidence: list[str]
    error: str | None = None


class Neo4jClient:
    def __init__(self, config: PatchConfig):
        try:
            from neo4j import GraphDatabase
        except Exception as exc:
            raise RuntimeError(
                "The neo4j Python package is required. Install with: pip install neo4j"
            ) from exc

        self.config = config
        self.driver = GraphDatabase.driver(
            config.uri,
            auth=(config.user, config.password),
        )

    def close(self) -> None:
        self.driver.close()

    def verify(self) -> None:
        self.driver.verify_connectivity()

    def read(self, cypher: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        with self.driver.session(database=self.config.database) as session:
            result = session.execute_read(
                lambda tx: [record.data() for record in tx.run(cypher, params or {})]
            )
        return json_ready(result)

    def write_stage(self, stage: str, operations: list[CypherOperation]) -> StageResult:
        result = StageResult(stage=stage, started_at=utc_now(), dry_run=self.config.dry_run)
        if self.config.dry_run:
            result.operations = [
                {
                    "name": op.name,
                    "risk": op.risk,
                    "params": json_ready(op.params),
                    "cypher_preview": re.sub(r"\s+", " ", op.cypher).strip()[:500],
                    "executed": False,
                }
                for op in operations
            ]
            result.status = "dry_run"
            result.finished_at = utc_now()
            return result

        common = {
            "patch_id": self.config.patch_id,
            "patched_at": utc_now(),
            "phase4b_source": "phase4b_patch.py",
        }

        try:
            with self.driver.session(database=self.config.database) as session:
                def work(tx: Any) -> list[dict[str, Any]]:
                    operation_results: list[dict[str, Any]] = []
                    for op in operations:
                        params = {**common, **op.params}
                        records = tx.run(op.cypher, params)
                        summary = records.consume()
                        counters = summary.counters
                        operation_results.append(
                            {
                                "name": op.name,
                                "risk": op.risk,
                                "executed": True,
                                "counters": {
                                    "nodes_created": counters.nodes_created,
                                    "nodes_deleted": counters.nodes_deleted,
                                    "relationships_created": counters.relationships_created,
                                    "relationships_deleted": counters.relationships_deleted,
                                    "properties_set": counters.properties_set,
                                    "labels_added": counters.labels_added,
                                    "labels_removed": counters.labels_removed,
                                },
                            }
                        )
                    return operation_results

                result.operations = session.execute_write(work)
            result.status = "applied"
        except Exception as exc:
            result.status = "failed"
            result.error = str(exc)
            raise
        finally:
            result.finished_at = utc_now()
        return result


class Phase4BPatcher:
    def __init__(self, config: PatchConfig, client: Neo4jClient):
        self.config = config
        self.client = client
        self.log: dict[str, Any] = {
            "patch_id": config.patch_id,
            "started_at": utc_now(),
            "dry_run": config.dry_run,
            "database": config.database,
            "stages": [],
            "detections": {},
            "validations": {},
            "outputs": {},
            "warnings": [],
        }

    # ------------------------------------------------------------------
    # 1. Backup
    # ------------------------------------------------------------------
    def backup_graph(self) -> dict[str, Any]:
        nodes = self.client.read(
            """
            MATCH (n)
            RETURN elementId(n) AS element_id,
                   labels(n) AS labels,
                   properties(n) AS properties
            ORDER BY element_id
            """
        )
        relationships = self.client.read(
            """
            MATCH (a)-[r]->(b)
            RETURN elementId(r) AS element_id,
                   type(r) AS type,
                   elementId(a) AS start_element_id,
                   elementId(b) AS end_element_id,
                   properties(r) AS properties
            ORDER BY element_id
            """
        )
        payload = {
            "metadata": {
                "kind": "phase4b_pre_patch_backup",
                "created_at": utc_now(),
                "database": self.config.database,
                "neo4j_uri": self.config.uri,
                "node_count": len(nodes),
                "relationship_count": len(relationships),
                "patch_id": self.config.patch_id,
            },
            "nodes": nodes,
            "relationships": relationships,
        }
        payload["metadata"]["checksum_sha256"] = stable_checksum(
            {"nodes": nodes, "relationships": relationships}
        )
        write_json(self.config.backup_path, payload)
        self.log["outputs"]["backup_pre_phase4b.json"] = str(self.config.backup_path)
        return payload

    # ------------------------------------------------------------------
    # 2. Duplicate detection
    # ------------------------------------------------------------------
    def detect_duplicates(self) -> dict[str, Any]:
        same_name = self.client.read(
            """
            MATCH (n)
            WITH n, coalesce(n.name, n.degree_name, n.title, n.id) AS raw_name
            WHERE raw_name IS NOT NULL AND trim(toString(raw_name)) <> ""
            CALL (n) {
              OPTIONAL MATCH (n)--()
              RETURN count(*) AS degree
            }
            WITH toLower(trim(toString(raw_name))) AS normalized_name,
                 collect({
                   element_id: elementId(n),
                   labels: labels(n),
                   id: n.id,
                   name: coalesce(n.name, n.degree_name, n.title),
                   degree: degree,
                   properties: properties(n)
                 }) AS nodes
            WHERE size(nodes) > 1
            RETURN normalized_name, size(nodes) AS count, nodes
            ORDER BY count DESC, normalized_name
            """
        )

        weak_course_aliases = self.client.read(
            """
            MATCH (weak:Course), (canonical:Course)
            WHERE elementId(weak) <> elementId(canonical)
              AND toLower(coalesce(weak.name, "")) = toLower(coalesce(canonical.name, ""))
              AND weak.course_code IS NULL
              AND canonical.course_code IS NOT NULL
            RETURN weak.id AS weak_id,
                   weak.name AS name,
                   canonical.id AS canonical_id,
                   canonical.course_code AS canonical_course_code,
                   labels(weak) AS weak_labels,
                   labels(canonical) AS canonical_labels
            ORDER BY name, canonical_id, weak_id
            """
        )

        source_findings = self._analyze_source_exports()
        detection = {
            "same_name_clusters": same_name,
            "weak_course_aliases": weak_course_aliases,
            "source_export_findings": source_findings,
        }
        self.log["detections"]["duplicates"] = detection
        return detection

    # ------------------------------------------------------------------
    # 3. Split identity detection
    # ------------------------------------------------------------------
    def detect_split_identities(self) -> dict[str, Any]:
        person_professor = self.client.read(
            """
            MATCH (person:Person), (professor:Professor)
            WITH person, professor,
                 toLower(trim(coalesce(person.name, ""))) AS person_name,
                 toLower(trim(coalesce(
                   professor.name,
                   CASE
                     WHEN coalesce(professor.id, "") STARTS WITH "PROF_"
                     THEN replace(substring(professor.id, 5), "_", " ")
                     ELSE professor.id
                   END,
                   ""
                 ))) AS professor_name
            WHERE person_name <> ""
              AND professor_name <> ""
              AND person_name = professor_name
              AND elementId(person) <> elementId(professor)
            RETURN person_name AS normalized_name,
                   {
                     element_id: elementId(person),
                     labels: labels(person),
                     id: person.id,
                     name: person.name,
                     role: person.role,
                     title: person.title
                   } AS person,
                   {
                     element_id: elementId(professor),
                     labels: labels(professor),
                     id: professor.id,
                     name: professor.name,
                     role: professor.role,
                     title: professor.title
                   } AS professor
            ORDER BY normalized_name
            """
        )

        admin_fragments = self.client.read(
            """
            MATCH (person:Person)-[r:HAS_ADMIN|HEAD_OF]->(unit)
            WHERE size(labels(unit)) = 0
               OR (unit.id IS NULL AND unit.name IS NULL)
            RETURN elementId(unit) AS unit_element_id,
                   labels(unit) AS unit_labels,
                   properties(unit) AS unit_properties,
                   collect(DISTINCT {
                     person: person.name,
                     role: person.role,
                     relation: type(r)
                   }) AS inbound_admin_edges
            ORDER BY unit_element_id
            """
        )

        detection = {
            "person_professor_splits": person_professor,
            "admin_fragments": admin_fragments,
        }
        self.log["detections"]["split_identities"] = detection
        return detection

    # ------------------------------------------------------------------
    # 4. Identity repair
    # ------------------------------------------------------------------
    def patch_identity_bridges(self) -> StageResult:
        operations = [
            CypherOperation(
                "restore_hany_canonical_professor_profile",
                """
                MERGE (p:Professor {id: $hany_canonical_id})
                ON CREATE SET p.phase4b_created = true,
                              p.data_source_type = "phase4b_authoritative_restore"
                SET p:Entity,
                    p.phase4b_identity_hardened = true,
                    p.phase4b_patch_id = $patch_id,
                    p.phase4b_canonical = true
                WITH p
                FOREACH (_ IN CASE WHEN p.name IS NULL THEN [1] ELSE [] END |
                  SET p.name = $hany_name,
                      p.phase4b_enriched_name = true
                )
                FOREACH (_ IN CASE WHEN p.role IS NULL THEN [1] ELSE [] END |
                  SET p.role = "Head of Unit",
                      p.phase4b_enriched_role = true
                )
                FOREACH (_ IN CASE WHEN p.title IS NULL THEN [1] ELSE [] END |
                  SET p.title = $hany_title,
                      p.phase4b_enriched_title = true
                )
                RETURN count(p) AS touched
                """,
                {"hany_canonical_id": HANY_CANONICAL_ID, "hany_name": HANY_NAME, "hany_title": HANY_TITLE},
            ),
            CypherOperation(
                "bridge_hany_aliases_to_canonical",
                """
                MATCH (canonical:Professor {id: $hany_canonical_id})
                MATCH (alias)
                WHERE elementId(alias) <> elementId(canonical)
                  AND (
                    alias.id IN $hany_alias_ids
                    OR toLower(coalesce(alias.name, "")) = toLower($hany_name)
                  )
                MERGE (alias)-[same:IS_SAME_ENTITY]->(canonical)
                SET same.phase4b_patch_id = $patch_id,
                    same.created_by = $phase4b_source,
                    same.confidence = 0.98,
                    same.reason = "Phase 4B bridge: same Hany Hanafy identity observed across Professor and Person nodes",
                    same.patched_at = $patched_at
                SET alias.phase4b_canonical_id = $hany_canonical_id,
                    alias.phase4b_patch_id = $patch_id
                RETURN count(same) AS bridges
                """,
                {
                    "hany_canonical_id": HANY_CANONICAL_ID,
                    "hany_alias_ids": HANY_ALIAS_IDS,
                    "hany_name": HANY_NAME,
                },
            ),
            CypherOperation(
                "bridge_all_person_professor_splits",
                """
                MATCH (person:Person), (professor:Professor)
                WITH person, professor,
                     toLower(trim(coalesce(person.name, ""))) AS person_name,
                     toLower(trim(coalesce(
                       professor.name,
                       CASE
                         WHEN coalesce(professor.id, "") STARTS WITH "PROF_"
                         THEN replace(substring(professor.id, 5), "_", " ")
                         ELSE professor.id
                       END,
                       ""
                     ))) AS professor_name
                WHERE person_name <> ""
                  AND professor_name <> ""
                  AND person_name = professor_name
                  AND elementId(person) <> elementId(professor)
                MERGE (person)-[same:IS_SAME_ENTITY]->(professor)
                SET same.phase4b_patch_id = $patch_id,
                    same.created_by = $phase4b_source,
                    same.confidence = 0.94,
                    same.reason = "Phase 4B bridge: Person and Professor share normalized identity",
                    same.patched_at = $patched_at
                SET person.phase4b_canonical_id = coalesce(professor.id, person.phase4b_canonical_id),
                    professor.phase4b_identity_hardened = true,
                    professor.phase4b_patch_id = $patch_id
                FOREACH (_ IN CASE WHEN professor.name IS NULL AND person.name IS NOT NULL THEN [1] ELSE [] END |
                  SET professor.name = person.name,
                      professor.phase4b_enriched_name = true
                )
                FOREACH (_ IN CASE WHEN professor.role IS NULL AND person.role IS NOT NULL THEN [1] ELSE [] END |
                  SET professor.role = person.role,
                      professor.phase4b_enriched_role = true
                )
                FOREACH (_ IN CASE WHEN professor.title IS NULL AND person.title IS NOT NULL THEN [1] ELSE [] END |
                  SET professor.title = person.title,
                      professor.phase4b_enriched_title = true
                )
                RETURN count(same) AS bridges
                """,
            ),
            CypherOperation(
                "repair_person_role_bridges",
                """
                MATCH (person:Person)
                WHERE person.role IS NOT NULL AND trim(person.role) <> ""
                MERGE (role:Role {name: person.role})
                ON CREATE SET role.phase4b_created = true
                SET role.phase4b_patch_id = $patch_id,
                    role.data_source_type = coalesce(role.data_source_type, "phase4b_authoritative_bridge")
                MERGE (person)-[hasRole:HAS_ROLE]->(role)
                SET hasRole.phase4b_patch_id = $patch_id,
                    hasRole.created_by = $phase4b_source,
                    hasRole.patched_at = $patched_at
                MERGE (person)-[acts:ACTS_AS]->(role)
                SET acts.phase4b_patch_id = $patch_id,
                    acts.created_by = $phase4b_source,
                    acts.patched_at = $patched_at
                WITH person, role
                OPTIONAL MATCH (person)-[:IS_SAME_ENTITY]->(professor:Professor)
                FOREACH (_ IN CASE WHEN professor IS NULL THEN [] ELSE [1] END |
                  MERGE (professor)-[profActs:ACTS_AS]->(role)
                  SET profActs.phase4b_patch_id = $patch_id,
                      profActs.created_by = $phase4b_source,
                      profActs.patched_at = $patched_at
                )
                RETURN count(DISTINCT person) AS role_bridges
                """,
            ),
            CypherOperation(
                "ensure_hany_teaching_edges_on_canonical",
                """
                MATCH (hany:Professor {id: $hany_canonical_id})
                MATCH (nlp:Course {id: "COURSE_NATURAL_LANGUAGE_PROCESSING"})
                MERGE (hany)-[teachesNlp:TEACHES]->(nlp)
                SET teachesNlp.phase4b_patch_id = $patch_id,
                    teachesNlp.created_by = $phase4b_source,
                    teachesNlp.patched_at = $patched_at,
                    teachesNlp.data_source_type = coalesce(teachesNlp.data_source_type, "official")
                WITH hany
                MATCH (cognitive:Course {id: "COURSE_COGNITIVE_COMPUTING"})
                MERGE (hany)-[teachesCog:TEACHES]->(cognitive)
                SET teachesCog.phase4b_patch_id = $patch_id,
                    teachesCog.created_by = $phase4b_source,
                    teachesCog.patched_at = $patched_at,
                    teachesCog.data_source_type = coalesce(teachesCog.data_source_type, "official")
                RETURN count(hany) AS canonical_teaching_profile
                """,
                {"hany_canonical_id": HANY_CANONICAL_ID},
            ),
        ]
        return self._apply_and_validate("identity_repair", operations)

    # ------------------------------------------------------------------
    # 5. Institutional hierarchy
    # ------------------------------------------------------------------
    def patch_institutional_hierarchy(self) -> StageResult:
        operations = [
            CypherOperation(
                "repair_blank_governance_fragment",
                """
                MATCH (unit)
                WHERE size(labels(unit)) = 0
                  AND unit.id IS NULL
                  AND unit.name IS NULL
                  AND EXISTS { MATCH (:Person)-[:HAS_ADMIN|HEAD_OF]->(unit) }
                SET unit:GovernanceUnit:Entity,
                    unit.id = $governance_id,
                    unit.name = "CAI Governance",
                    unit.scope = "College leadership and administration",
                    unit.data_source_type = "phase4b_authoritative_restore",
                    unit.phase4b_patch_id = $patch_id,
                    unit.phase4b_fragment_repaired = true
                RETURN count(unit) AS repaired_fragments
                """,
                {"governance_id": "UNIT_CAI_EL_ALAMEIN_GOVERNANCE"},
            ),
            CypherOperation(
                "upsert_governance_department_quality_nodes",
                """
                MATCH (college:College {id: $college_id})
                MERGE (governance:GovernanceUnit {id: "UNIT_CAI_EL_ALAMEIN_GOVERNANCE"})
                ON CREATE SET governance.phase4b_created = true
                SET governance:Entity,
                    governance.name = coalesce(governance.name, "CAI Governance"),
                    governance.scope = coalesce(governance.scope, "College leadership and administration"),
                    governance.data_source_type = coalesce(governance.data_source_type, "phase4b_authoritative_restore"),
                    governance.phase4b_patch_id = $patch_id
                MERGE (quality:QualityUnit {id: "UNIT_CAI_EL_ALAMEIN_QUALITY"})
                ON CREATE SET quality.phase4b_created = true
                SET quality:Entity,
                    quality.name = "Quality Unit",
                    quality.full_name = "Quality Unit at the College of Artificial Intelligence, El Alamein Branch",
                    quality.scope = "Quality assurance and institutional quality governance",
                    quality.data_source_type = "phase4b_authoritative_restore",
                    quality.phase4b_patch_id = $patch_id
                MERGE (department:Department {id: "DEPT_CAI_EL_ALAMEIN_ARTIFICIAL_INTELLIGENCE"})
                ON CREATE SET department.phase4b_created = true
                SET department:Entity,
                    department.name = "Artificial Intelligence Department",
                    department.scope = "Academic department within the College of Artificial Intelligence",
                    department.data_source_type = "phase4b_authoritative_restore",
                    department.phase4b_patch_id = $patch_id
                MERGE (programGovernance:GovernanceUnit {id: "UNIT_CAI_EL_ALAMEIN_PROGRAM_GOVERNANCE"})
                ON CREATE SET programGovernance.phase4b_created = true
                SET programGovernance:Entity,
                    programGovernance.name = "Program Governance",
                    programGovernance.scope = "Program governance structure for CAI academic programs",
                    programGovernance.data_source_type = "phase4b_authoritative_restore",
                    programGovernance.phase4b_patch_id = $patch_id
                MERGE (college)-[g:HAS_GOVERNANCE_BODY]->(governance)
                SET g.phase4b_patch_id = $patch_id, g.created_by = $phase4b_source, g.patched_at = $patched_at
                MERGE (college)-[u:HAS_UNIT]->(quality)
                SET u.phase4b_patch_id = $patch_id, u.created_by = $phase4b_source, u.patched_at = $patched_at
                MERGE (college)-[d:HAS_DEPARTMENT]->(department)
                SET d.phase4b_patch_id = $patch_id, d.created_by = $phase4b_source, d.patched_at = $patched_at
                MERGE (college)-[pg:HAS_GOVERNANCE_BODY]->(programGovernance)
                SET pg.phase4b_patch_id = $patch_id, pg.created_by = $phase4b_source, pg.patched_at = $patched_at
                MERGE (quality)-[qb:BELONGS_TO]->(college)
                SET qb.phase4b_patch_id = $patch_id, qb.created_by = $phase4b_source, qb.patched_at = $patched_at
                MERGE (department)-[db:BELONGS_TO]->(college)
                SET db.phase4b_patch_id = $patch_id, db.created_by = $phase4b_source, db.patched_at = $patched_at
                MERGE (programGovernance)-[pgb:BELONGS_TO]->(college)
                SET pgb.phase4b_patch_id = $patch_id, pgb.created_by = $phase4b_source, pgb.patched_at = $patched_at
                RETURN count(college) AS hierarchy_seeded
                """,
                {"college_id": COLLEGE_ID},
            ),
            CypherOperation(
                "connect_dean_vice_dean_department_and_quality_leaders",
                """
                MATCH (college:College {id: $college_id})
                OPTIONAL MATCH (governance:GovernanceUnit {id: "UNIT_CAI_EL_ALAMEIN_GOVERNANCE"})
                OPTIONAL MATCH (quality:QualityUnit {id: "UNIT_CAI_EL_ALAMEIN_QUALITY"})
                OPTIONAL MATCH (department:Department {id: "DEPT_CAI_EL_ALAMEIN_ARTIFICIAL_INTELLIGENCE"})
                OPTIONAL MATCH (programGovernance:GovernanceUnit {id: "UNIT_CAI_EL_ALAMEIN_PROGRAM_GOVERNANCE"})
                OPTIONAL MATCH (dean:Person {name: "Ali Ali Mohamed Fahmy"})
                OPTIONAL MATCH (viceDean:Person {name: "Ahmed Abdelkhalik Ahmed Abouelfarag"})
                OPTIONAL MATCH (departmentHead:Person {name: "Ahmed Mohamed Mansour Khames Elshaer"})
                OPTIONAL MATCH (hanyPerson:Person {name: $hany_name})
                OPTIONAL MATCH (hanyProfessor:Professor {id: $hany_canonical_id})
                FOREACH (_ IN CASE WHEN dean IS NULL THEN [] ELSE [1] END |
                  MERGE (dean)-[r:DEAN_OF]->(college)
                  SET r.phase4b_patch_id = $patch_id, r.created_by = $phase4b_source, r.patched_at = $patched_at
                  MERGE (dean)-[m:MANAGES]->(governance)
                  SET m.phase4b_patch_id = $patch_id, m.created_by = $phase4b_source, m.patched_at = $patched_at
                  MERGE (dean)-[w:WORKS_IN]->(college)
                  SET w.phase4b_patch_id = $patch_id, w.created_by = $phase4b_source, w.patched_at = $patched_at
                )
                FOREACH (_ IN CASE WHEN viceDean IS NULL THEN [] ELSE [1] END |
                  MERGE (viceDean)-[a:ADMINISTERS]->(college)
                  SET a.phase4b_patch_id = $patch_id, a.created_by = $phase4b_source, a.patched_at = $patched_at
                  MERGE (viceDean)-[m:MANAGES]->(programGovernance)
                  SET m.phase4b_patch_id = $patch_id, m.created_by = $phase4b_source, m.patched_at = $patched_at
                  MERGE (viceDean)-[w:WORKS_IN]->(college)
                  SET w.phase4b_patch_id = $patch_id, w.created_by = $phase4b_source, w.patched_at = $patched_at
                )
                FOREACH (_ IN CASE WHEN departmentHead IS NULL THEN [] ELSE [1] END |
                  MERGE (departmentHead)-[h:HEAD_OF]->(department)
                  SET h.phase4b_patch_id = $patch_id, h.created_by = $phase4b_source, h.patched_at = $patched_at
                  MERGE (departmentHead)-[w:WORKS_IN]->(college)
                  SET w.phase4b_patch_id = $patch_id, w.created_by = $phase4b_source, w.patched_at = $patched_at
                )
                FOREACH (_ IN CASE WHEN hanyPerson IS NULL THEN [] ELSE [1] END |
                  MERGE (hanyPerson)-[h:HEAD_OF]->(quality)
                  SET h.phase4b_patch_id = $patch_id, h.created_by = $phase4b_source, h.patched_at = $patched_at
                  MERGE (hanyPerson)-[m:MANAGES]->(quality)
                  SET m.phase4b_patch_id = $patch_id, m.created_by = $phase4b_source, m.patched_at = $patched_at
                  MERGE (hanyPerson)-[w:WORKS_IN]->(college)
                  SET w.phase4b_patch_id = $patch_id, w.created_by = $phase4b_source, w.patched_at = $patched_at
                )
                FOREACH (_ IN CASE WHEN hanyProfessor IS NULL THEN [] ELSE [1] END |
                  MERGE (hanyProfessor)-[h:HEAD_OF]->(quality)
                  SET h.phase4b_patch_id = $patch_id, h.created_by = $phase4b_source, h.patched_at = $patched_at
                  MERGE (hanyProfessor)-[m:MANAGES]->(quality)
                  SET m.phase4b_patch_id = $patch_id, m.created_by = $phase4b_source, m.patched_at = $patched_at
                  MERGE (hanyProfessor)-[w:WORKS_IN]->(college)
                  SET w.phase4b_patch_id = $patch_id, w.created_by = $phase4b_source, w.patched_at = $patched_at
                )
                RETURN count(college) AS leadership_connected
                """,
                {
                    "college_id": COLLEGE_ID,
                    "hany_name": HANY_NAME,
                    "hany_canonical_id": HANY_CANONICAL_ID,
                },
            ),
            CypherOperation(
                "connect_program_governance_structure",
                """
                MATCH (department:Department {id: "DEPT_CAI_EL_ALAMEIN_ARTIFICIAL_INTELLIGENCE"})
                MATCH (programGovernance:GovernanceUnit {id: "UNIT_CAI_EL_ALAMEIN_PROGRAM_GOVERNANCE"})
                MATCH (college:College {id: $college_id})
                MATCH (program:Program)
                WHERE program.id IN $program_ids
                MERGE (program)-[b:BELONGS_TO]->(department)
                SET b.phase4b_patch_id = $patch_id, b.created_by = $phase4b_source, b.patched_at = $patched_at
                MERGE (program)-[gb:BELONGS_TO]->(college)
                SET gb.phase4b_patch_id = $patch_id, gb.created_by = $phase4b_source, gb.patched_at = $patched_at
                MERGE (programGovernance)-[m:MANAGES]->(program)
                SET m.phase4b_patch_id = $patch_id, m.created_by = $phase4b_source, m.patched_at = $patched_at
                RETURN count(DISTINCT program) AS governed_programs
                """,
                {"college_id": COLLEGE_ID, "program_ids": [INTELLIGENT_SYSTEMS_ID, DATA_SCIENCE_ID]},
            ),
        ]
        return self._apply_and_validate("institutional_hierarchy", operations)

    # ------------------------------------------------------------------
    # 6. Curriculum intelligence
    # ------------------------------------------------------------------
    def patch_curriculum_intelligence(self) -> StageResult:
        operations = [
            CypherOperation(
                "upsert_curriculum_tracks_and_reference_roles",
                """
                UNWIND $tracks AS row
                MERGE (track:Track {id: row.id})
                ON CREATE SET track.phase4b_created = true
                SET track:Entity,
                    track += row.properties,
                    track.phase4b_patch_id = $patch_id
                WITH count(track) AS track_count
                UNWIND $career_roles AS role_row
                MERGE (role:CareerRole {id: role_row.id})
                ON CREATE SET role.phase4b_created = true
                SET role:Entity,
                    role += role_row.properties,
                    role.phase4b_patch_id = $patch_id
                RETURN track_count, count(role) AS role_count
                """,
                {
                    "tracks": self._track_nodes(),
                    "career_roles": self._career_role_nodes(),
                },
            ),
            CypherOperation(
                "canonicalize_program_course_membership",
                """
                UNWIND $program_courses AS row
                MATCH (program:Program {id: row.program_id})
                MATCH (course:Course {id: row.course_id})
                MERGE (program)-[r:HAS_COURSE]->(course)
                SET r.curriculum_bucket = coalesce(r.curriculum_bucket, row.curriculum_bucket),
                    r.phase4b_patch_id = $patch_id,
                    r.created_by = $phase4b_source,
                    r.patched_at = $patched_at,
                    r.data_source_type = coalesce(r.data_source_type, "phase4b_authoritative_bridge")
                RETURN count(r) AS canonical_course_edges
                """,
                {"program_courses": self._program_course_edges()},
            ),
            CypherOperation(
                "connect_program_tracks",
                """
                UNWIND $specializes AS row
                MATCH (program:Program {id: row.program_id})
                MATCH (track:Track {id: row.track_id})
                MERGE (program)-[r:SPECIALIZES_IN]->(track)
                SET r.phase4b_patch_id = $patch_id,
                    r.created_by = $phase4b_source,
                    r.patched_at = $patched_at,
                    r.data_source_type = row.data_source_type,
                    r.confidence = row.confidence
                RETURN count(r) AS program_track_edges
                """,
                {"specializes": self._program_track_edges()},
            ),
            CypherOperation(
                "connect_courses_to_tracks",
                """
                UNWIND $course_tracks AS row
                MATCH (course:Course {id: row.course_id})
                MATCH (track:Track {id: row.track_id})
                MERGE (course)-[r:PART_OF_TRACK]->(track)
                SET r.phase4b_patch_id = $patch_id,
                    r.created_by = $phase4b_source,
                    r.patched_at = $patched_at,
                    r.curriculum_role = row.curriculum_role,
                    r.data_source_type = row.data_source_type,
                    r.confidence = row.confidence
                RETURN count(r) AS course_track_edges
                """,
                {"course_tracks": self._course_track_edges()},
            ),
            CypherOperation(
                "expand_prerequisite_and_recommended_after_paths",
                """
                UNWIND $prerequisites AS row
                MATCH (course:Course {id: row.course_id})
                MATCH (prereq:Course {id: row.prerequisite_id})
                MERGE (course)-[r:HAS_PREREQUISITE]->(prereq)
                SET r.phase4b_patch_id = $patch_id,
                    r.created_by = $phase4b_source,
                    r.patched_at = $patched_at,
                    r.data_source_type = row.data_source_type,
                    r.confidence = row.confidence
                WITH count(r) AS prereq_count
                UNWIND $recommended_after AS rec
                MATCH (course:Course {id: rec.course_id})
                MATCH (prior:Course {id: rec.after_course_id})
                MERGE (course)-[ra:RECOMMENDED_AFTER]->(prior)
                SET ra.phase4b_patch_id = $patch_id,
                    ra.created_by = $phase4b_source,
                    ra.patched_at = $patched_at,
                    ra.data_source_type = rec.data_source_type,
                    ra.confidence = rec.confidence,
                    ra.reason = rec.reason
                RETURN prereq_count, count(ra) AS recommended_after_count
                """,
                {
                    "prerequisites": self._prerequisite_edges(),
                    "recommended_after": self._recommended_after_edges(),
                },
            ),
            CypherOperation(
                "connect_career_alignment",
                """
                UNWIND $career_alignment AS row
                MATCH (source {id: row.source_id})
                MATCH (role:CareerRole {id: row.role_id})
                MERGE (source)-[r:CAREER_ALIGNMENT]->(role)
                SET r.phase4b_patch_id = $patch_id,
                    r.created_by = $phase4b_source,
                    r.patched_at = $patched_at,
                    r.alignment = row.alignment,
                    r.data_source_type = row.data_source_type,
                    r.confidence = row.confidence
                RETURN count(r) AS career_alignment_edges
                """,
                {"career_alignment": self._career_alignment_edges()},
            ),
            CypherOperation(
                "connect_program_career_and_comparison_paths",
                """
                UNWIND $leads_to AS row
                MATCH (source {id: row.source_id})
                MATCH (role:CareerRole {id: row.role_id})
                MERGE (source)-[r:LEADS_TO]->(role)
                SET r.phase4b_patch_id = $patch_id,
                    r.created_by = $phase4b_source,
                    r.patched_at = $patched_at,
                    r.data_source_type = row.data_source_type,
                    r.confidence = row.confidence
                WITH count(r) AS leads_to_count
                UNWIND $comparisons AS comp
                MATCH (left {id: comp.left_id})
                MATCH (right {id: comp.right_id})
                MERGE (left)-[cr:COMPARES_WITH]->(right)
                SET cr.phase4b_patch_id = $patch_id,
                    cr.created_by = $phase4b_source,
                    cr.patched_at = $patched_at,
                    cr.data_source_type = comp.data_source_type,
                    cr.confidence = comp.confidence,
                    cr.reason = comp.reason
                RETURN leads_to_count, count(cr) AS comparison_edges
                """,
                {"leads_to": self._leads_to_edges(), "comparisons": self._comparison_edges()},
            ),
            CypherOperation(
                "upsert_policy_route_bridges_for_hybrid_validation",
                """
                MATCH (college:College {id: $college_id})
                UNWIND $policies AS row
                MERGE (policy:Policy {id: row.id})
                ON CREATE SET policy.phase4b_created = true
                SET policy:Entity,
                    policy += row.properties,
                    policy.phase4b_patch_id = $patch_id
                MERGE (policy)-[b:BELONGS_TO]->(college)
                SET b.phase4b_patch_id = $patch_id,
                    b.created_by = $phase4b_source,
                    b.patched_at = $patched_at
                MERGE (college)-[s:SUPPORTS_POLICY_QUERY]->(policy)
                SET s.phase4b_patch_id = $patch_id,
                    s.created_by = $phase4b_source,
                    s.patched_at = $patched_at,
                    s.query_family = row.properties.policy_type
                RETURN count(policy) AS policies
                """,
                {"college_id": COLLEGE_ID, "policies": self._policy_nodes()},
            ),
            CypherOperation(
                "connect_programs_to_tuition_and_scholarship_policy_paths",
                """
                MATCH (tuition:Policy {id: "POLICY_CAI_TUITION_PATHWAY"})
                MATCH (scholarshipPolicy:Policy {id: "POLICY_CAI_SCHOLARSHIP_PATHWAY"})
                MATCH (advising:Policy {id: "POLICY_CAI_ACADEMIC_ADVISING_PATHWAY"})
                MATCH (program:Program)
                WHERE program.id IN $program_ids
                MERGE (program)-[t:HAS_TUITION_PATHWAY]->(tuition)
                SET t.phase4b_patch_id = $patch_id, t.created_by = $phase4b_source, t.patched_at = $patched_at
                MERGE (program)-[s:HAS_SCHOLARSHIP_POLICY]->(scholarshipPolicy)
                SET s.phase4b_patch_id = $patch_id, s.created_by = $phase4b_source, s.patched_at = $patched_at
                MERGE (program)-[a:HAS_ADVISING_PATHWAY]->(advising)
                SET a.phase4b_patch_id = $patch_id, a.created_by = $phase4b_source, a.patched_at = $patched_at
                RETURN count(program) AS program_policy_paths
                """,
                {"program_ids": [INTELLIGENT_SYSTEMS_ID, DATA_SCIENCE_ID]},
            ),
        ]
        return self._apply_and_validate("curriculum_intelligence", operations)

    # ------------------------------------------------------------------
    # 7. Duplicate cleanup
    # ------------------------------------------------------------------
    def cleanup_duplicates(self) -> StageResult:
        operations = [
            CypherOperation(
                "isolate_weak_course_duplicates",
                """
                MATCH (weak:Course), (canonical:Course)
                WHERE elementId(weak) <> elementId(canonical)
                  AND toLower(coalesce(weak.name, "")) = toLower(coalesce(canonical.name, ""))
                  AND weak.course_code IS NULL
                  AND canonical.course_code IS NOT NULL
                WITH weak, canonical
                ORDER BY canonical.id
                WITH weak, collect(canonical)[0] AS canonical
                MERGE (weak)-[same:IS_SAME_ENTITY]->(canonical)
                SET same.phase4b_patch_id = $patch_id,
                    same.created_by = $phase4b_source,
                    same.patched_at = $patched_at,
                    same.confidence = 0.97,
                    same.reason = "Phase 4B weak course alias isolated in favor of coded canonical course"
                SET weak.phase4b_status = "weak_duplicate_isolated",
                    weak.demo_hidden = true,
                    weak.canonical_id = canonical.id,
                    weak.phase4b_patch_id = $patch_id
                RETURN count(weak) AS weak_duplicates_isolated
                """,
            ),
            *self._rewire_duplicate_operations(),
        ]

        if self.config.delete_isolated_duplicates:
            operations.append(
                CypherOperation(
                    "delete_isolated_weak_course_duplicates",
                    """
                    MATCH (weak:Course)
                    WHERE weak.phase4b_status = "weak_duplicate_isolated"
                      AND weak.demo_hidden = true
                    WITH weak
                    DETACH DELETE weak
                    RETURN count(*) AS deleted_weak_duplicates
                    """,
                    risk="high",
                )
            )
        return self._apply_and_validate("duplicate_cleanup", operations)

    # ------------------------------------------------------------------
    # 8. Integrity validation
    # ------------------------------------------------------------------
    def validate_graph_integrity(self, stage: str = "final") -> dict[str, Any]:
        checks: dict[str, Any] = {"stage": stage, "checked_at": utc_now()}
        checks["counts"] = self.client.read(
            """
            MATCH (n)
            WITH count(n) AS node_count
            MATCH ()-[r]->()
            RETURN node_count, count(r) AS relationship_count
            """
        )[0]
        checks["blank_nodes"] = self.client.read(
            """
            MATCH (n)
            WHERE size(labels(n)) = 0 OR (n.id IS NULL AND n.name IS NULL AND n.degree_name IS NULL)
            RETURN count(n) AS blank_or_unidentified_nodes,
                   collect({element_id: elementId(n), labels: labels(n), properties: properties(n)})[0..10] AS samples
            """
        )[0]
        checks["hany_bridge"] = self.client.read(
            """
            MATCH (canonical:Professor {id: $hany_canonical_id})
            OPTIONAL MATCH (alias)-[same:IS_SAME_ENTITY]->(canonical)
            OPTIONAL MATCH (canonical)-[teaches:TEACHES]->(course:Course)
            OPTIONAL MATCH (canonical)-[heads:HEAD_OF]->(unit)
            RETURN canonical.name AS canonical_name,
                   canonical.role AS role,
                   canonical.title AS title,
                   count(DISTINCT same) AS same_entity_bridges,
                   collect(DISTINCT course.name) AS teaches,
                   collect(DISTINCT coalesce(unit.name, unit.full_name, unit.id)) AS heads
            """,
            {"hany_canonical_id": HANY_CANONICAL_ID},
        )[0]
        checks["weak_duplicates"] = self.client.read(
            """
            MATCH (weak:Course)
            WHERE weak.phase4b_status = "weak_duplicate_isolated"
            RETURN count(weak) AS isolated_weak_course_duplicates,
                   collect({id: weak.id, name: weak.name, canonical_id: weak.canonical_id})[0..20] AS samples
            """
        )[0]
        checks["same_name_duplicates_remaining"] = self.client.read(
            """
            MATCH (n)
            WITH n, coalesce(n.name, n.degree_name, n.title, n.id) AS raw_name
            WHERE raw_name IS NOT NULL AND trim(toString(raw_name)) <> ""
            WITH toLower(trim(toString(raw_name))) AS normalized_name,
                 collect({element_id: elementId(n), labels: labels(n), id: n.id, status: n.phase4b_status}) AS nodes
            WHERE size(nodes) > 1
            RETURN count(*) AS duplicate_name_clusters,
                   collect({name: normalized_name, nodes: nodes})[0..10] AS samples
            """
        )[0]
        checks["phase4b_relationships"] = self.client.read(
            """
            MATCH ()-[r]->()
            WHERE r.phase4b_patch_id IS NOT NULL
            RETURN type(r) AS type, count(r) AS count
            ORDER BY count DESC, type
            """
        )
        checks["status"] = self._integrity_status(checks)
        self.log["validations"][f"integrity_{stage}"] = checks
        return checks

    # ------------------------------------------------------------------
    # Mandatory golden/demo validation suite
    # ------------------------------------------------------------------
    def run_validation_suite(self) -> list[ValidationResult]:
        specs: list[tuple[str, str, dict[str, Any], Callable[[list[dict[str, Any]]], bool]]] = [
            (
                "Who is Hany Hanafy?",
                """
                MATCH (p)
                WHERE p.id IN $hany_ids OR toLower(coalesce(p.name, "")) = toLower($hany_name)
                OPTIONAL MATCH (p)-[r:IS_SAME_ENTITY|ACTS_AS|HAS_ROLE|HEAD_OF|WORKS_IN|TEACHES]-(m)
                RETURN count(DISTINCT p) AS anchor_count,
                       count(DISTINCT r) AS link_count,
                       count(DISTINCT m) AS related_count,
                       collect(DISTINCT coalesce(p.title, p.role, p.name, p.id))[0..10] AS evidence
                """,
                {"hany_ids": HANY_ALIAS_IDS, "hany_name": HANY_NAME},
                lambda rows: rows and rows[0]["anchor_count"] >= 1 and rows[0]["link_count"] >= 3,
            ),
            (
                "What does Hany Hanafy teach?",
                """
                MATCH (p)-[:TEACHES]->(course:Course)
                WHERE p.id IN $hany_ids OR toLower(coalesce(p.name, "")) = toLower($hany_name)
                RETURN count(DISTINCT p) AS anchor_count,
                       count(DISTINCT course) AS related_count,
                       count(DISTINCT course) AS link_count,
                       collect(DISTINCT course.name) AS evidence
                """,
                {"hany_ids": HANY_ALIAS_IDS, "hany_name": HANY_NAME},
                lambda rows: rows
                and {"Natural Language Processing", "Cognitive Computing"}.issubset(set(rows[0]["evidence"])),
            ),
            (
                "Head of quality unit?",
                """
                MATCH (person)-[r:HEAD_OF|MANAGES]->(unit)
                WHERE toLower(coalesce(unit.name, unit.full_name, unit.id, "")) CONTAINS "quality"
                RETURN count(DISTINCT person) AS anchor_count,
                       count(DISTINCT r) AS link_count,
                       count(DISTINCT unit) AS related_count,
                       collect(DISTINCT coalesce(person.name, person.id) + " -> " + coalesce(unit.name, unit.full_name, unit.id))[0..10] AS evidence
                """,
                {},
                lambda rows: rows and rows[0]["anchor_count"] >= 1 and rows[0]["link_count"] >= 1,
            ),
            (
                "AI prerequisites?",
                """
                MATCH (program:Program {id: $program_id})-[:HAS_COURSE]->(course:Course)
                MATCH (course)-[r:HAS_PREREQUISITE|RECOMMENDED_AFTER]->(prior:Course)
                RETURN count(DISTINCT program) AS anchor_count,
                       count(DISTINCT r) AS link_count,
                       count(DISTINCT course) + count(DISTINCT prior) AS related_count,
                       collect(DISTINCT course.name + " after " + prior.name)[0..12] AS evidence
                """,
                {"program_id": INTELLIGENT_SYSTEMS_ID},
                lambda rows: rows and rows[0]["link_count"] >= 4,
            ),
            (
                "Compare AI vs Cybersecurity",
                """
                MATCH (ai)
                WHERE ai.id IN $ai_ids
                MATCH (cyber:Track {id: "TRACK_CYBERSECURITY_REFERENCE"})
                OPTIONAL MATCH (ai)-[r:COMPARES_WITH|SPECIALIZES_IN|CAREER_ALIGNMENT|LEADS_TO]-(x)
                OPTIONAL MATCH (cyber)-[cr:CAREER_ALIGNMENT|LEADS_TO]->(role:CareerRole)
                RETURN count(DISTINCT ai) AS anchor_count,
                       count(DISTINCT r) + count(DISTINCT cr) AS link_count,
                       count(DISTINCT cyber) + count(DISTINCT x) + count(DISTINCT role) AS related_count,
                       collect(DISTINCT coalesce(ai.name, ai.id))[0..5] +
                       collect(DISTINCT cyber.name)[0..5] +
                       collect(DISTINCT role.name)[0..5] AS evidence
                """,
                {
                    "ai_ids": [
                        INTELLIGENT_SYSTEMS_ID,
                        "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE",
                        "TRACK_AI_FOUNDATIONS",
                    ]
                },
                lambda rows: rows and rows[0]["anchor_count"] >= 1 and rows[0]["link_count"] >= 2,
            ),
            (
                "Career roadmap",
                """
                MATCH (source)-[r:LEADS_TO|CAREER_ALIGNMENT]->(role:CareerRole)
                WHERE source.id IN $ai_ids
                RETURN count(DISTINCT source) AS anchor_count,
                       count(DISTINCT r) AS link_count,
                       count(DISTINCT role) AS related_count,
                       collect(DISTINCT coalesce(source.name, source.id) + " -> " + role.name)[0..12] AS evidence
                """,
                {
                    "ai_ids": [
                        INTELLIGENT_SYSTEMS_ID,
                        "TRACK_AI_FOUNDATIONS",
                        "TRACK_NATURAL_LANGUAGE_PROCESSING",
                        "TRACK_COGNITIVE_COMPUTING",
                    ]
                },
                lambda rows: rows and rows[0]["link_count"] >= 4,
            ),
            (
                "Tuition pathways",
                """
                MATCH (college:College {id: $college_id})-[r:SUPPORTS_POLICY_QUERY|HAS_TUITION_PATHWAY]->(policy:Policy)
                WHERE policy.policy_type = "tuition"
                   OR toLower(coalesce(policy.name, "")) CONTAINS "tuition"
                RETURN count(DISTINCT college) AS anchor_count,
                       count(DISTINCT r) AS link_count,
                       count(DISTINCT policy) AS related_count,
                       collect(DISTINCT policy.name)[0..10] AS evidence
                """,
                {"college_id": COLLEGE_ID},
                lambda rows: rows and rows[0]["related_count"] >= 1,
            ),
            (
                "Scholarships",
                """
                MATCH (program:Program)-[r:HAS_SCHOLARSHIP]->(scholarship:Scholarship)
                OPTIONAL MATCH (program)-[policyRel:HAS_SCHOLARSHIP_POLICY]->(policy:Policy)
                RETURN count(DISTINCT program) AS anchor_count,
                       count(DISTINCT r) + count(DISTINCT policyRel) AS link_count,
                       count(DISTINCT scholarship) + count(DISTINCT policy) AS related_count,
                       collect(DISTINCT program.name + " -> " + scholarship.name)[0..10] +
                       collect(DISTINCT policy.name)[0..5] AS evidence
                """,
                {},
                lambda rows: rows and rows[0]["link_count"] >= 2,
            ),
            (
                "Academic advising",
                """
                MATCH (college:College {id: $college_id})-[r:SUPPORTS_POLICY_QUERY|HAS_ADVISING_PATHWAY]->(policy:Policy)
                WHERE policy.policy_type = "academic_advising"
                OPTIONAL MATCH (program:Program)-[pr:HAS_ADVISING_PATHWAY]->(policy)
                RETURN count(DISTINCT college) AS anchor_count,
                       count(DISTINCT r) + count(DISTINCT pr) AS link_count,
                       count(DISTINCT policy) + count(DISTINCT program) AS related_count,
                       collect(DISTINCT coalesce(policy.name, policy.id))[0..10] AS evidence
                """,
                {"college_id": COLLEGE_ID},
                lambda rows: rows and rows[0]["related_count"] >= 1 and rows[0]["link_count"] >= 1,
            ),
        ]

        results: list[ValidationResult] = []
        for name, cypher, params, predicate in specs:
            try:
                rows = self.client.read(cypher, params)
                row = rows[0] if rows else {}
                success = bool(predicate(rows))
                node_count = int(row.get("anchor_count", 0) or 0) + int(row.get("related_count", 0) or 0)
                link_count = int(row.get("link_count", 0) or 0)
                quality = self._path_quality(node_count, link_count)
                results.append(
                    ValidationResult(
                        name=name,
                        success=success,
                        path_quality=quality,
                        node_count=node_count,
                        link_count=link_count,
                        deterministic_ready=success and quality in {"MEDIUM", "HIGH"},
                        evidence=[str(item) for item in (row.get("evidence") or []) if item],
                    )
                )
            except Exception as exc:
                results.append(
                    ValidationResult(
                        name=name,
                        success=False,
                        path_quality="ERROR",
                        node_count=0,
                        link_count=0,
                        deterministic_ready=False,
                        evidence=[],
                        error=str(exc),
                    )
                )

        self.log["validations"]["demo_suite"] = [r.__dict__ for r in results]
        return results

    # ------------------------------------------------------------------
    # 9. Export
    # ------------------------------------------------------------------
    def export_updated_graph(self) -> dict[str, Any]:
        nodes = self.client.read(
            """
            MATCH (n)
            RETURN elementId(n) AS element_id,
                   labels(n) AS labels,
                   properties(n) AS properties
            ORDER BY element_id
            """
        )
        relationships = self.client.read(
            """
            MATCH (a)-[r]->(b)
            RETURN elementId(r) AS element_id,
                   type(r) AS type,
                   elementId(a) AS start_element_id,
                   elementId(b) AS end_element_id,
                   properties(r) AS properties
            ORDER BY element_id
            """
        )
        nodes_by_eid = {node["element_id"]: node for node in nodes}
        connected: set[str] = set()
        rows: list[dict[str, Any]] = []
        for rel in relationships:
            start = nodes_by_eid.get(rel["start_element_id"])
            end = nodes_by_eid.get(rel["end_element_id"])
            if not start or not end:
                continue
            connected.add(start["element_id"])
            connected.add(end["element_id"])
            rows.append({"n": self._export_node(start), "r": self._export_relationship(rel), "m": self._export_node(end)})
        for node in nodes:
            if node["element_id"] not in connected:
                rows.append({"n": self._export_node(node)})

        payload = {
            "metadata": {
                "kind": "phase4b_updated_graph_export",
                "created_at": utc_now(),
                "database": self.config.database,
                "patch_id": self.config.patch_id,
                "dry_run": self.config.dry_run,
                "node_count": len(nodes),
                "relationship_count": len(relationships),
                "row_count": len(rows),
            },
            "nodes": nodes,
            "relationships": relationships,
            "rows": rows,
        }
        payload["metadata"]["checksum_sha256"] = stable_checksum({"nodes": nodes, "relationships": relationships})
        write_json(self.config.export_path, payload)
        self.log["outputs"]["relationship_phase4b.json"] = str(self.config.export_path)
        return payload

    # ------------------------------------------------------------------
    # 10. Metrics report
    # ------------------------------------------------------------------
    def generate_metrics_report(self, validation_results: list[ValidationResult] | None = None) -> str:
        label_counts = self.client.read(
            """
            MATCH (n)
            UNWIND labels(n) AS label
            RETURN label, count(*) AS count
            ORDER BY count DESC, label
            """
        )
        relationship_counts = self.client.read(
            """
            MATCH ()-[r]->()
            RETURN type(r) AS type, count(*) AS count
            ORDER BY count DESC, type
            """
        )
        patch_counts = self.client.read(
            """
            MATCH ()-[r]->()
            WHERE r.phase4b_patch_id IS NOT NULL
            RETURN type(r) AS type, count(*) AS count
            ORDER BY count DESC, type
            """
        )
        duplicate_summary = self.detect_duplicates()
        split_summary = self.detect_split_identities()
        integrity = self.validate_graph_integrity("metrics")
        validation_results = validation_results or []

        lines = [
            "# Phase 4B Graph Metrics Report",
            "",
            f"- Generated at: `{utc_now()}`",
            f"- Patch ID: `{self.config.patch_id}`",
            f"- Database: `{self.config.database}`",
            f"- Mode: `{'DRY_RUN' if self.config.dry_run else 'APPLIED'}`",
            f"- Integrity status: `{integrity.get('status')}`",
            "",
            "## Node Inventory",
            "",
            "| Label | Count |",
            "|---|---:|",
        ]
        lines.extend(f"| {row['label']} | {row['count']} |" for row in label_counts)
        lines.extend(["", "## Relationship Inventory", "", "| Type | Count |", "|---|---:|"])
        lines.extend(f"| {row['type']} | {row['count']} |" for row in relationship_counts)
        lines.extend(["", "## Phase 4B Relationship Additions", "", "| Type | Count |", "|---|---:|"])
        if patch_counts:
            lines.extend(f"| {row['type']} | {row['count']} |" for row in patch_counts)
        else:
            lines.append("| None | 0 |")

        lines.extend(
            [
                "",
                "## Duplicate And Split-Identity Audit",
                "",
                f"- Same-name duplicate clusters: `{len(duplicate_summary.get('same_name_clusters', []))}`",
                f"- Weak course aliases detected: `{len(duplicate_summary.get('weak_course_aliases', []))}`",
                f"- Person/Professor split identities: `{len(split_summary.get('person_professor_splits', []))}`",
                f"- Admin fragments: `{len(split_summary.get('admin_fragments', []))}`",
                "",
                "## Demo Validation Suite",
                "",
                "| Check | Success | Path Quality | Nodes | Links | Deterministic Ready | Evidence |",
                "|---|---:|---|---:|---:|---:|---|",
            ]
        )
        if validation_results:
            for result in validation_results:
                evidence = "; ".join(result.evidence[:4]).replace("|", "\\|")
                lines.append(
                    f"| {result.name} | {str(result.success)} | {result.path_quality} | "
                    f"{result.node_count} | {result.link_count} | {str(result.deterministic_ready)} | {evidence} |"
                )
        else:
            lines.append("| Not run | False | N/A | 0 | 0 | False | |")

        lines.extend(
            [
                "",
                "## Operational Notes",
                "",
                "- Identity repair uses `IS_SAME_ENTITY` and `ACTS_AS`; it does not destructive-merge people.",
                "- Weak course duplicates are isolated by default with `demo_hidden=true` and `canonical_id`.",
                "- New governance, policy, and curriculum bridge records are tagged with `phase4b_patch_id`.",
                "- `--delete-isolated-duplicates` is intentionally opt-in because it is destructive.",
                "",
                "## Rollback",
                "",
                f"- Tagged rollback: `python phase4b_patch.py --rollback --apply --backup-file {self.config.backup_path}`",
                "- Full database restore, if required, should use the pre-patch backup exported before mutation.",
            ]
        )
        report = "\n".join(lines) + "\n"
        self.config.metrics_path.write_text(report, encoding="utf-8")
        self.log["outputs"]["graph_metrics_phase4b.md"] = str(self.config.metrics_path)
        return report

    # ------------------------------------------------------------------
    # Rollback protection
    # ------------------------------------------------------------------
    def rollback_phase4b(self) -> StageResult:
        if self.config.backup_file and not self.config.backup_file.exists():
            raise FileNotFoundError(f"Backup file not found: {self.config.backup_file}")
        operations = [
            CypherOperation(
                "remove_phase4b_relationships",
                """
                MATCH ()-[r]->()
                WHERE r.phase4b_patch_id IS NOT NULL
                WITH r
                DELETE r
                RETURN count(*) AS removed_relationships
                """,
                risk="medium",
            ),
            CypherOperation(
                "remove_phase4b_created_nodes",
                """
                MATCH (n)
                WHERE n.phase4b_created = true
                WITH n
                DETACH DELETE n
                RETURN count(*) AS removed_nodes
                """,
                risk="medium",
            ),
            CypherOperation(
                "remove_phase4b_enriched_properties",
                """
                MATCH (n)
                FOREACH (_ IN CASE WHEN n.phase4b_enriched_name = true THEN [1] ELSE [] END |
                  REMOVE n.name
                )
                FOREACH (_ IN CASE WHEN n.phase4b_enriched_role = true THEN [1] ELSE [] END |
                  REMOVE n.role
                )
                FOREACH (_ IN CASE WHEN n.phase4b_enriched_title = true THEN [1] ELSE [] END |
                  REMOVE n.title
                )
                REMOVE n.phase4b_enriched_name,
                       n.phase4b_enriched_role,
                       n.phase4b_enriched_title,
                       n.phase4b_identity_hardened,
                       n.phase4b_canonical,
                       n.phase4b_canonical_id,
                       n.phase4b_status,
                       n.phase4b_patch_id,
                       n.phase4b_fragment_repaired,
                       n.demo_hidden,
                       n.canonical_id
                RETURN count(n) AS scanned_nodes
                """,
                risk="medium",
            ),
        ]
        return self._apply_and_validate("rollback_phase4b", operations)

    # ------------------------------------------------------------------
    # Orchestration
    # ------------------------------------------------------------------
    def run(self) -> None:
        if self.config.rollback:
            stage = self.rollback_phase4b()
            self.log["stages"].append(stage.__dict__)
            validation_results = self.run_validation_suite()
            self.export_updated_graph()
            self.generate_metrics_report(validation_results)
            self._finish_log()
            return

        if not self.config.validate_only and not self.config.export_only and not self.config.metrics_only:
            self.backup_graph()
            self.detect_duplicates()
            self.detect_split_identities()

        if self.config.detect_only:
            self._finish_log()
            return

        if not any([self.config.validate_only, self.config.export_only, self.config.metrics_only]):
            for stage_fn in [
                self.patch_identity_bridges,
                self.patch_institutional_hierarchy,
                self.patch_curriculum_intelligence,
                self.cleanup_duplicates,
            ]:
                stage = stage_fn()
                self.log["stages"].append(stage.__dict__)

        validation_results: list[ValidationResult] = []
        if not self.config.export_only and not self.config.metrics_only:
            self.validate_graph_integrity("final")
            validation_results = self.run_validation_suite()

        if not self.config.validate_only and not self.config.metrics_only:
            self.export_updated_graph()

        if not self.config.export_only:
            self.generate_metrics_report(validation_results)

        self._finish_log()

    def _apply_and_validate(self, stage_name: str, operations: list[CypherOperation]) -> StageResult:
        stage = self.client.write_stage(stage_name, operations)
        try:
            stage.validation = self.validate_graph_integrity(stage_name)
        except Exception as exc:
            stage.validation = {"status": "validation_failed", "error": str(exc)}
            if stage.status != "dry_run":
                raise
        return stage

    def _finish_log(self) -> None:
        self.log["finished_at"] = utc_now()
        write_json(self.config.log_path, self.log)
        self.log["outputs"]["phase4b_patch_log.json"] = str(self.config.log_path)

    # ------------------------------------------------------------------
    # Source-export intelligence
    # ------------------------------------------------------------------
    def _analyze_source_exports(self) -> dict[str, Any]:
        findings: dict[str, Any] = {}
        for key, path in {
            "relationship": self.config.source_relationship,
            "historical": self.config.source_historical,
        }.items():
            if not path.exists():
                findings[key] = {"exists": False, "path": str(path)}
                continue
            try:
                nodes, relationships = parse_neo4j_export(path)
                names: dict[str, list[dict[str, Any]]] = defaultdict(list)
                for node in nodes.values():
                    props = node.get("properties", {})
                    name = props.get("name") or props.get("degree_name") or props.get("title") or props.get("id")
                    if name:
                        names[str(name).strip().lower()].append(
                            {
                                "identity": node.get("identity"),
                                "labels": node.get("labels", []),
                                "id": props.get("id"),
                                "name": props.get("name") or props.get("degree_name"),
                            }
                        )
                duplicates = {name: items for name, items in names.items() if len(items) > 1}
                findings[key] = {
                    "exists": True,
                    "path": str(path),
                    "node_count": len(nodes),
                    "relationship_count": len(relationships),
                    "duplicate_name_clusters": duplicates,
                }
            except Exception as exc:
                findings[key] = {"exists": True, "path": str(path), "error": str(exc)}
        return findings

    @staticmethod
    def _integrity_status(checks: dict[str, Any]) -> str:
        blank_count = checks.get("blank_nodes", {}).get("blank_or_unidentified_nodes", 0) or 0
        hany = checks.get("hany_bridge", {})
        if blank_count > 0:
            return "WARN_BLANK_NODES"
        if not hany.get("canonical_name") or not hany.get("teaches"):
            return "WARN_IDENTITY_INCOMPLETE"
        return "PASS"

    @staticmethod
    def _path_quality(node_count: int, link_count: int) -> str:
        if node_count >= 5 and link_count >= 4:
            return "HIGH"
        if node_count >= 2 and link_count >= 1:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _export_node(node: dict[str, Any]) -> dict[str, Any]:
        return {
            "elementId": node.get("element_id"),
            "labels": node.get("labels", []),
            "properties": node.get("properties", {}),
        }

    @staticmethod
    def _export_relationship(rel: dict[str, Any]) -> dict[str, Any]:
        return {
            "elementId": rel.get("element_id"),
            "type": rel.get("type"),
            "startElementId": rel.get("start_element_id"),
            "endElementId": rel.get("end_element_id"),
            "properties": rel.get("properties", {}),
        }

    # ------------------------------------------------------------------
    # Patch data derived from project graph exports and existing routing
    # priorities. These are relationship seeds, not a graph rebuild.
    # ------------------------------------------------------------------
    @staticmethod
    def _track_nodes() -> list[dict[str, Any]]:
        return [
            {
                "id": "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE",
                "properties": {
                    "name": "Artificial Intelligence",
                    "track_type": "comparison_reference",
                    "description": "AI comparison and roadmap reference track for KG routing.",
                    "data_source_type": "phase4b_authoritative_bridge",
                },
            },
            {
                "id": "TRACK_AI_FOUNDATIONS",
                "properties": {
                    "name": "AI Foundations",
                    "track_type": "curriculum",
                    "description": "Foundation path for Intelligent Systems and AI curriculum reasoning.",
                    "data_source_type": "phase4b_authoritative_bridge",
                },
            },
            {
                "id": "TRACK_NATURAL_LANGUAGE_PROCESSING",
                "properties": {
                    "name": "Natural Language Processing",
                    "track_type": "curriculum",
                    "description": "NLP path connected to Natural Language Processing and Cognitive Computing.",
                    "data_source_type": "official",
                },
            },
            {
                "id": "TRACK_COGNITIVE_COMPUTING",
                "properties": {
                    "name": "Cognitive Computing",
                    "track_type": "curriculum",
                    "description": "Cognitive Computing path for multimodal and explainable AI topics.",
                    "data_source_type": "official",
                },
            },
            {
                "id": "TRACK_DATA_SCIENCE",
                "properties": {
                    "name": "Data Science",
                    "track_type": "curriculum",
                    "description": "Data Science path connected to statistics, data mining, and big data analytics.",
                    "data_source_type": "official",
                },
            },
            {
                "id": "TRACK_CYBERSECURITY_REFERENCE",
                "properties": {
                    "name": "Cybersecurity",
                    "track_type": "comparison_reference",
                    "description": "Decision-engine comparison reference; not asserted as a CAI offered program.",
                    "data_source_type": "phase4b_decision_reference",
                },
            },
        ]

    @staticmethod
    def _career_role_nodes() -> list[dict[str, Any]]:
        return [
            {
                "id": "CAREERROLE_NLP_ENGINEER",
                "properties": {
                    "name": "NLP Engineer",
                    "data_source_type": "phase4b_curriculum_bridge",
                },
            },
            {
                "id": "CAREERROLE_COGNITIVE_AI_ENGINEER",
                "properties": {
                    "name": "Cognitive AI Engineer",
                    "data_source_type": "phase4b_curriculum_bridge",
                },
            },
            {
                "id": "CAREERROLE_CYBERSECURITY_ANALYST",
                "properties": {
                    "name": "Cybersecurity Analyst",
                    "data_source_type": "phase4b_decision_reference",
                },
            },
            {
                "id": "CAREERROLE_SECURITY_ENGINEER",
                "properties": {
                    "name": "Security Engineer",
                    "data_source_type": "phase4b_decision_reference",
                },
            },
        ]

    @staticmethod
    def _program_course_edges() -> list[dict[str, Any]]:
        return [
            {"program_id": INTELLIGENT_SYSTEMS_ID, "course_id": "COURSE_IN311", "curriculum_bucket": "core"},
            {"program_id": DATA_SCIENCE_ID, "course_id": "COURSE_DS313", "curriculum_bucket": "core"},
        ]

    @staticmethod
    def _program_track_edges() -> list[dict[str, Any]]:
        return [
            {
                "program_id": INTELLIGENT_SYSTEMS_ID,
                "track_id": "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE",
                "data_source_type": "phase4b_authoritative_bridge",
                "confidence": 0.96,
            },
            {
                "program_id": INTELLIGENT_SYSTEMS_ID,
                "track_id": "TRACK_AI_FOUNDATIONS",
                "data_source_type": "official",
                "confidence": 0.95,
            },
            {
                "program_id": INTELLIGENT_SYSTEMS_ID,
                "track_id": "TRACK_NATURAL_LANGUAGE_PROCESSING",
                "data_source_type": "official",
                "confidence": 0.92,
            },
            {
                "program_id": INTELLIGENT_SYSTEMS_ID,
                "track_id": "TRACK_COGNITIVE_COMPUTING",
                "data_source_type": "official",
                "confidence": 0.9,
            },
            {
                "program_id": DATA_SCIENCE_ID,
                "track_id": "TRACK_DATA_SCIENCE",
                "data_source_type": "official",
                "confidence": 0.95,
            },
        ]

    @staticmethod
    def _course_track_edges() -> list[dict[str, Any]]:
        official = "official"
        bridge = "phase4b_curriculum_bridge"
        return [
            {"course_id": "COURSE_FUNDAMENTALS_OF_AI", "track_id": "TRACK_AI_FOUNDATIONS", "curriculum_role": "foundation", "data_source_type": official, "confidence": 0.95},
            {"course_id": "COURSE_LINEAR_ALGEBRA", "track_id": "TRACK_AI_FOUNDATIONS", "curriculum_role": "foundation", "data_source_type": official, "confidence": 0.9},
            {"course_id": "COURSE_PROBABILITY_AND_STATISTICS", "track_id": "TRACK_AI_FOUNDATIONS", "curriculum_role": "foundation", "data_source_type": official, "confidence": 0.9},
            {"course_id": "COURSE_IN221", "track_id": "TRACK_AI_FOUNDATIONS", "curriculum_role": "core", "data_source_type": official, "confidence": 0.96},
            {"course_id": "COURSE_IN311", "track_id": "TRACK_AI_FOUNDATIONS", "curriculum_role": "advanced_core", "data_source_type": official, "confidence": 0.96},
            {"course_id": "COURSE_NATURAL_LANGUAGE_PROCESSING", "track_id": "TRACK_NATURAL_LANGUAGE_PROCESSING", "curriculum_role": "core", "data_source_type": official, "confidence": 0.98},
            {"course_id": "COURSE_COGNITIVE_COMPUTING", "track_id": "TRACK_COGNITIVE_COMPUTING", "curriculum_role": "specialization", "data_source_type": official, "confidence": 0.96},
            {"course_id": "COURSE_COMPUTER_VISION", "track_id": "TRACK_AI_FOUNDATIONS", "curriculum_role": "core", "data_source_type": official, "confidence": 0.92},
            {"course_id": "COURSE_ETHICS_AND_GOVERNANCE_OF_AI", "track_id": "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE", "curriculum_role": "governance", "data_source_type": official, "confidence": 0.92},
            {"course_id": "COURSE_FUNDAMENTALS_OF_DATA_SCIENCE", "track_id": "TRACK_DATA_SCIENCE", "curriculum_role": "foundation", "data_source_type": official, "confidence": 0.95},
            {"course_id": "COURSE_STATISTICS_FOR_DATA_SCIENCE", "track_id": "TRACK_DATA_SCIENCE", "curriculum_role": "core", "data_source_type": official, "confidence": 0.95},
            {"course_id": "COURSE_DS313", "track_id": "TRACK_DATA_SCIENCE", "curriculum_role": "core", "data_source_type": official, "confidence": 0.96},
            {"course_id": "COURSE_BIG_DATA_ANALYTICS", "track_id": "TRACK_DATA_SCIENCE", "curriculum_role": "advanced_core", "data_source_type": official, "confidence": 0.94},
            {"course_id": "COURSE_INFORMATION_RETRIEVAL_AND_SEARCH_ENGINES", "track_id": "TRACK_NATURAL_LANGUAGE_PROCESSING", "curriculum_role": "supporting_core", "data_source_type": bridge, "confidence": 0.82},
        ]

    @staticmethod
    def _prerequisite_edges() -> list[dict[str, Any]]:
        return [
            {"course_id": "COURSE_IN311", "prerequisite_id": "COURSE_IN221", "data_source_type": "official", "confidence": 0.99},
            {"course_id": "COURSE_DS313", "prerequisite_id": "COURSE_FUNDAMENTALS_OF_DATA_SCIENCE", "data_source_type": "official", "confidence": 0.99},
            {"course_id": "COURSE_IN221", "prerequisite_id": "COURSE_FUNDAMENTALS_OF_AI", "data_source_type": "official", "confidence": 0.99},
        ]

    @staticmethod
    def _recommended_after_edges() -> list[dict[str, Any]]:
        return [
            {
                "course_id": "COURSE_NATURAL_LANGUAGE_PROCESSING",
                "after_course_id": "COURSE_IN221",
                "data_source_type": "phase4b_curriculum_advisory",
                "confidence": 0.86,
                "reason": "Advisory sequencing: NLP is stronger after Machine Learning foundations.",
            },
            {
                "course_id": "COURSE_COGNITIVE_COMPUTING",
                "after_course_id": "COURSE_NATURAL_LANGUAGE_PROCESSING",
                "data_source_type": "phase4b_curriculum_advisory",
                "confidence": 0.86,
                "reason": "Cognitive Computing syllabus builds on NLP and transformer topics.",
            },
            {
                "course_id": "COURSE_COMPUTER_VISION",
                "after_course_id": "COURSE_IN221",
                "data_source_type": "phase4b_curriculum_advisory",
                "confidence": 0.84,
                "reason": "Advisory sequencing: Computer Vision benefits from Machine Learning foundations.",
            },
            {
                "course_id": "COURSE_DS313",
                "after_course_id": "COURSE_STATISTICS_FOR_DATA_SCIENCE",
                "data_source_type": "phase4b_curriculum_advisory",
                "confidence": 0.9,
                "reason": "Data Mining is strengthened by Statistics for Data Science.",
            },
            {
                "course_id": "COURSE_BIG_DATA_ANALYTICS",
                "after_course_id": "COURSE_DS313",
                "data_source_type": "phase4b_curriculum_advisory",
                "confidence": 0.84,
                "reason": "Big Data Analytics follows well after Data Mining concepts.",
            },
            {
                "course_id": "COURSE_INFORMATION_RETRIEVAL_AND_SEARCH_ENGINES",
                "after_course_id": "COURSE_DS313",
                "data_source_type": "phase4b_curriculum_advisory",
                "confidence": 0.8,
                "reason": "Information retrieval can build on mining and search concepts.",
            },
        ]

    @staticmethod
    def _career_alignment_edges() -> list[dict[str, Any]]:
        official = "official"
        bridge = "phase4b_curriculum_bridge"
        decision = "phase4b_decision_reference"
        return [
            {"source_id": "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE", "role_id": "CAREERROLE_AI_ENGINEER", "alignment": "primary", "data_source_type": bridge, "confidence": 0.94},
            {"source_id": "TRACK_AI_FOUNDATIONS", "role_id": "CAREERROLE_MACHINE_LEARNING_ENGINEER", "alignment": "primary", "data_source_type": official, "confidence": 0.94},
            {"source_id": "TRACK_NATURAL_LANGUAGE_PROCESSING", "role_id": "CAREERROLE_NLP_ENGINEER", "alignment": "primary", "data_source_type": bridge, "confidence": 0.9},
            {"source_id": "TRACK_COGNITIVE_COMPUTING", "role_id": "CAREERROLE_COGNITIVE_AI_ENGINEER", "alignment": "primary", "data_source_type": bridge, "confidence": 0.86},
            {"source_id": "TRACK_DATA_SCIENCE", "role_id": "CAREERROLE_DATA_SCIENTIST", "alignment": "primary", "data_source_type": official, "confidence": 0.95},
            {"source_id": "TRACK_DATA_SCIENCE", "role_id": "CAREERROLE_BIG_DATA_ENGINEER", "alignment": "secondary", "data_source_type": official, "confidence": 0.9},
            {"source_id": "COURSE_NATURAL_LANGUAGE_PROCESSING", "role_id": "CAREERROLE_NLP_ENGINEER", "alignment": "course_to_role", "data_source_type": bridge, "confidence": 0.88},
            {"source_id": "COURSE_COGNITIVE_COMPUTING", "role_id": "CAREERROLE_COGNITIVE_AI_ENGINEER", "alignment": "course_to_role", "data_source_type": bridge, "confidence": 0.86},
            {"source_id": "COURSE_IN311", "role_id": "CAREERROLE_MACHINE_LEARNING_ENGINEER", "alignment": "course_to_role", "data_source_type": official, "confidence": 0.92},
            {"source_id": "COURSE_DS313", "role_id": "CAREERROLE_DATA_SCIENTIST", "alignment": "course_to_role", "data_source_type": official, "confidence": 0.92},
            {"source_id": "TRACK_CYBERSECURITY_REFERENCE", "role_id": "CAREERROLE_CYBERSECURITY_ANALYST", "alignment": "comparison_reference", "data_source_type": decision, "confidence": 0.82},
            {"source_id": "TRACK_CYBERSECURITY_REFERENCE", "role_id": "CAREERROLE_SECURITY_ENGINEER", "alignment": "comparison_reference", "data_source_type": decision, "confidence": 0.82},
        ]

    @staticmethod
    def _leads_to_edges() -> list[dict[str, Any]]:
        bridge = "phase4b_curriculum_bridge"
        decision = "phase4b_decision_reference"
        return [
            {"source_id": "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE", "role_id": "CAREERROLE_AI_ENGINEER", "data_source_type": bridge, "confidence": 0.94},
            {"source_id": "TRACK_AI_FOUNDATIONS", "role_id": "CAREERROLE_MACHINE_LEARNING_ENGINEER", "data_source_type": bridge, "confidence": 0.9},
            {"source_id": "TRACK_NATURAL_LANGUAGE_PROCESSING", "role_id": "CAREERROLE_NLP_ENGINEER", "data_source_type": bridge, "confidence": 0.88},
            {"source_id": "TRACK_COGNITIVE_COMPUTING", "role_id": "CAREERROLE_COGNITIVE_AI_ENGINEER", "data_source_type": bridge, "confidence": 0.84},
            {"source_id": "TRACK_CYBERSECURITY_REFERENCE", "role_id": "CAREERROLE_CYBERSECURITY_ANALYST", "data_source_type": decision, "confidence": 0.82},
        ]

    @staticmethod
    def _comparison_edges() -> list[dict[str, Any]]:
        return [
            {
                "left_id": "TRACK_ARTIFICIAL_INTELLIGENCE_REFERENCE",
                "right_id": "TRACK_CYBERSECURITY_REFERENCE",
                "data_source_type": "phase4b_decision_reference",
                "confidence": 0.82,
                "reason": "Demo comparison bridge for AI versus Cybersecurity routing; Cybersecurity is not asserted as a CAI offered program.",
            },
            {
                "left_id": INTELLIGENT_SYSTEMS_ID,
                "right_id": "TRACK_CYBERSECURITY_REFERENCE",
                "data_source_type": "phase4b_decision_reference",
                "confidence": 0.8,
                "reason": "Decision-engine comparison bridge from Intelligent Systems to Cybersecurity reference track.",
            },
        ]

    @staticmethod
    def _policy_nodes() -> list[dict[str, Any]]:
        return [
            {
                "id": "POLICY_CAI_TUITION_PATHWAY",
                "properties": {
                    "name": "Tuition and Fees Pathway",
                    "policy_type": "tuition",
                    "description": "Graph bridge for routing tuition questions to verified tuition policy and decision fee calculation.",
                    "data_source_type": "phase4b_hybrid_route_bridge",
                },
            },
            {
                "id": "POLICY_CAI_SCHOLARSHIP_PATHWAY",
                "properties": {
                    "name": "Scholarship Pathway",
                    "policy_type": "scholarship",
                    "description": "Graph bridge connecting CAI programs to scholarship policy and Excellence Scholarship evidence.",
                    "data_source_type": "phase4b_hybrid_route_bridge",
                },
            },
            {
                "id": "POLICY_CAI_ACADEMIC_ADVISING_PATHWAY",
                "properties": {
                    "name": "Academic Advising Pathway",
                    "policy_type": "academic_advising",
                    "description": "Graph bridge for advising questions that require hybrid KG, RAG, and decision-engine evidence.",
                    "data_source_type": "phase4b_hybrid_route_bridge",
                },
            },
        ]

    @staticmethod
    def _rewire_duplicate_operations() -> list[CypherOperation]:
        operations: list[CypherOperation] = []
        incoming_types = ["HAS_COURSE", "TEACHES", "HAS_PREREQUISITE", "RECOMMENDED_AFTER"]
        outgoing_types = ["HAS_PREREQUISITE", "HAS_SYLLABUS", "RECOMMENDED_AFTER", "PART_OF_TRACK", "CAREER_ALIGNMENT"]
        for rel_type in incoming_types:
            operations.append(
                CypherOperation(
                    f"rewire_incoming_{rel_type.lower()}_from_weak_courses",
                    f"""
                    MATCH (weak:Course)-[:IS_SAME_ENTITY]->(canonical:Course)
                    WHERE weak.phase4b_status = "weak_duplicate_isolated"
                    MATCH (source)-[r:{rel_type}]->(weak)
                    WHERE elementId(source) <> elementId(canonical)
                    MERGE (source)-[nr:{rel_type}]->(canonical)
                    SET nr += properties(r),
                        nr.phase4b_patch_id = $patch_id,
                        nr.phase4b_rewired_from = weak.id,
                        nr.created_by = $phase4b_source,
                        nr.patched_at = $patched_at
                    RETURN count(nr) AS rewired
                    """,
                )
            )
        for rel_type in outgoing_types:
            operations.append(
                CypherOperation(
                    f"rewire_outgoing_{rel_type.lower()}_from_weak_courses",
                    f"""
                    MATCH (weak:Course)-[:IS_SAME_ENTITY]->(canonical:Course)
                    WHERE weak.phase4b_status = "weak_duplicate_isolated"
                    MATCH (weak)-[r:{rel_type}]->(target)
                    WHERE elementId(target) <> elementId(canonical)
                    MERGE (canonical)-[nr:{rel_type}]->(target)
                    SET nr += properties(r),
                        nr.phase4b_patch_id = $patch_id,
                        nr.phase4b_rewired_from = weak.id,
                        nr.created_by = $phase4b_source,
                        nr.patched_at = $patched_at
                    RETURN count(nr) AS rewired
                    """,
                )
            )
        return operations


def parse_neo4j_export(path: Path) -> tuple[dict[Any, dict[str, Any]], list[dict[str, Any]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    nodes: dict[Any, dict[str, Any]] = {}
    relationships: list[dict[str, Any]] = []
    if not isinstance(data, list):
        raise ValueError(f"Expected list export in {path}")
    for row in data:
        if not isinstance(row, dict):
            continue
        for value in row.values():
            if not isinstance(value, dict):
                continue
            if "labels" in value and "identity" in value:
                nodes[value["identity"]] = value
            elif "type" in value and "start" in value and "end" in value:
                relationships.append(value)
    return nodes, relationships


def build_config(argv: list[str]) -> PatchConfig:
    parser = argparse.ArgumentParser(
        description="Phase 4B production-safe Neo4j graph restoration patch.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--apply", action="store_true", help="Apply mutations. Default is dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run even if --apply is omitted.")
    parser.add_argument("--validate-only", action="store_true", help="Run integrity and demo validation only.")
    parser.add_argument("--export-only", action="store_true", help="Export the current graph only.")
    parser.add_argument("--metrics-only", action="store_true", help="Generate metrics report only.")
    parser.add_argument("--detect-only", action="store_true", help="Run backup plus duplicate/split detection only.")
    parser.add_argument("--rollback", action="store_true", help="Remove Phase 4B tagged writes.")
    parser.add_argument("--delete-isolated-duplicates", action="store_true", help="Destructively delete weak duplicate courses after rewiring.")
    parser.add_argument("--backup-file", type=Path, help="Backup file used for rollback audit context.")
    parser.add_argument("--root", type=Path, default=ROOT, help="Project root.")
    parser.add_argument("--output-dir", type=Path, default=None, help="Output directory for backup/export/log/report.")
    parser.add_argument("--env-file", type=Path, default=None, help="Optional .env file with Neo4j credentials.")
    parser.add_argument("--uri", default=None, help="Neo4j URI.")
    parser.add_argument("--user", default=None, help="Neo4j username.")
    parser.add_argument("--password", default=None, help="Neo4j password.")
    parser.add_argument("--database", default=None, help="Neo4j database.")
    parser.add_argument("--relationship", type=Path, default=None, help="Primary relationship.json source.")
    parser.add_argument("--historical", type=Path, default=None, help="Historical Neo4j export source.")
    parser.add_argument("--analysis-clean", type=Path, default=None, help="Clean graph audit source.")
    parser.add_argument("--analysis-raw", type=Path, default=None, help="Raw graph audit source.")
    args = parser.parse_args(argv)

    root = args.root.resolve()
    env_file = args.env_file
    if env_file is None:
        candidate = root / "aast-ai-agent-main" / "backend" / ".env"
        env_file = candidate if candidate.exists() else None
    load_env_file(env_file)

    output_dir = (args.output_dir or root).resolve()
    dry_run = not args.apply or args.dry_run
    patch_id = f"phase4b_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

    return PatchConfig(
        root=root,
        output_dir=output_dir,
        uri=args.uri or os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
        user=args.user or os.environ.get("NEO4J_USER", "neo4j"),
        password=args.password or os.environ.get("NEO4J_PASSWORD", "password"),
        database=args.database or os.environ.get("NEO4J_DATABASE", "neo4j"),
        dry_run=dry_run,
        patch_id=patch_id,
        source_relationship=(args.relationship or root / "relationship.json").resolve(),
        source_historical=(args.historical or root / "neo4j_query_table_data_2026-4-22 (2).json").resolve(),
        source_analysis_clean=(args.analysis_clean or root / "relationship_analysis_clean.txt").resolve(),
        source_analysis_raw=(args.analysis_raw or root / "relationship_analysis.txt").resolve(),
        delete_isolated_duplicates=args.delete_isolated_duplicates,
        validate_only=args.validate_only,
        export_only=args.export_only,
        metrics_only=args.metrics_only,
        detect_only=args.detect_only,
        rollback=args.rollback,
        backup_file=args.backup_file.resolve() if args.backup_file else None,
    )


def print_summary(config: PatchConfig) -> None:
    mode = "DRY_RUN" if config.dry_run else "APPLY"
    print(f"[phase4b] Mode: {mode}")
    print(f"[phase4b] Neo4j: {config.uri} database={config.database} user={config.user}")
    print(f"[phase4b] Patch ID: {config.patch_id}")
    print(f"[phase4b] Outputs: {config.output_dir}")


def main(argv: list[str] | None = None) -> int:
    config = build_config(argv or sys.argv[1:])
    print_summary(config)
    client = Neo4jClient(config)
    try:
        client.verify()
        patcher = Phase4BPatcher(config, client)
        patcher.run()
        print(f"[phase4b] Backup:  {config.backup_path if config.backup_path.exists() else 'not generated'}")
        print(f"[phase4b] Export:  {config.export_path if config.export_path.exists() else 'not generated'}")
        print(f"[phase4b] Metrics: {config.metrics_path if config.metrics_path.exists() else 'not generated'}")
        print(f"[phase4b] Log:     {config.log_path if config.log_path.exists() else 'not generated'}")
        if config.dry_run and not config.validate_only and not config.export_only and not config.metrics_only:
            print("[phase4b] Dry-run completed. Re-run with --apply to mutate Neo4j.")
        return 0
    except Exception as exc:
        print(f"[phase4b] ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
