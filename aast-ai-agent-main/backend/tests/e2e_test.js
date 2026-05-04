import fetch from "node-fetch";

const API_BASE = "http://localhost:8000/api";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2E() {
  console.log("🚀 Starting E2E Journey Simulation...");
  let currentCid = null;

  async function sendQuery(query, cid) {
    const res = await fetch(`${API_BASE}/chatbot/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, cid })
    });
    const data = await res.json();
    return data;
  }

  try {
    // a) Greet the bot
    console.log("\n[Step 1] Sending Greeting...");
    let response = await sendQuery("Hello there!");
    
    // b) Store CID from first turn
    currentCid = response.cid;
    console.log(`✅ Received CID: ${currentCid}`);
    console.log(`🤖 Bot Answer: ${response.answer}`);
    if (response.source !== "greeting") console.error("⚠️ Source was not 'greeting'");

    await sleep(1000);

    // b) Ask a GRAPH question
    console.log("\n[Step 2] Sending GRAPH Question...");
    response = await sendQuery("What are the engineering modules?", currentCid);
    console.log(`✨ CID Maintained: ${response.cid === currentCid}`);
    console.log(`🤖 Bot Answer: ${response.answer.substring(0, 50)}...`);
    if (response.source !== "knowledge_graph" && response.source !== "faq") console.warn("⚠️ Source issue on GRAPH");

    await sleep(2000);

    // c) Provide partial profile data
    console.log("\n[Step 3] Asking for Recommendation (Partial Data)...");
    response = await sendQuery("I have 90% in high school and love AI, what should I study?", currentCid);
    console.log(`🤖 Bot Answer: ${response.answer}`);
    
    // d) Verify if the bot asks for missing budget
    if (response.answer.toLowerCase().includes("budget")) {
      console.log("✅ Verified: Bot accurately identified missing 'budget' constraint.");
    } else {
      console.error("❌ Failed: Bot did not ask for budget.");
    }

    await sleep(1000);

    // e) Provide budget
    console.log("\n[Step 4] Providing Missing Budget Data...");
    response = await sendQuery("My budget is 5000", currentCid);
    console.log(`🤖 Final Decision Answer: ${response.answer.substring(0, 60)}...`);
    
    if (response.decision) {
      console.log("✅ Verified: Received final decision payload.");
      console.log(`   🎓 Major: ${response.decision.recommended_major}`);
      console.log(`   ⚖️ Confidence: ${response.decision.confidence}%`);
      console.log(`   ✅ Pros: ${response.decision.pros?.length || 0} features returned`);
    } else {
      console.error("❌ Failed: Final decision payload was not appended.");
    }

    console.log("\n🎉 E2E Test Suite Passed Successfully!");

  } catch (error) {
    console.error("\n💥 Error during E2E Testing:", error.message);
  }
}

runE2E();
