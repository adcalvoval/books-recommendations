import type { VercelRequest, VercelResponse } from '@vercel/node';

interface IncomingBook {
  title: string;
  author: string;
  genre?: string[];
  rating?: number;
}

interface ClaudeRecommendation {
  title: string;
  author: string;
  genre?: string[];
  year?: number;
  estimatedRating?: number;
  summary: string;
  reasons?: string[];
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';
const MAX_QUERY_LENGTH = 500;
const MAX_LIBRARY_CONTEXT = 60;

function slugify(title: string, author: string): string {
  return `claude-${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Claude API key is not configured on the server. Set CLAUDE_API_KEY in your environment.',
    });
    return;
  }

  const { query, userBooks } = (req.body ?? {}) as {
    query?: unknown;
    userBooks?: IncomingBook[];
  };

  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'A non-empty "query" string is required.' });
    return;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `Query is too long (max ${MAX_QUERY_LENGTH} characters).` });
    return;
  }

  const libraryContext = Array.isArray(userBooks)
    ? userBooks
        .slice(0, MAX_LIBRARY_CONTEXT)
        .map((b) => `- "${b.title}" by ${b.author}${b.genre?.length ? ` (${b.genre.join(', ')})` : ''}${b.rating ? `, rated ${b.rating}/5` : ''}`)
        .join('\n')
    : '';

  const prompt = `You are a book recommendation engine. A reader is asking: "${query.trim()}"

${libraryContext ? `Their existing library (do not recommend any of these):\n${libraryContext}\n` : ''}
Recommend up to 8 real, published books that best match their request. Respond with ONLY a JSON object (no markdown, no commentary) in exactly this shape:

{
  "recommendations": [
    {
      "title": "string",
      "author": "string",
      "genre": ["string"],
      "year": number,
      "estimatedRating": number,
      "summary": "one or two sentence summary",
      "reasons": ["short reason", "short reason"]
    }
  ]
}`;

  try {
    const anthropicResponse = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errText);
      res.status(502).json({ error: `Claude API error (${anthropicResponse.status})` });
      return;
    }

    const anthropicData = await anthropicResponse.json();
    const text: string = anthropicData?.content?.[0]?.text ?? '';

    let parsed: { recommendations?: ClaudeRecommendation[] };
    try {
      parsed = extractJson(text) as { recommendations?: ClaudeRecommendation[] };
    } catch {
      console.error('Failed to parse Claude response as JSON:', text);
      res.status(502).json({ error: 'Claude returned an unexpected response format.' });
      return;
    }

    const existingKeys = new Set(
      (Array.isArray(userBooks) ? userBooks : []).map(
        (b) => `${b.title.toLowerCase().trim()}::${b.author.toLowerCase().trim()}`
      )
    );

    const recommendations = (parsed.recommendations ?? [])
      .filter((rec) => rec.title && rec.author)
      .filter((rec) => !existingKeys.has(`${rec.title.toLowerCase().trim()}::${rec.author.toLowerCase().trim()}`))
      .map((rec) => ({
        id: slugify(rec.title, rec.author),
        title: rec.title,
        author: rec.author,
        genre: rec.genre ?? [],
        rating: rec.estimatedRating ?? 4,
        summary: rec.summary,
        year: rec.year,
        score: 85,
        reasons: rec.reasons ?? [],
      }));

    res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Recommendations handler error:', error);
    res.status(500).json({ error: 'Unable to get book recommendations at the moment.' });
  }
}
