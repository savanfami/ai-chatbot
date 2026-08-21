import { openai } from "../config/openai";
import { pinecone } from "../config/pinecone";
import fs from "fs";
import path from "path";
import { getLocalEmbedding } from "./local-embeddings";

export function splitChunk(text: string, chunkSize = 500) {
  const paragraphs = text.split("\n");
  const chunks: string[] = [];

  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + para).length > chunkSize) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += para + "\n";
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================================
// EMBEDDINGS FUNCTION
// ============================================================================
async function getEmbedding(text: string) {
  // 1. Free Local Embeddings (@xenova/transformers - 384 dimensions)
  return await getLocalEmbedding(text);

  /*
  // 2. Previous OpenAI Embeddings (1536 dimensions)
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
  */
}

export const index = pinecone.index(
  process.env.PINECONE_INDEX_NAME || "rag-learning"
  // Previous hardcoded URL: "https://rag-learning-4a2bac7.svc.aped-4627-b74a.pinecone.io"
);

export async function storeDocuments(docs: string[]) {
  const validDocs = docs.map((d) => d.trim()).filter(Boolean);

  if (!validDocs.length) {
    throw new Error("No valid docs");
  }

  // 1. Free Local Embeddings (@xenova/transformers - 384 dimensions)
  const embeddings = await Promise.all(
    validDocs.map((doc) => getLocalEmbedding(doc))
  );

  const vectors: any = validDocs.map((doc, i) => ({
    id: `doc-${i}`,
    values: embeddings[i],
    metadata: { text: doc },
  }));

  /*
  // 2. Previous OpenAI Embeddings (1536 dimensions)
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: validDocs,
  });

  const vectors: any = validDocs.map((doc, i) => ({
    id: `doc-${i}`,
    values: response.data[i].embedding,
    metadata: { text: doc },
  }));
  */

  console.log("Vectors created locally:", vectors.length);

  if (!vectors.length) {
    throw new Error("No vectors created");
  }

  await index.upsert(vectors);
}

export async function searchRelevantDocs(query: string) {
  const embedding = await getEmbedding(query);

  const result = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
  });

  return result.matches.map((m: any) => m.metadata.text);
}

export function readTextFile(fileName: string) {
  const filePath = path.join(__dirname, "../data", fileName);
  const content = fs.readFileSync(filePath, "utf-8");

  return content;
}
