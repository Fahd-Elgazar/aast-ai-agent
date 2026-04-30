import { MeiliSearch } from "meilisearch";
import dotenv from "dotenv";
dotenv.config();

let client;

export async function connectMeili() {
  try {
    client = new MeiliSearch({
      host: process.env.MEILI_HOST,
      apiKey: process.env.MEILI_API_KEY || "",
    });
    const version = await client.getVersion();
    console.log(`✅ MeiliSearch connected (version ${version.pkgVersion})`);
    return client;
  } catch (err) {
    console.error("❌ MeiliSearch connection error:", err.message);
  }
}

export { client };
