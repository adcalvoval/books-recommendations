import type { Book } from '../types';
import type { BookRecommendation } from './recommendations';
import { fetchBookCovers } from './bookCovers';

// AI-powered recommendations via the /api/recommendations serverless function.
// Falls back silently (caller catches) so keyword-based search still works
// when the Claude API key isn't configured or the request fails.
export const getClaudeRecommendations = async (
  query: string,
  userBooks: Book[]
): Promise<BookRecommendation[]> => {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, userBooks }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Claude recommendations request failed: ${response.status}`);
  }

  const data = await response.json();
  const recommendations: BookRecommendation[] = data.recommendations ?? [];

  if (recommendations.length === 0) {
    return recommendations;
  }

  const coverMap = await fetchBookCovers(recommendations);
  return recommendations.map((rec) => ({
    ...rec,
    coverUrl: coverMap.get(rec.id) ?? rec.coverUrl,
  }));
};
