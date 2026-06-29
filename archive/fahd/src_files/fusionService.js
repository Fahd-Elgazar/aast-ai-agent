/**
 * ============================================================
 * fusionService.js — AAST Explainable Hybrid Academic Super-Agent
 * ============================================================
 * PHASE 3B.9 — FINAL PRECISION HARDENING PATCH
 *
 * Merges outputs from Neo4j KG, Qdrant RAG, Decision Engine, 
 * Career Engine, FAQ, and LLM fallback into a unified,
 * conversational, and explainable academic advisor response.
 * ============================================================
 */

'use strict';

import crypto from 'crypto';

const logger = {
    info: (tag, msg, meta = {}) => console.log(`[FUSION_SERVICE][${tag}] ${msg}`, Object.keys(meta).length ? meta : ''),
    warn: (tag, msg, meta = {}) => console.warn(`[FUSION_SERVICE][${tag}] ⚠  ${msg}`, Object.keys(meta).length ? meta : ''),
    error: (tag, msg, meta = {}) => console.error(`[FUSION_SERVICE][${tag}] ✖  ${msg}`, Object.keys(meta).length ? meta : ''),
    debug: (tag, msg, meta = {}) => {
        if (process.env.FUSION_DEBUG === 'true') {
            console.debug(`[FUSION_SERVICE][${tag}] ⬡  ${msg}`, Object.keys(meta).length ? meta : '');
        }
    },
};

const MAX_TOTAL_EVIDENCE = 8;
const MAX_PER_SOURCE = 3;

class FusionService {
    constructor() {
        this.metrics = {
            total_fusions: 0,
            successful_fusions: 0,
            total_evidence_processed: 0,
            total_deduped: 0,
            total_confidence_accumulated: 0,
            contradiction_count: 0,
            pairwise_conflict_count: 0,
            override_count: 0,
            source_contributions: { KG: 0, RAG: 0, DECISION: 0, CAREER: 0, FAQ: 0, LLM: 0 },
            route_distribution: {},
            contradiction_type_breakdown: {},
            override_type_breakdown: {}
        };
    }

    /**
     * MAIN ENTRY POINT
     * @param {Object} queryPayload - original query string/object
     * @param {Object} routeData - from brainRouter
     * @param {Object} rawResults - raw data from all executed subsystems { kg: [...], rag: [...], ... }
     * @returns {Object} Final Explainable Payload
     */
    async fuse(queryPayload, routeData, rawResults) {
        this.metrics.total_fusions++;
        const route = routeData.route || 'UNKNOWN';
        
        // Update route distribution metric
        this.metrics.route_distribution[route] = (this.metrics.route_distribution[route] || 0) + 1;

        const queryText = typeof queryPayload === 'string' ? queryPayload : (queryPayload.query || '');
        const queryContextType = this._classifyQueryContext(queryText);
        
        logger.info('FUSE_START', `Starting fusion for route: ${route}`, { query: queryText, contextType: queryContextType });

        try {
            // 1. Multi-Source Ingestion
            let rawEvidence = [];
            if (rawResults.kg) rawEvidence.push(...this.processKGResults(rawResults.kg));
            if (rawResults.rag) rawEvidence.push(...this.processRAGResults(rawResults.rag));
            if (rawResults.decision) rawEvidence.push(...this.processDecisionResults(rawResults.decision));
            if (rawResults.career) rawEvidence.push(...this.processCareerResults(rawResults.career));
            if (rawResults.faq) rawEvidence.push(...this.processFAQResults(rawResults.faq));
            if (rawResults.llm) rawEvidence.push(...this.processLLMResults(rawResults.llm));

            this.metrics.total_evidence_processed += rawEvidence.length;

            // 2. Evidence Deduplication
            const preDedupeCount = rawEvidence.length;
            let dedupedEvidence = this.deduplicateEvidence(rawEvidence);
            this.metrics.total_deduped += (preDedupeCount - dedupedEvidence.length);

            // 3. Evidence Ranking & Token Budgeting (Dynamic Priority)
            let rankedEvidence = this.rankEvidence(dedupedEvidence, queryContextType);
            rankedEvidence = this.applyTokenBudget(rankedEvidence);

            // Update source metrics
            rankedEvidence.forEach(ev => {
                if (this.metrics.source_contributions[ev.source_type] !== undefined) {
                    this.metrics.source_contributions[ev.source_type]++;
                }
            });

            // 4. Pairwise Contradiction Detection & Semantic Policy Override
            const contradictionData = this.detectEvidenceConflicts(rankedEvidence);
            if (contradictionData.contradiction_flag) {
                this.metrics.contradiction_count++;
                this.metrics.pairwise_conflict_count += (contradictionData.pairwise_conflicts || []).length;
                const cType = contradictionData.contradiction_type || 'UNKNOWN';
                this.metrics.contradiction_type_breakdown[cType] = (this.metrics.contradiction_type_breakdown[cType] || 0) + 1;
            }

            const { resolvedEvidence, overrideApplied } = this.resolveConflicts(rankedEvidence, contradictionData, queryContextType);
            if (overrideApplied) {
                this.metrics.override_count++;
                this.metrics.override_type_breakdown[overrideApplied] = (this.metrics.override_type_breakdown[overrideApplied] || 0) + 1;
            }

            // 5. Confidence Aggregation
            const finalConfidence = this.computeFinalConfidence(resolvedEvidence, routeData.confidence, routeData.ambiguity_score || 0, contradictionData);
            this.metrics.total_confidence_accumulated += finalConfidence;

            // 6. Hybrid Response Synthesis
            const synthesizedText = this.generateHybridResponse(resolvedEvidence, queryText, route);
            
            // 7. Response Style Layer
            const finalAnswer = this.formatConversationalResponse(synthesizedText, route, finalConfidence);

            // 8. Source Explainability Payload
            const citations = this._extractUniqueCitations(resolvedEvidence);
            const contributingSources = [...new Set(resolvedEvidence.map(e => e.source_type))];
            
            const source_breakdown = {};
            resolvedEvidence.forEach(e => { source_breakdown[e.source_type] = (source_breakdown[e.source_type] || 0) + 1; });

            this.metrics.successful_fusions++;

            const responseEnvelope = {
                final_answer: finalAnswer,
                confidence: finalConfidence,
                route_used: route,
                contributing_sources: contributingSources,
                citations: citations,
                reasoning: routeData.reasoning || "Synthesized available evidence.",
                metadata: {
                    evidence_count: resolvedEvidence.length,
                    deduped_count: preDedupeCount - dedupedEvidence.length,
                    contradiction_detected: contradictionData.contradiction_flag,
                    contradiction_score: contradictionData.contradiction_score,
                    contradiction_type: contradictionData.contradiction_type,
                    route_confidence: routeData.confidence,
                    evidence_diversity: contributingSources.length,
                    policy_override_applied: overrideApplied,
                    source_breakdown
                }
            };

            logger.info('FUSE_SUCCESS', `Fusion completed successfully`, { confidence: finalConfidence, evidence_count: resolvedEvidence.length });
            return responseEnvelope;

        } catch (error) {
            logger.error('FUSE_ERROR', `Fusion failed, degrading gracefully`, { error: error.message });
            return this._createFallbackEnvelope(queryText, routeData, error.message);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. SEMANTIC CLASSIFICATION & DYNAMIC PRIORITY
    // ─────────────────────────────────────────────────────────────

    _classifyQueryContext(query) {
        const q = query.toLowerCase();
        
        const policyCluster = ['policy', 'regulation', 'probation', 'gpa', 'scholarship', 'fees', 'registration', 'transfer', 'admission', 'compliance', 'deadline'];
        const curriculumCluster = ['course', 'curriculum', 'prerequisite', 'track', 'major', 'credit', 'professor', 'dean'];
        const decisionCluster = ['recommend', 'best major', 'compare', 'roadmap', 'career', 'path'];

        const counts = { policy: 0, curriculum: 0, decision: 0 };
        policyCluster.forEach(w => { if (q.includes(w)) counts.policy++; });
        curriculumCluster.forEach(w => { if (q.includes(w)) counts.curriculum++; });
        decisionCluster.forEach(w => { if (q.includes(w)) counts.decision++; });

        if (counts.decision > 0 && counts.decision >= counts.policy && counts.decision >= counts.curriculum) {
            return q.includes('career') || q.includes('job') ? 'CAREER' : 'DECISION';
        }
        if (counts.policy > counts.curriculum) return 'POLICY';
        if (counts.curriculum > counts.policy) return 'CURRICULUM';
        
        return 'GENERAL';
    }

    _getDynamicSourcePriority(contextType) {
        // Dynamic priority mapping based on cluster intent
        if (contextType === 'POLICY')     return { RAG: 5, KG: 4, FAQ: 3, DECISION: 2, CAREER: 1, LLM: 0 };
        if (contextType === 'CURRICULUM') return { KG: 5, RAG: 4, FAQ: 3, DECISION: 2, CAREER: 1, LLM: 0 };
        if (contextType === 'DECISION')   return { DECISION: 5, KG: 4, RAG: 3, CAREER: 2, FAQ: 1, LLM: 0 };
        if (contextType === 'CAREER')     return { CAREER: 5, DECISION: 4, KG: 3, RAG: 2, FAQ: 1, LLM: 0 };
        return { KG: 4, RAG: 3, DECISION: 5, CAREER: 2, FAQ: 1, LLM: 0 }; // Default
    }

    // ─────────────────────────────────────────────────────────────
    // 2. MULTI-SOURCE EVIDENCE INGESTION
    // ─────────────────────────────────────────────────────────────

    processKGResults(kgRaw) {
        if (!kgRaw) return [];
        const items = Array.isArray(kgRaw) ? kgRaw : [kgRaw];
        return items.map(item => ({
            source_type: 'KG',
            confidence: item.confidence || 0.9,
            evidence: item.content || item.description || JSON.stringify(item),
            citations: item.node_id ? [`Graph Node: ${item.node_id}`] : [],
            officiality: 1.0,
            freshness: this._calculateFreshness(item.metadata),
            metadata: item.metadata || {}
        }));
    }

    processRAGResults(ragRaw) {
        if (!ragRaw) return [];
        const items = Array.isArray(ragRaw) ? ragRaw : [ragRaw];
        return items.map(item => ({
            source_type: 'RAG',
            confidence: item.score || item.confidence || 0.7,
            evidence: item.text || item.content || '',
            citations: item.metadata?.source_file ? [`Doc: ${item.metadata.source_file}`] : [],
            officiality: 0.9,
            freshness: this._calculateFreshness(item.metadata),
            metadata: item.metadata || {}
        }));
    }

    processDecisionResults(decisionRaw) {
        if (!decisionRaw) return [];
        const items = Array.isArray(decisionRaw) ? decisionRaw : [decisionRaw];
        return items.map(item => ({
            source_type: 'DECISION',
            confidence: item.confidence || 0.85,
            evidence: item.recommendation || item.advice || JSON.stringify(item),
            citations: ['AAST Academic Decision Engine'],
            officiality: 0.8,
            freshness: this._calculateFreshness(item.factors),
            metadata: item.factors || {}
        }));
    }

    processCareerResults(careerRaw) {
        if (!careerRaw) return [];
        const items = Array.isArray(careerRaw) ? careerRaw : [careerRaw];
        return items.map(item => ({
            source_type: 'CAREER',
            confidence: item.confidence || 0.8,
            evidence: item.career_path || item.roadmap || JSON.stringify(item),
            citations: ['AAST Career Advisory Engine'],
            officiality: 0.7,
            freshness: this._calculateFreshness(item.market_data),
            metadata: item.market_data || {}
        }));
    }

    processFAQResults(faqRaw) {
        if (!faqRaw) return [];
        const items = Array.isArray(faqRaw) ? faqRaw : [faqRaw];
        return items.map(item => ({
            source_type: 'FAQ',
            confidence: item.confidence || 0.95,
            evidence: item.answer || item.content || JSON.stringify(item),
            citations: ['AAST Official FAQ'],
            officiality: 1.0,
            freshness: this._calculateFreshness({}),
            metadata: {}
        }));
    }

    processLLMResults(llmRaw) {
        if (!llmRaw) return [];
        const items = Array.isArray(llmRaw) ? llmRaw : [llmRaw];
        return items.map(item => ({
            source_type: 'LLM',
            confidence: item.confidence || 0.4,
            evidence: item.text || item.response || JSON.stringify(item),
            citations: ['General Knowledge Fallback'],
            officiality: 0.1,
            freshness: 0.5,
            metadata: {}
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. EVIDENCE DEDUPLICATION
    // ─────────────────────────────────────────────────────────────

    deduplicateEvidence(evidenceArray) {
        const unique = new Map();
        
        for (const ev of evidenceArray) {
            if (!ev.evidence) continue;
            
            const normalized = ev.evidence.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim();
            const fallbackHash = crypto.createHash("sha256").update(normalized).digest("hex");
            
            const m = ev.metadata || {};
            const fingerprint = (m.doc_id || m.source_file || m.title) 
                ? `${ev.source_type}_${m.doc_id || 'no_id'}_${m.source_file || 'no_file'}_${m.title || 'no_title'}`
                : fallbackHash;
            
            if (!fingerprint) continue;

            if (unique.has(fingerprint)) {
                const existing = unique.get(fingerprint);
                const existingScore = (existing.confidence * 0.6) + (existing.officiality * 0.4);
                const newScore = (ev.confidence * 0.6) + (ev.officiality * 0.4);

                if (newScore > existingScore) {
                    ev.citations = [...new Set([...existing.citations, ...(ev.citations || [])])];
                    unique.set(fingerprint, ev);
                } else {
                    existing.citations = [...new Set([...existing.citations, ...(ev.citations || [])])];
                }
            } else {
                ev.citations = ev.citations || [];
                unique.set(fingerprint, ev);
            }
        }

        return Array.from(unique.values());
    }

    // ─────────────────────────────────────────────────────────────
    // 4. EVIDENCE RANKING & BUDGET ENGINE
    // ─────────────────────────────────────────────────────────────

    rankEvidence(evidenceArray, queryContext) {
        const priorityMap = this._getDynamicSourcePriority(queryContext);

        return evidenceArray.sort((a, b) => {
            const priA = priorityMap[a.source_type] || 0;
            const priB = priorityMap[b.source_type] || 0;
            
            // Weighted scoring: Confidence > Officiality > Source Priority > Freshness
            const scoreA = (a.confidence * 0.45) + (a.officiality * 0.35) + ((priA / 5) * 0.15) + (a.freshness * 0.05);
            const scoreB = (b.confidence * 0.45) + (b.officiality * 0.35) + ((priB / 5) * 0.15) + (b.freshness * 0.05);

            return scoreB - scoreA;
        });
    }

    applyTokenBudget(rankedEvidence) {
        const sourceCounts = {};
        const budgeted = [];

        for (const ev of rankedEvidence) {
            if (budgeted.length >= MAX_TOTAL_EVIDENCE) break;
            
            sourceCounts[ev.source_type] = (sourceCounts[ev.source_type] || 0) + 1;
            if (sourceCounts[ev.source_type] <= MAX_PER_SOURCE) {
                budgeted.push(ev);
            }
        }
        return budgeted;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. PAIRWISE CONTRADICTION ENGINE
    // ─────────────────────────────────────────────────────────────

    detectEvidenceConflicts(evidenceArray) {
        let contradiction_score = 0;
        let contradiction_flag = false;
        let contradiction_type = null;
        let source_conflict_map = [];
        let pairwise_conflicts = [];

        if (!evidenceArray || evidenceArray.length < 2) {
            return { contradiction_flag, contradiction_score, contradiction_type, source_conflict_map, pairwise_conflicts };
        }

        // Compare individual source pairs to prevent false global merges
        for (let i = 0; i < evidenceArray.length; i++) {
            for (let j = i + 1; j < evidenceArray.length; j++) {
                const ev1 = evidenceArray[i];
                const ev2 = evidenceArray[j];
                
                // Do not compare within the same source type
                if (ev1.source_type === ev2.source_type) continue;

                const text1 = ev1.evidence.toLowerCase();
                const text2 = ev2.evidence.toLowerCase();

                const conflict = this._evaluatePairwiseConflict(text1, text2);
                if (conflict.detected) {
                    contradiction_flag = true;
                    contradiction_score = Math.max(contradiction_score, conflict.score);
                    contradiction_type = conflict.type; // Takes highest or most recent priority
                    
                    pairwise_conflicts.push({
                        pair: `${ev1.source_type}_VS_${ev2.source_type}`,
                        type: conflict.type,
                        score: conflict.score
                    });
                    
                    if (!source_conflict_map.includes(ev1.source_type)) source_conflict_map.push(ev1.source_type);
                    if (!source_conflict_map.includes(ev2.source_type)) source_conflict_map.push(ev2.source_type);
                }
            }
        }

        return { contradiction_flag, contradiction_score, contradiction_type, source_conflict_map, pairwise_conflicts };
    }

    _evaluatePairwiseConflict(t1, t2) {
        let result = { detected: false, type: null, score: 0 };
        const combined = `${t1} ||| ${t2}`;

        // 1. GPA Numeric Threshold Mismatches
        const gpaRegex = /gpa\s*(?:of|requirement|threshold|minimum)?\s*(\d\.\d+)/g;
        const gpa1 = [...t1.matchAll(gpaRegex)].map(m => parseFloat(m[1]));
        const gpa2 = [...t2.matchAll(gpaRegex)].map(m => parseFloat(m[1]));
        
        if (gpa1.length > 0 && gpa2.length > 0) {
            const max1 = Math.max(...gpa1);
            const max2 = Math.max(...gpa2);
            if (Math.abs(max1 - max2) > 0.05) {
                return { detected: true, type: 'GPA_THRESHOLD_MISMATCH', score: 0.25 };
            }
        }

        // 2. Waived vs Required vs Prerequisite
        const isWaived = (t) => t.includes('waived') || t.includes('exempt');
        const isReq = (t) => t.includes('required') || t.includes('mandatory');
        if ((isWaived(t1) && isReq(t2)) || (isReq(t1) && isWaived(t2))) {
            const isPrereq = combined.includes('prerequisite');
            return { detected: true, type: isPrereq ? 'PREREQUISITE_CONFLICT' : 'WAIVED_VS_REQUIRED', score: 0.2 };
        }

        // 3. Allowed vs Prohibited
        const isProhibited = (t) => t.includes('not allowed') || t.includes('prohibited');
        const isAllowed = (t) => t.includes(' allowed ') || t.includes('permitted'); 
        if ((isProhibited(t1) && isAllowed(t2)) || (isAllowed(t1) && isProhibited(t2))) {
            return { detected: true, type: 'ALLOWED_VS_PROHIBITED', score: 0.2 };
        }

        // 4. Mapped Category Dependencies (fallback rule detection)
        const hasConflictKeywords = combined.includes('conflict') || combined.includes('contradicts') || combined.includes('differs');
        if (hasConflictKeywords) {
            if (combined.includes('transfer')) return { detected: true, type: 'TRANSFER_ELIGIBILITY_CONTRADICTION', score: 0.15 };
            if (combined.includes('scholarship')) return { detected: true, type: 'SCHOLARSHIP_INCONSISTENCY', score: 0.15 };
            if (combined.includes('fee') || combined.includes('payment')) return { detected: true, type: 'FEE_PAYMENT_CONTRADICTION', score: 0.15 };
            if (combined.includes('deadline')) return { detected: true, type: 'POLICY_DEADLINE_CONFLICT', score: 0.15 };
        }

        return result;
    }

    resolveConflicts(evidenceArray, contradictionData, queryContext) {
        if (!contradictionData.contradiction_flag) return { resolvedEvidence: evidenceArray, overrideApplied: false };
        
        let overrideApplied = false;
        let resolved = [...evidenceArray];

        // Route-aware Semantic Governance
        if (queryContext === 'POLICY') {
            const ragIndex = resolved.findIndex(e => e.source_type === 'RAG');
            const kgIndex = resolved.findIndex(e => e.source_type === 'KG');
            if (ragIndex !== -1 && kgIndex !== -1) {
                resolved.splice(kgIndex, 1); // RAG overrides KG for policy
                overrideApplied = 'RAG_OVER_KG_POLICY';
            }
        } else if (queryContext === 'CURRICULUM') {
            const ragIndex = resolved.findIndex(e => e.source_type === 'RAG');
            const kgIndex = resolved.findIndex(e => e.source_type === 'KG');
            if (ragIndex !== -1 && kgIndex !== -1) {
                resolved.splice(ragIndex, 1); // KG overrides RAG for curriculum
                overrideApplied = 'KG_OVER_RAG_CURRICULUM';
            }
        }

        if (queryContext === 'DECISION' || queryContext === 'CAREER') {
            const decIndex = resolved.findIndex(e => e.source_type === 'DECISION' || e.source_type === 'CAREER');
            if (decIndex !== -1) {
                // DECISION engines safely override generic/uncertain sources
                resolved = resolved.filter(e => ['DECISION', 'CAREER', 'KG', 'RAG'].includes(e.source_type));
                if (!overrideApplied) overrideApplied = 'DECISION_OVER_GENERIC';
            }
        }

        return { resolvedEvidence: resolved, overrideApplied };
    }

    // ─────────────────────────────────────────────────────────────
    // 6. HYBRID RESPONSE SYNTHESIS & SECONDARY ENGINE
    // ─────────────────────────────────────────────────────────────

    _summarizeSecondaryEvidence(secondaryArray) {
        if (!secondaryArray || secondaryArray.length === 0) return "";
        
        const allText = secondaryArray.map(e => e.evidence.toLowerCase()).join(' ');
        const topics = [];
        
        if (allText.includes('scholarship')) topics.push('scholarship eligibility');
        if (allText.includes('register') || allText.includes('registration')) topics.push('registration constraints');
        if (allText.includes('gpa')) topics.push('GPA thresholds');
        if (allText.includes('transfer')) topics.push('transfer requirements');
        if (allText.includes('deadline')) topics.push('academic deadlines');
        if (allText.includes('fee') || allText.includes('payment')) topics.push('fee regulations');
        if (allText.includes('prerequisite')) topics.push('prerequisite rules');

        if (topics.length > 0) {
            const uniqueTopics = [...new Set(topics)];
            const last = uniqueTopics.pop();
            const joinedTopics = uniqueTopics.length > 0 ? `${uniqueTopics.join(', ')}, and ${last}` : last;
            return `Additional institutional considerations include ${joinedTopics}.`;
        } else {
            return `There are also additional institutional guidelines to consider.`;
        }
    }

    generateHybridResponse(evidenceArray, query, route) {
        if (!evidenceArray || evidenceArray.length === 0) {
            return "I don't have enough specific academic information to provide a complete answer at the moment.";
        }

        const structured = evidenceArray.filter(e => e.source_type === 'KG');
        const policy = evidenceArray.filter(e => e.source_type === 'RAG');
        const advising = evidenceArray.filter(e => ['DECISION', 'CAREER'].includes(e.source_type));
        
        let narrative = [];

        if (route === 'HYBRID_KG_RAG' && structured.length > 0 && policy.length > 0) {
            const lowerKG = structured[0].evidence.trim().replace(/^A\s|^The\s/, a => a.toLowerCase());
            const lowerRAG = policy[0].evidence.trim().replace(/^A\s|^The\s/, a => a.toLowerCase());
            
            narrative.push(`Looking at your academic standing, ${lowerKG}.`);
            narrative.push(`To ensure compliance with the current guidelines, it's important to note that ${lowerRAG}.`);
            
            if (structured.length > 1 || policy.length > 1) {
                const secondary = [...structured.slice(1), ...policy.slice(1)];
                narrative.push(`\n${this._summarizeSecondaryEvidence(secondary)}`);
            }
        } else if (advising.length > 0) {
            narrative.push(`Based on your profile, my primary recommendation is: ${advising[0].evidence.trim()}`);
            if (structured.length > 0) {
                narrative.push(`This aligns well with our curriculum structure, specifically: ${structured[0].evidence.trim()}`);
            }
            if (policy.length > 0) {
                narrative.push(`Please keep the following institutional policy in mind: ${policy[0].evidence.trim()}`);
            }
        } else {
            narrative.push(evidenceArray[0].evidence.trim());
            if (evidenceArray.length > 1) {
                narrative.push(`\n${this._summarizeSecondaryEvidence(evidenceArray.slice(1))}`);
            }
        }

        return narrative.join(' ');
    }

    // ─────────────────────────────────────────────────────────────
    // 7. RESPONSE STYLE LAYER
    // ─────────────────────────────────────────────────────────────

    formatConversationalResponse(synthesizedText, route, finalConfidence) {
        let prefix = "";

        if (finalConfidence < 0.4) {
            prefix = "I'm not entirely certain, but based on the closest information I could find:\n\n";
        } else if (route === 'HYBRID_KG_RAG') {
            prefix = "Based on AAST academic regulations and curriculum structure:\n\n";
        } else if (route === 'DECISION_ENGINE') {
            prefix = "As your academic advisor, here is my recommendation:\n\n";
        } else if (route === 'KG_ONLY') {
            prefix = "Looking at the official AAST curriculum data:\n\n";
        } else if (route === 'RAG_ONLY') {
            prefix = "According to AAST official policies and guidelines:\n\n";
        } else if (route === 'FAQ') {
            prefix = "Here is the standard institutional information regarding your question:\n\n";
        } else if (route === 'CAREER_ENGINE') {
            prefix = "Based on career roadmaps and market data:\n\n";
        }

        let cleanText = synthesizedText
            .replace(/\n{3,}/g, '\n\n') 
            .replace(/\[doc_id:.*?\]/g, '') 
            .trim();

        return `${prefix}${cleanText}`;
    }

    // ─────────────────────────────────────────────────────────────
    // 8. CONFIDENCE AGGREGATION
    // ─────────────────────────────────────────────────────────────

    computeFinalConfidence(evidenceArray, route_confidence, ambiguity_score, contradictionData) {
        if (!evidenceArray || evidenceArray.length === 0) return 0.1;

        const topEvidences = evidenceArray.slice(0, 2);
        const avgEvidenceConfidence = topEvidences.reduce((sum, e) => sum + e.confidence, 0) / topEvidences.length;

        let finalConfidence = (route_confidence * 0.4) + (avgEvidenceConfidence * 0.6);

        finalConfidence -= (ambiguity_score * 0.5);
        if (contradictionData && contradictionData.contradiction_flag) {
            finalConfidence -= contradictionData.contradiction_score;
        }

        const uniqueSources = new Set(evidenceArray.map(e => e.source_type)).size;
        if (uniqueSources > 1) {
            finalConfidence += 0.05;
        } else {
            finalConfidence -= 0.05;
        }

        if (evidenceArray.length === 1) {
            finalConfidence -= 0.10;
        }

        if (evidenceArray.some(e => e.source_type === 'KG') && evidenceArray.some(e => e.source_type === 'RAG')) {
            finalConfidence += 0.08;
        }

        return parseFloat(Math.min(1.0, Math.max(0.1, finalConfidence)).toFixed(3));
    }

    // ─────────────────────────────────────────────────────────────
    // 9. UTILITIES & EXTERNALS
    // ─────────────────────────────────────────────────────────────

    _extractUniqueCitations(evidenceArray) {
        const allCitations = evidenceArray.flatMap(e => e.citations || []);
        return [...new Set(allCitations)];
    }

    _createFallbackEnvelope(query, routeData, errorMessage) {
        const route = routeData.route || 'UNKNOWN';
        const q = query.toLowerCase();
        
        let contextualGuidance = "Based on available academic guidance, I recommend verifying this directly with the registration office.";

        if (q.includes('gpa') || q.includes('grade') || q.includes('probation')) {
            contextualGuidance = "Academic standing and GPA thresholds can involve complex rules. I recommend discussing your current standing directly with your academic advisor.";
        } else if (route === 'CAREER_ENGINE' || q.includes('career') || q.includes('job')) {
            contextualGuidance = "Career roadmaps shift frequently. I suggest consulting the career services department for the most current advisory data.";
        } else if (route === 'KG_ONLY' || q.includes('prerequisite') || q.includes('course')) {
            contextualGuidance = "Curriculum structures and prerequisites can vary by catalog year. Please verify your specific track in the official student handbook.";
        } else if (q.includes('scholarship') || q.includes('fee')) {
            contextualGuidance = "Financial regulations are strict. I recommend reaching out to the financial affairs office to confirm your eligibility.";
        }

        return {
            final_answer: contextualGuidance,
            confidence: 0.1,
            route_used: 'LLM_FALLBACK',
            contributing_sources: [],
            citations: [],
            reasoning: `Fusion fallback triggered. Evidence assimilation was not completed.`,
            metadata: { error: true, original_error: errorMessage, fallback_context_type: route }
        };
    }

    _calculateFreshness(metadata) {
        if (!metadata) return 0.5;
        if (metadata.freshness_score) return parseFloat(metadata.freshness_score);
        
        let score = 0.5;
        const now = new Date();
        
        if (metadata.timestamp || metadata.ingestion_date || metadata.publication_date || metadata.date) {
            const rawDate = metadata.timestamp || metadata.ingestion_date || metadata.publication_date || metadata.date;
            const parsedDate = new Date(rawDate);
            if (!isNaN(parsedDate)) {
                const diffMonths = (now.getFullYear() - parsedDate.getFullYear()) * 12 + (now.getMonth() - parsedDate.getMonth());
                if (diffMonths <= 1) score = 1.0;
                else if (diffMonths <= 6) score = 0.9;
                else if (diffMonths <= 12) score = 0.8;
                else if (diffMonths <= 24) score = 0.6;
                else score = 0.4;
                return score;
            }
        }
        
        if (metadata.year) {
            const diff = now.getFullYear() - parseInt(metadata.year, 10);
            if (diff === 0) score = 0.95;
            else if (diff === 1) score = 0.8;
            else if (diff <= 3) score = 0.6;
            else score = 0.3;
            return score;
        } 
        
        if (metadata.version) return 0.8;
        return score;
    }

    /**
     * Observability Output decoupled for external monitoring services
     */
    getMetrics() {
        const total = this.metrics.total_fusions || 1;
        return { 
            ...this.metrics,
            average_fusion_confidence: parseFloat((this.metrics.total_confidence_accumulated / total).toFixed(3)),
            average_evidence_per_response: parseFloat((this.metrics.total_evidence_processed / total).toFixed(2))
        };
    }
}

// Export singleton instance
export default new FusionService();
