// Voyage AI embeddings client, shared by embed-document and chat functions.

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3' // 1024 dims, must match documents.embedding

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>
}

// "document" when storing chunks, "query" when embedding a user question.
export async function getEmbeddings(
  texts: string[],
  inputType: 'document' | 'query',
): Promise<number[][]> {
  const voyageKey = Deno.env.get('VOYAGE_API_KEY')
  if (!voyageKey) throw new Error('VOYAGE_API_KEY not set')

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${voyageKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts, input_type: inputType }),
  })

  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status} ${await response.text()}`)
  }

  const data: VoyageResponse = await response.json()
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}
