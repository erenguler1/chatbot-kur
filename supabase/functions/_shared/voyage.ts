// Voyage AI embeddings client, shared by embed-document and chat functions.

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
// voyage-4: current general-purpose multilingual model, covered by the 200M
// free tokens (voyage-3/3.5 are not). Default 1024 dims, must match
// documents.embedding. Changing the model requires re-embedding all documents.
const VOYAGE_MODEL = 'voyage-4'

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
