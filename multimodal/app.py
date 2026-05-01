import streamlit as st
from pipeline.image_pipeline import analyze_image

# ⚙️ Page config
st.set_page_config(
    page_title="Multimodal AI",
    page_icon="🧠",
    layout="wide"
)

# 🎨 Custom CSS (modern style)
st.markdown("""
<style>
body {
    background-color: #0e1117;
}

.main-title {
    font-size: 40px;
    font-weight: bold;
    color: #00ffe1;
}

.card {
    padding: 20px;
    border-radius: 15px;
    background: #161b22;
    box-shadow: 0px 0px 15px rgba(0,255,225,0.1);
    margin-bottom: 20px;
}

.section-title {
    font-size: 20px;
    font-weight: bold;
    color: #00ffe1;
    margin-bottom: 10px;
}
</style>
""", unsafe_allow_html=True)

# 🧠 Title
st.markdown('<div class="main-title">🧠 Multimodal Scene Understanding</div>', unsafe_allow_html=True)
st.write("Analyze any image using AI (Vision + Reasoning)")

# 📤 Upload
uploaded_file = st.file_uploader("Upload Image", type=["jpg", "png"])

if uploaded_file:
    col1, col2 = st.columns([1, 2])

    # 🖼️ Image preview
    with col1:
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.image(uploaded_file, caption="Input Image", width="stretch")
        st.markdown('</div>', unsafe_allow_html=True)

    # ⚡ Analyze button
    with col2:
        if st.button("🚀 Analyze Image"):
            image_bytes = uploaded_file.read()

            with st.spinner("Analyzing with AI..."):
                result = analyze_image(image_bytes)

            # 📊 Tabs for results
            tab1, tab2, tab3 = st.tabs(["🧭 Scene", "📝 Description", "🧠 Structured"])

            # 🧭 Scene Type
            with tab1:
                st.markdown('<div class="card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title">Scene Type</div>', unsafe_allow_html=True)
                st.success(result["scene_type"])
                st.markdown('</div>', unsafe_allow_html=True)

            # 📝 Raw description
            with tab2:
                st.markdown('<div class="card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title">Raw Description (LLaVA)</div>', unsafe_allow_html=True)
                st.write(result["raw"])
                st.markdown('</div>', unsafe_allow_html=True)

            # 🧠 Structured JSON
            with tab3:
                st.markdown('<div class="card">', unsafe_allow_html=True)
                st.markdown('<div class="section-title">Structured Output (Gemma)</div>', unsafe_allow_html=True)
                st.json(result["structured"])
                st.markdown('</div>', unsafe_allow_html=True)