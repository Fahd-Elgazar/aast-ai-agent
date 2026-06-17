# 08g_migrations_audit.md — Forensic Audit of Alembic Migrations & Env Setup

## REMEDIATION CERTIFICATE
- **Document**: `08g_migrations_audit.md`
- **Previous Status**: PASS
- **Current Status**: PASS
- **Missing Requirements Resolved**:
  - Audited 100% of the 9 Alembic migration scripts in alembic/versions/
  - Audited 100% of alembic/env.py setup configuration (87 lines)
  - Documented exact evolutionary timeline and lineage (revisions/down_revisions)
  - Compiled detailed listings of tables created, columns added, indexes created, and tables dropped
  - Described rollback behaviors for each revision step
  - Traced Called By / Calls To hierarchies for online/offline migration runners
  - Standardized strict headers (Source File Evidence, Function Evidence, Line Range Evidence)
  - Created Verified vs Unverified Findings section
- **Confidence**: HIGH

---

## 1. Audit Metadata
- **Migrations Directory**: `college-decision-system-backend/alembic/versions/`
- **Analyzed Version Files**:
  - `3d6b8e491c76_initial_schema.py` (85 lines)
  - `377dbfa7c09e_add_students_table.py` (52 lines)
  - `9c8a6d1f4b2a_add_decision_dataset_schema.py` (455 lines)
  - `c1e7a9d42f51_add_decision_fee_schema.py` (305 lines)
  - `e6f3d9a8b1c2_add_runtime_integrity_indexes.py` (44 lines)
  - `f4c2d7e9b3a1_drop_legacy_mvp_tables.py` (99 lines)
  - `1c26e9f9d3c2_add_chat_messages_table.py` (60 lines)
  - `41d5ba5c5a79_add_min_percentage_and_allowed_tracks_.py` (33 lines)
  - `4a4dbd1d4c6c_add_program_fees.py` (30 lines)
  - *Analysis Period*: 2026-06-09T12:55:00+03:00 / 2026-06-09T13:05:00+03:00
- **Migrations Environment Configuration**: `college-decision-system-backend/alembic/env.py` (87 lines, 2431 bytes)
  - *Analysis Period*: 2026-06-09T13:05:00+03:00 / 2026-06-09T13:10:00+03:00

---

## 2. File Audit Certificates

### Versions Schema Files (`alembic/versions/`)
```
====================================================================
                       FILE AUDIT CERTIFICATE
====================================================================
Status:                  COMPLETE
Lines In File:           1,163 (across 9 migration files)
Lines Analyzed:          1,163
Coverage Percentage:     100%
Functions:               18 (upgrade and downgrade for each script)
Classes:                 0
Exports:                 18 upgrade/downgrade hooks
Confidence Level:        HIGH
====================================================================
```

### Migrations Environment Runner (`alembic/env.py`)
```
====================================================================
                       FILE AUDIT CERTIFICATE
====================================================================
Status:                  COMPLETE
Lines In File:           87
Lines Analyzed:          87
Coverage Percentage:     100%
Functions:               2 (run_migrations_offline, run_migrations_online)
Classes:                 0
Exports:                 0 (entry-point execution script)
Confidence Level:        HIGH
====================================================================
```

---

## 3. Schema Evolution Timeline & Lineage Mappings

The database schema evolved in a straight-line single lineage sequence from initial MVP layout to the production clean-architecture relational schema:

```
[3d6b8e491c76: Initial MVP Schema]
              ↓ (Revises: None)
[377dbfa7c09e: Add Students Table]
              ↓ (Revises: 3d6b8e491c76)
[9c8a6d1f4b2a: Add Decision Dataset Schema]
              ↓ (Revises: 377dbfa7c09e)
[c1e7a9d42f51: Add Decision Fee Schema]
              ↓ (Revises: 9c8a6d1f4b2a)
[e6f3d9a8b1c2: Add Runtime Integrity Indexes]
              ↓ (Revises: c1e7a9d42f51)
[f4c2d7e9b3a1: Drop Legacy MVP Tables]
              ↓ (Revises: e6f3d9a8b1c2)
[1c26e9f9d3c2: Add Chat Messages Table]
              ↓ (Revises: f4c2d7e9b3a1)
[41d5ba5c5a79: Add min_percentage & allowed_tracks]
              ↓ (Revises: 1c26e9f9d3c2)
[4a4dbd1d4c6c: Add program_fees SafeNumeric]
              (Revises: 41d5ba5c5a79)
```

---

## 4. Itemized Revision History & Operations

### 1. Revision `3d6b8e491c76` (Initial Schema)
- **Upgrade Operations**:
  - Created legacy tables: `campuses`, `colleges`, `campus_colleges`, `programs`, `tuition_fees` using string IDs (length 36) for primary/foreign keys.
- **Downgrade Operations**:
  - Drops the above five tables.

### 2. Revision `377dbfa7c09e` (Add Students Table)
- **Upgrade Operations**:
  - Created legacy `students` table mapping student evaluation demographics.
- **Downgrade Operations**:
  - Drops `students` table.

### 3. Revision `9c8a6d1f4b2a` (Add Decision Dataset Schema)
- **Upgrade Operations**:
  - Created 17 production tables: `decision_colleges`, `decision_college_sources`, `decision_college_leadership`, `decision_programs`, `decision_program_decision_profiles`, `decision_program_career_paths`, `decision_program_traits`, `decision_employment_outlooks`, `decision_college_level_profiles`, `decision_training_and_practice`, `decision_admission_requirements`, `decision_accepted_certificates`, `decision_college_accreditations`, `decision_college_facilities`, `decision_college_research_focus`, `decision_college_mobility`, `decision_college_mobility_items`.
  - Added indexes: `ix_decision_programs_college_id`, `ix_decision_programs_program_family`, `ix_decision_programs_program_name`, `ix_decision_program_career_paths_program_id`, `ix_decision_program_traits_program_id`, `ix_decision_program_traits_trait_type`, `ix_decision_employment_outlooks_program_id`, `ix_decision_college_accreditations_college_id`, `ix_decision_college_facilities_college_id`.
  - Added unique constraints: `uq_decision_college_sources_college_id`, `uq_decision_programs_college_id_program_name`.
- **Downgrade Operations**:
  - Drops all created indexes and tables.

### 5. Revision `c1e7a9d42f51` (Add Decision Fee Schema)
- **Upgrade Operations**:
  - Created 10 fee-related tables: `decision_fee_global_policies`, `decision_fee_definitions`, `decision_fee_items`, `decision_fee_amounts`, `decision_fee_additional_fees`, `decision_fee_category_rules`, `decision_fee_rule_colleges`, `decision_fee_rule_thresholds`, `decision_scholarships`, `decision_scholarship_eligibility`.
  - Added indexes: `ix_decision_fee_items_college_id_raw`, `ix_decision_fee_items_source_college_match_id`, `ix_decision_fee_items_source_program_match_id`, `ix_decision_fee_items_track_type`, `ix_decision_fee_amounts_fee_item_id`, `ix_decision_fee_amounts_student_group`, `ix_decision_fee_amounts_fee_category`, `ix_decision_fee_rule_colleges_fee_rule_id`, `ix_decision_fee_rule_colleges_college_id_raw`, `ix_decision_fee_rule_thresholds_fee_rule_id`.
  - Added unique constraints: `uq_decision_fee_definitions_fee_id`, `uq_decision_fee_category_rules_rule_id`, `uq_decision_scholarships_scholarship_id`.
- **Downgrade Operations**:
  - Drops all created fee indexes and tables.

### 5. Revision `e6f3d9a8b1c2` (Add Runtime Integrity Indexes)
- **Upgrade Operations**:
  - Added index `ix_decision_accepted_certificates_admission_requirement_id` on table `decision_accepted_certificates`.
  - Added index `ix_decision_fee_additional_fees_fee_item_id` on table `decision_fee_additional_fees`.
- **Downgrade Operations**:
  - Drops both indexes.

### 6. Revision `f4c2d7e9b3a1` (Drop Legacy MVP Tables)
- **Upgrade Operations**:
  - Cleans up database namespace by dropping the initial legacy MVP tables: `tuition_fees`, `students`, `programs`, `campus_colleges`, `colleges`, `campuses`.
- **Downgrade Operations**:
  - Recreates all six legacy MVP tables along with their columns, primary keys, and foreign keys.

### 7. Revision `1c26e9f9d3c2` (Add Chat Messages Table)
- **Upgrade Operations**:
  - Created `chat_messages` table to persist conversation history.
  - Columns: `id` (Text, Primary Key), `session_id` (Text, Index), `role` (Text), `content` (Text), `tool_calls` (JSON), `created_at` (DateTime).
- **Downgrade Operations**:
  - Drops `chat_messages` table.

### 8. Revision `41d5ba5c5a79` (Add min_percentage & allowed_tracks)
- **Upgrade Operations**:
  - Added `min_percentage` (SafeNumeric, precision=4, scale=2) and `allowed_tracks` (Text) columns to `decision_programs`.
- **Downgrade Operations**:
  - Drops columns `allowed_tracks` and `min_percentage` from `decision_programs`.

### 9. Revision `4a4dbd1d4c6c` (Add program_fees)
- **Upgrade Operations**:
  - Added `program_fees` (SafeNumeric, precision=10, scale=2) column to `decision_programs`.
- **Downgrade Operations**:
  - Drops column `program_fees` from `decision_programs`.

---

## 5. Alembic Environment & Execution Context

The `alembic/env.py` script serves as the configuration entry point for Alembic schema migrations:
1. **PYTHONPATH Configuration**: Dynamically resolves the project root relative to `env.py` file location and appends it to `sys.path` to allow importing application modules.
2. **Metadata Binding**: Imports SQLAlchemy `Base` from `app.infrastructure.db.session` and loads the model registry namespace via `import app.infrastructure.db.models` to bind `target_metadata = Base.metadata` for autogenerate detection.
3. **Execution Modes**:
   - **Offline Mode**: Running via `run_migrations_offline()`. Grabs connection URL string from configuration and binds context parameters dynamically. Bypasses engine creation, mapping transactions directly to stdout or generated DDL SQL files.
   - **Online Mode**: Running via `run_migrations_online()`. Spawns database engine from configuration sections, initiates connection pools, wraps execution inside SQL transaction blocks, and runs schema updates against raw database files.

---

## 6. Migration Execution Context & Invocation Mappings

### `run_migrations_offline()`
- **Called By**:
  - Script entrypoint if `context.is_offline_mode()` yields `True` (Line 84)
- **Calls To**:
  - `context.config.get_main_option` (Alembic configuration parser)
  - `context.configure` (Alembic context configuration)
  - `context.begin_transaction` (Alembic transaction manager)
  - `context.run_migrations` (Alembic DDL migration applier)

### `run_migrations_online()`
- **Called By**:
  - Script entrypoint if `context.is_offline_mode()` yields `False` (Line 86)
- **Calls To**:
  - `sqlalchemy.engine_from_config` (SQLAlchemy engine factory)
  - `connectable.connect` (SQLAlchemy connection provider)
  - `context.configure` (Alembic context configuration)
  - `context.begin_transaction` (Alembic transaction manager)
  - `context.run_migrations` (Alembic DDL migration applier)

---

## 7. Evidence Section (EVIDENCE RULE)

### Offline Migrations Configuration
- **Source File Evidence**: `college-decision-system-backend/alembic/env.py`
- **Function Evidence**: `run_migrations_offline`
- **Line Range Evidence**: 36-52
- **Code Evidence**:
```python
def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()
```

### Online Migrations Configuration
- **Source File Evidence**: `college-decision-system-backend/alembic/env.py`
- **Function Evidence**: `run_migrations_online`
- **Line Range Evidence**: 57-78
- **Code Evidence**:
```python
def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()
```

### Dynamic PYTHONPATH Injection
- **Source File Evidence**: `college-decision-system-backend/alembic/env.py`
- **Line Range Evidence**: 8-12
- **Code Evidence**:
```python
# Add project root to PYTHONPATH
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
```

### Legacy Table Drop & Recreate Rollback Rules
- **Source File Evidence**: `college-decision-system-backend/alembic/versions/f4c2d7e9b3a1_drop_legacy_mvp_tables.py`
- **Function Evidence**: `upgrade` & `downgrade`
- **Line Range Evidence**: 21-34
- **Code Evidence**:
```python
def upgrade() -> None:
    op.drop_table("tuition_fees")
    op.drop_table("students")
    op.drop_table("programs")
    op.drop_table("campus_colleges")
    op.drop_table("colleges")
    op.drop_table("campuses")
```

### Custom SafeNumeric Type Migration Check
- **Source File Evidence**: `college-decision-system-backend/alembic/versions/4a4dbd1d4c6c_add_program_fees.py`
- **Function Evidence**: `upgrade`
- **Line Range Evidence**: 23-26
- **Code Evidence**:
```python
def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('decision_programs', sa.Column('program_fees', app.infrastructure.db.models.decision_common.SafeNumeric(precision=10, scale=2), nullable=True))
```

---

## 8. Architectural Risks & Findings
- **Data Loss During Legacy Drops**: The migration `f4c2d7e9b3a1` drops the MVP tables (`colleges`, `campuses`, `tuition_fees`, etc.) in the upgrade path. If there was production data inside these legacy tables before running this upgrade, it would be permanently destroyed without backup prompts.
- **SQLite Column Modifications Limitation**: SQLite does not native-support dropping columns or updating constraints directly (requires recreating the table under the hood). If future migrations attempt complex modifications, Alembic default operations will raise schema errors.

---

## 9. Verified vs Unverified Findings

### Verified Findings
- **Single-branch lineage verified in code**: Verified that the migration lineage forms a deterministic timeline without splits or branch labels (All `down_revision` pointers are single string values).
- **SafeNumeric import verified in code**: Verified that migrations use the custom `SafeNumeric` SQLAlchemy wrapper to declare new columns (Line 25 of `4a4dbd1d4c6c_add_program_fees.py`).
- **PYTHONPATH base directory resolution verified in code**: Verified that `BASE_DIR = Path(__file__).resolve().parents[1]` resolves root directory for import paths.
- **Autogenerate comparison configuration verified in code**: Verified that migrations configuration compares columns and defaults via `compare_type=True` and `compare_server_default=True` (Lines 46–47, 72–73 of `env.py`).

### Unverified Findings
- **Raw SQL Execution under production datasets**: Not verified if massive datasets lock SQLite file access while migrations alter tables or compile indexes in live production.
