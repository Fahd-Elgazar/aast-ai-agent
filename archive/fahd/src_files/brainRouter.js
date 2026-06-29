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
import { ROUTING_CALIBRATION } from '../config/routingCalibration.js';
import { ACADEMIC_ALIAS_GROUPS, ONTOLOGY_NON_PERSON_CATEGORIES } from './academicAliases.js';
import { ROUTE_PRIORITY, classifyGoldenQuery } from '../config/goldenPathRegistry.js';

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

const ONTOLOGY_KG_INTENTS = new Set([
    'FACILITY',
    'TRACK',
    'PARTNER_INSTITUTION',
    'GOVERNANCE',
    'POLICY',
    'CAMPUS',
    'CURRICULUM'
]);

const CURRICULUM_INTENT_PATTERN = /\b(week|weekly|topic|topics|syllabus|lecture|lectures|module|modules|transformers?|rag|multimodal|text generation|self-supervised learning)\b/i;

function detectCurriculumIntent(query) {
    return CURRICULUM_INTENT_PATTERN.test(String(query || ''));
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(value, min = 0, max = 1) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
}

function tokenCount(query) {
    return String(query || '').split(/\s+/).filter(Boolean).length;
}

const ALIAS_LOOKUP = ACADEMIC_ALIAS_GROUPS
    .flatMap(group => [
        { surface: group.canonical, canonical: group.canonical, category: group.category, canonical_hit: true },
        ...group.aliases.map(alias => ({
            surface: alias,
            canonical: group.canonical,
            category: group.category,
            canonical_hit: false
        }))
    ])
    .sort((a, b) => b.surface.length - a.surface.length);

function matchAliasSignals(query) {
    const matched = [];
    const seen = new Set();

    for (const entry of ALIAS_LOOKUP) {
        const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(entry.surface)}(?=$|[^A-Za-z0-9])`, 'i');
        if (!pattern.test(query)) continue;

        const key = `${entry.category}:${entry.canonical}:${entry.surface}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matched.push(entry);
    }

    return matched;
}

// Foundational token dictionaries (supplemented by regex patterns later)
const SIGNAL_DICTIONARY = {

    KG: [
        // Core Academic Structure
        'course', 'courses', 'subject', 'subjects',
        'program', 'programs', 'degree', 'specialization', 'specializations',
        'track', 'tracks', 'pathway', 'pathways', 'focus area', 'major track',
        'curriculum', 'academic structure',
        'week', 'weekly',
        'lecture', 'lectures',
        'topic', 'topics',
        'module', 'modules',
        'transformer', 'transformers',
        'rag', 'multimodal',
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
        'college', 'campus', 'campuses', 'branch',
        'policy', 'grading policy',
        'grading system', 'gpa',
        'scholarship', 'scholarships',
        'governance', 'governance body', 'governance unit',
        'quality unit', 'quality assurance unit',
        'partner institution', 'partner institutions',
        'partner university', 'academic partner',
        'international collaboration',

        // Course Content
        'syllabus', 'schedule',
        'lab', 'labs', 'laboratory', 'laboratories',
        'facility', 'facilities', 'facility component',
        'robotics lab', 'iot lab', 'virtual reality lab',

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
        this.calibration = ROUTING_CALIBRATION;
        this.confidenceThresholds = {
            HIGH: 0.70,
            MEDIUM: ROUTING_CALIBRATION.kgConfidenceThreshold,
            DEGRADED: ROUTING_CALIBRATION.llmFallbackThreshold,
            HYBRID_TRIGGER: ROUTING_CALIBRATION.hybridConfidenceThreshold
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
            person_alias_boost: ROUTING_CALIBRATION.personAliasBoost,
            requirements_hybrid_boost: ROUTING_CALIBRATION.requirementsHybridBoost,
            scholarship_hybrid_boost: ROUTING_CALIBRATION.scholarshipHybridBoost,

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

            const ambiguityMargin = this.calibration.ambiguityMargin;
            if (diff <= ambiguityMargin && top1[1] > 0.2) {
                ambiguity_detected = true;
                ambiguity_score = parseFloat((ambiguityMargin - diff).toFixed(3));

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
            /course owner/i,
            /week/i,
            /weekly/i,
            /topic/i,
            /topics/i,
            /syllabus/i,
            /lecture/i,
            /lectures/i,
            /module/i,
            /modules/i,
            /transformers?/i,
            /\brag\b/i,
            /multimodal/i
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

    classifyQuestionFeatures(query, existingIntent = null, sessionContext = {}) {
        const lowerQuery = String(query || '').toLowerCase();
        const normalizedExistingIntent = String(existingIntent || '')
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_')
            .replace(/[^A-Z_]/g, '');
        const existingOntologyIntentFromInput = ONTOLOGY_KG_INTENTS.has(normalizedExistingIntent)
            ? normalizedExistingIntent
            : null;
        const aliases = matchAliasSignals(lowerQuery);
        const aliasCategories = new Set(aliases.map(alias => alias.category));
        const hasCurriculumSignal = existingOntologyIntentFromInput === 'CURRICULUM' || aliasCategories.has('ontology_curriculum') || detectCurriculumIntent(lowerQuery);
        const existingOntologyIntent = existingOntologyIntentFromInput || (hasCurriculumSignal ? 'CURRICULUM' : null);
        const aliasConfidence = aliases.length === 0
            ? 0
            : clamp(Math.max(...aliases.map(alias => alias.canonical_hit ? 0.82 : 0.94)));

        const hasCourseCode = /\b[a-z]{2,5}\s*\d{3,4}\b/i.test(lowerQuery);
        const hasSpecificSubject = /\b(machine learning|natural language processing|mobile computing|blockchain|deep learning|computer vision|data science|artificial intelligence|software engineering|nlp|ml)\b/i.test(lowerQuery);
        const hasCurriculum = existingOntologyIntent === 'CURRICULUM' || hasCurriculumSignal;
        const hasFacility = existingOntologyIntent === 'FACILITY' || aliasCategories.has('ontology_facility') || aliasCategories.has('ontology_facility_component') || /\b(facility|facilities|lab|labs|laboratory|laboratories|facility component|equipment|robotics lab|iot lab|virtual reality lab)\b/i.test(lowerQuery);
        const hasStructuralPolicy = existingOntologyIntent === 'POLICY' || aliasCategories.has('ontology_policy') || /\b(policy|policies|policy pathway|policy pathways|grading|grading system|grading systems|grading policy|passing criteria|tuition pathway|scholarship pathway|advising pathway)\b/i.test(lowerQuery);
        const hasExplicitTrackIntent = /\b(track|tracks|specialization|specializations|pathway|pathways|focus area|focus areas|major track|major tracks|concentration|concentrations)\b/i.test(lowerQuery);
        const hasTrack = existingOntologyIntent === 'TRACK' || (!hasStructuralPolicy && (aliasCategories.has('ontology_track') || hasExplicitTrackIntent));
        const hasPartnerInstitution = existingOntologyIntent === 'PARTNER_INSTITUTION' || aliasCategories.has('ontology_partner_institution') || /\b(partner institution|partner institutions|partner university|academic partner|international partner|international collaboration|uclan|barcelona)\b/i.test(lowerQuery);
        const hasGovernance = existingOntologyIntent === 'GOVERNANCE' || aliasCategories.has('ontology_governance') || /\b(governance|governance body|governance unit|quality unit|quality assurance unit|program governance|college governance)\b/i.test(lowerQuery);
        const hasCampus = existingOntologyIntent === 'CAMPUS' || aliasCategories.has('ontology_campus') || /\b(campus|campuses|branch|branches|el alamein|new el alamein)\b/i.test(lowerQuery);
        const hasOntologyAlias = [...aliasCategories].some(category => ONTOLOGY_NON_PERSON_CATEGORIES.includes(category));
        const hasOntologyNonPerson = !!existingOntologyIntent || hasOntologyAlias || hasCurriculum || hasFacility || hasTrack || hasPartnerInstitution || hasGovernance || hasStructuralPolicy || hasCampus;
        const hasPersonTitleOrAlias = aliasCategories.has('faculty_person') || /\b(dr|doctor|professor|prof|instructor|lecturer|staff)\b/i.test(lowerQuery);
        const hasPerson = hasPersonTitleOrAlias && !hasOntologyNonPerson;
        const hasFacultyRole = aliasCategories.has('faculty_role') || /\b(dean|vice dean|head of department|hod|program director|department head)\b/i.test(lowerQuery);
        const hasTeaching = /\b(who teaches|who is teaching|teacher|teaches|teaching|taught by|instructor|lecturer)\b/i.test(lowerQuery);
        const hasCoursePrereq = /\b(prerequisite|prerequisites|prereq|pre requisite|required before|depends on|before taking)\b/i.test(lowerQuery);
        const hasRequirements = /\b(requirement|requirements|required|eligibility|eligible|criteria|condition|conditions)\b/i.test(lowerQuery);
        const hasScholarship = /\b(scholarship|scholarships|financial aid|tuition exemption|fee waiver|discount|grant|bursary)\b/i.test(lowerQuery);
        const hasFees = /\b(fee|fees|tuition|cost|payment|price|charges)\b/i.test(lowerQuery);
        const hasGpa = /\b(gpa|cgpa|grade point|minimum grade)\b/i.test(lowerQuery);
        const hasProgram = /\b(program|major|department|college|faculty|course|courses|curriculum)\b/i.test(lowerQuery) || (!hasExplicitTrackIntent && /\b(track|tracks|pathway|pathways|specialization|specializations)\b/i.test(lowerQuery));
        const hasComparison = /\b(compare|comparison|vs|versus|difference between|different from|better)\b/i.test(lowerQuery);
        const hasAdvisory = /\b(should i|recommend|advise|advice|choose|help me decide|best for me|suit me|fits me)\b/i.test(lowerQuery);
        const hasConversational = /\b(favorite color|joke|story|write a|script|poem|unmotivated|motivate|summarize the plot)\b/i.test(lowerQuery);
        const hasPlanning = /\b(plan|planning|roadmap|path|career path|decision support|case|cases)\b/i.test(lowerQuery);

        const classes = [];
        if (hasCurriculum) classes.push('curriculum');
        if (hasPerson) classes.push('person');
        if (hasFacultyRole) classes.push('leadership');
        if (hasTeaching) classes.push('teaching');
        if (hasCoursePrereq) classes.push('course_prerequisite');
        if (hasFacility) classes.push('facility');
        if (hasTrack) classes.push('track');
        if (hasPartnerInstitution) classes.push('partner_institution');
        if (hasGovernance) classes.push('governance');
        if (hasStructuralPolicy) classes.push('kg_policy');
        if (hasCampus) classes.push('campus');
        if (hasScholarship) classes.push('scholarship');
        if (hasFees) classes.push('fees');
        if (hasGpa) classes.push('gpa');
        if (hasRequirements && !hasCoursePrereq) classes.push('requirements');
        if (hasComparison) classes.push('comparison');
        if (hasAdvisory) classes.push('advisory');
        if (hasPlanning) classes.push('planning');
        if (hasConversational) classes.push('conversational');

        const entityConfidence = clamp(Math.max(
            hasCourseCode ? 0.92 : 0,
            hasPerson && aliases.length > 0 ? 0.94 : 0,
            hasPerson ? 0.78 : 0,
            hasFacultyRole ? 0.86 : 0,
            hasCurriculum ? 0.94 : 0,
            hasOntologyNonPerson ? 0.88 : 0,
            hasSpecificSubject ? 0.82 : 0,
            hasProgram ? 0.64 : 0
        ));

        const specificity = clamp(
            (tokenCount(lowerQuery) >= 4 ? 0.20 : 0.08) +
            (hasCourseCode ? 0.28 : 0) +
            (hasSpecificSubject ? 0.22 : 0) +
            (hasPerson || hasFacultyRole ? 0.22 : 0) +
            (hasOntologyNonPerson ? 0.20 : 0) +
            (hasRequirements || hasCoursePrereq ? 0.16 : 0) +
            (hasGpa || hasFees || hasScholarship ? 0.14 : 0)
        );

        const semanticAmbiguity = clamp(
            Math.max(0, classes.length - 1) * 0.14 +
            (hasAdvisory && (hasRequirements || hasScholarship || hasFees) ? 0.2 : 0) +
            (hasComparison && hasProgram ? 0.12 : 0)
        );

        const hybridTriggerReasons = [];
        if (hasScholarship) hybridTriggerReasons.push('scholarship_hybrid_boost');
        if (hasRequirements && !hasCoursePrereq) hybridTriggerReasons.push('requirements_hybrid_boost');
        if ((hasGpa || hasFees) && hasProgram) hybridTriggerReasons.push('policy_program_intersection');
        if (hasCoursePrereq && (hasGpa || hasScholarship || /\bprobation|policy|rule|allowed|can i\b/i.test(lowerQuery))) {
            hybridTriggerReasons.push('course_policy_intersection');
        }
        if (hasComparison && (hasSpecificSubject || /\btrack|tracks|requirements|fees|scholarship|gpa\b/i.test(lowerQuery))) {
            hybridTriggerReasons.push('comparison_structured_policy_blend');
        }
        if (semanticAmbiguity >= 0.28 && (hasProgram || hasSpecificSubject)) hybridTriggerReasons.push('semantic_ambiguity');

        let questionClass = 'general';
        if (hasConversational && !hasProgram && !hasSpecificSubject) questionClass = 'conversational';
        else if (hasCurriculum) questionClass = 'curriculum';
        else if (hasTeaching) questionClass = 'faculty_teaching';
        else if (hasPerson) questionClass = 'faculty_person';
        else if (hasFacultyRole) questionClass = 'leadership';
        else if (hasCoursePrereq) questionClass = 'course_prerequisite';
        else if (hasFacility) questionClass = 'facility';
        else if (hasTrack) questionClass = 'track';
        else if (hasPartnerInstitution) questionClass = 'partner_institution';
        else if (hasGovernance) questionClass = 'governance';
        else if (hasStructuralPolicy) questionClass = 'kg_policy';
        else if (hasCampus) questionClass = 'campus';
        else if (hasScholarship) questionClass = 'scholarship';
        else if (hasRequirements) questionClass = 'requirements';
        else if (hasFees) questionClass = 'fees';
        else if (hasComparison) questionClass = 'comparison';
        else if (hasAdvisory) questionClass = 'advisory';

        return {
            question_class: questionClass,
            entity_confidence: entityConfidence,
            alias_confidence: aliasConfidence,
            query_specificity: specificity,
            semantic_ambiguity: semanticAmbiguity,
            matched_aliases: aliases.map(alias => ({
                category: alias.category,
                canonical: alias.canonical,
                surface: alias.surface,
                canonical_hit: alias.canonical_hit
            })).slice(0, 8),
            class_signals: [...new Set(classes)],
            hybrid_trigger_reasons: [...new Set(hybridTriggerReasons)],
            historical_route: sessionContext?.lastRoute || null,
            ontology_intent: existingOntologyIntent || (hasCurriculum ? 'CURRICULUM'
                : hasTrack ? 'TRACK'
                : hasFacility ? 'FACILITY'
                    : hasPartnerInstitution ? 'PARTNER_INSTITUTION'
                        : hasGovernance ? 'GOVERNANCE'
                            : hasStructuralPolicy ? 'POLICY'
                                : hasCampus ? 'CAMPUS'
                                    : null),
            intent_hint: existingOntologyIntent || (hasCurriculum ? 'CURRICULUM'
                : hasTrack ? 'TRACK'
                : hasFacility ? 'FACILITY'
                    : hasPartnerInstitution ? 'PARTNER_INSTITUTION'
                        : hasGovernance ? 'GOVERNANCE'
                            : hasStructuralPolicy ? 'POLICY'
                                : hasCampus ? 'CAMPUS'
                                    : (existingIntent || null)),
            force_hybrid: hybridTriggerReasons.length > 0 && !(hasTeaching || (hasPerson && !hasRequirements && !hasScholarship && !hasFees) || (hasOntologyNonPerson && !hasComparison)),
            force_kg: ((hasTeaching || hasPerson || hasFacultyRole || hasCoursePrereq || (hasOntologyNonPerson && !hasComparison)) && hybridTriggerReasons.length === 0) || hasStructuralPolicy,
            allow_llm_direct: hasConversational && !hasProgram && !hasSpecificSubject && !hasRequirements && !hasScholarship && !hasOntologyNonPerson,
        };
    }

    applyFeatureCalibration(signals, features) {
        if (!features) return;

        if (features.entity_confidence > 0) {
            signals.kg_score += features.entity_confidence * 0.34;
        }

        if (features.alias_confidence > 0) {
            signals.kg_score += features.alias_confidence * this.signalWeights.person_alias_boost;
        }

        if (features.force_kg) {
            signals.kg_score += 0.42 + (features.query_specificity * 0.2);
            signals.kg_direct_score = Math.max(signals.kg_direct_score || 0, 0.72 + (features.entity_confidence * 0.2));
        }

        if (features.ontology_intent === 'TRACK') {
            signals.kg_score += 0.30;
            signals.kg_direct_score = Math.max(signals.kg_direct_score || 0, 0.90);
        }

        if (features.ontology_intent && features.ontology_intent !== 'TRACK') {
            signals.kg_score += 0.28;
            signals.kg_direct_score = Math.max(signals.kg_direct_score || 0, 0.90);
        }

        if (features.hybrid_trigger_reasons.includes('requirements_hybrid_boost')) {
            signals.hybrid_score += this.signalWeights.requirements_hybrid_boost;
            signals.rag_score += 0.22;
            signals.kg_score += 0.12;
        }

        if (features.hybrid_trigger_reasons.includes('scholarship_hybrid_boost')) {
            signals.hybrid_score += this.signalWeights.scholarship_hybrid_boost;
            signals.rag_score += 0.32;
            signals.kg_score += 0.16;
        }

        if (features.hybrid_trigger_reasons.includes('policy_program_intersection')) {
            signals.hybrid_score += 0.32;
            signals.rag_score += 0.22;
            signals.kg_score += 0.18;
        }

        if (features.hybrid_trigger_reasons.includes('course_policy_intersection')) {
            signals.hybrid_score += 0.36;
            signals.rag_score += 0.24;
            signals.kg_score += 0.24;
        }

        if (features.hybrid_trigger_reasons.includes('comparison_structured_policy_blend')) {
            signals.hybrid_score += 0.28;
            signals.kg_score += 0.20;
            signals.rag_score += 0.14;
        }

        if (features.historical_route) {
            this._applyContextBoost(signals, { lastRoute: features.historical_route }, this.calibration.historicalRouteBoost);
        }

        if (features.allow_llm_direct) {
            signals.llm_score += 0.34;
            signals.kg_score *= 0.35;
            signals.rag_score *= 0.35;
            signals.hybrid_score *= 0.35;
        }
    }

    applyGoldenPathCalibration(signals, features, goldenPath) {
        if (!goldenPath) return;

        features.golden_path = {
            id: goldenPath.id,
            category: goldenPath.category,
            execution: goldenPath.execution,
            priority: goldenPath.priority,
            route: goldenPath.route,
            registry_version: goldenPath.registry_version
        };
        features.question_class = goldenPath.category;
        features.entity_confidence = Math.max(features.entity_confidence || 0, 0.96);
        features.query_specificity = Math.max(features.query_specificity || 0, 0.92);
        features.semantic_ambiguity = 0;
        features.force_hybrid = goldenPath.route === ROUTES.HYBRID_KG_RAG;
        features.force_kg = goldenPath.route === ROUTES.KG_DIRECT;
        features.allow_llm_direct = false;

        switch (goldenPath.route) {
            case ROUTES.KG_DIRECT:
                signals.kg_score += 2.4;
                signals.kg_direct_score = 1.0;
                signals.hybrid_score *= 0.25;
                signals.rag_score *= 0.55;
                signals.llm_score = Math.min(signals.llm_score, 0.05);
                break;
            case ROUTES.RAG_DIRECT:
                signals.rag_score += 2.0;
                signals.rag_direct_score = 1.0;
                signals.kg_score *= 0.55;
                signals.hybrid_score *= 0.35;
                signals.llm_score = Math.min(signals.llm_score, 0.05);
                break;
            case ROUTES.HYBRID_KG_RAG:
                signals.kg_score += 0.95;
                signals.rag_score += 0.95;
                signals.hybrid_score += 1.8;
                signals.llm_score = Math.min(signals.llm_score, 0.05);
                break;
            case ROUTES.DECISION_ENGINE:
                signals.decision_score += 2.1;
                signals.kg_score *= 0.35;
                signals.rag_score *= 0.35;
                signals.hybrid_score *= 0.25;
                signals.llm_score = Math.min(signals.llm_score, 0.05);
                break;
            case ROUTES.CAREER_ENGINE:
                signals.career_score += 2.1;
                signals.decision_score += 0.35;
                signals.kg_score *= 0.35;
                signals.rag_score *= 0.35;
                signals.hybrid_score *= 0.25;
                signals.llm_score = Math.min(signals.llm_score, 0.05);
                break;
            default:
                break;
        }

        logger.info('GOLDEN_PATH', 'Golden query calibration applied', {
            id: goldenPath.id,
            category: goldenPath.category,
            route: goldenPath.route,
            priority: goldenPath.priority
        });
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
        const goldenPath = classifyGoldenQuery(normalizedQuery);
        const features = this.classifyQuestionFeatures(lowerQuery, existingIntent, sessionContext);

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

        // 3. Adjust signals based on pre-classified intent, with ontology
        // terms taking priority over broad PROGRAM hints.
        this._applyIntentBoost(signals, features.intent_hint || existingIntent);

        // 4. Apply deterministic multi-factor calibration before hard route gates.
        this.applyFeatureCalibration(signals, features);

        // 4.5 Deterministic policy classifier (Phase 6 repair)
        const deterministicPolicy = this.classifyDeterministicPolicyQuery(lowerQuery);
        const hasStructuralKgPolicyIntent = features.class_signals.includes('kg_policy');
        const hasAcademicEntityIntent = ['teaching', 'person', 'leadership', 'course_prerequisite']
            .some(signal => features.class_signals.includes(signal));

        if (deterministicPolicy.strong_policy_evidence && hasAcademicEntityIntent && !hasStructuralKgPolicyIntent) {
            features.force_hybrid = true;
            features.force_kg = false;
            features.hybrid_trigger_reasons = [
                ...new Set([
                    ...features.hybrid_trigger_reasons,
                    'deterministic_academic_policy_mix'
                ])
            ];
        }

        if (deterministicPolicy.strong_policy_evidence && !hasStructuralKgPolicyIntent) {
            signals.rag_score += this.signalWeights.deterministic_policy_boost + (deterministicPolicy.score * 0.45);
            signals.rag_direct_score = Math.max(0.85, deterministicPolicy.score);

            // Policy terms such as GPA/scholarship can appear in KG dictionaries;
            // keep KG available as fallback, but do not let it suppress RAG.
            if (!this.isDeterministicAcademicQuery(lowerQuery) && !features.force_hybrid) {
                signals.kg_score *= 0.45;
                signals.hybrid_score *= 0.5;
            }

            logger.debug('ANALYZE', 'Deterministic policy query detected, boosting rag_direct_score', deterministicPolicy);
        } else {
            signals.rag_direct_score = 0;
        }

        // 5. Determine hybrid potential
        // Expanded to include combinations of KG, RAG, CAREER, DECISION
        const isHybridCandidate = features.force_hybrid || (!deterministicPolicy.strong_policy_evidence && (
            signals.kg_score >= this.confidenceThresholds.HYBRID_TRIGGER &&
            signals.rag_score >= this.confidenceThresholds.HYBRID_TRIGGER
        ));

        if (isHybridCandidate) {
            // Synergistic boost
            signals.hybrid_score += (Math.max(signals.kg_score, signals.rag_score) + 0.3) * this.signalWeights.hybrid_boost;
            logger.debug('ANALYZE', 'Hybrid conditions met, boosting hybrid_score', { hybrid_score: signals.hybrid_score });
        }

        // 5.5 Detect Deterministic Factual Academic Queries (PHASE 4)
        if (this.isDeterministicAcademicQuery(lowerQuery) && !features.force_hybrid) {
            signals.kg_score += 1.0;
            signals.kg_direct_score = 1.0;
            logger.debug('ANALYZE', 'Deterministic academic query detected, boosting kg_direct_score');
        } else {
            signals.kg_direct_score = features.force_kg
                ? Math.max(signals.kg_direct_score || 0, 0.82)
                : 0;
        }

        // 5.6 Demo golden path lock. Applied after generic deterministic
        // classifiers so the registry is the final authority for showcase flows.
        if (goldenPath) {
            this.applyGoldenPathCalibration(signals, features, goldenPath);
        }

        // 6. Normalize Signals (CRITICAL LAYER)
        const normalizedSignals = this.normalizeSignals(signals);

        return {
            original_query: normalizedQuery,
            normalized_query: lowerQuery,
            signals: normalizedSignals,
            is_hybrid_candidate: isHybridCandidate,
            deterministic_policy: deterministicPolicy,
            golden_path: goldenPath,
            routing_features: features,
            thresholds: {
                kg_confidence_threshold: this.confidenceThresholds.MEDIUM,
                hybrid_confidence_threshold: this.confidenceThresholds.HYBRID_TRIGGER,
                llm_fallback_threshold: this.confidenceThresholds.DEGRADED,
                deterministic_kg_threshold: this.calibration.deterministicKgThreshold,
                deterministic_rag_threshold: this.calibration.deterministicRagThreshold
            },
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
        const { signals, is_hybrid_candidate, deterministic_policy, golden_path, routing_features, thresholds } = analysisPayload;

        // Ensure healthStatus has defaults
        const health = {
            kg: healthStatus.kg !== false,
            rag: healthStatus.rag !== false,
            decision: healthStatus.decision !== false,
            career: healthStatus.career !== false,
            faq: healthStatus.faq !== false,
            llm: healthStatus.llm !== false
        };

        const buildDecision = ({
            route,
            confidence,
            reasoning,
            fallback_chain = [],
            services_required = [],
            ambiguity_score = 0,
            ambiguity_detected = false,
            deterministic_policy: policy = deterministic_policy,
            routing_features: features = routing_features,
            extra = {}
        }) => ({
            route,
            confidence: parseFloat(clamp(confidence).toFixed(3)),
            reasoning,
            fallback_chain,
            services_required,
            ambiguity_score,
            ambiguity_detected,
            deterministic_policy: policy,
            routing_features: features,
            thresholds: thresholds || {},
            telemetry: {
                route_chosen: route,
                confidence_score: parseFloat(clamp(confidence).toFixed(3)),
                entity_score: features?.entity_confidence || 0,
                alias_score: features?.alias_confidence || 0,
                query_specificity: features?.query_specificity || 0,
                semantic_ambiguity: features?.semantic_ambiguity || 0,
                hybrid_trigger_reasons: features?.hybrid_trigger_reasons || [],
                alias_expansions: features?.matched_aliases || [],
                golden_path: golden_path ? {
                    id: golden_path.id,
                    category: golden_path.category,
                    execution: golden_path.execution,
                    priority: golden_path.priority,
                    route: golden_path.route
                } : null,
                thresholds_used: thresholds || {},
                fallback_chain
            },
            ...extra
        });

        if (golden_path) {
            const routePolicy = golden_path.execution || golden_path.route;
            let route = golden_path.route;
            let servicesRequired = [];
            let fallbackChain = [];
            let degradedReason = null;

            if (route === ROUTES.KG_DIRECT) {
                servicesRequired = ['kg'];
                fallbackChain = [ROUTES.RAG_DIRECT, ROUTES.FAQ, ROUTES.LLM_FALLBACK];
                if (!health.kg) {
                    degradedReason = 'KG_UNHEALTHY_GOLDEN_DEGRADE';
                    route = health.rag ? ROUTES.RAG_DIRECT : (health.faq ? ROUTES.FAQ : ROUTES.LLM_FALLBACK);
                    servicesRequired = route === ROUTES.RAG_DIRECT ? ['rag'] : route === ROUTES.FAQ ? ['faq'] : ['llm'];
                }
            } else if (route === ROUTES.RAG_DIRECT) {
                servicesRequired = ['rag'];
                fallbackChain = [ROUTES.FAQ, ROUTES.KG_DIRECT, ROUTES.LLM_FALLBACK];
                if (!health.rag) {
                    degradedReason = 'RAG_UNHEALTHY_GOLDEN_DEGRADE';
                    route = health.kg ? ROUTES.KG_DIRECT : (health.faq ? ROUTES.FAQ : ROUTES.LLM_FALLBACK);
                    servicesRequired = route === ROUTES.KG_DIRECT ? ['kg'] : route === ROUTES.FAQ ? ['faq'] : ['llm'];
                }
            } else if (route === ROUTES.HYBRID_KG_RAG) {
                servicesRequired = ['kg', 'rag'];
                fallbackChain = [ROUTES.KG_DIRECT, ROUTES.RAG_DIRECT, ROUTES.FAQ, ROUTES.LLM_FALLBACK];
                if (!health.kg || !health.rag) {
                    degradedReason = 'HYBRID_PARTIAL_UNHEALTHY_GOLDEN_DEGRADE';
                    route = health.kg ? ROUTES.KG_DIRECT : (health.rag ? ROUTES.RAG_DIRECT : (health.faq ? ROUTES.FAQ : ROUTES.LLM_FALLBACK));
                    servicesRequired = route === ROUTES.KG_DIRECT ? ['kg'] : route === ROUTES.RAG_DIRECT ? ['rag'] : route === ROUTES.FAQ ? ['faq'] : ['llm'];
                }
            } else if (route === ROUTES.DECISION_ENGINE) {
                servicesRequired = ['decision'];
                fallbackChain = [ROUTES.CAREER_ENGINE, ROUTES.FAQ, ROUTES.LLM_FALLBACK];
                if (!health.decision) {
                    degradedReason = 'DECISION_UNHEALTHY_GOLDEN_RULE_FALLBACK';
                }
            } else if (route === ROUTES.CAREER_ENGINE) {
                servicesRequired = ['career'];
                fallbackChain = [ROUTES.DECISION_ENGINE, ROUTES.FAQ, ROUTES.LLM_FALLBACK];
                if (!health.career) {
                    degradedReason = 'CAREER_UNHEALTHY_GOLDEN_RULE_FALLBACK';
                }
            }

            logger.info('GOLDEN_PATH', 'Golden route enforced', {
                id: golden_path.id,
                category: golden_path.category,
                requested_route: golden_path.route,
                selected_route: route,
                routePolicy,
                degradedReason
            });

            return buildDecision({
                route,
                confidence: Math.max(golden_path.confidence || 0, signals.kg_score, signals.rag_score, signals.decision_score, signals.career_score, 0.94),
                reasoning: degradedReason
                    ? `Golden path ${golden_path.id} matched and degraded safely because ${degradedReason}.`
                    : `Golden path ${golden_path.id} matched. Route locked by registry policy ${routePolicy}.`,
                fallback_chain: fallbackChain,
                services_required: servicesRequired,
                ambiguity_score: 0,
                ambiguity_detected: false,
                extra: {
                    golden_path,
                    hard_route: golden_path.route,
                    deterministic_kg: golden_path.route === ROUTES.KG_DIRECT,
                    route_priority: ROUTE_PRIORITY[routePolicy] || ROUTE_PRIORITY[route] || 0,
                    degraded_reason: degradedReason
                }
            });
        }

        if (
            ONTOLOGY_KG_INTENTS.has(routing_features?.ontology_intent) &&
            !routing_features?.force_hybrid &&
            health.kg
        ) {
            const ontologyFallbackChain = routing_features.ontology_intent === 'CURRICULUM'
                ? [ROUTES.KG_ONLY]
                : [ROUTES.KG_ONLY, ROUTES.LLM_FALLBACK];
            logger.info('ROUTING_DECISION', 'Deterministic ontology KG path enforced', {
                ontology_intent: routing_features.ontology_intent
            });
            return buildDecision({
                route: ROUTES.KG_DIRECT,
                confidence: Math.max(signals.kg_direct_score, signals.kg_score, 0.96),
                reasoning: "Deterministic ontology query detected. Bypassing RAG escalation and using verified KG facts.",
                fallback_chain: ontologyFallbackChain,
                services_required: ['kg'],
                ambiguity_score: 0,
                ambiguity_detected: false,
                extra: {
                    deterministic_kg: true,
                    hard_route: ROUTES.KG_DIRECT,
                    ontology_intent: routing_features.ontology_intent
                }
            });
        }

        // Forced hybrid is intentionally limited to multi-domain academic policy
        // intersections. Career-only and advisory queries stay eligible for their
        // dedicated engines.
        if (routing_features?.force_hybrid && health.kg && health.rag) {
            logger.info('ROUTING_DECISION', 'Calibrated hybrid trigger enforced');
            return buildDecision({
                route: ROUTES.HYBRID_KG_RAG,
                confidence: Math.max(signals.hybrid_score, signals.kg_score, signals.rag_score, 0.82),
                reasoning: `Hybrid forced by calibrated academic trigger(s): ${routing_features.hybrid_trigger_reasons.join(', ')}.`,
                fallback_chain: [ROUTES.KG_ONLY, ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK],
                services_required: ['kg', 'rag'],
                ambiguity_score: 0,
                ambiguity_detected: false
            });
        }

        // Sort signals by score descending
        const sortedSignals = Object.entries(signals)
            .sort((a, b) => b[1] - a[1])
            .filter(s => s[1] > 0);

        // 0. Evaluate Deterministic RAG Policy Shortcut (Phase 6 hardened)
        if (
            deterministic_policy?.strong_policy_evidence &&
            signals.rag_direct_score >= this.calibration.deterministicRagThreshold &&
            health.rag
        ) {
            logger.info('ROUTING_DECISION', 'Hard deterministic RAG policy path enforced', {
                matched_categories: deterministic_policy.matched_categories
            });
            return buildDecision({
                route: ROUTES.RAG_DIRECT,
                confidence: 0.96,
                reasoning: "Deterministic academic policy query detected. Bypassing LLM fallback and prioritizing verified RAG policy sources.",
                fallback_chain: [ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK],
                services_required: ['rag'],
                ambiguity_score: 0,
                ambiguity_detected: false,
                deterministic_policy
            });
        }

        // 1. Evaluate Deterministic KG Shortcut (PHASE 4.2 Hardened)
        if (signals.kg_direct_score >= this.calibration.deterministicKgThreshold && health.kg) {
            logger.info('ROUTING_DECISION', 'Hard deterministic KG path enforced');
            return buildDecision({
                route: ROUTES.KG_DIRECT,
                confidence: 0.99,
                reasoning: "Deterministic academic factual query detected. Bypassing hybrid logic for guaranteed accuracy.",
                fallback_chain: [ROUTES.KG_ONLY, ROUTES.RAG_ONLY, ROUTES.LLM_FALLBACK],
                services_required: ['kg'],
                ambiguity_score: 0,
                ambiguity_detected: false,
                deterministic_policy
            });
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

        return buildDecision({
            route: bestRoute,
            confidence: parseFloat(bestScore.toFixed(3)),
            reasoning,
            fallback_chain: fallbackChain,
            services_required: requiredServices,
            ambiguity_score: ambiguityData.ambiguity_score,
            ambiguity_detected: ambiguityData.ambiguity_detected,
            deterministic_policy
        });
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
            'recommend': 'decision_score',
            'comparison': 'decision_score',
            'decision': 'decision_score',
            'course_info': 'kg_score',
            'course': 'kg_score',
            'program': 'kg_score',
            'person': 'kg_score',
            'admin': 'kg_score',
            'dean': 'kg_score',
            'prerequisite': 'kg_score',
            'facility': 'kg_score',
            'track': 'kg_score',
            'partner': 'kg_score',
            'institution': 'kg_score',
            'governance': 'kg_score',
            'campus': 'kg_score',
            'curriculum': 'kg_score',
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
    _applyContextBoost(signals, context, overrideBoost = null) {
        if (!context || !context.lastRoute) return;

        const last = context.lastRoute;
        const contextBoost = overrideBoost ?? this.signalWeights.context_boost; // Subtle continuity anchor

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
