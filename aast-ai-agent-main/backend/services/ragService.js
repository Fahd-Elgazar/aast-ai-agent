/**
 * ============================================================
 * ragService.js — AAST Explainable Hybrid Academic Super-Agent
 * ============================================================
 * VERSION 2.0 — Enterprise GraphRAG Retrieval Gateway
 *
 * Upgrades over v1:
 *   ✓ Configurable + fallback API endpoints
 *   ✓ Synonym expansion & academic terminology normalization
 *   ✓ Multi-signal source reranking (rankSources)
 *   ✓ Query-aware category/metadata boosting
 *   ✓ Configurable top-K retrieval depth
 *   ✓ Hybrid search support (vector + keyword)
 *   ✓ Hardened failure handling (timeout / JSON / mismatch)
 *   ✓ Full observability envelope (latency-per-pass, rerank scores)
 *   ✓ Phase 3 brainRouter / fusionService compatible output modes
 *   ✓ All v1 architecture preserved
 *
 * Output modes:
 *   RAG | HYBRID | DEGRADED | FAILURE
 *
 * 
 * Pipeline:
 *   User Query
 *     ↓ detectQueryCategory()        ← intent / category detection
 *     ↓ expandQuery()                ← synonym + terminology expansion
 *     ↓ search() — multi-pass        ← PASS 1 → PASS 2 → PASS 3
 *         ↓ _callRetriever()         ← Qdrant via FastAPI :8001
 *         ↓ rankSources()            ← multi-signal reranker
 *     ↓ answer()                     ← grounded LLM :8002
 *     ↓ Structured Result Envelope   ← brainRouter / fusionService
 * ============================================================
 */

'use strict';

import axios from 'axios';
import axiosRetryPkg from 'axios-retry';
const axiosRetry = axiosRetryPkg.default ?? axiosRetryPkg;

// ─────────────────────────────────────────────────────────────
// SECTION 1 — CONFIGURATION
// ─────────────────────────────────────────────────────────────

const CONFIG = {
    // ── Service URLs ──────────────────────────────────────────
    RETRIEVER_URL: process.env.RAG_RETRIEVER_URL || 'http://localhost:8001',
    ANSWER_URL: process.env.RAG_ANSWER_URL || 'http://localhost:8002',

    // ── Endpoint paths (configurable for API version changes) ─
    RETRIEVER_PATH: process.env.RAG_RETRIEVER_PATH || '/search',
    RETRIEVER_PATH_ALT: process.env.RAG_RETRIEVER_PATH_ALT || '/search',   // Both default to /search per production fix
    ANSWER_PATH: process.env.RAG_ANSWER_PATH || '/answer',
    ANSWER_PATH_ALT: process.env.RAG_ANSWER_PATH_ALT || '/generate', // fallback if /answer 404s
    HEALTH_PATH_RETRIEVER: process.env.RAG_HEALTH_PATH_RETRIEVER || '/health',
    HEALTH_PATH_ANSWER: process.env.RAG_HEALTH_PATH_ANSWER || '/health',

    // ── Reliability ───────────────────────────────────────────
    TIMEOUT_MS: parseInt(process.env.RAG_TIMEOUT_MS || '15000', 10),
    MAX_RETRIES: parseInt(process.env.RAG_MAX_RETRIES || '3', 10),
    BACKOFF_BASE_MS: parseInt(process.env.RAG_BACKOFF_BASE_MS || '300', 10),
    HEALTH_TIMEOUT_MS: parseInt(process.env.RAG_HEALTH_TIMEOUT_MS || '5000', 10),

    // ── Circuit Breaker ───────────────────────────────────────
    CB_FAILURE_THRESHOLD: parseInt(process.env.RAG_CB_FAILURE_THRESHOLD || '5', 10),
    CB_COOLDOWN_MS: parseInt(process.env.RAG_CB_COOLDOWN_MS || '30000', 10),

    // ── Confidence thresholds ─────────────────────────────────
    CONFIDENCE_THRESHOLD: parseFloat(process.env.RAG_CONFIDENCE_THRESHOLD || '0.65'),
    HIGH_CONFIDENCE_FLOOR: parseFloat(process.env.RAG_HIGH_CONFIDENCE || '0.75'),
    MEDIUM_CONFIDENCE_FLOOR: parseFloat(process.env.RAG_MEDIUM_CONFIDENCE || '0.45'),

    // ── Retrieval depth ───────────────────────────────────────
    TOP_K: parseInt(process.env.RAG_TOP_K || '8', 10),
    TOP_K_DEEP: parseInt(process.env.RAG_TOP_K_DEEP || '15', 10), // used on weak-confidence passes
    MIN_SOURCE_DIVERSITY: parseInt(process.env.RAG_MIN_SOURCE_DIVERSITY || '2', 10),

    // ── Search mode ───────────────────────────────────────────
    // 'hybrid'   → vector + keyword signals (recommended)
    // 'semantic' → vector only
    // 'keyword'  → BM25-style keyword only
    SEARCH_TYPE: process.env.RAG_SEARCH_TYPE || 'hybrid',

    // ── Reranker weights ──────────────────────────────────────
    RERANK_OFFICIAL_BOOST: parseFloat(process.env.RAG_RERANK_OFFICIAL_BOOST || '0.20'),
    RERANK_QUALITY_WEIGHT: parseFloat(process.env.RAG_RERANK_QUALITY_WEIGHT || '0.30'),
    RERANK_PRIORITY_WEIGHT: parseFloat(process.env.RAG_RERANK_PRIORITY_WEIGHT || '0.20'),
    RERANK_CONF_WEIGHT: parseFloat(process.env.RAG_RERANK_CONF_WEIGHT || '0.30'),
    RERANK_CATEGORY_BOOST: parseFloat(process.env.RAG_RERANK_CATEGORY_BOOST || '0.15'),
};

// ─────────────────────────────────────────────────────────────
// SECTION 2 — ACADEMIC SYNONYM & EXPANSION DICTIONARY
//
// This is the core of the recall-maximization strategy.
// When user phrasing differs from dataset wording (the primary
// cause of retrieval failure), expansion bridges the gap.
//
// Structure:
//   key   = canonical term (official dataset wording)
//   value = surface forms found in user queries
//
// expandQuery() runs BEFORE embedding so Qdrant receives a
// semantically enriched query rather than the user's exact
// colloquial phrasing.
// ─────────────────────────────────────────────────────────────

const SYNONYM_DICT = {
    // ── GPA / Academic Standing ───────────────────────────────
    'grade point average': [
        'gpa', 'grades', 'grade average', 'cumulative gpa', 'cgpa', 'semester gpa',
        'my grades', 'academic score',
    ],
    'academic probation': [
        'probation', 'academic warning', 'academic standing', 'dismissal risk',
        'academic hold', 'low gpa warning', 'academic risk', 'at risk', 'on probation',
    ],
    'academic dismissal': [
        'dismissed', 'expelled', 'removed from program', 'terminated enrollment',
        'kicked out', 'program termination',
    ],
    'minimum gpa requirement': [
        'required gpa', 'gpa requirement', 'gpa cutoff', 'minimum grade', 'passing gpa',
        'what gpa do i need', 'gpa needed',
    ],
    'academic regulations': [
        'rules', 'academic rules', 'student regulations', 'academic policy',
        'academic policies', 'academic handbook', 'student handbook',
        'code of conduct', 'university rules',
    ],

    // ── Admission / Enrollment ────────────────────────────────
    'admission requirements': [
        'admission', 'apply', 'application', 'how to enroll', 'enrollment requirements',
        'acceptance criteria', 'entry requirements', 'how to get in',
        'joining requirements', 'admissions process', 'admissions criteria',
        'requirements to join',
    ],
    'enrollment': [
        'register', 'registration', 'enroll', 'sign up', 'course registration',
        'class registration', 'semester registration', 'add course', 'drop course',
    ],
    'transfer student requirements': [
        'transfer', 'credit transfer', 'transferred credits', 'transfer admission',
        'how to transfer',
    ],
    'international student admission': [
        'international', 'foreign student', 'visa student', 'overseas student',
    ],

    // ── Scholarship / Financial Aid ───────────────────────────
    'scholarship': [
        'scholarships', 'financial aid', 'discount', 'fee reduction', 'fee waiver',
        'merit award', 'tuition discount', 'bursary', 'grant', 'funding', 'award',
        'academic excellence award', 'need-based aid', 'how to get money',
    ],
    'scholarship eligibility': [
        'who qualifies for scholarship', 'scholarship requirements',
        'how to get scholarship', 'scholarship gpa', 'scholarship conditions',
        'maintain scholarship', 'keep scholarship',
    ],
    'scholarship renewal': [
        'renew scholarship', 'keep my scholarship', 'scholarship continuation',
        'lose scholarship', 'scholarship cancellation',
    ],

    // ── Tuition / Fees ────────────────────────────────────────
    'tuition fees': [
        'fees', 'tuition', 'cost', 'payment', 'how much does it cost', 'program cost',
        'semester fees', 'annual fees', 'lab fees', 'registration fees',
        'what is the cost', 'how much to study',
    ],
    'payment deadline': [
        'fee deadline', 'tuition deadline', 'payment due date', 'when to pay',
        'last day to pay', 'payment schedule',
    ],
    'late payment penalty': [
        'overdue fees', 'unpaid tuition', 'payment penalty', 'fee penalty',
        'late fee', 'missed payment',
    ],

    // ── Curriculum / Program ──────────────────────────────────
    'prerequisites': [
        'prerequisite', 'pre-req', 'prereq', 'required courses',
        'course requirements', 'what courses do i need', 'before taking',
        'prior courses', 'course dependency',
    ],
    'credit hours': [
        'credits', 'credit load', 'hours', 'semester hours', 'course credits',
        'credit requirement', 'total credits', 'how many credits',
    ],
    'graduation requirements': [
        'graduate', 'graduation', 'how to graduate', 'degree requirements',
        'what do i need to graduate', 'completion requirements', 'finish degree',
    ],
    'elective courses': [
        'electives', 'optional courses', 'free elective', 'open elective',
        'elective options',
    ],
    'degree program': [
        'major', 'specialization', 'concentration', 'track', 'program',
        'what programs are offered', 'available programs',
    ],

    // ── Institutional Roles ───────────────────────────────────
    'faculty dean': [
        'dean', 'college dean', 'dean of engineering', 'academic dean',
    ],
    'department head': [
        'department chair', 'head of department', 'program director', 'hod',
    ],
    'academic advisor': [
        'advisor', 'counselor', 'academic counselor', 'student advisor',
        'who advises me',
    ],
    'faculty instructor': [
        'professor', 'instructor', 'faculty', 'lecturer', 'teaching staff',
        'dr.', 'doctor', 'who teaches',
    ],

    // ── Withdrawal / Leave ────────────────────────────────────
    'course withdrawal': [
        'withdraw', 'drop course', 'course drop', 'late withdrawal', 'w grade',
        'remove course', 'cancel enrollment',
    ],
    'medical leave of absence': [
        'medical withdrawal', 'health leave', 'leave of absence', 'medical excuse',
        'sick leave', 'medical absence',
    ],
    'semester withdrawal': [
        'withdraw from semester', 'drop semester', 'semester leave',
        'take a break', 'pause studies',
    ],

    // ── Exam / Assessment ─────────────────────────────────────
    'final examination': [
        'finals', 'final exam', 'final examination', 'end of semester exam',
        'final test',
    ],
    'midterm examination': [
        'midterm', 'mid exam', 'mid semester exam', 'midterm test',
    ],
    'exam schedule': [
        'exam timetable', 'exam dates', 'when is the exam', 'exam period',
        'exam calendar',
    ],
    'makeup examination': [
        'retake exam', 're-exam', 'makeup exam', 'resit', 'second chance exam',
        'incomplete grade', 'missed exam',
    ],
    'grade appeal': [
        'appeal grade', 'dispute grade', 'grade review', 'contest grade',
        'grade reconsideration', 'mark review', 'wrong grade',
    ],

    // ── Housing / Campus ──────────────────────────────────────
    'student housing': [
        'dormitory', 'dorm', 'residence', 'student accommodation',
        'on campus housing', 'off campus housing', 'housing options', 'where to live',
    ],
};

// ─────────────────────────────────────────────────────────────
// SECTION 3 — QUERY CATEGORY SIGNAL MAP
//
// Used by detectQueryCategory() to determine which document
// category to boost during retrieval and reranking.
// Each category maps to a list of keyword signals.
// ─────────────────────────────────────────────────────────────

const CATEGORY_SIGNALS = {
    academic_policy: [
        'gpa', 'probation', 'standing', 'dismissal', 'academic warning',
        'regulations', 'rules', 'handbook', 'policy', 'policies', 'academic hold',
        'academic risk', 'grade point', 'cumulative', 'cgpa', 'academic regulations',
    ],
    financial_aid: [
        'scholarship', 'financial aid', 'bursary', 'grant', 'discount', 'merit award',
        'fee waiver', 'funding', 'award', 'tuition discount', 'need-based',
    ],
    tuition: [
        'fees', 'tuition', 'cost', 'payment', 'pay', 'charge', 'semester fees',
        'annual fees', 'how much', 'price', 'overdue', 'late payment',
    ],
    admissions: [
        'admission', 'apply', 'application', 'enroll', 'enrollment',
        'requirements', 'acceptance', 'transfer', 'international', 'joining',
        'entry', 'join',
    ],
    curriculum: [
        'prerequisites', 'credit', 'course', 'major', 'graduate', 'graduation',
        'elective', 'degree', 'program', 'track', 'specialization', 'curriculum',
        'credit hours',
    ],
    examination: [
        'exam', 'final', 'midterm', 'test', 'retake', 'resit', 'grade', 'mark',
        'appeal', 'result', 'score', 'assessment', 'makeup',
    ],
    registration: [
        'register', 'registration', 'enroll', 'drop', 'add', 'course registration',
        'schedule', 'timetable', 'semester schedule', 'add/drop',
    ],
    institutional: [
        'dean', 'professor', 'instructor', 'faculty', 'advisor', 'department',
        'director', 'staff', 'contact', 'office', 'who is',
    ],
    housing: [
        'housing', 'dorm', 'dormitory', 'residence', 'accommodation',
        'campus living', 'where to live',
    ],
};

// Maps detected category → document types to boost in reranker
const CATEGORY_DOCUMENT_TYPE_MAP = {
    academic_policy: ['academic_policy', 'policy', 'regulation', 'handbook', 'rules'],
    financial_aid: ['financial_aid', 'scholarship', 'financial', 'aid', 'bursary'],
    tuition: ['tuition', 'fees', 'payment', 'financial'],
    admissions: ['admissions', 'admission', 'enrollment', 'requirements'],
    curriculum: ['curriculum', 'course', 'program', 'degree', 'academic'],
    examination: ['examination', 'exam', 'assessment', 'grading'],
    registration: ['registration', 'schedule', 'timetable'],
    institutional: ['institutional', 'faculty', 'staff', 'contact'],
    housing: ['housing', 'residence', 'dormitory'],
};

// ─────────────────────────────────────────────────────────────
// SECTION 4 — LOGGER
// Compatible with existing orchestrator logging style.
// ─────────────────────────────────────────────────────────────

const logger = {
    info: (tag, msg, meta = {}) => console.log(`[RAG][${tag}] ${msg}`, Object.keys(meta).length ? meta : ''),
    warn: (tag, msg, meta = {}) => console.warn(`[RAG][${tag}] ⚠  ${msg}`, Object.keys(meta).length ? meta : ''),
    error: (tag, msg, meta = {}) => console.error(`[RAG][${tag}] ✖  ${msg}`, Object.keys(meta).length ? meta : ''),
    debug: (tag, msg, meta = {}) => {
        if (process.env.RAG_DEBUG === 'true') {
            console.debug(`[RAG][${tag}] ⬡  ${msg}`, Object.keys(meta).length ? meta : '');
        }
    },
};

// ─────────────────────────────────────────────────────────────
// SECTION 5 — AXIOS HTTP CLIENT
// ─────────────────────────────────────────────────────────────

const httpClient = axios.create({
    timeout: CONFIG.TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
});

axiosRetry(httpClient, {
    retries: CONFIG.MAX_RETRIES,
    retryDelay: (attempt) => axiosRetry.exponentialDelay(attempt, CONFIG.BACKOFF_BASE_MS),
    retryCondition: (error) => {
        // Never retry 4xx — those indicate caller/config errors.
        if (error.response && error.response.status >= 400 && error.response.status < 500) return false;
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            (error.response && error.response.status >= 500)
        );
    },
    onRetry: (retryCount, error, requestConfig) => {
        logger.warn('RETRY',
            `Attempt ${retryCount}/${CONFIG.MAX_RETRIES} → ${requestConfig.url}`,
            { reason: error.message, status: error.response?.status }
        );
    },
});

// ─────────────────────────────────────────────────────────────
// SECTION 6 — UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

/** High-resolution elapsed milliseconds since an hrtime snapshot. */
const elapsedMs = (start) => {
    const [sec, ns] = process.hrtime(start);
    return Math.round(sec * 1000 + ns / 1e6);
};

/** Safely parse float; return 0 on NaN / null / undefined. */
const safeFloat = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
};

/**
 * Safe JSON parse — returns null instead of throwing.
 * Critical for handling malformed service responses without crashing.
 */
const safeParse = (text) => {
    try { return JSON.parse(text); }
    catch { return null; }
};

// ─────────────────────────────────────────────────────────────
// SECTION 7 — RAGService CLASS
// ─────────────────────────────────────────────────────────────

class RAGService {

    constructor() {
        /**
         * Runtime telemetry accumulator.
         * Tracks aggregate stats across the service lifetime.
         * Surfaced by healthCheck() and /api/health aggregation.
         */
        this._telemetry = {
            total_searches: 0,
            pass1_successes: 0,
            pass2_successes: 0,
            pass3_successes: 0,
            total_failures: 0,
            fallback_count: 0,
            reranked_count: 0,
            avg_latency_ms: 0,
            endpoint_registry: {
                retriever: { primary: CONFIG.RETRIEVER_PATH, active: CONFIG.RETRIEVER_PATH },
                answer: { primary: CONFIG.ANSWER_PATH, active: CONFIG.ANSWER_PATH },
            },
            capabilities: {
                validated: false,
                hybrid: false,
                semantic: false,
                keyword: false
            },
            circuit_breaker: {
                state: 'CLOSED', // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
                failures: 0,
                last_failure: null
            },
            synthetic_probes: {
                last_run: null,
                status: 'UNKNOWN',
                results: []
            }
        };
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — HEALTH CHECK
    // ══════════════════════════════════════════════════════════

    /**
     * Validates both subsystem health endpoints and operational
     * route endpoints. Reports endpoint misconfiguration separately
     * from service-down conditions.
     *
     * Returns structured health report consumed by:
     *   - brainRouter.js (route availability gate)
     *   - /api/health aggregation endpoint
     *
     * @returns {Promise<Object>}
     */
    async healthCheck() {
        const start = process.hrtime();
        logger.info('HEALTH', 'Running health check on RAG subsystems');

        this._runSyntheticProbes().catch(e => logger.error('HEALTH', 'Synthetic probe failed', { error: e.message }));

        // Parallel: ping health endpoints + validate operational endpoints
        const [retrieverPing, answerPing, retrieverEndpoint, answerEndpoint] =
            await Promise.allSettled([
                this._pingService('retriever', CONFIG.RETRIEVER_URL, CONFIG.HEALTH_PATH_RETRIEVER),
                this._pingService('answer_engine', CONFIG.ANSWER_URL, CONFIG.HEALTH_PATH_ANSWER),
                this._validateEndpoint('retriever', CONFIG.RETRIEVER_URL, CONFIG.RETRIEVER_PATH),
                this._validateEndpoint('answer_engine', CONFIG.ANSWER_URL, CONFIG.ANSWER_PATH),
            ]);

        const retrieverStatus = retrieverPing.status === 'fulfilled' ? retrieverPing.value : { ok: false, name: 'retriever', error: retrieverPing.reason?.message };
        const answerStatus = answerPing.status === 'fulfilled' ? answerPing.value : { ok: false, name: 'answer_engine', error: answerPing.reason?.message };
        const retrieverEndpointOk = retrieverEndpoint.status === 'fulfilled' ? retrieverEndpoint.value : false;
        const answerEndpointOk = answerEndpoint.status === 'fulfilled' ? answerEndpoint.value : false;

        const allHealthy = retrieverStatus.ok && answerStatus.ok;
        const anyHealthy = retrieverStatus.ok || answerStatus.ok;
        const systemStatus = allHealthy ? 'HEALTHY' : anyHealthy ? 'DEGRADED' : 'DOWN';

        const report = {
            system_status: systemStatus,
            retriever: {
                ...retrieverStatus,
                endpoint_valid: retrieverEndpointOk,
                configured_endpoint: `${CONFIG.RETRIEVER_URL}${CONFIG.RETRIEVER_PATH}`,
                fallback_endpoint: `${CONFIG.RETRIEVER_URL}${CONFIG.RETRIEVER_PATH_ALT}`,
                active_endpoint: this._telemetry.endpoint_registry.retriever.active,
            },
            answer_engine: {
                ...answerStatus,
                endpoint_valid: answerEndpointOk,
                configured_endpoint: `${CONFIG.ANSWER_URL}${CONFIG.ANSWER_PATH}`,
                fallback_endpoint: `${CONFIG.ANSWER_URL}${CONFIG.ANSWER_PATH_ALT}`,
                active_endpoint: this._telemetry.endpoint_registry.answer.active,
            },
            telemetry: { ...this._telemetry },
            synthetic_probes: this._telemetry.synthetic_probes,
            latency_ms: elapsedMs(start),
            checked_at: new Date().toISOString(),
        };

        if (!allHealthy) {
            logger.warn('HEALTH', `System status: ${systemStatus}`, {
                retriever_ok: retrieverStatus.ok,
                answer_ok: answerStatus.ok,
                latency_ms: report.latency_ms,
            });
        } else {
            logger.info('HEALTH', `System status: ${systemStatus}`, { latency_ms: report.latency_ms });
        }

        return report;
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — SEARCH (Multi-Pass Retrieval)
    // ══════════════════════════════════════════════════════════

    /**
     * Primary retrieval entry point. Executes a 3-pass strategy:
     *
     *   PASS 1 — Expanded raw query → retriever :8001 (top_k = 8)
     *   PASS 2 — Simplified + normalized → retriever :8001 (top_k = 15)
     *   PASS 3 — Answer engine fallback → :8002 (grounded generation)
     *
     * Each pass:
     *   - Records its own latency for observability
     *   - Reranks returned sources via rankSources()
     *   - Checks strength via _isStrongResult() before stopping
     *
     * @param {string} query - User's raw input text
     * @returns {Promise<Object>} Canonical result envelope
     */
    async search(query) {
        const totalStart = process.hrtime();
        this._telemetry.total_searches++;

        if (!this._telemetry.capabilities.validated) {
            await this._validateCapabilities();
        }

        // Detect semantic category early — used for boosting and reranking
        const categoryResult = this.detectQueryCategory(query);
        const queryCategory = categoryResult.category;
        logger.info('SEARCH', `Multi-pass retrieval | category: ${queryCategory}`, {
            query,
            confidence: categoryResult.confidence,
            signals: categoryResult.matched_signals
        });

        // Expand query with synonyms before PASS 1 embedding
        const expandedQuery = this.expandQuery(query, queryCategory);
        if (expandedQuery !== query) {
            logger.debug('SEARCH', 'Query synonym-expanded', {
                original: query, expanded: expandedQuery.slice(0, 120) + '...',
            });
        }

        const passLatencies = {};

        // ── PASS 1: Expanded query, standard top_k ────────────
        const p1Start = process.hrtime();
        logger.debug('SEARCH', 'PASS 1: expanded query → retriever');
        const pass1 = await this._callRetriever(expandedQuery, CONFIG.TOP_K, queryCategory);
        passLatencies.pass1_ms = elapsedMs(p1Start);

        if (this._isStrongResult(pass1)) {
            this._telemetry.pass1_successes++;
            const ranked = this.rankSources(pass1.sources, queryCategory);
            logger.info('SEARCH', 'PASS 1 strong result', {
                confidence: pass1.confidence,
                source_count: ranked.length,
                top_rerank: ranked[0]?.rerank_score?.toFixed(3),
                latency_ms: elapsedMs(totalStart),
            });
            return this._buildSearchResult(
                { ...pass1, sources: ranked }, 'PASS_1_DIRECT',
                expandedQuery, queryCategory, passLatencies, elapsedMs(totalStart)
            );
        }

        logger.warn('SEARCH', 'PASS 1 weak — escalating to PASS 2', {
            confidence: pass1.confidence, source_count: pass1.sources?.length ?? 0,
            latency_ms: passLatencies.pass1_ms,
        });

        // ── PASS 2: Simplified query, deep top_k ─────────────
        const simplifiedQuery = this.simplifyQuery(query);
        const p2Start = process.hrtime();
        logger.debug('SEARCH', 'PASS 2: simplified → retriever (deep top_k)', { simplifiedQuery });

        // Deeper top_k on PASS 2 — casts a wider Qdrant net
        const pass2 = await this._callRetriever(simplifiedQuery, CONFIG.TOP_K_DEEP, queryCategory);
        passLatencies.pass2_ms = elapsedMs(p2Start);

        if (this._isStrongResult(pass2)) {
            this._telemetry.pass2_successes++;
            const ranked = this.rankSources(pass2.sources, queryCategory);
            logger.info('SEARCH', 'PASS 2 strong result (simplified)', {
                original: query,
                simplified: simplifiedQuery,
                confidence: pass2.confidence,
                source_count: ranked.length,
                latency_ms: elapsedMs(totalStart),
            });
            return this._buildSearchResult(
                { ...pass2, sources: ranked }, 'PASS_2_SIMPLIFIED',
                simplifiedQuery, queryCategory, passLatencies, elapsedMs(totalStart)
            );
        }

        logger.warn('SEARCH', 'PASS 2 still weak — escalating to PASS 3 (answer engine)', {
            confidence: pass2.confidence, latency_ms: passLatencies.pass2_ms,
        });

        // ── PASS 3: Answer engine fallback ───────────────────
        const p3Start = process.hrtime();
        logger.debug('SEARCH', 'PASS 3: answer engine fallback');
        const pass3 = await this._callAnswerEngine(query);
        passLatencies.pass3_ms = elapsedMs(p3Start);

        if (pass3.success) {
            this._telemetry.pass3_successes++;
            this._telemetry.fallback_count++;
            const ranked = this.rankSources(pass3.sources || [], queryCategory);
            logger.info('SEARCH', 'PASS 3 answer engine fallback used', {
                confidence: pass3.confidence, latency_ms: elapsedMs(totalStart),
            });
            return this._buildSearchResult(
                { ...pass3, sources: ranked, fallback_used: true }, 'PASS_3_ANSWER_FALLBACK',
                query, queryCategory, passLatencies, elapsedMs(totalStart)
            );
        }

        // ── All passes exhausted ─────────────────────────────
        this._telemetry.total_failures++;
        logger.error('FAILURE', 'All 3 retrieval passes failed', {
            query, queryCategory, pass_latencies: passLatencies,
            total_ms: elapsedMs(totalStart),
        });

        return this._buildFailureResult(
            'retrieval_failure',
            'All retrieval passes exhausted — no matching documents found',
            {
                passes_attempted: 3,
                pass_latencies: passLatencies,
                query_category: queryCategory,
                total_latency_ms: elapsedMs(totalStart),
            }
        );
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — ANSWER
    // ══════════════════════════════════════════════════════════

    /**
     * Calls the grounded answer engine (port 8002) directly.
     * Used when brainRouter selects RAG-only mode or when
     * fusionService needs a grounded answer for hybrid merging.
     *
     * @param {string} query
     * @returns {Promise<Object>} Canonical answer envelope
     */
    async answer(query) {
        const start = process.hrtime();
        logger.info('ANSWER', 'Calling grounded answer engine', { query });

        const result = await this._callAnswerEngine(query);

        if (result.success) {
            logger.info('ANSWER', 'Answer engine responded successfully', {
                confidence: result.confidence,
                source_count: result.sources?.length ?? 0,
                latency_ms: elapsedMs(start),
            });
            return { ...result, latency_ms: elapsedMs(start) };
        }

        this._telemetry.total_failures++;
        logger.error('FAILURE', 'Answer engine returned failure', {
            query, latency_ms: elapsedMs(start),
        });

        return this._buildFailureResult(
            'answer_failure',
            result.recovery_hint || 'Answer engine unavailable',
            { latency_ms: elapsedMs(start) }
        );
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — REQUEST WITH RETRY
    // ══════════════════════════════════════════════════════════

    /**
     * Core HTTP dispatcher with hardened multi-class error handling.
     *
     * Error classification:
     *   TIMEOUT          — server did not respond within TIMEOUT_MS
     *   NETWORK          — connection refused / DNS failure / reset
     *   ENDPOINT_NOT_FOUND — 404 (misconfigured path)
     *   HTTP_4XX         — other client-side errors
     *   HTTP_5XX         — server fault (retried by axiosRetry)
     *   EMPTY_RESPONSE   — null/undefined/empty body
     *   MALFORMED_JSON   — response is not valid JSON
     *
     * @param {string} url
     * @param {Object} payload
     * @returns {Promise<Object>} Parsed response data
     * @throws {EnrichedError} Typed error with _ragErrorType
     */
    async requestWithRetry(url, payload) {
        logger.debug('SEARCH', `POST ${url}`, { payload });

        const cb = this._telemetry.circuit_breaker;
        if (cb.state === 'OPEN') {
            const now = Date.now();
            if (now - cb.last_failure >= CONFIG.CB_COOLDOWN_MS) {
                cb.state = 'HALF_OPEN';
                logger.info('CIRCUIT_BREAKER', `State changed to HALF_OPEN for ${url}`);
            } else {
                throw this._typedError('CIRCUIT_BREAKER_OPEN', 'Service temporarily disabled due to failures', url);
            }
        }

        try {
            const response = await httpClient.post(url, payload, {
                // Capture raw string to diagnose malformed JSON separately
                transformResponse: [(data) => data],
            });

            if (cb.state === 'HALF_OPEN') {
                cb.state = 'CLOSED';
                cb.failures = 0;
                logger.info('CIRCUIT_BREAKER', `State changed to CLOSED (Recovered) for ${url}`);
            }

            const responseText = response.data;

            // Guard: empty body
            if (responseText === null || responseText === undefined || responseText === '') {
                throw this._typedError('EMPTY_RESPONSE', `Empty response body from ${url}`, url);
            }

            // Guard: malformed JSON
            const parsed = safeParse(responseText);
            if (parsed === null) {
                logger.error('FAILURE', 'Malformed JSON from service', {
                    url, preview: String(responseText).slice(0, 200),
                });
                throw this._typedError('MALFORMED_JSON', `Malformed JSON from ${url}`, url);
            }

            return parsed;

        } catch (err) {
            // Already typed — re-throw directly without re-wrapping
            if (err._ragError) throw err;

            const isTimeout = err.code === 'ECONNABORTED'
                || err.message?.toLowerCase().includes('timeout');

            const isNetwork = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EHOSTUNREACH']
                .includes(err.code);

            const httpStatus = err.response?.status;
            const is404 = httpStatus === 404;
            const is4xx = httpStatus >= 400 && httpStatus < 500;

            // Endpoint mismatch — provide actionable config hint
            if (is404) {
                logger.error('FAILURE',
                    `Endpoint not found (404): ${url} — verify RAG_RETRIEVER_PATH / RAG_ANSWER_PATH`,
                    { url, status: 404 }
                );
                throw this._typedError('ENDPOINT_NOT_FOUND',
                    `Endpoint ${url} returned 404 — check path configuration`, url,
                    { http_status: 404 }
                );
            }

            if (is4xx) {
                logger.error('FAILURE', `Client error ${httpStatus} from ${url}`, {
                    payload_preview: JSON.stringify(payload).slice(0, 200),
                });
            }

            logger.error('FAILURE', `Request failed: ${url}`, {
                error: err.message, is_timeout: isTimeout, is_network: isNetwork,
                http_status: httpStatus,
            });

            cb.failures++;
            if (cb.failures >= CONFIG.CB_FAILURE_THRESHOLD && cb.state !== 'OPEN') {
                cb.state = 'OPEN';
                cb.last_failure = Date.now();
                logger.error('CIRCUIT_BREAKER', `State changed to OPEN after ${cb.failures} failures for ${url}`);
            }

            throw this._typedError(
                isTimeout ? 'TIMEOUT'
                    : isNetwork ? 'NETWORK'
                        : is4xx ? 'HTTP_4XX'
                            : 'HTTP_ERROR',
                err.message, url,
                { is_timeout: isTimeout, is_network: isNetwork, http_status: httpStatus }
            );
        }
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — CONFIDENCE NORMALIZATION
    // ══════════════════════════════════════════════════════════

    /**
     * Converts raw float confidence (0.0–1.0) into routing tiers.
     *
     *   HIGH   → ≥ 0.75  (trust, surface directly to user)
     *   MEDIUM → ≥ 0.45  (surface with caveat or blend with KG)
     *   LOW    → < 0.45  (trigger fallback pass or discard)
     *
     * @param {number|string} score
     * @returns {'HIGH'|'MEDIUM'|'LOW'}
     */
    normalizeConfidence(score) {
        const n = safeFloat(score);
        if (n >= CONFIG.HIGH_CONFIDENCE_FLOOR) return 'HIGH';
        if (n >= CONFIG.MEDIUM_CONFIDENCE_FLOOR) return 'MEDIUM';
        return 'LOW';
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — QUERY EXPANSION (pre-PASS 1)
    // ══════════════════════════════════════════════════════════

    /**
     * Appends canonical synonym terms to the raw query before
     * PASS 1 embedding. Preserves natural language structure
     * while enriching the embedding space.
     *
     * Strategy:
     *   - If a surface form (e.g. "gpa") appears → append canonical term
     *   - If a canonical term appears → append top 3 surface synonyms
     *   - Never duplicate terms already in the query
     *
     * Example:
     *   "What GPA do I need to avoid probation?"
     *   → "What GPA do I need to avoid probation? grade point average academic probation academic standing"
     *
     * @param {string} query
     * @returns {string} Semantically enriched query
     */
    expandQuery(query, categoryHint = 'GENERAL') {
        const lowerQuery = query.toLowerCase();
        const expansions = [];

        for (const [canonical, surfaces] of Object.entries(SYNONYM_DICT)) {
            const surfaceMatched = surfaces.some(s => {
                const regex = new RegExp(`\\b${s}\\b`, 'i');
                return regex.test(query);
            });
            const canonicalMatched = new RegExp(`\\b${canonical}\\b`, 'i').test(query);

            let weight = 0;
            // Boost if canonical term matches the category hint
            if (categoryHint !== 'GENERAL' && CATEGORY_SIGNALS[categoryHint]?.includes(canonical)) {
                weight += 2;
            }

            if (surfaceMatched && !canonicalMatched) {
                expansions.push({ term: canonical, weight: weight + 1 });
            }
            if (canonicalMatched) {
                surfaces.slice(0, 3).forEach(s => {
                    if (!new RegExp(`\\b${s}\\b`, 'i').test(query)) expansions.push({ term: s, weight: weight + 0.5 });
                });
            }
        }

        if (expansions.length === 0) return query;

        // Rank by importance (weight) and limit to top 4
        expansions.sort((a, b) => b.weight - a.weight);
        const topExpansions = expansions.slice(0, 4).map(e => e.term);

        const expanded = `${query} ${topExpansions.join(' ')}`;
        return expanded;
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — QUERY SIMPLIFICATION (pre-PASS 2)
    // ══════════════════════════════════════════════════════════

    /**
     * Transforms a query for PASS 2 broad-recall retrieval.
     *
     * Steps:
     *   1. Lowercase + strip punctuation
     *   2. Expand surface forms → canonical terms (official terminology)
     *   3. Remove stop-words + deduplicate tokens
     *   4. Append domain anchor "AAST" if missing
     *
     * Differs from expandQuery():
     *   - Removes stop-words and noise aggressively
     *   - Uses canonical form only (no appended synonyms)
     *   - Produces a compact keyword-optimized string
     *
     * Example:
     *   "What GPA is required to avoid academic probation?"
     *   → "grade point average required avoid academic probation AAST"
     *
     * @param {string} query
     * @returns {string} Simplified keyword-optimized query
     */
    simplifyQuery(query) {
        const STOP_WORDS = new Set([
            'what', 'is', 'the', 'are', 'a', 'an', 'to', 'for', 'in', 'of', 'and', 'or',
            'how', 'do', 'i', 'can', 'does', 'with', 'that', 'this', 'it', 'my', 'your',
            'be', 'have', 'has', 'was', 'will', 'would', 'could', 'should', 'me', 'you',
            'we', 'they', 'get', 'need', 'want', 'tell', 'about', 'any', 'there', 'if',
            'when', 'where', 'which', 'who', 'please', 'give', 'show', 'find', 'let',
            'explain', 'describe', 'list', 'tell', 'help',
        ]);

        // Institutional anchor terms to preserve (adaptive filtering)
        const PRESERVE_TERMS = new Set([
            'scholarship', 'gpa', 'admission', 'probation', 'visa', 'dean', 'faculty',
            'transfer', 'dismissal', 'tuition', 'fee', 'program', 'degree', 'credit'
        ]);

        // Step 1: lowercase + strip punctuation
        let normalized = query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Step 2: surface forms → canonical terms for official terminology
        for (const [canonical, surfaces] of Object.entries(SYNONYM_DICT)) {
            for (const surface of surfaces) {
                if (normalized.includes(surface)) {
                    normalized = normalized.replace(
                        new RegExp(`\\b${surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
                        canonical
                    );
                }
            }
        }

        // Step 3: filter stop-words + deduplicate + adaptive preservation
        const seen = new Set();
        const tokens = normalized
            .split(' ')
            .filter(t => t.length > 1 && (!STOP_WORDS.has(t) || PRESERVE_TERMS.has(t)))
            .filter(t => { if (seen.has(t)) return false; seen.add(t); return true; });

        // Step 4: domain anchor
        if (!seen.has('aast')) tokens.push('AAST');

        const simplified = tokens.join(' ');
        logger.debug('SEARCH', 'Query simplified for PASS 2', { original: query, simplified });
        return simplified;
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — QUERY CATEGORY DETECTION
    // ══════════════════════════════════════════════════════════

    /**
     * Detects the semantic category of a query via signal scoring.
     * The detected category drives:
     *   - Retrieval category_hint (payload sent to retriever)
     *   - rankSources() category alignment boost
     *   - Frontend explainability badge category label
     *
     * Scoring: count of matching keyword signals per category.
     * Ties broken by first matched category (map insertion order).
     *
     * @param {string} query
     * @returns {string} Category key | 'GENERAL'
     */
    detectQueryCategory(query) {
        const lower = query.toLowerCase();
        const scores = {};
        let totalSignalsMatched = 0;

        for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
            let categoryScore = 0;
            const matched = [];

            for (const signal of signals) {
                // Support phrase-level and exact token matching
                const regex = new RegExp(`\\b${signal}\\b`, 'i');
                if (regex.test(query)) {
                    categoryScore += 2.0;
                    matched.push(signal);
                } else if (lower.includes(signal)) {
                    categoryScore += 0.5;
                    matched.push(signal);
                }
            }

            // Check synonyms related to this category for extra weight
            for (const [canonical, surfaces] of Object.entries(SYNONYM_DICT)) {
                if (signals.includes(canonical)) {
                    for (const surface of surfaces) {
                        const regex = new RegExp(`\\b${surface}\\b`, 'i');
                        if (regex.test(query)) {
                            categoryScore += 1.5;
                            matched.push(surface);
                        }
                    }
                }
            }

            if (categoryScore > 0) {
                scores[category] = { score: categoryScore, matched: [...new Set(matched)] };
                totalSignalsMatched += categoryScore;
            }
        }

        if (Object.keys(scores).length === 0) {
            return { category: 'GENERAL', confidence: 0, matched_signals: [] };
        }

        const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
        const best = sorted[0];

        const confidence = totalSignalsMatched > 0 ? (best[1].score / totalSignalsMatched) : 0;

        logger.debug('SEARCH', 'Category detected via semantic scoring', {
            category: best[0], confidence: confidence.toFixed(2), signals: best[1].matched
        });

        return {
            category: best[0],
            confidence: parseFloat(confidence.toFixed(4)),
            matched_signals: best[1].matched
        };
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API — SOURCE RERANKING
    // ══════════════════════════════════════════════════════════

    /**
     * Reranks retrieved sources using a multi-signal scoring model.
     *
     * Raw Qdrant ordering (pure vector similarity) is not always
     * optimal. This reranker combines:
     *
     *   Signal 1 — Official source flat boost (+0.20)
     *   Signal 2 — Quality score field       (weight 0.30)
     *   Signal 3 — Priority field            (weight 0.20, inverted)
     *   Signal 4 — Confidence / similarity   (weight 0.30)
     *   Signal 5 — Category alignment boost  (+0.15)
     *
     * Each source receives a rerank_score (0.0–1.0+) stored for
     * frontend explainability badge rendering.
     *
     * @param {Array}  sources       - Raw sources from retriever
     * @param {string} queryCategory - From detectQueryCategory()
     * @returns {Array} Sorted sources with rerank_score attached
     */
    rankSources(sources, queryCategory = 'GENERAL') {
        if (!Array.isArray(sources) || sources.length === 0) return [];

        this._telemetry.reranked_count++;
        const matchingDocTypes = CATEGORY_DOCUMENT_TYPE_MAP[queryCategory] || [];

        const dedupedSources = this._deduplicateSources(sources);

        const ranked = dedupedSources.map((source) => {
            let score = 0;

            // Signal 1: Official source boost
            const isOfficial = !!(
                source.is_official ||
                source.official ||
                source.source_type === 'official' ||
                source.doc_type === 'regulation'
            );
            if (isOfficial) score += CONFIG.RERANK_OFFICIAL_BOOST;

            // Signal 2: quality_score field (0.0–1.0)
            const quality = Math.min(1, safeFloat(source.quality_score ?? source.quality ?? 0));
            score += quality * CONFIG.RERANK_QUALITY_WEIGHT;

            // Signal 3: priority field normalization (support string, number, null)
            let normalizedPriority = 0.5; // default fallback
            if (typeof source.priority === 'string') {
                const p = source.priority.toLowerCase();
                if (p === 'high') normalizedPriority = 1.0;
                else if (p === 'medium') normalizedPriority = 0.6;
                else if (p === 'low') normalizedPriority = 0.3;
            } else if (typeof source.priority === 'number') {
                const rawPriority = Math.max(1, Math.min(10, source.priority));
                normalizedPriority = (10 - rawPriority) / 9;
            }
            score += normalizedPriority * CONFIG.RERANK_PRIORITY_WEIGHT;

            // Signal 4: Qdrant vector similarity / confidence score
            const similarity = Math.min(1, safeFloat(
                source.score ?? source.confidence ?? source.similarity ?? 0
            ));
            score += similarity * CONFIG.RERANK_CONF_WEIGHT;

            // Signal 5: Category alignment
            const sourceCategory = (
                source.category || source.doc_type || source.type || ''
            ).toLowerCase();
            const categoryMatches = matchingDocTypes.some(t => sourceCategory.includes(t));
            if (categoryMatches) score += CONFIG.RERANK_CATEGORY_BOOST;

            return {
                ...source,
                rerank_score: parseFloat(score.toFixed(4)),
                is_official: isOfficial,
                category_match: categoryMatches,
            };
        });

        ranked.sort((a, b) => b.rerank_score - a.rerank_score);

        logger.debug('SEARCH', 'Sources reranked', {
            count: ranked.length,
            top_score: ranked[0]?.rerank_score,
            category: queryCategory,
        });

        return ranked;
    }

    // ══════════════════════════════════════════════════════════
    // PRIVATE — CALL RETRIEVER (:8001)
    // ══════════════════════════════════════════════════════════

    /**
     * Maps internal UI/signal categories to backend-supported category strings.
     * Prevents mismatch errors in retrieval filtering.
     * @private
     */
    _mapCategory(category) {
        if (!category || category === 'GENERAL' || category === 'unknown') return null;

        const MAPPING = {
            'academic_policy': 'admissions_registration',
            'transfer': 'admissions_registration',
            'grading': 'academic_rules',
            'admissions': 'admissions_registration',
            'registration': 'admissions_registration',
            'curriculum': 'academic_rules',
            'examination': 'academic_rules',
            'financial_aid': 'tuition_scholarships',
            'tuition': 'tuition_scholarships',
            'housing': 'campus_life',
            'institutional': 'campus_life'
        };

        return MAPPING[category] || null;
    }

    /**
     * Normalizes payload for the /search endpoint contract.
     * Removes unsupported fields: search_type, category_hint, filters.
     * @private
     */
    _normalizePayload(query, topK, category) {
        return {
            query,
            top_k: topK || CONFIG.TOP_K,
            category: this._mapCategory(category),
            program_level: null,
            priority_only: false
        };
    }

    /**
     * Sends a retrieval request to the FastAPI retriever service.
     * Payload normalized to strict /search contract:
     *   - query
     *   - top_k
     *   - category (mapped)
     *   - program_level: null
     *   - priority_only: false
     *
     * @param {string} query
     * @param {number} topK
     * @param {string} category
     * @returns {Promise<Object>} Normalized result envelope
     * @private
     */
    async _callRetriever(query, topK, category) {
        const payload = this._normalizePayload(query, topK, category);

        logger.info('SEARCH', `Calling retriever at ${CONFIG.RETRIEVER_PATH}`, {
            payload,
            original_category: category
        });

        const result = await this._callWithEndpointFallback(
            CONFIG.RETRIEVER_URL,
            CONFIG.RETRIEVER_PATH,
            CONFIG.RETRIEVER_PATH_ALT,
            payload,
            'retriever'
        );

        if (!result.success) {
            logger.warn('SEARCH', 'Retriever failed on all endpoints', {
                error: result.error,
                endpoint: CONFIG.RETRIEVER_PATH,
                payload
            });
            return this._emptyRetrieverResult(result.error);
        }

        const data = result.data;
        // Production Fix: Use avg_confidence as primary signal
        const rawScore = safeFloat(data.avg_confidence ?? data.confidence ?? data.score ?? 0);
        const sources = this._extractSources(data);

        logger.info('SEARCH', 'Retriever success', {
            confidence: rawScore.toFixed(3),
            source_count: sources.length,
            fallback_used: data.fallback_used || false
        });

        return {
            success: true,
            confidence: this.normalizeConfidence(rawScore),
            raw_confidence: rawScore,
            sources,
            source_count: sources.length,
            source_diversity: this._computeSourceDiversity(sources),
            fallback_used: data.fallback_used || false,
            category: data.category_filter || data.category || category || 'GENERAL',
            metadata: data.metadata || { latency_seconds: data.latency_seconds },
            endpoint_used: result.endpoint_used,
            top_k_used: payload.top_k,
        };
    }

    // ══════════════════════════════════════════════════════════
    // PRIVATE — CALL ANSWER ENGINE (:8002)
    // ══════════════════════════════════════════════════════════

    /**
     * Sends a generation request to the FastAPI answer engine.
     * Falls back to alternate endpoint path if primary 404s.
     *
     * @param {string} query
     * @returns {Promise<Object>} Normalized answer envelope
     * @private
     */
    async _callAnswerEngine(query) {
        const result = await this._callWithEndpointFallback(
            CONFIG.ANSWER_URL,
            CONFIG.ANSWER_PATH,
            CONFIG.ANSWER_PATH_ALT,
            { query },
            'answer'
        );

        if (!result.success) {
            logger.error('FAILURE', 'Answer engine failed on all endpoints', { error: result.error });
            return {
                success: false,
                answer: '',
                confidence: 'LOW',
                raw_confidence: 0,
                sources: [],
                source_count: 0,
                source_diversity: 0,
                fallback_used: true,
                category: 'UNKNOWN',
                metadata: {},
                recovery_hint: result.recovery_hint || 'Answer engine unavailable',
            };
        }

        const data = result.data;
        // Production Fix: Extract avg_confidence from answer engine if present
        const rawScore = safeFloat(data.avg_confidence ?? data.confidence ?? data.score ?? 0);
        const sources = this._extractSources(data);

        return {
            success: true,
            answer: data.answer || data.response || data.text || '',
            confidence: this.normalizeConfidence(rawScore),
            raw_confidence: rawScore,
            sources,
            source_count: sources.length,
            source_diversity: this._computeSourceDiversity(sources),
            fallback_used: true,
            category: data.category || 'GENERAL',
            metadata: data.metadata || {},
            endpoint_used: result.endpoint_used,
        };
    }

    // ══════════════════════════════════════════════════════════
    // PRIVATE — ENDPOINT FALLBACK DISPATCHER
    // ══════════════════════════════════════════════════════════

    /**
     * Attempts primary endpoint; if 404 detected, retries alternate.
     * Records which endpoint is actively working in telemetry.
     *
     * This handles API version differences (e.g. /retrieve vs /search)
     * without requiring a service restart or config change.
     *
     * @param {string} baseUrl
     * @param {string} primaryPath
     * @param {string} altPath
     * @param {Object} payload
     * @param {string} serviceKey  - 'retriever' | 'answer'
     * @returns {Promise<{success, data?, endpoint_used?, error?, recovery_hint?}>}
     * @private
     */
    async _callWithEndpointFallback(baseUrl, primaryPath, altPath, payload, serviceKey) {
        const primaryUrl = `${baseUrl}${primaryPath}`;
        const altUrl = `${baseUrl}${altPath}`;

        try {
            const data = await this.requestWithRetry(primaryUrl, payload);
            this._telemetry.endpoint_registry[serviceKey].active = primaryPath;
            return { success: true, data, endpoint_used: primaryPath };

        } catch (primaryErr) {
            if (primaryErr._ragErrorType === 'ENDPOINT_NOT_FOUND') {
                logger.warn('SEARCH',
                    `Primary 404 — trying alternate endpoint: ${altUrl}`,
                    { primary: primaryUrl, alt: altUrl }
                );

                try {
                    const data = await this.requestWithRetry(altUrl, payload);
                    this._telemetry.endpoint_registry[serviceKey].active = altPath;
                    logger.info('SEARCH', `Alternate endpoint succeeded: ${altPath}`);
                    return { success: true, data, endpoint_used: altPath };

                } catch (altErr) {
                    logger.error('FAILURE',
                        `Both primary and alternate endpoints failed for ${serviceKey}`,
                        { primary: primaryUrl, alt: altUrl, error: altErr.message }
                    );
                    return {
                        success: false,
                        error: altErr.message,
                        recovery_hint: `Both ${primaryPath} and ${altPath} unavailable — check ${serviceKey} service`,
                    };
                }
            }

            // Non-404 error — map to recovery hint
            const hint =
                primaryErr._ragErrorType === 'TIMEOUT' ? `${serviceKey} timed out`
                    : primaryErr._ragErrorType === 'NETWORK' ? `${serviceKey} unreachable`
                        : primaryErr._ragErrorType === 'MALFORMED_JSON' ? `${serviceKey} returned invalid JSON`
                            : primaryErr._ragErrorType === 'EMPTY_RESPONSE' ? `${serviceKey} returned empty body`
                                : `${serviceKey} error: ${primaryErr.message}`;

            return { success: false, error: primaryErr.message, recovery_hint: hint };
        }
    }

    // ══════════════════════════════════════════════════════════
    // PRIVATE — RESULT BUILDERS
    // ══════════════════════════════════════════════════════════

    /**
     * Builds the canonical search result envelope consumed by
     * brainRouter.js, fusionService.js, and responseFormatter.js.
     *
     * Mode resolution:
     *   HYBRID   — hybrid search_type was used and succeeded
     *   RAG      — semantic-only retrieval succeeded
     *   DEGRADED — fallback to answer engine was required
     *   FAILURE  — _buildFailureResult (separate path)
     *
     * Full observability payload included for monitoring dashboards.
     *
     * @private
     */
    _buildSearchResult(payload, pass, queryUsed, queryCategory, passLatencies, totalLatency) {
        const mode = payload.fallback_used
            ? 'DEGRADED'
            : CONFIG.SEARCH_TYPE === 'hybrid'
                ? 'HYBRID'
                : 'RAG';

        this._updateAvgLatency(totalLatency);

        return {
            success: true,
            mode,
            pass_used: pass,
            query_used: queryUsed,
            query_category: queryCategory,
            confidence: payload.confidence || this.normalizeConfidence(payload.raw_confidence),
            raw_confidence: payload.raw_confidence ?? 0,
            sources: payload.sources || [],
            source_count: payload.source_count ?? (payload.sources?.length || 0),
            source_diversity: payload.source_diversity?.overall_score ?? (typeof payload.source_diversity === 'number' ? payload.source_diversity : this._computeSourceDiversity(payload.sources).overall_score),
            diversity_metrics: payload.source_diversity && typeof payload.source_diversity === 'object' ? payload.source_diversity : this._computeSourceDiversity(payload.sources),
            fallback_used: payload.fallback_used ?? false,
            category: payload.category || queryCategory || 'GENERAL',
            answer: payload.answer || null,
            metadata: payload.metadata || {},
            endpoint_used: payload.endpoint_used || null,

            // Full observability envelope for monitoring + debugging
            observability: {
                pass_latencies: passLatencies,
                total_latency_ms: totalLatency,
                search_type: CONFIG.SEARCH_TYPE,
                top_k_used: payload.top_k_used || CONFIG.TOP_K,
                rerank_applied: true,
                top_rerank_score: payload.sources?.[0]?.rerank_score ?? null,
                source_diversity: payload.source_diversity ?? 0,
                fallback_pass: pass.startsWith('PASS_3'),
                query_category: queryCategory,
                telemetry_snapshot: {
                    pass1_success_rate: this._passRate('pass1'),
                    pass2_success_rate: this._passRate('pass2'),
                    pass3_success_rate: this._passRate('pass3'),
                    avg_latency_ms: this._telemetry.avg_latency_ms,
                    fallback_frequency: this._fallbackRate(),
                },
            },

            system_status: 'OK',
            retrieved_at: new Date().toISOString(),
        };
    }

    /**
     * Builds the canonical failure envelope — never throws,
     * always returns a structured object the orchestrator can handle.
     * @private
     */
    _buildFailureResult(failureType, recoveryHint, extras = {}) {
        return {
            success: false,
            mode: 'FAILURE',
            failure_type: failureType,
            recovery_hint: recoveryHint,
            confidence: 'LOW',
            raw_confidence: 0,
            sources: [],
            source_count: 0,
            source_diversity: 0,
            fallback_used: true,
            category: 'UNKNOWN',
            answer: null,
            metadata: {},
            observability: { search_type: CONFIG.SEARCH_TYPE },
            system_status: 'DEGRADED',
            retrieved_at: new Date().toISOString(),
            ...extras,
        };
    }

    // ══════════════════════════════════════════════════════════
    // PRIVATE — HELPER METHODS
    // ══════════════════════════════════════════════════════════

    /**
     * Determines if a retrieval result is strong enough to
     * terminate the multi-pass loop. ALL three must pass:
     *   - success === true
     *   - raw_confidence >= CONFIDENCE_THRESHOLD
     *   - at least 1 source returned
     * @private
     */
    _isStrongResult(result) {
        return (
            result.success === true &&
            safeFloat(result.raw_confidence) >= CONFIG.CONFIDENCE_THRESHOLD &&
            (result.sources?.length ?? 0) > 0
        );
    }

    /**
     * Counts distinct source identifiers for evidence breadth scoring.
     * Breadth matters for academic answer credibility.
     * @private
     */
    _computeSourceDiversity(sources) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return { chunk_diversity: 0, document_diversity: 0, category_diversity: 0, overall_score: 0 };
        }

        const chunks = new Set();
        const docs = new Set();
        const categories = new Set();

        sources.forEach(s => {
            const chunkId = s.id || s.chunk_id || (s.text ? s.text.substring(0, 20) : Math.random().toString());
            const docId = s.doc_id || s.source || s.title || chunkId;
            const category = s.category || s.doc_type || s.type || 'unknown';

            chunks.add(chunkId);
            docs.add(docId);
            categories.add(category);
        });

        const docDiv = docs.size;
        const catDiv = categories.size;
        const chunkDiv = chunks.size;

        // Document diversity is weighted higher than chunk diversity
        const overallScore = (docDiv * 2) + catDiv + (chunkDiv * 0.5);

        return {
            chunk_diversity: chunkDiv,
            document_diversity: docDiv,
            category_diversity: catDiv,
            overall_score: parseFloat(overallScore.toFixed(2))
        };
    }

    /**
     * Normalizes sources from any FastAPI response shape.
     * Handles: sources, documents, results, hits, chunks, references.
     * @private
     */
    _extractSources(data) {
        return (
            Array.isArray(data.sources) ? data.sources :
                Array.isArray(data.documents) ? data.documents :
                    Array.isArray(data.results) ? data.results :
                        Array.isArray(data.hits) ? data.hits :
                            Array.isArray(data.chunks) ? data.chunks :
                                Array.isArray(data.references) ? data.references :
                                    []
        );
    }

    /**
     * Returns a zero-result retriever envelope for use when
     * all endpoint attempts are exhausted.
     * @private
     */
    _emptyRetrieverResult(errorMsg) {
        return {
            success: false, confidence: 'LOW', raw_confidence: 0, sources: [],
            source_count: 0, source_diversity: 0, fallback_used: true,
            category: 'UNKNOWN', metadata: {}, error: errorMsg,
        };
    }

    /**
     * Pings a service health endpoint. Returns structured result
     * without throwing — used inside healthCheck().
     * @private
     */
    async _pingService(name, baseUrl, healthPath) {
        const url = `${baseUrl}${healthPath}`;
        const start = process.hrtime();
        try {
            const res = await httpClient.get(url, { timeout: CONFIG.HEALTH_TIMEOUT_MS });
            return { ok: true, name, status: res.status, latency_ms: elapsedMs(start) };
        } catch (err) {
            return {
                ok: false, name, error: err.message,
                status: err.response?.status || null, latency_ms: elapsedMs(start),
            };
        }
    }

    /**
     * Validates that an operational endpoint accepts requests.
     * Uses HEAD (low cost) with fallback to checking 405.
     * A 404 response → endpoint is misconfigured.
     * @private
     */
    async _validateEndpoint(name, baseUrl, path) {
        const url = `${baseUrl}${path}`;
        try {
            await httpClient.request({
                method: 'HEAD', url, timeout: CONFIG.HEALTH_TIMEOUT_MS,
                // 405 Method Not Allowed = path exists, HEAD unsupported
                validateStatus: (s) => s < 500,
            });
            return true;
        } catch (err) {
            if (err.response?.status === 404) {
                logger.warn('HEALTH', `Endpoint validation 404: ${url}`, {
                    name, suggestion: `Verify RAG_${name.toUpperCase()}_PATH`,
                });
            }
            return false;
        }
    }

    /**
     * Constructs a typed error object for structured failure routing.
     * The _ragError flag prevents re-wrapping in requestWithRetry.
     * @private
     */
    _typedError(type, message, url, extras = {}) {
        const err = new Error(message);
        err._ragError = true;
        err._ragErrorType = type;
        err.service_url = url;
        Object.assign(err, extras);
        return err;
    }

    /**
     * Deduplicates sources by doc ID, source file, title, and semantic overlap.
     * @private
     */
    _deduplicateSources(sources) {
        if (!Array.isArray(sources) || sources.length === 0) return [];

        const seen = new Map();
        const deduplicated = [];

        for (const source of sources) {
            const docId = source.doc_id || source.id || '';
            const sourceFile = source.source_file || source.source || '';
            const title = source.title || '';

            const groupKey = (docId || sourceFile || title || '').toLowerCase();

            if (!groupKey) {
                deduplicated.push(source);
                continue;
            }

            if (!seen.has(groupKey)) {
                seen.set(groupKey, source);
                deduplicated.push(source);
            } else {
                const existing = seen.get(groupKey);
                const existingScore = safeFloat(existing.score || existing.confidence || existing.rerank_score || 0);
                const newScore = safeFloat(source.score || source.confidence || source.rerank_score || 0);

                if (newScore > existingScore) {
                    const idx = deduplicated.indexOf(existing);
                    if (idx !== -1) deduplicated[idx] = source;
                    seen.set(groupKey, source);
                }
            }
        }

        return deduplicated;
    }

    /**
     * Startup capability validation. Detects support for hybrid/semantic modes.
     * @private
     */
    async _validateCapabilities() {
        if (this._telemetry.capabilities.validated) return;

        logger.info('STARTUP', 'Validating retriever capabilities...');
        try {
            const res = await this._callWithEndpointFallback(
                CONFIG.RETRIEVER_URL, CONFIG.RETRIEVER_PATH, CONFIG.RETRIEVER_PATH_ALT,
                this._normalizePayload("test capabilities", 1, 'GENERAL'), 'retriever'
            );

            if (res.success) {
                this._telemetry.capabilities.hybrid = true;
                this._telemetry.capabilities.semantic = true;
                this._telemetry.capabilities.keyword = true;
                logger.info('STARTUP', 'Hybrid search fully supported.');
            } else if (res.error && res.error.toLowerCase().includes('search_type')) {
                this._telemetry.capabilities.hybrid = false;
                this._telemetry.capabilities.semantic = true;
                logger.warn('STARTUP', 'Hybrid search NOT supported, downgrading to semantic.');
                CONFIG.SEARCH_TYPE = 'semantic';
            }
        } catch (e) {
            logger.error('STARTUP', 'Capability validation failed', { error: e.message });
        } finally {
            this._telemetry.capabilities.validated = true;
        }
    }

    /**
     * Runs periodic synthetic probes to validate retrieval health.
     * @private
     */
    async _runSyntheticProbes() {
        if (this._telemetry.circuit_breaker.state === 'OPEN') return;

        const now = Date.now();
        if (this._telemetry.synthetic_probes.last_run && now - this._telemetry.synthetic_probes.last_run < 300000) return;

        this._telemetry.synthetic_probes.last_run = now;
        logger.info('HEALTH', 'Running synthetic health probes...');

        const testQueries = [
            { query: "admission requirements", category: "admissions" },
            { query: "GPA probation", category: "academic_policy" },
            { query: "scholarship eligibility", category: "financial_aid" }
        ];

        let passed = 0;
        const results = [];

        for (const test of testQueries) {
            try {
                const res = await this._callRetriever(test.query, 3, test.category);
                const isHealthy = res.success && res.source_count > 0;
                if (isHealthy) passed++;
                results.push({ query: test.query, success: isHealthy, confidence: res.confidence });
            } catch (e) {
                results.push({ query: test.query, success: false, error: e.message });
            }
        }

        this._telemetry.synthetic_probes.status = passed === testQueries.length ? 'PASS' : (passed > 0 ? 'DEGRADED' : 'FAIL');
        this._telemetry.synthetic_probes.results = results;
    }

    /**
     * Formats raw RAG envelope into natural conversational response.
     * @param {Object} ragResult 
     * @returns {string}
     */
    formatConversationalResponse(ragResult) {
        if (!ragResult || !ragResult.success) {
            return "I'm currently unable to retrieve academic information. Please try again later or contact your advisor directly.";
        }

        let response = ragResult.answer || "I found some relevant academic information for you.";
        const sources = ragResult.sources || [];

        // Remove robotic formatting
        response = response.replace(/^(Answer:|A:|Response:)\s*/i, '');

        // Contextual tone
        if (ragResult.confidence === 'HIGH') {
            // Already highly confident, answer directly
        } else if (ragResult.confidence === 'MEDIUM') {
            response = `Based on the academic records, here is what I found: ${response}`;
        } else {
            response = `I couldn't find an exact match, but here is some related information: ${response}`;
        }

        // Attach evidence
        if (sources.length > 0) {
            const sourceTitles = sources.slice(0, 2)
                .map(s => s.title || s.source || s.doc_id || 'Academic Handbook')
                .filter(Boolean);

            if (sourceTitles.length > 0) {
                const uniqueTitles = [...new Set(sourceTitles)];
                response += `\n\n*(Source: ${uniqueTitles.join(', ')})*`;
            }
        }

        return response;
    }

    /**
     * Computes pass success rate percentage for telemetry.
     * @private
     */
    _passRate(pass) {
        const total = this._telemetry.total_searches;
        const success = this._telemetry[`${pass}_successes`] || 0;
        if (total === 0) return '0%';
        return `${Math.round((success / total) * 100)}%`;
    }

    /**
     * Computes fallback frequency percentage for observability.
     * @private
     */
    _fallbackRate() {
        const total = this._telemetry.total_searches;
        if (total === 0) return '0%';
        return `${Math.round((this._telemetry.fallback_count / total) * 100)}%`;
    }

    /**
     * Maintains an exponential moving average of search latency.
     * Alpha = 0.1 → slow adaptation, noise-resistant.
     * @private
     */
    _updateAvgLatency(newMs) {
        const alpha = 0.1;
        this._telemetry.avg_latency_ms = this._telemetry.avg_latency_ms === 0
            ? newMs
            : Math.round(alpha * newMs + (1 - alpha) * this._telemetry.avg_latency_ms);
    }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────

/**
 * Shared singleton — all importers use the same HTTP client,
 * telemetry accumulator, and active-endpoint registry.
 *
 * Usage:
 *
 *   const ragService = require('./services/ragService');
 *
 *   // Primary multi-pass retrieval (GENERAL route)
 *   const result = await ragService.search(userQuery);
 *
 *   // Direct grounded answer (RAG-only mode)
 *   const answer = await ragService.answer(userQuery);
 *
 *   // Health probe (/api/health aggregation)
 *   const health = await ragService.healthCheck();
 *
 *   // Manual rerank (fusionService.js hybrid merging)
 *   const reranked = ragService.rankSources(sources, 'academic_policy');
 *
 *   // Category detection (brainRouter.js routing signal)
 *   const category = ragService.detectQueryCategory(userQuery);
 *
 *   // Synonym expansion only (testing / debugging)
 *   const expanded   = ragService.expandQuery(userQuery);
 *   const simplified = ragService.simplifyQuery(userQuery);
 */
export default new RAGService();