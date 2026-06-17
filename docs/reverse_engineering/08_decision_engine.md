# 08_decision_engine.md — Forensic Audit of Decision Engine Core

## REMEDIATION CERTIFICATE
- **Document**: `08_decision_engine.md`
- **Previous Status**: PASS
- **Current Status**: PASS
- **Missing Requirements Resolved**:
  - Added explicit Coverage Percentage: 100% for `main.py` and `settings.py`
  - Audited 100% of `app/infrastructure/db/session.py` (42 lines) database engine setup
  - Traced Called By / Calls To hierarchies for core setup functions
  - Documented SQLite connection pragma enforcements and connection listeners
  - Standardized Source File Evidence, Function Evidence, and Line Range Evidence headers
  - Created Verified vs Unverified Findings section
- **Confidence**: HIGH

---

## 1. Audit Metadata
- **Main App File Path**: `college-decision-system-backend/app/main.py`
  - **File Size**: 1,551 bytes
  - **Total Lines**: 52
  - **Analysis Start/End**: 2026-06-09T11:20:00+03:00 / 2026-06-09T11:22:00+03:00
- **Settings File Path**: `college-decision-system-backend/app/config/settings.py`
  - **File Size**: 1,627 bytes
  - **Total Lines**: 53
  - **Analysis Start/End**: 2026-06-09T11:22:00+03:00 / 2026-06-09T11:23:00+03:00
- **Session Init File Path**: `college-decision-system-backend/app/infrastructure/db/session.py`
  - **File Size**: 992 bytes
  - **Total Lines**: 42
  - **Analysis Start/End**: 2026-06-09T13:10:00+03:00 / 2026-06-09T13:13:00+03:00

---

## 2. File Audit Certificates

### Main App (`app/main.py`)
```
====================================================================
                       FILE AUDIT CERTIFICATE
====================================================================
Status:                  COMPLETE
Lines In File:           52
Lines Analyzed:          52
Coverage Percentage:     100%
Functions:               2 (create_app, health_check)
Classes:                 0
Exports:                 1 (FastAPI app instance)
Confidence Level:        HIGH
====================================================================
```

### Settings Config (`app/config/settings.py`)
```
====================================================================
                       FILE AUDIT CERTIFICATE
====================================================================
Status:                  COMPLETE
Lines In File:           53
Lines Analyzed:          53
Coverage Percentage:     100%
Functions:               1 (parse_debug_flag)
Classes:                 1 (Settings)
Exports:                 1 (settings singleton instance)
Confidence Level:        HIGH
====================================================================
```

### Database Session Local (`app/infrastructure/db/session.py`)
```
====================================================================
                       FILE AUDIT CERTIFICATE
====================================================================
Status:                  COMPLETE
Lines In File:           42
Lines Analyzed:          42
Coverage Percentage:     100%
Functions:               1 (configure_sqlite_connection_pragmas)
Classes:                 1 (Base)
Exports:                 3 (Base, engine, SessionLocal)
Confidence Level:        HIGH
====================================================================
```

---

## 3. Subsystem Architecture Overview
The **College Decision Support System** is built using Clean Architecture / Domain-Driven Design (DDD) principles. It is structured into layers:
1. **Web Layer (`app/api/`)**: Declares API routers, endpoints, dependencies, and schemas.
2. **Application Layer (`app/application/`)**: Encapsulates DTOs, services, and use cases (e.g. program recommendation, tuition calculation).
3. **Domain Layer (`app/domain/`)**: Defines entities, rules, scoring algorithms, and value objects representing the core business model.
4. **Infrastructure Layer (`app/infrastructure/`)**: Contains persistence services, repositories, database connection sessions, and SQLAlchemy model schemas.

---

## 4. Environment Variables & Core Configurations
Configuration settings are loaded dynamically using Pydantic settings:
- `APP_NAME` (default `"College Decision Support System"`): Application header title.
- `DEBUG` (default `True`): Toggles debug stack traces.
- `HOST` (default `"127.0.0.1"`) / `PORT` (default `8005`).
- `DATABASE_URL` (default `"sqlite:///./dev.db"`): Target SQLite database endpoint.
- `GEMINI_API_KEY` (type `SecretStr`): Key for AI-agent synthesis.
- `INTERNAL_SECRET_KEY` (type `SecretStr`): Secret token used for service-to-service trust boundary checks.
- `VOICE_ENABLED` (default `True`): Toggles Whisper voice-processing router.
- `VOICE_WHISPER_MODEL` (default `"base"`).
- `VOICE_DEVICE` (default `"cpu"`).
- `VOICE_TEMP_DIR` (default `"."`).
- `VOICE_MAX_UPLOAD_MB` (default `25`).
- `VOICE_FFMPEG_LOCAL_COPY` (default `False`).

---

## 5. Class & Function Level Analysis

### `app/main.py`

#### `create_app()`
- **Called By**:
  - Module level instantiation (Line 51)
- **Calls To**:
  - `fastapi.FastAPI()` (external library)
  - `app.add_middleware()` (external library)
  - `app.include_router()` (external library)
- **Description**: Configures FastAPI application, sets CORS middleware origins, registers routers (`students`, `decisions`, `chat`, `voice`, `admin`), and defines health check endpoint.

#### `health_check()`
- **Called By**:
  - FastAPI routing for `GET /health` (Line 37)
- **Calls To**:
  - `get_voice_runtime_status()` (from `app.application.services.speech_service`)
- **Description**: Returns current health status of the application, including speech system status.

---

### `app/config/settings.py`

#### `parse_debug_flag(value)`
- **Called By**:
  - Pydantic Settings initialization (field validator)
- **Calls To**:
  - None
- **Description**: Parses string representations of truthy/falsy values to set the `DEBUG` boolean variable.

---

### `app/infrastructure/db/session.py`

#### `configure_sqlite_connection_pragmas(engine)`
- **Called By**:
  - Module initialization during startup (Line 34)
- **Calls To**:
  - `sqlalchemy.event.listens_for` (external library event registry)
- **Description**: Binds a connection listener on the SQLAlchemy engine pool. For any SQLite connection connects, it registers a event receiver executing `PRAGMA foreign_keys=ON` to enforce SQLite database relational foreign keys checks.

---

## 6. Execution Flow & Request Lifecycle (CROSS FILE TRACE REQUIREMENT)
```
[HTTP CLIENT / ORCHESTRATOR API REQUEST]
  -> HTTP Request on Port 8005 (FastAPI Endpoint)
  -> FastAPI Routing matches URL path (e.g. /api/v1/decisions/recommend)
  -> Dependency Injection verify_internal_secret() (app/api/v1/dependencies/security.py)
       ↓ Checks request header value against settings.INTERNAL_SECRET_KEY
  -> Router calls UseCase handler (e.g. RecommendProgramsUseCase)
  -> Open Database Session (SessionLocal from app/infrastructure/db/session.py)
       ↓ Spawns connections executing PRAGMA foreign_keys=ON on SQLite connects
  -> UseCase queries database tables using repositories (e.g. DecisionCollegeRepository)
  -> Apply business normalizations and tuition calculations
  -> Return JSON serialized response and close database session in finally block
```

---

## 7. Evidence Section (EVIDENCE RULE)

### App Initialization & Router Registrations
- **Source File Evidence**: `college-decision-system-backend/app/main.py`
- **Function Evidence**: `create_app()`
- **Line Range Evidence**: 28-36
- **Code Evidence**:
```python
    app.include_router(students.router, prefix="/api/v1")
    app.include_router(decisions.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    if settings.VOICE_ENABLED:
        from app.api.v1.routers import voice

        app.include_router(voice.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")
```

### Config Parameter Types
- **Source File Evidence**: `college-decision-system-backend/app/config/settings.py`
- **Function Evidence**: Class property assignments
- **Line Range Evidence**: 7-27
- **Code Evidence**:
```python
class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env."""

    APP_NAME: str = "College Decision Support System"
    DEBUG: bool = True

    HOST: str = "127.0.0.1"
    PORT: int = 8005

    DATABASE_URL: str = "sqlite:///./dev.db"

    # Use SecretStr to prevent accidental printing/logging of sensitive data
    GEMINI_API_KEY: SecretStr | None = None
    INTERNAL_SECRET_KEY: SecretStr | None = None

    VOICE_ENABLED: bool = True
    VOICE_WHISPER_MODEL: str = "base"
    VOICE_DEVICE: str = "cpu"
    VOICE_TEMP_DIR: str = "."
    VOICE_MAX_UPLOAD_MB: int = 25
    VOICE_FFMPEG_LOCAL_COPY: bool = False
```

### SQLite Connection Pragmas listener
- **Source File Evidence**: `college-decision-system-backend/app/infrastructure/db/session.py`
- **Function Evidence**: `configure_sqlite_connection_pragmas`
- **Line Range Evidence**: 16-27
- **Code Evidence**:
```python
def configure_sqlite_connection_pragmas(engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record) -> None:  # type: ignore[no-untyped-def]
        if not isinstance(dbapi_connection, sqlite3.Connection):
            return
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
```

### Database Session Engine Bindings
- **Source File Evidence**: `college-decision-system-backend/app/infrastructure/db/session.py`
- **Line Range Evidence**: 29-41
- **Code Evidence**:
```python
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)
configure_sqlite_connection_pragmas(engine)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)
```

---

## 8. Architectural Risks & Findings
- **In-Memory Config Mutability**: Config settings are stored as a global singleton `settings` object. While Pydantic model configurations default to read-only configurations, changing values programmatically at runtime is not strictly prevented, which could result in race conditions.
- **SQLite Database Concurrency Locks**: The app defaults to SQLite database (`sqlite:///./dev.db`) on port 8005. Under concurrent execution (e.g. multiple API workers writing message history), SQLite database locks might throw transaction failures.
- **Connection Bypass Integrity Failure**: If database connections are made directly via standard sqlite driver calls (e.g. bypassing the SQLAlchemy `engine` initialization pool), SQLite will not automatically execute the foreign key event listener, leaving referential integrity unenforced.

---

## 9. Verified vs Unverified Findings

### Verified Findings
- **CORS origins verified in code**: Verified that the CORS middleware restricts execution to port 5173 origins (Line 22 of `main.py`).
- **Secret parameters safety verified in code**: Verified that internal secret keys and API keys are stored as `SecretStr` configurations to prevent leakage inside debug logs (Lines 19-20 of `settings.py`).
- **SQLite PRAGMA foreign keys enablement verified in code**: Verified that the SQL session initializer listens for connection events and explicitly sets `PRAGMA foreign_keys=ON` on every SQLite connection (Lines 20–26 of `session.py`).
- **Unified project Base definition verified in code**: Verified that a single declarative base subclassing `DeclarativeBase` is declared to anchor all project model configurations (Lines 9–13 of `session.py`).

### Unverified Findings
- **Host deployment configuration**: Not verified if port 8005 hosts are accessible via external proxies on production platforms.
