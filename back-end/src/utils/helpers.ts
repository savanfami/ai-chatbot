import { openai } from "../config/openai";
import { pinecone } from "../config/pinecone";

export function splitChunk(data: any, chunkSize = 500) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

export const index = pinecone.index("rag-learning");
export async function storeDocuments(docs: string[]) {
  const vectors: any = [];

  for (let i = 0; i < docs.length; i++) {
    const embedding = await getEmbedding(docs[i]);

    vectors.push({
      id: `doc-${i}`,
      values: embedding,
      metadata: {
        text: docs[i],
      },
    });
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
