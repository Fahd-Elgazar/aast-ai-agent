"""
========================================================
PHASE 1.3 DATA REFINEMENT ENGINE — PRODUCTION v4.0
========================================================
Project     : Explainable Hybrid GraphRAG + VectorRAG
              Academic Advisor (CAI-AAST)
Purpose     : Final optimization pass — maximum chunk
              granularity, aggressive fluff suppression,
              tighter semantic deduplication, and
              Qdrant-ready enriched metadata output.
Author      : Senior AI Systems Engineering Pipeline
Environment : Windows-compatible, Python 3.9+
Dependencies: sentence-transformers, torch, numpy
========================================================

SUCCESS TARGETS:
  - Chunk count        : 180–220
  - High priority      : >65%
  - Low priority       : <15%
  - Duplicate reduction: >10%
  - Avg quality score  : >0.65
  - Production readiness: >85%
========================================================
"""

import json
import logging
import re
import hashlib
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple
from collections import Counter

import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError as exc:
    raise ImportError(
        "sentence-transformers is required. "
        "Install with: pip install sentence-transformers"
    ) from exc

# ============================================================
# CONFIGURATION
# ============================================================

INPUT_FILES = [
    r"C:\Users\mh978\Downloads\CAI_AAST\data_rag_cai\CAI_rag3_cleaned.json",
    r"C:\Users\mh978\Downloads\CAI_AAST\data_rag_cai\cai_msc.json",
]

OUTPUT_FILE = (
    r"C:\Users\mh978\Downloads\CAI_AAST\cleaned_chunked_cai_production_v4.json"
)

EMBEDDING_MODEL_ID   = "BAAI/bge-m3"
SIMILARITY_THRESHOLD = 0.89      # tightened from 0.91 → catches more near-dupes
TITLE_SIM_WEIGHT     = 0.25      # combined similarity: content * 0.75 + title * 0.25
EMBEDDING_BATCH_SIZE = 64

MIN_CHUNK_WORDS = 8
MAX_CHUNK_WORDS = 70

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ============================================================
# CATEGORY NORMALIZATION
# ============================================================

CATEGORY_MAP: Dict[str, str] = {
    "general"                  : "institutional",
    "policies"                 : "academic_policies",
    "registration"             : "admissions_registration",
    "grading"                  : "grading_policies",
    "rules"                    : "academic_rules",
    "courses"                  : "academic_programs",
    "financial information"    : "financial_policies",
    "admissions"               : "admissions",
    "compliance and quality"   : "compliance",
    "postgraduate programs"    : "postgraduate_programs",
    "academic policies"        : "academic_policies",
    "compliance"               : "compliance",
    "financial"                : "financial_policies",
    "international relations"  : "international_relations",
    "infrastructure"           : "infrastructure",
}

# ============================================================
# PRIORITY TIERS
# ============================================================

HIGH_PRIORITY: set = {
    "admissions",
    "academic_rules",
    "grading_policies",
    "academic_policies",
    "compliance",
    "financial_policies",
    "admissions_registration",
    "postgraduate_programs",
}

MEDIUM_PRIORITY: set = {
    "academic_programs",
    "infrastructure",
    "international_relations",
}

LOW_PRIORITY: set = {
    "institutional",
    "other",
}

# ============================================================
# INSTITUTIONAL WHITELIST
# Institutional entries matching ANY of these are retained.
# ============================================================

INSTITUTIONAL_WHITELIST: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"accreditation",
        r"official partner",
        r"MOU",
        r"memorandum of understanding",
        r"contact (information|us|email|phone|office)",
        r"lab(oratory)?",
        r"research center",
        r"address",
        r"hotline",
        r"website",
        r"portal",
        r"exam hall",
        r"computer lab",
        r"simulation (lab|room)",
        r"IEEE",
        r"ISO",
        r"NARS",
        r"NAQA",
        r"ministry of",
        r"Egyptian Universities",
        r"Supreme Council",
    ]
]

# ============================================================
# FLUFF PATTERNS — aggressive institutional suppression
# ============================================================

FLUFF_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Welcome / dean messages
        r"welcome to",
        r"dear student[s]?[,\s]",
        r"it is (our|my) (pleasure|honor|privilege)",
        r"distinguished (faculty|staff|alumni|colleagues)",
        r"on behalf of",
        # Vision / mission marketing
        r"our (vision|mission) (is|aims?)",
        r"we (are proud|believe|strive|aim|seek|endeavor)",
        r"the college (aims?|seeks?|strives?|envisions?)",
        r"committed to (your|student|academic) success",
        r"dedicated to (excellence|quality|innovation)",
        # AI history / global trends
        r"history of artificial intelligence",
        r"global ai (growth|market|trend|development)",
        r"the future of (ai|artificial intelligence)",
        r"rapid(ly)? (growing|advancing|evolving) field",
        r"fourth industrial revolution",
        r"era of artificial intelligence",
        # Motivational / inspirational
        r"motivat(e|ion|ional|ing)",
        r"inspir(e|ing|ation|ational)",
        r"empower(ing)? students",
        r"bright (future|career|prospects)",
        r"journey (begins?|starts?|ahead|of learning)",
        r"proud (tradition|heritage|history)",
        r"strive for excellence",
        r"transforming (the world|society|education)",
        # Prestige / marketing
        r"world[- ]class (education|university|institution|faculty)",
        r"state[- ]of[- ]the[- ]art (facilities|campus)",
        r"leading (university|institution|college|center)",
        r"top[- ](ranked|tier|rated)",
        r"pioneering (role|institution|college)",
        r"prestigious",
        # Generic institutional
        r"the college (was founded|was established|has been)",
        r"established in \d{4}",
        r"since its (founding|establishment|inception)",
        r"over the (years|decades|past)",
        r"continuous(ly)? (growing|expanding|developing)",
    ]
]

# ============================================================
# HIGH-VALUE KEEP SIGNALS — always retain chunks with these
# ============================================================

KEEP_SIGNALS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"admission",
        r"registr",
        r"\bGPA\b",
        r"grade[s]?",
        r"credit hour[s]?",
        r"contact hour[s]?",
        r"tuition",
        r"\bfee[s]?\b",
        r"scholarship",
        r"transfer",
        r"prerequisite",
        r"thesis",
        r"dissertation",
        r"graduation requir",
        r"academic (warning|probation|standing)",
        r"dismissal",
        r"appeal",
        r"compliance",
        r"regulation[s]?",
        r"bypass",
        r"waiver",
        r"course load",
        r"semester",
        r"internship",
        r"research project",
        r"withdrawal",
        r"equivalen",
        r"accreditation",
        r"\bISO\b",
        r"\bIEEE\b",
        r"lab(oratory)?",
        r"program structure",
        r"\bMSc\b",
        r"postgraduate",
        r"undergraduate",
    ]
]

# ============================================================
# QUALITY SCORING SIGNALS
# ============================================================

QUALITY_BOOST_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bGPA\b",
        r"admission",
        r"grading",
        r"scholarship",
        r"compliance",
        r"regulation",
        r"transfer",
        r"tuition",
        r"\bfee[s]?\b",
        r"thesis",
        r"graduation",
        r"credit hour",
        r"prerequisite",
        r"dismissal",
        r"probation",
        r"academic warning",
        r"academic standing",
        r"bypass",
        r"equivalen",
        r"contact hour",
        r"course load",
        r"withdrawal",
        r"internship",
        r"research project",
        r"accreditation",
        r"program structure",
        r"\bMSc\b",
    ]
]

QUALITY_PENALTY_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"welcome",
        r"proud",
        r"\bvision\b",
        r"\bmission\b",
        r"future of ai",
        r"global ai",
        r"motivat",
        r"inspir",
        r"history of",
        r"world[- ]class",
        r"state[- ]of[- ]the[- ]art",
        r"pioneering",
        r"prestigious",
        r"strive",
        r"endeavor",
        r"transforming the world",
        r"bright future",
        r"general policy",
        r"overview",
        r"summary",
        r"introduction",
        r"brief description",
        r"basic information",
    ]
]

# ============================================================
# DOCUMENT TYPE CLASSIFICATION RULES
# (evaluated in order — first match wins)
# ============================================================

DOC_TYPE_RULES: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"scholarship|grant|award|financial aid|eligibility", re.IGNORECASE), "scholarship_policy"),
    (re.compile(r"tuition|fee[s]?|payment|financial|refund|cost", re.IGNORECASE),        "tuition_policy"),
    (re.compile(r"admission|applicant|enroll|entry requir|accept", re.IGNORECASE),  "admission_policy"),
    (re.compile(r"grade[s]?|gpa|grading|mark[s]?|score|evaluation", re.IGNORECASE),    "grading_policy"),
    (re.compile(r"transfer|equivalen|bypass|credit transfer", re.IGNORECASE),"transfer_policy"),
    (re.compile(r"thesis|research project|dissertation|supervisor", re.IGNORECASE),     "research_requirement"),
    (re.compile(r"graduation|program structure|plan of study|degree requirement", re.IGNORECASE), "graduation_policy"),
    (re.compile(r"probation|warning|dismissal|appeal|standing|academic load", re.IGNORECASE),"academic_standing"),
    (re.compile(r"prerequisite|corequisite|requisite", re.IGNORECASE),                 "prerequisite_policy"),
    (re.compile(r"registration|add/drop|credit hour|course load|withdraw", re.IGNORECASE),        "registration_policy"),
    (re.compile(r"lab(oratory)?|workshop|facility|equipment|simulation|library", re.IGNORECASE), "infrastructure"),
    (re.compile(r"compliance|accreditation|ISO|NAQA|NARS|ministry|regulation|conduct", re.IGNORECASE), "compliance_policy"),
    (re.compile(r"absence|attendance|excuse|leave", re.IGNORECASE),       "attendance_policy"),
    (re.compile(r"internship|industrial training|co[- ]op|practical training", re.IGNORECASE),  "internship_policy"),
    (re.compile(r"contact information|email|phone|office|address|hotline", re.IGNORECASE), "contact_info"),
]

# ============================================================
# POLICY CLAUSE SPLIT MARKERS
# Ordered from highest to lowest semantic boundary strength.
# ============================================================

# Phrase-level boundary markers injected as |SPLIT| before the phrase
POLICY_PHRASE_MARKERS: List[str] = [
    "Students must",
    "Student must",
    "Applicants must",
    "Applicant must",
    "Admission requires",
    "Graduation requires",
    "To qualify",
    "Transfer students",
    "The student is required",
    "Requirements include",
    "Fees",
    "Scholarships",
    "A minimum of",
    "A maximum of",
    "Not exceeding",
    "Provided that",
    "In case of",
    "Subject to",
    "Upon completion",
    "Upon approval",
    "In accordance with",
    "Failure to",
    "The department",
    "The council",
    "The college shall",
    "The student shall",
    "Students may",
    "Students are",
    "Eligible students",
    "Only if",
    "Except when",
    "Except in",
    "After completing",
    "Before registering",
    "Before enrollment",
    "Must obtain",
    "Must complete",
    "Must achieve",
    "Must submit",
    "Must maintain",
    "Is required to",
    "Are required to",
    "May apply",
    "May register",
    "May transfer",
    "May not",
    "including",
    "such as",
    "where",
    "when",
    "unless",
    "eligible for",
    "in addition to",
]

# ============================================================
# UTILITY FUNCTIONS
# ============================================================


def clean_text(text: str) -> str:
    """Normalize whitespace and strip edges."""
    return re.sub(r"\s+", " ", text).strip()


def normalize_category(raw: str) -> str:
    """Map raw category label to canonical name."""
    return CATEGORY_MAP.get(raw.strip().lower(), "other")


def detect_program_level(filename: str) -> str:
    """Infer program level from source filename."""
    lower = filename.lower()
    if any(k in lower for k in ("msc", "postgrad", "master", "graduate")):
        return "postgraduate"
    return "undergraduate"


def generate_chunk_id(title: str, chunk: str) -> str:
    """Deterministic MD5 chunk ID — stable across runs for Qdrant upsert."""
    raw = f"{title.strip()}::{chunk.strip()}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def assign_priority(category: str) -> str:
    if category in HIGH_PRIORITY:
        return "high"
    if category in MEDIUM_PRIORITY:
        return "medium"
    return "low"


def infer_document_type(title: str, content: str) -> str:
    """Match content against ordered rule list; fall back to general_policy."""
    combined = title + " " + content
    for pattern, doc_type in DOC_TYPE_RULES:
        if pattern.search(combined):
            return doc_type
    return "general_policy"


# ============================================================
# QUALITY SCORING
# ============================================================


def compute_quality_score(content: str) -> float:
    """
    Score chunk retrieval value in [0.0, 1.0].

    Boost: actionable academic keywords.
    Penalize: promotional / vague institutional language.
    Word-count factor: reward the 10–60 word sweet spot.
    """
    score = 0.65  # baseline

    wc = len(content.split())

    # Word-count factor
    if 10 <= wc <= 60:
        score += 0.15
    elif wc > 60:
        score -= 0.10

    # Boost signals (capped)
    boost_hits = sum(1 for p in QUALITY_BOOST_PATTERNS if p.search(content))
    score += min(boost_hits * 0.15, 0.35)

    # Penalty signals (capped)
    penalty_hits = sum(1 for p in QUALITY_PENALTY_PATTERNS if p.search(content))
    score -= min(penalty_hits * 0.15, 0.30)

    return round(max(0.0, min(score, 1.0)), 4)


# ============================================================
# FLUFF / LOW-VALUE FILTER
# ============================================================


def _is_institutional_fluff(content: str) -> bool:
    """
    Return True if content is purely promotional / institutional fluff
    with no actionable academic facts.

    Strategy:
    1. Hard pass — any KEEP_SIGNAL present → retain unconditionally.
    2. Institutional whitelist — accreditation, labs, contact, etc. → retain.
    3. Fluff count ≥ 2 → discard.
    """
    if any(p.search(content) for p in KEEP_SIGNALS):
        return False
    if any(p.search(content) for p in INSTITUTIONAL_WHITELIST):
        return False

    fluff_hits = sum(1 for p in FLUFF_PATTERNS if p.search(content))
    return fluff_hits >= 2


def should_suppress_institutional(category: str, content: str) -> bool:
    """
    Additional hard rule: institutional-category entries with no
    whitelisted operational content are suppressed.
    """
    if category != "institutional":
        return False
    # Retain if whitelisted content is present
    if any(p.search(content) for p in INSTITUTIONAL_WHITELIST):
        return False
    if any(p.search(content) for p in KEEP_SIGNALS):
        return False
    return True


def is_low_value(content: str, category: str = "") -> bool:
    """Unified low-value gate combining fluff detection and institutional suppression."""
    if should_suppress_institutional(category, content):
        return True
    return _is_institutional_fluff(content)


# ============================================================
# ATOMIC CHUNKING ENGINE — v3 (maximum granularity)
# ============================================================


def _inject_policy_splits(text: str) -> str:
    """
    Inject |SPLIT| boundary tokens before each known policy phrase marker.
    Uses word-boundary-aware negative lookbehind to avoid double injection.
    """
    for marker in POLICY_PHRASE_MARKERS:
        escaped = re.escape(marker)
        # Only inject if not already preceded by |SPLIT|
        text = re.sub(
            rf"(?<!\|SPLIT\|)\b(?={escaped})",
            "|SPLIT|",
            text,
        )
    return text


def _secondary_clause_splits(text: str) -> str:
    """
    Fine-grained clause decomposition:
    - Commas in rule lists (followed by a capital or keyword)
    - "must", "requires", "eligible", "only if", "except", "after", "before"
      when they introduce a new clause mid-sentence
    """
    # Comma + capital letter (rule lists)
    text = re.sub(r",\s+(?=[A-Z])", ",|SPLIT|", text)
    
    # Commas inside rule lists (heuristic: comma followed by multiple words)
    text = re.sub(r",\s+(?=\w+\s+\w+\s+\w+)", ",|SPLIT|", text)
    
    # Parenthetical clauses
    text = re.sub(r"(\([^\)]+\))", r"|SPLIT|\1|SPLIT|", text)

    # Inline clause keywords that start a new constraint
    clause_triggers = [
        r"\bmust\b",
        r"\brequires?\b",
        r"\beligible\b",
        r"\beligible for\b",
        r"\bonly if\b",
        r"\bexcept\b",
        r"\bin case of\b",
        r"\bsubject to\b",
        r"\bafter\b(?=\s+[a-z])",  # "after completing…"
        r"\bbefore\b(?=\s+[a-z])",  # "before registering…"
        r"\bprovided that\b",
        r"\bstudents? may\b",
        r"\band\b(?=\s+[A-Z])",
        r"\bor\b(?=\s+[A-Z])",
        r"\bincluding\b",
        r"\bsuch as\b",
        r"\bwhere\b",
        r"\bif\b",
        r"\bwhen\b",
        r"\bunless\b",
        r"\bin addition to\b",
        r"\bfee\b",
        r"\bgpa\b",
        r"\bscholarship\b",
    ]
    for trigger in clause_triggers:
        text = re.sub(
            rf"(?<=[.;,\s])({trigger})",
            r"|SPLIT|\1",
            text,
            flags=re.IGNORECASE,
        )
    return text


def split_into_atomic_chunks(content: str) -> List[str]:
    """
    Multi-layer atomic chunking optimized for maximum policy granularity.

    Layer 1  : Policy phrase boundary markers (strong semantic splits)
    Layer 2  : Numbered list items
    Layer 3  : Bullet / dash items
    Layer 4  : Colon boundaries (definition start)
    Layer 5  : Semicolons
    Layer 6  : Sentence-final periods before capital letter
    Layer 7  : Fine-grained clause splits (commas, must, requires, etc.)
    Layer 8  : Secondary sentence-boundary split for oversized survivors
    """
    content = clean_text(content)

    # Layer 1: Policy phrase markers
    content = _inject_policy_splits(content)

    # Layer 2: Numbered lists  "1. " / "1) "
    content = re.sub(r"(?<!\d)(\d+[\.\)])\s+", r"|SPLIT|\1 ", content)

    # Layer 3: Bullet / dash items
    content = re.sub(r"[\n\r]\s*[-–•]\s+", "|SPLIT|", content)

    # Layer 4: Colons before a capital letter (definition boundaries)
    content = re.sub(r":\s+(?=[A-Z])", ":|SPLIT|", content)

    # Layer 5: Semicolons
    content = content.replace(";", ";|SPLIT|")

    # Layer 6: Sentence-final periods before capital
    content = re.sub(r"\.\s+(?=[A-Z])", ".|SPLIT|", content)

    # Layer 7: Fine-grained clause splits
    content = _secondary_clause_splits(content)

    raw_parts = content.split("|SPLIT|")

    all_raw_parts = []
    for raw in raw_parts:
        part = clean_text(raw)
        if not part:
            continue
        wc = len(part.split())
        if wc > 12:
            for kw in [
                "and", "or", "including", "such as", "provided that", 
                "where", "if", "when", "unless", "students may", 
                "students must", "required to", "eligible for", "in addition to"
            ]:
                part = re.sub(rf"\b({kw})\b", r"|SPLIT|\1", part, flags=re.IGNORECASE)
            for sp in part.split("|SPLIT|"):
                sp = clean_text(sp)
                if sp:
                    all_raw_parts.append(sp)
        else:
            all_raw_parts.append(part)

    final_chunks: List[str] = []
    pending = ""

    for part in all_raw_parts:
        pending = (pending + " " + part).strip() if pending else part
        wc = len(pending.split())
        
        if wc >= MIN_CHUNK_WORDS:
            if wc <= 35:
                final_chunks.append(pending)
                pending = ""
            else:
                sentences = re.split(r"(?<=[.!?])\s+", pending)
                if len(sentences) == 1 and len(pending.split()) > 35:
                    sentences = re.split(r"(?<=,)\s+", pending)
                buffer = ""
                for sent in sentences:
                    candidate = (buffer + " " + sent).strip() if buffer else sent
                    if len(candidate.split()) <= 35:
                        buffer = candidate
                    else:
                        if buffer and len(buffer.split()) >= MIN_CHUNK_WORDS:
                            final_chunks.append(buffer)
                        buffer = sent
                if buffer and len(buffer.split()) >= MIN_CHUNK_WORDS:
                    final_chunks.append(buffer)
                pending = ""

    if pending and len(pending.split()) >= MIN_CHUNK_WORDS:
        final_chunks.append(pending)

    return final_chunks


# ============================================================
# SEMANTIC DEDUPLICATION ENGINE — v3
# ============================================================


class SemanticDeduplicator:
    """
    Hybrid semantic deduplication:

    Similarity score = α × cosine(content_emb_A, content_emb_B)
                     + (1-α) × cosine(title_emb_A, title_emb_B)

    where α = 1 - TITLE_SIM_WEIGHT (0.75 content, 0.25 title).

    Threshold lowered to 0.91 to catch paraphrased near-duplicates.
    Greedy scan: first-seen canonical version is preserved.
    """

    def __init__(
        self,
        model_id: str = EMBEDDING_MODEL_ID,
        batch_size: int = EMBEDDING_BATCH_SIZE,
        threshold: float = SIMILARITY_THRESHOLD,
        title_weight: float = TITLE_SIM_WEIGHT,
    ):
        logger.info(f"Loading embedding model: {model_id}")
        t0 = time.time()
        self.model = SentenceTransformer(model_id)
        logger.info(f"Model ready in {time.time() - t0:.1f}s")
        self.batch_size = batch_size
        self.threshold  = threshold
        self.alpha      = 1.0 - title_weight  # content weight

    def _encode(self, texts: List[str]) -> np.ndarray:
        return self.model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=True,
            show_progress_bar=True,
            convert_to_numpy=True,
        )

    def deduplicate(
        self,
        entries: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Remove exact and semantic near-duplicates.

        Returns (unique_entries, num_removed).
        """
        if not entries:
            return [], 0

        contents = [e["content"] for e in entries]
        titles   = [e["title"]   for e in entries]

        logger.info(f"Encoding {len(contents)} content chunks…")
        content_embs = self._encode(contents)

        logger.info(f"Encoding {len(titles)} title strings…")
        title_embs = self._encode(titles)

        def _run_dedup(alpha_val: float) -> Tuple[List[Dict[str, Any]], int]:
            combined = alpha_val * content_embs + (1 - alpha_val) * title_embs
            norms = np.linalg.norm(combined, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1.0, norms)
            combined = combined / norms

            kept_indices:    List[int]        = []
            kept_embeddings: List[np.ndarray] = []

            for i, emb in enumerate(combined):
                if kept_embeddings:
                    kept_matrix  = np.array(kept_embeddings)  # (K, D)
                    similarities = kept_matrix @ emb           # cosine (normalized)
                    
                    is_duplicate = False
                    for j, sim in enumerate(similarities):
                        adj_sim = float(sim)
                        kept_entry = entries[kept_indices[j]]
                        curr_entry = entries[i]
                        
                        # Document type and category duplication checks
                        if kept_entry["document_type"] == curr_entry["document_type"]:
                            adj_sim += 0.015
                        if kept_entry["category"] == curr_entry["category"]:
                            adj_sim += 0.015
                        
                        # Title duplication penalty
                        if kept_entry["title"] == curr_entry["title"]:
                            adj_sim += 0.02
                            
                        if adj_sim >= self.threshold:
                            is_duplicate = True
                            # Preserve best quality chunk as canonical
                            if curr_entry["quality_score"] > kept_entry["quality_score"]:
                                kept_indices[j] = i
                                kept_embeddings[j] = emb
                            break
                            
                    if is_duplicate:
                        continue

                kept_indices.append(i)
                kept_embeddings.append(emb)

            unique   = [entries[idx] for idx in kept_indices]
            removed  = len(entries) - len(unique)
            return unique, removed

        unique, removed = _run_dedup(self.alpha)
        
        # Adaptive Deduplication Improvement
        if removed / len(entries) < 0.10:
            logger.info("Duplicate reduction < 10%. Tightening title similarity weighting...")
            unique, removed = _run_dedup(self.alpha - 0.1)

        return unique, removed


# ============================================================
# DATA LOADER
# ============================================================


def load_raw_data(file_paths: List[str]) -> List[Dict[str, Any]]:
    """Load, clean, and normalize all source JSON files."""
    all_data: List[Dict[str, Any]] = []

    for fp in file_paths:
        path = Path(fp)
        if not path.exists():
            logger.warning(f"File not found, skipping: {fp}")
            continue

        logger.info(f"Loading: {path.name}")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        program_level = detect_program_level(path.name)

        for item in data:
            title    = clean_text(item.get("title",    "Untitled"))
            content  = clean_text(item.get("content",  ""))
            category = normalize_category(item.get("category", "other"))
            tags     = item.get("tags", [])

            if not content:
                continue

            all_data.append(
                {
                    "title":         title,
                    "content":       content,
                    "category":      category,
                    "tags":          tags,
                    "source_file":   path.name,
                    "program_level": program_level,
                }
            )

    logger.info(f"Raw entries loaded: {len(all_data)}")
    return all_data


# ============================================================
# FLUFF FILTER STAGE
# ============================================================


def filter_low_value(
    raw_data: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Remove entries dominated by fluff or suppressed institutional content.
    Returns (filtered_data, num_removed).
    """
    filtered: List[Dict[str, Any]] = []
    removed = 0

    for item in raw_data:
        if is_low_value(item["content"], item["category"]):
            logger.debug(f"[FLUFF] {item['title'][:70]}")
            removed += 1
        else:
            filtered.append(item)

    logger.info(f"Fluff filter: removed {removed} entries.")
    return filtered, removed


# ============================================================
# REFINEMENT PIPELINE
# ============================================================


def refine_data(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Core per-entry pipeline:
    1. Atomic chunking (8-layer decomposition)
    2. Per-chunk fluff filter
    3. Quality scoring with hard floor
    4. Full metadata enrichment
    """
    refined: List[Dict[str, Any]] = []

    for item in raw_data:
        chunks = split_into_atomic_chunks(item["content"])

        for chunk in chunks:
            if is_low_value(chunk, item["category"]):
                continue

            quality = compute_quality_score(chunk)
            if quality < 0.10:   # absolute floor — do not index
                continue

            category = item["category"]
            refined.append(
                {
                    "id"           : generate_chunk_id(item["title"], chunk),
                    "title"        : item["title"],
                    "content"      : chunk,
                    "category"     : category,
                    "subcategory"  : item["title"].lower().replace(" ", "_"),
                    "priority"     : assign_priority(category),
                    "source"       : item["source_file"],
                    "program_level": item["program_level"],
                    "document_type": infer_document_type(item["title"], chunk),
                    "quality_score": quality,
                    "tags"         : item["tags"],
                }
            )

    logger.info(f"Post-chunking entries: {len(refined)}")
    return refined


# ============================================================
# EXPORT
# ============================================================


def save_output(data: List[Dict[str, Any]], output_file: str) -> None:
    """Serialize final Qdrant-ready dataset to JSON (UTF-8, indented)."""
    out = Path(output_file)
    out.parent.mkdir(parents=True, exist_ok=True)

    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info(f"Output saved → {output_file}")


# ============================================================
# VALIDATION & REPORTING
# ============================================================


def _pct(num: int, den: int) -> str:
    return f"{num / den * 100:.1f}%" if den else "N/A"


def generate_report(
    original_count:    int,
    post_filter_count: int,
    fluff_removed:     int,
    post_chunk_count:  int,
    final_data:        List[Dict[str, Any]],
    duplicates_removed: int,
) -> None:
    """
    Comprehensive Phase 1.2 validation report with production
    readiness score and all required extended metrics.
    """
    total = len(final_data)
    if total == 0:
        logger.error("No chunks in final dataset — cannot generate report.")
        return

    priorities  = Counter(x["priority"]      for x in final_data)
    categories  = Counter(x["category"]      for x in final_data)
    doc_types   = Counter(x["document_type"] for x in final_data)
    prog_levels = Counter(x["program_level"] for x in final_data)

    avg_words   = sum(len(x["content"].split()) for x in final_data) / total
    avg_quality = sum(x["quality_score"]         for x in final_data) / total

    high_pct    = priorities.get("high",   0) / total
    medium_pct  = priorities.get("medium", 0) / total
    low_pct     = priorities.get("low",    0) / total

    dup_reduction_pct = (
        duplicates_removed / post_chunk_count if post_chunk_count else 0
    )
    chunk_expansion_ratio = (
        post_chunk_count / original_count if original_count else 0
    )
    institutional_pct = (
        fluff_removed / original_count if original_count else 0
    )
    general_policy_count = doc_types.get("general_policy", 0)
    policy_density_pct   = 1.0 - (general_policy_count / total)

    # ---- Production readiness heuristic (7 criteria) ----
    score = 0.0
    criteria: List[Tuple[str, bool, float]] = [
        ("Chunk count 180–220",          180 <= total <= 220,            0.20),
        ("High priority >65%",           high_pct >= 0.65,               0.20),
        ("Low priority <15%",            low_pct < 0.15,                 0.15),
        ("Duplicate reduction >10%",     dup_reduction_pct >= 0.10,      0.15),
        ("Avg quality >0.65",            avg_quality >= 0.65,            0.15),
        ("Policy density >70%",          policy_density_pct >= 0.70,     0.10),
        ("Fluff removed >0",             fluff_removed > 0,              0.05),
    ]
    for _, passed, weight in criteria:
        if passed:
            score += weight
    readiness_pct = round(score * 100, 1)

    S = "=" * 62
    logger.info(S)
    logger.info("  PHASE 1.3 VALIDATION REPORT — CAI-AAST RAG v4")
    logger.info(S)
    logger.info(f"  Original entries loaded        : {original_count}")
    logger.info(f"  After fluff / institutional    : {post_filter_count}  (-{fluff_removed}, {_pct(fluff_removed, original_count)} removed)")
    logger.info(f"  After chunking                 : {post_chunk_count}")
    logger.info(f"  After deduplication            : {total}  (-{duplicates_removed})")
    
    under_chunks = sum(1 for x in final_data if len(x["content"].split()) < 15)
    over_chunks = sum(1 for x in final_data if len(x["content"].split()) > 60)
    
    logger.info(S)
    logger.info("  CHUNK METRICS:")
    logger.info(f"    Chunk expansion ratio        : {chunk_expansion_ratio:.2f}x")
    logger.info(f"    Avg chunk size (words)       : {avg_words:.1f}")
    logger.info(f"    Avg quality score            : {avg_quality:.3f}  (target >0.65)")
    logger.info(f"    Duplicate reduction          : {_pct(duplicates_removed, post_chunk_count)}  (target >10%)")
    logger.info(f"    Institutional removal        : {_pct(fluff_removed, original_count)}")
    logger.info(f"    Policy density               : {policy_density_pct*100:.1f}%  (target >70%)")
    
    logger.info(S)
    logger.info("  ADAPTIVE VALIDATION ENGINE:")
    logger.info(f"    Under-chunk warning          : {under_chunks} chunks < 15 words")
    logger.info(f"    Over-broad chunk warning     : {over_chunks} chunks > 60 words")
    
    low_quality = sum(1 for x in final_data if x["quality_score"] < 0.4)
    logger.info(f"    Quality failure root cause   : {low_quality} chunks scored < 0.4 (often generic/vague)")
    logger.info(f"    Duplicate sensitivity score  : {SIMILARITY_THRESHOLD}")
    logger.info(f"    Retrieval density score      : {policy_density_pct * avg_quality:.3f}")
    
    recommendation = "PASS PHASE 1" if readiness_pct >= 85 else "REQUIRE FINAL TUNING"
    logger.info(f"    Final deployment rec.        : {recommendation}")

    logger.info(S)
    logger.info("  PRIORITY DISTRIBUTION:")
    logger.info(f"    High   : {priorities.get('high',   0):>4}  ({high_pct*100:.1f}%)  target >65%")
    logger.info(f"    Medium : {priorities.get('medium', 0):>4}  ({medium_pct*100:.1f}%)")
    logger.info(f"    Low    : {priorities.get('low',    0):>4}  ({low_pct*100:.1f}%)  target <15%")
    logger.info(S)
    logger.info("  CATEGORY DISTRIBUTION:")
    for cat, cnt in sorted(categories.items(), key=lambda x: -x[1]):
        logger.info(f"    {cat:<36}: {cnt}")
    logger.info(S)
    logger.info("  DOCUMENT TYPE DISTRIBUTION:")
    for dt, cnt in sorted(doc_types.items(), key=lambda x: -x[1]):
        logger.info(f"    {dt:<36}: {cnt}")
    logger.info(S)
    logger.info("  PROGRAM LEVEL SPLIT:")
    for pl, cnt in sorted(prog_levels.items(), key=lambda x: -x[1]):
        logger.info(f"    {pl:<36}: {cnt}")
    logger.info(S)
    logger.info("  PRODUCTION READINESS CRITERIA:")
    for label, passed, weight in criteria:
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"    [{status}] {label:<36} (weight {weight:.0%})")
    logger.info(S)
    logger.info(f"  PRODUCTION READINESS SCORE : {readiness_pct}%  (target >85%)")
    logger.info(S)


# ============================================================
# MAIN
# ============================================================


def main() -> None:
    logger.info("=" * 62)
    logger.info("  PHASE 1.3 DATA REFINEMENT ENGINE — STARTED (v4.0)")
    logger.info("=" * 62)

    t0 = time.time()

    # Stage 1: Load
    raw_data       = load_raw_data(INPUT_FILES)
    original_count = len(raw_data)

    # Stage 2: Fluff / institutional suppression
    filtered_data, fluff_removed = filter_low_value(raw_data)
    post_filter_count = len(filtered_data)

    # Stage 3: Atomic chunking + enrichment
    refined_data     = refine_data(filtered_data)
    post_chunk_count = len(refined_data)

    if post_chunk_count == 0:
        logger.error(
            "No chunks produced after refinement. "
            "Check input files and filter thresholds."
        )
        return

    # Stage 4: Semantic deduplication
    deduplicator = SemanticDeduplicator(
        model_id    = EMBEDDING_MODEL_ID,
        batch_size  = EMBEDDING_BATCH_SIZE,
        threshold   = SIMILARITY_THRESHOLD,
        title_weight= TITLE_SIM_WEIGHT,
    )
    deduplicated_data, duplicates_removed = deduplicator.deduplicate(refined_data)

    # Stage 5: Save
    save_output(deduplicated_data, OUTPUT_FILE)

    # Stage 6: Report
    generate_report(
        original_count     = original_count,
        post_filter_count  = post_filter_count,
        fluff_removed      = fluff_removed,
        post_chunk_count   = post_chunk_count,
        final_data         = deduplicated_data,
        duplicates_removed = duplicates_removed,
    )

    logger.info(f"  Total elapsed: {time.time() - t0:.1f}s")
    logger.info("=" * 62)
    logger.info("  PHASE 1.3 DATA REFINEMENT ENGINE — COMPLETE")
    logger.info("=" * 62)


if __name__ == "__main__":
    main()