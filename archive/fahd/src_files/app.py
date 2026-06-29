# Streamlit UI for CAI-AAST Academic Advisor (Phase 4)

import streamlit as st
import requests
import json
from datetime import datetime

# ============================================================
# CONFIG
# ============================================================
PHASE4_API_URL = "http://localhost:8002/answer"
HEALTH_URL = "http://localhost:8002/health"
TIMEOUT = 180

# ============================================================
# PAGE CONFIG
# ============================================================
st.set_page_config(
    page_title="CAI-AAST Academic Advisor",
    page_icon="🎓",
    layout="wide"
)

# ============================================================
# HELPERS
# ============================================================
def check_system_health():
    try:
        response = requests.get(HEALTH_URL, timeout=10)
        if response.status_code == 200:
            return True, response.json()
        return False, None
    except Exception:
        return False, None


def query_system(user_query, category=None, priority_only=False):
    payload = {
        "query": user_query,
        "top_k": 8,
        "category": category if category else None,
        "priority_only": priority_only
    }

    response = requests.post(
        PHASE4_API_URL,
        json=payload,
        timeout=TIMEOUT
    )

    return response


# ============================================================
# HEADER
# ============================================================
st.title("🎓 CAI-AAST Explainable Academic Advisor")
st.markdown("### Production Hybrid VectorRAG Academic Advisory System")
st.markdown("Ask admissions, grading, scholarships, regulations, and academic policy questions.")

# ============================================================
# SIDEBAR
# ============================================================
st.sidebar.header("System Controls")

healthy, health_data = check_system_health()

if healthy:
    st.sidebar.success("System Online")
else:
    st.sidebar.error("System Offline")

category = st.sidebar.selectbox(
    "Optional Category Filter",
    [
        "Auto Detect",
        "admissions",
        "grading_policies",
        "financial_policies",
        "academic_policies",
        "compliance",
        "postgraduate_programs"
    ]
)

priority_only = st.sidebar.checkbox("High Priority Policies Only")

st.sidebar.markdown("---")
st.sidebar.markdown("### Example Questions")
example_questions = [
    "What GPA is required to avoid academic probation?",
    "What are admission requirements for AI students?",
    "Are scholarships available for outstanding students?",
    "What are transfer regulations?",
    "What are graduation requirements?"
]

for q in example_questions:
    if st.sidebar.button(q):
        st.session_state["example_query"] = q

# ============================================================
# INPUT
# ============================================================
default_query = st.session_state.get("example_query", "")

user_query = st.text_area(
    "Enter your academic question:",
    value=default_query,
    height=120,
    placeholder="Example: What GPA is required to avoid academic probation?"
)

submit = st.button("Get Academic Answer")

# ============================================================
# MAIN QUERY FLOW
# ============================================================
if submit:
    if not user_query.strip():
        st.warning("Please enter a valid academic question.")
    else:
        with st.spinner("Processing through production academic advisor system..."):
            try:
                selected_category = None if category == "Auto Detect" else category

                response = query_system(
                    user_query,
                    category=selected_category,
                    priority_only=priority_only
                )

                # ------------------------------------------------
                # SUCCESS
                # ------------------------------------------------
                if response.status_code == 200:
                    data = response.json()

                    st.success("Answer generated successfully")

                    # Main Answer
                    st.markdown("## Academic Answer")
                    st.write(data.get("answer", "No answer available."))

                    # Confidence Metrics
                    st.markdown("## System Confidence Metrics")

                    col1, col2, col3, col4 = st.columns(4)

                    with col1:
                        st.metric(
                            "Answer Confidence",
                            f"{data.get('answer_confidence', 0):.2f}"
                        )

                    with col2:
                        st.metric(
                            "Retrieval Confidence",
                            f"{data.get('retrieval_confidence', 0):.2f}"
                        )

                    with col3:
                        st.metric(
                            "Confidence Level",
                            data.get("confidence_level", "N/A")
                        )

                    with col4:
                        st.metric(
                            "Latency (sec)",
                            f"{data.get('latency_seconds', 0):.2f}"
                        )

                    # Metadata
                    st.markdown("## Retrieval Metadata")
                    st.json({
                        "fallback_used": data.get("retrieval_fallback_used"),
                        "category_filter": data.get("category_filter"),
                        "results_used": data.get("results_used"),
                        "system_status": data.get("system_status")
                    })

                    # Sources
                    st.markdown("## Verified Sources")
                    sources = data.get("verified_sources", [])

                    if sources:
                        for idx, source in enumerate(sources, start=1):
                            with st.expander(f"Source {idx}: {source.get('title', 'Untitled')}"):
                                st.write(f"**Category:** {source.get('category')}" )
                                st.write(f"**Document Type:** {source.get('document_type')}" )
                                st.write(f"**Source File:** {source.get('source')}" )
                                st.write(f"**Confidence:** {source.get('confidence')}" )
                    else:
                        st.info("No verified sources returned.")

                    # Raw JSON
                    with st.expander("Raw API Response"):
                        st.code(json.dumps(data, indent=2), language="json")

                # ------------------------------------------------
                # SAFE REFUSAL / VALIDATION
                # ------------------------------------------------
                elif response.status_code == 422:
                    error_data = response.json()
                    st.error("Request rejected by academic safety validation")
                    st.json(error_data)

                # ------------------------------------------------
                # SYSTEM FAILURE
                # ------------------------------------------------
                else:
                    st.error(f"System Error: HTTP {response.status_code}")
                    try:
                        st.json(response.json())
                    except Exception:
                        st.text(response.text)

            except Exception as e:
                st.error(f"Application Error: {str(e)}")

# ============================================================
# FOOTER
# ============================================================
st.markdown("---")
st.caption(
    f"CAI-AAST Production Academic Advisor | Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
)

