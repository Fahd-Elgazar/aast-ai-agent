/**
 * ============================================================
 * brainRouter.js — AAST Explainable Hybrid Academic Super-Agent
 * ============================================================
 * PHASE 3A — CENTRAL AGENTIC BRAIN
 *
 * Intelligently routes queries based on semantic analysis,
 * intent classification, hybrid detection, and confidence scoring.
 * 
 * Replaces shallow if/else matching with an enterprise-grade
 * signal fusion engine.
 * ============================================================
 */

'use strict';

import ragService from './ragService.js';

// ─────────────────────────────────────────────────────────────
// LOGGER & CONSTANTS
// ─────────────────────────────────────────────────────────────

const logger = {
    info: (tag, msg, meta = {}) => console.log(`[BRAIN_ROUTER][${tag}] ${msg}`, Object.keys(meta).length ? meta : ''),
    warn: (tag, msg, meta = {}) => console.warn(`[BRAIN_ROUTER][${tag}] ⚠  ${msg}`, Object.keys(meta).length ? meta : ''),
    error: (tag, msg, meta = {}) => console.error(`[BRAIN_ROUTER][${tag}] ✖  ${msg}`, Object.keys(meta).length ? meta : ''),
    debug: (tag, msg, meta = {}) => {
        if (process.env.BRAIN_DEBUG === 'true') {
            console.debug(`[BRAIN_ROUTER][${tag}] ⬡  ${msg}`, Object.keys(meta).length ? meta : '');
        }
    },
};

const ROUTES = {
    KG_DIRECT: 'KG_DIRECT',
    KG_ONLY: 'KG_ONLY',
    RAG_DIRECT: 'RAG_DIRECT',
    RAG_ONLY: 'RAG_ONLY',
    HYBRID_KG_RAG: 'HYBRID_KG_RAG',
    DECISION_ENGINE: 'DECISION_ENGINE',
    CAREER_ENGINE: 'CAREER_ENGINE',
    FAQ: 'FAQ',
    LLM_FALLBACK: 'LLM_FALLBACK'
};

// Foundational token dictionaries (supplemented by regex patterns later)
const SIGNAL_DICTIONARY = {

    KG: [
        // Core Academic Structure
        'course', 'courses', 'subject', 'subjects',
        'program', 'programs', 'degree', 'specialization', 'specializations',
        'track', 'tracks', 'curriculum', 'academic structure',
        'semester', 'credit hour', 'credits',

        // Prerequisites / Course Dependencies
        'prerequisite', 'prerequisites', 'requirement', 'requirements',
        'required before', 'depends on', 'course sequence',

        // Faculty / Staff
        'professor', 'professors', 'doctor', 'doctors',
        'dean', 'vice dean',
        'teacher', 'teachers',
        'teach', 'teaches', 'teaching',
        'instructor', 'lecturer',
        'staff', 'faculty',
        'teaching assistant', 'ta',

        // Department / Governance
        'department', 'departments',
        'college', 'campus',
        'policy', 'grading policy',
        'grading system', 'gpa',
        'scholarship', 'scholarships',

        // Course Content
        'syllabus', 'schedule',
        'lab', 'labs', 'facility', 'facilities',

        // Career / Outcomes
        'career', 'career role', 'job role',

        // AI College Specific Programs
        'intelligent systems',
        'data science',
        'robotics',

        // Major Courses
        'machine learning',
        'deep learning',
        'mobile computing',
        'cognitive computing',
        'natural language processing',
        'artificial intelligence',
        'blockchain',
        'nlp',
        'computer vision',
        'image processing',
        'data mining',
        'cloud computing',
        'high performance computing',
        'block chain',
        'time series',
        'software engineering',
        'operating systems',
        'computing algorithms',
        'reinforcement learning',
        'robotics design',
        'information retrieval',

        // Faculty Names (high-value explicit entities)
        'osama badawy',
        'amr nasr',
        'khaled badran',
        'amira elsaid',
        'nihal mabrouk',
        'eman elakabawy',
        'mohamed talaat',
        'somaya ahmed',
        'ahmed attia',

        // Institution Specific
        'aast',
        'arab academy',
        'college of artificial intelligence'
    ],




    RAG: [
        // GPA / Grading
        'gpa', 'cgpa', 'grade', 'grades',
        'grading', 'grading system',
        'academic probation', 'probation',
        'underachievement',
        'pass', 'fail', 'failed',
        'repeat', 'repeated course',
        'conditioned pass',
        'credit hour', 'credit hours',
        'semester load', 'course load',
        'marks', 'exam', 'final exam',
        'absence', 'attendance',
        'withdraw', 'withdrawal',
        'forced withdrawal',
        'incomplete grade',

        // Admissions
        'admission', 'admissions',
        'minimum score',
        'requirements',
        'documents',
        'application',
        'orientation',
        'registration',
        'enrollment',
        'deadline', 'deadlines',

        // Tuition / Fees
        'fee', 'fees',
        'tuition', 'tuition fee',
        'payment',
        'financial',

        // Scholarships
        'scholarship', 'scholarships',
        'tuition exemption',
        'eligibility',
        'scholarship rules',

        // Transfer
        'transfer',
        'internal transfer',
        'external transfer',
        'credit transfer',
        'switch major',
        'major transfer',

        // Policies / Governance
        'policy', 'policies',
        'regulation', 'regulations',
        'rule', 'rules',
        'compliance',
        'academic integrity',
        'student conduct',
        'student affairs',
        'disciplinary',
        'handbook',

        // Academic Calendar
        'semester',
        'summer semester',
        'academic year',
        'calendar',

        // Graduation
        'graduation',
        'graduation requirements',
        'degree duration',

        // Student Services
        'advisor',
        'academic advisor',

        // Institutional
        'accreditation',
        'quality assurance',

        // Postgraduate
        'msc',
        'master',
        'postgraduate',
        'research paper',
        'publication requirement'
    ],

    DECISION: [
        'recommend', 'recommendation', 'best major', 'compare', 'difference between',
        'specialization fit', 'advise', 'advising', 'which major', 'choose',
        'help me decide', 'suit me', 'what should i study'
    ],
    CAREER: [
        'career', 'path', 'roadmap', 'future', 'job', 'jobs', 'specialization planning',
        'work as', 'salary', 'industry', 'market', 'employ', 'graduation'
    ],
    FAQ: [
        'where is', 'location', 'campus', 'contact', 'email', 'phone', 'hours',
        'open', 'close', 'wifi', 'password', 'reset'
    ]
};

// ─────────────────────────────────────────────────────────────
// BRAIN ROUTER CLASS
// ─────────────────────────────────────────────────────────────

class BrainRouter {
    constructor() {
        this.confidenceThresholds = {
            HIGH: 0.70,
            MEDIUM: 0.38,
            DEGRADED: 0.25,
            HYBRID_TRIGGER: 0.35 // If multi-domain signals cross this, HYBRID is highly considered
        };

        this.signalWeights = {
            lexical_single: 0.20,
            lexical_phrase: 0.35,
            lexical_compound: 0.05,

            pattern_course: 0.40,
            pattern_hybrid_base: 0.50,
            pattern_hybrid_component: 0.20,
            pattern_decision: 0.40,
            pattern_career: 0.40,

            hybrid_boost: 0.40,
            category_boost: 0.40,
            intent_boost: 0.30,
            context_boost: 0.15,
            deterministic_policy_boost: 1.10,

            base_llm: 0.10
        };

        this.metrics = {
            kg_hits: 0,
            rag_hits: 0,
            hybrid_hits: 0,
            faq_hits: 0,
            decision_hits: 0,
            career_hits: 0,
            fallback_hits: 0,
            total_requests: 0,
            total_confidence: 0,
            ambiguous_requests: 0
        };
    }

    /**
     * SIGNAL NORMALIZATION LAYER
     * Normalizes raw scores against theoretical maxes to prevent domain bias.
     */
    normalizeSignals(rawScores) {
        const normalized = {};
        // Approximate theoretical max based on dictionary size + standard boosts
        const theoreticalMax = {
            kg_score: 1.6,
            rag_score: 1.6, // Aligned domain normalization to prevent KG overweighting
            decision_score: 1.5,
            career_score: 1.5,
            faq_score: 1.5,
            hybrid_score: 2.0,
            llm_score: 1.0,
            kg_direct_score: 1.0,
            rag_direct_score: 1.0
        };

        for (const [key, value] of Object.entries(rawScores)) {
            const max = theoreticalMax[key] || 1.0;
            // Normalize by dividing by max, then scale up by 1.5 to preserve existing threshold viability
            const scaledValue = (value / max) * 1.5;
            normalized[key] = parseFloat(Math.min(1.0, scaledValue).toFixed(3));
        }
        return normalized;
    }

    /**
     * AMBIGUITY DETECTION ENGINE
     * Detects if the top 2 routes are too close to call.
     */
    detectAmbiguity(sortedSignals) {
        let ambiguity_detected = false;
        let ambiguity_score = 0;
        let prefer_hybrid = false;

        if (sortedSignals.length >= 2) {
            const top1 = sortedSignals[0];
            const top2 = sortedSignals[1];
            const diff = top1[1] - top2[1];

            if (diff <= 0.10 && top1[1] > 0.2) {
                ambiguity_detected = true;
                ambiguity_score = parseFloat((0.10 - diff).toFixed(3));

                const topKeys = [top1[0], top2[0]];
                if (topKeys.includes('kg_score') && topKeys.includes('rag_score')) {
                    prefer_hybrid = true;
                }
            }
        }

        return { ambiguity_detected, ambiguity_score, prefer_hybrid };
    }

    /**
     * ROUTE ANALYTICS & OBSERVABILITY
     */
    recordRouteMetrics(route, confidence, latencyMs, ambiguity) {
        this.metrics.total_requests++;
        this.metrics.total_confidence += confidence;
        if (ambiguity.ambiguity_detected) {
            this.metrics.ambiguous_requests++;
        }

        switch (route) {
            case ROUTES.KG_ONLY: this.metrics.kg_hits++; break;
            case ROUTES.KG_DIRECT: this.metrics.kg_hits++; break;
            case ROUTES.RAG_ONLY: this.metrics.rag_hits++; break;
            case ROUTES.RAG_DIRECT: this.metrics.rag_hits++; break;
            case ROUTES.HYBRID_KG_RAG: this.metrics.hybrid_hits++; break;
            case ROUTES.FAQ: this.metrics.faq_hits++; break;
            case ROUTES.DECISION_ENGINE: this.metrics.decision_hits++; break;
            case ROUTES.CAREER_ENGINE: this.metrics.career_hits++; break;
            case ROUTES.LLM_FALLBACK: this.metrics.fallback_hits++; break;
        }

        const avg_confidence = (this.metrics.total_confidence / this.metrics.total_requests).toFixed(3);
        const ambiguity_rate = (this.metrics.ambiguous_requests / this.metrics.total_requests).toFixed(3);

        logger.debug('METRICS', `Route Analytics Updated`, {
            route,
            latencyMs,
            avg_confidence,
            ambiguity_rate
        });
    }

    /**
     * DETERMINISTIC QUERY CLASSIFIER
     * Detects exact factual academic queries that should bypass the hybrid pipeline.
     */
    isDeterministicAcademicQuery(query) {
        const deterministicPatterns = [
            /who teaches/i,
            /who is teaching/i,
            /taught by/i,
            /instructor/i,
            /lecturer/i,
            /professor/i,
            /doctor/i,
            /prerequisite/i,
            /prereq/i,
            /pre-requisite/i,
            /pre requisite/i,
            /required before/i,
            /dean/i,
            /vice dean/i,
            /office/i,
            /location of/i,
            /where is/i,
            /room/i,
            /hall/i,
            /building/i,
            /faculty/i,
            /department head/i,
            /advisor/i,
            /schedule/i,
            /course owner/i
        ];
        return deterministicPatterns.some(pattern => pattern.test(query));
    }

    /**
     * DETERMINISTIC POLICY CLASSIFIER
     * Locks official academic policy questions to RAG before ambiguity logic can
     * dilute them into hybrid or LLM fallback paths.
     */
    classifyDeterministicPolicyQuery(query) {
        const policyPatterns = {
            gpa: /\b(gpa|cgpa|grade point|cumulative average|minimum gpa)\b/i,
            transfer: /\b(transfer|credit transfer|transferred credits|internal transfer|external transfer|switch major|change major)\b/i,
            probation: /\b(probation|academic warning|academic standing|underachievement|dismissal|academic risk)\b/i,
            scholarship: /\b(scholarship|financial aid|tuition exemption|fee waiver|discount|grant|bursary|eligibility)\b/i,
            admission: /\b(admission|admissions|apply|application|enrollment|joining|entry requirements|acceptance)\b/i,
            tuition: /\b(tuition|fees|payment|cost|charge|late payment|overdue|semester fees)\b/i,
            regulation: /\b(regulation|regulations|rules|handbook|bylaw|academic regulations)\b/i,
            policy: /\b(policy|policies|academic policy|institutional policy|student affairs|student conduct)\b/i
        };

        const matchedCategories = Object.entries(policyPatterns)
            .filter(([, pattern]) => pattern.test(query))
            .map(([category]) => category);

        const questionFraming = /\b(minimum|required|requirements|rule|rules|eligible|eligibility|allowed|must|can i|how do|what are|what is|when|deadline)\b/i.test(query);
        const explicitPolicyTerm = /\b(policy|policies|regulation|regulations|rules|handbook|probation|scholarship|tuition|admission|transfer|gpa|cgpa)\b/i.test(query);

        let score = 0;
        if (matchedCategories.length > 0) score += 0.45;
        score += Math.min(0.35, matchedCategories.length * 0.12);
        if (questionFraming) score += 0.12;
        if (explicitPolicyTerm) score += 0.12;

        const strongPolicyEvidence =
            matchedCategories.length >= 2 ||
            (matchedCategories.length >= 1 && questionFraming) ||
            /\b(probation rules|scholarship eligibility|admission requirements|tuition regulations|minimum gpa|gpa for transfer)\b/i.test(query);

        return {
            deterministic: strongPolicyEvidence,
            strong_policy_evidence: strongPolicyEvidence,
            score: parseFloat(Math.min(1.0, score).toFixed(3)),
            matched_categories: matchedCategories
        };
    }

    /**
     * 1. analyzeQuery(query, existingIntent, sessionContext)
     * Performs deep semantic decomposition of the query by combining
     * lexical signals, structural patterns, and RAG semantic categories.
     * 
     * @param {string} query - Raw user query
     * @param {string|null} existingIntent - Intent from previous classifier layer
     * @param {Object} sessionContext - Conversation history / state
     * @returns {Object} Analytical payload for the router
     */
    analyzeQuery(query, existingIntent = null, sessionContext = {}) {
        logger.info('ANALYZE', 'Analyzing incoming query', { query });
        const normalizedQuery =
            typeof query === "string"
                ? query
                : query?.query || "";

        const lowerQuery = normalizedQuery.toLowerCase();

        // 1. Extract base lexical and structural signals
        const signals = this.detectRoutingSignals(lowerQuery);

        // 2. Invoke ragService to detect semantic policy categories
        // This leverages Phase 2.5 weighted category scoring
        try {
            const categoryResult = ragService.detectQueryCategory(normalizedQuery);
            if (categoryResult && categoryResult.confidence > 0.2) {
                this._applyCategoryBoost(signals, categoryResult.category, categoryResult.confidence);
                logger.debug('ANALYZE', 'Applied RAG category boost', { category: categoryResult.category, confidence: categoryResult.confidence });
            }
        } catch (err) {
            logger.warn('ANALYZE', 'Failed to invoke ragService category detection', { error: err.message });
        }

        // 3. Adjust signals based on pre-classified intent (if available)
        this._applyIntentBoost(signals, existingIntent);

        // 4. Adjust signals based on conversation context (e.g., follow-up context)
        this._applyContextBoost(signals, sessionContext);

        // 4.5 Deterministic policy classifier (Phase 6 repair)
        const deterministicPolicy = this.classifyDeterministicPolicyQuery(lowerQuery);
        if (deterministicPolicy.strong_policy_evidence) {
            signals.rag_score += this.signalWeights.deterministic_policy_boost + (deterministicPolicy.score * 0.45);
            signals.rag_direct_score = Math.max(0.85, deterministicPolicy.score);

            // Policy terms such as GPA/scholarship can appear in KG dictionaries;
            // keep KG available as fallback, but do not let it suppress RAG.
            if (!this.isDeterministicAcademicQuery(lowerQuery)) {
                signals.kg_score *= 0.45;
                signals.hybrid_score *= 0.5;
            }

            logger.debug('ANALYZE', 'Deterministic policy query detected, boosting rag_direct_score', deterministicPolicy);
        } else {
            signals.rag_direct_score = 0;
        }

        // 5. Determine hybrid potential
        // Expanded to include combinations of KG, RAG, CAREER, DECISION
        const isHybridCandidate = !deterministicPolicy.strong_policy_evidence && (
            (signals.kg_score >= this.confidenceThresholds.HYBRID_TRIGGER && signals.rag_score >= this.confidenceThresholds.HYBRID_TRIGGER) ||
            (signals.kg_score >= this.confidenceThresholds.HYBRID_TRIGGER && (signals.career_score >= 0.4 || signals.decision_score >= 0.4)) ||
            (signals.rag_score >= this.confidenceThresholds.HYBRID_TRIGGER && (signals.career_score >= 0.4 || signals.decision_score >= 0.4))
        );

        if (isHybridCandidate) {
            // Synergistic boost
            signals.hybrid_score += (Math.max(signals.kg_score, signals.rag_score) + 0.3) * this.signalWeights.hybrid_boost;
            logger.debug('ANALYZE', 'Hybrid conditions met, boosting hybrid_score', { hybrid_score: signals.hybrid_score });
        }

        // 5.5 Detect Deterministic Factual Academic Queries (PHASE 4)
        if (this.isDeterministicAcademicQuery(lowerQuery)) {
            signals.kg_score += 1.0;
            signals.kg_direct_score = 1.0;
            logger.debug('ANALYZE', 'Deterministic academic query detected, boosting kg_direct_score');
        } else {
            signals.kg_direct_score = 0;
        }

        // 6. Normalize Signals (CRITICAL LAYER)
        const normalizedSignals = this.normalizeSignals(signals);

        return {
            original_query: normalizedQuery,
            normalized_query: lowerQuery,
            signals: normalizedSignals,
            is_hybrid_candidate: isHybridCandidate,
            deterministic_policy: deterministicPolicy,
            context_applied: Object.keys(sessionContext).length > 0
        };
    }

    /**
     * 2. detectRoutingSignals(query)
     * Scores the query against various domains using a mix of dictionary matches
     * and structural regex pattern detection.
     * 
     * @param {string} lowerQuery
     * @returns {Object} Scores map
     */
    detectRoutingSignals(lowerQuery) {
        const scores = {
            kg_score: 0,
            rag_score: 0,
            hybrid_score: 0,
            decision_score: 0,
            career_score: 0,
            faq_score: 0,
            llm_score: this.signalWeights.base_llm // Base fallback score ensures it's never 0
        };

        const facultyPattern = /(who teaches|who is teaching|instructor for|lecturer for|doctor for)/i;
        if (facultyPattern.test(lowerQuery)) {
            scores.kg_score += 0.45;
            logger.debug('ROUTING_SIGNAL', 'Detected faculty teaching query');
        }

        const prereqPattern = /(prerequisite|required before|depends on)/i;
        if (prereqPattern.test(lowerQuery)) {
            scores.kg_score += 0.40;
            logger.debug('ROUTING_SIGNAL', 'Detected prerequisite query');
        }

        // --- STEP A: Keyword & Phrase Dictionary Matching ---
        const calculateScore = (dictionary) => {
            let score = 0;
            let matched = 0;
            dictionary.forEach(term => {
                const regex = new RegExp(`\\b${term}\\b`, 'i');
                if (regex.test(lowerQuery)) {
                    score += term.includes(' ') ? this.signalWeights.lexical_phrase : this.signalWeights.lexical_single;
                    matched++;
                }
            });
            return score + (matched * this.signalWeights.lexical_compound); // slight compounding boost for multiple hits
        };

        scores.kg_score += calculateScore(SIGNAL_DICTIONARY.KG);
        scores.rag_score += calculateScore(SIGNAL_DICTIONARY.RAG);
        scores.decision_score += calculateScore(SIGNAL_DICTIONARY.DECISION);
        scores.career_score += calculateScore(SIGNAL_DICTIONARY.CAREER);
        scores.faq_score += calculateScore(SIGNAL_DICTIONARY.FAQ);

        // --- STEP B: Structural & Semantic Pattern Detection ---

        // Pattern: Course Codes (e.g., CS101, MATH 201) -> Strong KG Indicator
        const hasCourseCode = /[a-z]{2,4}\s*\d{3}/i.test(lowerQuery);
        if (hasCourseCode) {
            scores.kg_score += this.signalWeights.pattern_course;
            logger.debug('ROUTING_SIGNAL', 'Detected academic course code pattern');
        }

        // Pattern: Policy + Program combination -> Strong Hybrid Indicator
        const hasPolicyTerms = /(policy|rule|probation|gpa|requirement)/i.test(lowerQuery);
        const hasProgramTerms = /(major|track|department|course)/i.test(lowerQuery);
        if (hasPolicyTerms && hasProgramTerms) {
            scores.hybrid_score += this.signalWeights.pattern_hybrid_base;
            scores.kg_score += this.signalWeights.pattern_hybrid_component;
            scores.rag_score += this.signalWeights.pattern_hybrid_component;
            logger.debug('ROUTING_SIGNAL', 'Detected hybrid Policy+Program pattern');
        }

        // Pattern: Recommendation Framing ("What should I", "Which is better")
        const hasRecommendationFraming = /(what should i|which is better|recommend a|help me choose|best fit)/i.test(lowerQuery);
        if (hasRecommendationFraming) {
            scores.decision_score += this.signalWeights.pattern_decision;
            logger.debug('ROUTING_SIGNAL', 'Detected recommendation semantic framing');
        }

        // Pattern: Career Framing ("after graduation", "jobs for", "salary")
        const hasCareerFraming = /(after graduat|jobs for|career path|salary for)/i.test(lowerQuery);
        if (hasCareerFraming) {
            scores.career_score += this.signalWeights.pattern_career;
            logger.debug('ROUTING_SIGNAL', 'Detected career/future semantic framing');
        }

        return scores;
    }

    /**
     * 3. determineBestRoute(signals, healthStatus)
     * The decision engine that evaluates all signals and service health to output
     * the optimal execution route and fallback chain.
     * 
     * @param {Object} analysisPayload - Output from analyzeQuery
     * @param {Object} healthStatus - Current subsystem health flags
     * @returns {Object} Route envelope
     */
    determineBestRoute(analysisPayload, healthStatus = {}) {
        const routeStartTime = Date.now();
        const { signals, is_hybrid_candidate, deterministic_policy } = analysisPayload;

        // Ensure healthStatus has defaults
        const health = {
            kg: healthStatus.kg !== false,
            rag: healthStatus.rag !== false,
            decision: healthStatus.decision !== false,
            career: healthStatus.career !== false,
            faq: healthStatus.faq !== false,
            llm: healthStatus.llm !== false
        };

        // PHASE 8: HYBRID OVERRIDE REGEX
        if (/electives|specialization|career path|cybersecurity|scholarship|academic path|roadmap|best path/i.test(analysisPayload.original_query)) {
            logger.info('ROUTING_DECISION', 'Hybrid override regex triggered');
            return {
                route: ROUTES.HYBRID_KG_RAG,
                confidence: 0.92,
                reasoning: "Query contains high-value hybrid academic-career tokens. Forcing hybrid synthesis.",
                fallback_chain: [ROUTES.KG_ONLY, ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK],
                services_required: ['kg', 'rag'],
                ambiguity_score: 0,
                ambiguity_detected: false
            };
        }

        // Sort signals by score descending
        const sortedSignals = Object.entries(signals)
            .sort((a, b) => b[1] - a[1])
            .filter(s => s[1] > 0);

        // 0. Evaluate Deterministic RAG Policy Shortcut (Phase 6 hardened)
        if (
            deterministic_policy?.strong_policy_evidence &&
            signals.rag_direct_score >= 0.70 &&
            health.rag
        ) {
            logger.info('ROUTING_DECISION', 'Hard deterministic RAG policy path enforced', {
                matched_categories: deterministic_policy.matched_categories
            });
            return {
                route: ROUTES.RAG_DIRECT,
                confidence: 0.96,
                reasoning: "Deterministic academic policy query detected. Bypassing LLM fallback and prioritizing verified RAG policy sources.",
                fallback_chain: [ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK],
                services_required: ['rag'],
                ambiguity_score: 0,
                ambiguity_detected: false,
                deterministic_policy
            };
        }

        // 1. Evaluate Deterministic KG Shortcut (PHASE 4.2 Hardened)
        if (signals.kg_direct_score >= 0.70 && health.kg) {
            logger.info('ROUTING_DECISION', 'Hard deterministic KG path enforced');
            return {
                route: ROUTES.KG_DIRECT,
                confidence: 0.99,
                reasoning: "Deterministic academic factual query detected. Bypassing hybrid logic for guaranteed accuracy.",
                fallback_chain: [ROUTES.KG_ONLY, ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK],
                services_required: ['kg'],
                ambiguity_score: 0,
                ambiguity_detected: false,
                deterministic_policy
            };
        }

        // Ambiguity Engine
        const ambiguityData = this.detectAmbiguity(sortedSignals);

        let bestRoute = ROUTES.LLM_FALLBACK;
        let bestScore = sortedSignals.length > 0 ? sortedSignals[0][1] : 0;
        let reasoning = "Default LLM fallback due to extremely low confidence or missing signals.";
        let requiredServices = ['llm'];
        let fallbackChain = [];

        if (ambiguityData.ambiguity_detected && !ambiguityData.prefer_hybrid) {
            // Lower confidence to reflect uncertainty
            bestScore = Math.max(0.2, bestScore - 0.05);
        }

        if (sortedSignals.length > 0) {
            const topSignal = sortedSignals[0][0];
            const topScore = sortedSignals[0][1];

            // 1. Evaluate Hybrid First
            // Hybrid requires BOTH KG and RAG to be healthy.
            const meetsHybridThresholds = signals.kg_score >= this.confidenceThresholds.HYBRID_TRIGGER &&
                signals.rag_score >= this.confidenceThresholds.HYBRID_TRIGGER;
            const validHybrid = meetsHybridThresholds && (is_hybrid_candidate || ambiguityData.prefer_hybrid);

            if (validHybrid) {
                if (health.kg && health.rag) {
                    bestRoute = ROUTES.HYBRID_KG_RAG;
                    bestScore = signals.hybrid_score || Math.max(signals.kg_score, signals.rag_score);
                    reasoning = "Query contains complex intersections of structural academic data and policy/regulations.";
                    requiredServices = ['kg', 'rag'];
                    fallbackChain = [ROUTES.RAG_ONLY, ROUTES.KG_ONLY, ROUTES.LLM_FALLBACK];
                } else if (!health.rag && health.kg) {
                    bestRoute = ROUTES.KG_ONLY;
                    reasoning = "Hybrid intended, but RAG subsystem is unhealthy. Safely downgraded to KG_ONLY.";
                    requiredServices = ['kg'];
                    fallbackChain = [ROUTES.LLM_FALLBACK];
                } else if (!health.kg && health.rag) {
                    bestRoute = ROUTES.RAG_ONLY;
                    reasoning = "Hybrid intended, but KG subsystem is unhealthy. Safely downgraded to RAG_ONLY.";
                    requiredServices = ['rag'];
                    fallbackChain = [ROUTES.LLM_FALLBACK];
                }
            }
            // 2. Evaluate Decision Engine
            else if (topSignal === 'decision_score' && topScore >= this.confidenceThresholds.MEDIUM) {
                if (health.decision) {
                    bestRoute = ROUTES.DECISION_ENGINE;
                    reasoning = "Query strongly aligns with academic advising, major selection, or comparative recommendations.";
                    requiredServices = ['decision'];
                    fallbackChain = [ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK];
                } else {
                    bestRoute = ROUTES.RAG_ONLY;
                    reasoning = "Decision engine unhealthy. Downgrading to RAG retrieval for advising documentation.";
                    requiredServices = ['rag'];
                }
            }
            // 3. Evaluate Career Engine
            else if (topSignal === 'career_score' && topScore >= this.confidenceThresholds.MEDIUM) {
                if (health.career) {
                    bestRoute = ROUTES.CAREER_ENGINE;
                    reasoning = "Query focuses on post-graduation roadmap, job market, or career trajectory.";
                    requiredServices = ['career'];
                    fallbackChain = [ROUTES.DECISION_ENGINE, ROUTES.LLM_FALLBACK];
                } else {
                    bestRoute = ROUTES.LLM_FALLBACK;
                    reasoning = "Career engine unhealthy. Falling back to general LLM processing.";
                }
            }
            // 4. Evaluate Knowledge Graph Only
            else if (topSignal === 'kg_score' && topScore >= this.confidenceThresholds.MEDIUM) {
                if (health.kg) {
                    bestRoute = ROUTES.KG_ONLY;
                    reasoning = "Query maps to structured curriculum entities (courses, prerequisites, faculty).";
                    requiredServices = ['kg'];
                    fallbackChain = [ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK];
                } else {
                    bestRoute = ROUTES.RAG_ONLY;
                    reasoning = "Knowledge Graph unhealthy. Attempting text-based RAG retrieval as fallback.";
                    requiredServices = ['rag'];
                }
            }
            // 5. Evaluate RAG Only
            else if (topSignal === 'rag_score' && topScore >= this.confidenceThresholds.MEDIUM) {
                if (health.rag) {
                    bestRoute = ROUTES.RAG_ONLY;
                    reasoning = "Query maps to unstructured institutional knowledge (policies, fees, admission rules).";
                    requiredServices = ['rag'];
                    fallbackChain = [ROUTES.FAQ, ROUTES.LLM_FALLBACK];
                } else {
                    bestRoute = ROUTES.LLM_FALLBACK;
                    reasoning = "RAG subsystem unhealthy. Falling back to base LLM knowledge.";
                }
            }
            // 6. Evaluate FAQ
            else if (topSignal === 'faq_score' && topScore >= this.confidenceThresholds.MEDIUM) {
                const dominance_margin = 0.15;
                const isDominant = topScore > (signals.rag_score + dominance_margin) &&
                    topScore > (signals.kg_score + dominance_margin);

                if (isDominant && health.faq) {
                    bestRoute = ROUTES.FAQ;
                    reasoning = "Query maps to static, direct institutional answers safely dominating other routes.";
                    requiredServices = ['faq'];
                    fallbackChain = [ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK];
                } else {
                    bestRoute = ROUTES.RAG_ONLY;
                    reasoning = "FAQ service unhealthy or failed safety gating (insufficient dominance over RAG/KG). Attempting RAG extraction.";
                    requiredServices = ['rag'];
                }
            }
            // 7. Low Confidence Fallback
            else {
                if (signals.kg_score >= this.confidenceThresholds.DEGRADED && health.kg) {
                    bestRoute = ROUTES.KG_ONLY;
                    bestScore = signals.kg_score;
                    reasoning = `Low-confidence but usable academic structural signal detected. Gracefully degrading to KG_ONLY instead of catastrophic fallback.`;
                    requiredServices = ['kg'];
                    fallbackChain = [ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK];
                } 
                else if (signals.rag_score >= this.confidenceThresholds.DEGRADED && health.rag) {
                    bestRoute = ROUTES.RAG_ONLY;
                    bestScore = signals.rag_score;
                    reasoning = `Low-confidence but usable policy/institutional signal detected. Gracefully degrading to RAG_ONLY instead of catastrophic fallback.`;
                    requiredServices = ['rag'];
                    fallbackChain = [ROUTES.LLM_FALLBACK];
                } 
                else {
                    bestRoute = ROUTES.LLM_FALLBACK;
                    reasoning = `All signals below degraded safety threshold. Routing to LLM_FALLBACK as true last resort.`;
                    requiredServices = ['llm'];
                    fallbackChain = [];
                }
            }
        }

        if (ambiguityData.ambiguity_detected) {
            reasoning += " (Ambiguity detected: expanded fallback chain).";
            if (!fallbackChain.includes(ROUTES.LLM_FALLBACK)) {
                fallbackChain.push(ROUTES.LLM_FALLBACK);
            }
            // Add secondary route to fallback if applicable
            if (sortedSignals.length >= 2) {
                const altRouteMap = {
                    'kg_score': ROUTES.KG_ONLY,
                    'rag_score': ROUTES.RAG_ONLY,
                    'decision_score': ROUTES.DECISION_ENGINE,
                    'career_score': ROUTES.CAREER_ENGINE,
                    'faq_score': ROUTES.FAQ
                };
                const altRoute = altRouteMap[sortedSignals[1][0]];
                if (altRoute && altRoute !== bestRoute && !fallbackChain.includes(altRoute)) {
                    fallbackChain.unshift(altRoute); // Prioritize the close 2nd route
                }
            }
        }

        const latencyMs = Date.now() - routeStartTime;
        this.recordRouteMetrics(bestRoute, bestScore, latencyMs, ambiguityData);

        // Explainability logging
        logger.info('ROUTING_DECISION', `Best route computed: ${bestRoute}`, {
            confidence: bestScore.toFixed(2),
            top_signal: sortedSignals.length > 0 ? sortedSignals[0][0] : 'none',
            ambiguity: ambiguityData.ambiguity_detected,
            reasoning
        });

        return {
            route: bestRoute,
            confidence: parseFloat(bestScore.toFixed(3)),
            reasoning,
            fallback_chain: fallbackChain,
            services_required: requiredServices,
            ambiguity_score: ambiguityData.ambiguity_score,
            ambiguity_detected: ambiguityData.ambiguity_detected,
            deterministic_policy
        };
    }

    // ─────────────────────────────────────────────────────────────
    // PRIVATE BOOSTING METHODS
    // ─────────────────────────────────────────────────────────────

    /**
     * Incorporates semantic category signals from Phase 2.5 RAG Service.
     * Maps RAG documentation classes into Agentic domain scores.
     * @private
     */
    _applyCategoryBoost(signals, category, confidence) {
        const boost = confidence * this.signalWeights.category_boost; // multiplier for category weight

        switch (category) {
            case 'academic_policy':
            case 'financial_aid':
            case 'tuition':
            case 'admissions':
            case 'registration':
            case 'housing':
                signals.rag_score += Math.max(boost, 0.28);
                break;
            case 'curriculum':
            case 'institutional':
                signals.kg_score += boost;
                break;
            case 'examination':
                // Exams span both KG (schedules) and RAG (grading policies)
                signals.rag_score += (boost * 0.5);
                signals.kg_score += (boost * 0.5);
                break;
        }
    }

    /**
     * Allows legacy or upstream LLM intent classifiers to nudge the scores.
     * @private
     */
    _applyIntentBoost(signals, intent) {
        if (!intent || typeof intent !== 'string') return;
        const i = intent.toLowerCase();

        const boostMap = {
            'recommendation': 'decision_score',
            'course_info': 'kg_score',
            'policy': 'rag_score',
            'career': 'career_score',
            'faq': 'faq_score',
            'hybrid': 'hybrid_score'
        };

        for (const [key, field] of Object.entries(boostMap)) {
            if (i.includes(key)) {
                signals[field] += this.signalWeights.intent_boost; // High trust in pre-classifier
            }
        }
    }

    /**
     * Prevents context-switching whiplash by slightly favoring the domain
     * of the last conversation turn, aiding follow-up questions.
     * @private
     */
    _applyContextBoost(signals, context) {
        if (!context || !context.lastRoute) return;

        const last = context.lastRoute;
        const contextBoost = this.signalWeights.context_boost; // Subtle continuity anchor

        switch (last) {
            case ROUTES.DECISION_ENGINE:
                signals.decision_score += contextBoost;
                break;
            case ROUTES.CAREER_ENGINE:
                signals.career_score += contextBoost;
                break;
            case ROUTES.KG_ONLY:
                signals.kg_score += contextBoost;
                break;
            case ROUTES.RAG_ONLY:
                signals.rag_score += contextBoost;
                break;
            case ROUTES.HYBRID_KG_RAG:
                signals.hybrid_score += contextBoost;
                break;
        }
    }
}

// Export singleton instance and constants
const brainRouter = new BrainRouter();
brainRouter.ROUTES = ROUTES;
export default brainRouter;
