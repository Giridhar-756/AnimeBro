const API = 'https://api.jikan.moe/v4';
const CACHE_TTL = 10 * 60 * 1000;

function normalize(item) {
  const external = [...(item.external || []), ...(item.streaming || [])];
  const crunchyroll = external.find(({ url }) => {
    try { return new URL(url).hostname.endsWith('crunchyroll.com'); } catch { return false; }
  });
  return { id:item.mal_id, title:item.title_english || item.title, image:item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || '', synopsis:item.synopsis || 'No description is available yet.', year:item.year || item.aired?.prop?.from?.year || '', type:item.type || '', status:item.status || '', crunchyrollUrl:crunchyroll?.url || '' };
}
async function request(path) {
  const key = `animebro:${path}`;
  try { const saved = JSON.parse(sessionStorage.getItem(key)); if (saved && Date.now() - saved.time < CACHE_TTL) return saved.data; } catch { /* cache is optional */ }
  const response = await fetch(`${API}${path}`, { headers:{ Accept:'application/json' } });
  if (!response.ok) throw new Error(response.status === 429 ? 'The anime service is busy. Please try again shortly.' : 'Could not load anime right now.');
  const json = await response.json();
  const data = (json.data || []).map(normalize);
  try { sessionStorage.setItem(key, JSON.stringify({ time:Date.now(), data })); } catch { /* cache is optional */ }
  return data;
}
export const animeService = { search(query) { return request(`/anime?q=${encodeURIComponent(query)}&limit=18&sfw=true&order_by=popularity&sort=asc`); }, popular() { return request('/top/anime?limit=18&sfw=true'); } };
