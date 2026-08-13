const API = 'https://api.jikan.moe/v4';
const ANILIST_API = 'https://graphql.anilist.co';
const CACHE_TTL = 10 * 60 * 1000;
const FALLBACK_ANIME = [
  ['Naruto Shippuden','https://cdn.myanimelist.net/images/anime/5/17407.jpg',2007,'TV'],
  ['Attack on Titan','https://cdn.myanimelist.net/images/anime/10/47347.jpg',2013,'TV'],
  ['One Piece','https://cdn.myanimelist.net/images/anime/6/73245.jpg',1999,'TV'],
  ['Fullmetal Alchemist: Brotherhood','https://cdn.myanimelist.net/images/anime/1223/96541.jpg',2009,'TV'],
  ['Death Note','https://cdn.myanimelist.net/images/anime/9/9453.jpg',2006,'TV'],
  ['My Hero Academia','https://cdn.myanimelist.net/images/anime/10/78745.jpg',2016,'TV'],
  ['Demon Slayer: Kimetsu no Yaiba','https://cdn.myanimelist.net/images/anime/1286/99889.jpg',2019,'TV'],
  ['Hunter x Hunter','https://cdn.myanimelist.net/images/anime/1337/99013.jpg',2011,'TV'],
  ['Jujutsu Kaisen','https://cdn.myanimelist.net/images/anime/1171/109222.jpg',2020,'TV'],
  ['One Punch Man','https://cdn.myanimelist.net/images/anime/12/76049.jpg',2015,'TV']
].map(([title,image,year,type], index) => ({ id:`fallback-${index}`, title, image, year, type, status:'', synopsis:'AnimeBro offline discovery result. Connect to an anime metadata service for full details.', crunchyrollUrl:'' }));

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

function normalizeAniList(item) {
  return {
    id:item.id,
    title:item.title.english || item.title.romaji || item.title.native || 'Untitled anime',
    image:item.coverImage?.extraLarge || item.coverImage?.large || '',
    synopsis:(item.description || 'No description is available yet.').replace(/<[^>]*>/g, ''),
    year:item.seasonYear || '', type:item.format || '', status:item.status || '', crunchyrollUrl:''
  };
}

async function aniListRequest(search='') {
  const key = `animebro:anilist:${search || 'popular'}`;
  try { const saved = JSON.parse(sessionStorage.getItem(key)); if (saved && Date.now() - saved.time < CACHE_TTL) return saved.data; } catch { /* cache is optional */ }
  const query = `query ($search: String) { Page(perPage: 18) { media(type: ANIME, search: $search, sort: POPULARITY_DESC) { id title { english romaji native } coverImage { extraLarge large } description(asHtml: false) seasonYear format status } } }`;
  const response = await fetch(ANILIST_API, { method:'POST', headers:{ 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify({ query, variables:{ search:search || null } }) });
  if (!response.ok) throw new Error('Could not load anime right now.');
  const json = await response.json();
  const data = (json.data?.Page?.media || []).map(normalizeAniList);
  if (!data.length) throw new Error('Could not load anime right now.');
  try { sessionStorage.setItem(key, JSON.stringify({ time:Date.now(), data })); } catch { /* cache is optional */ }
  return data;
}

async function withFallback(primary, search) {
  try { return await primary(); } catch {
    try { return await aniListRequest(search); } catch {
      const term = search.trim().toLowerCase();
      return term ? FALLBACK_ANIME.filter(anime => anime.title.toLowerCase().includes(term)) : FALLBACK_ANIME;
    }
  }
}

export const animeService = {
  search(query) { return withFallback(() => request(`/anime?q=${encodeURIComponent(query)}&limit=18&sfw=true&order_by=popularity&sort=asc`), query); },
  popular() { return withFallback(() => request('/top/anime?limit=18&sfw=true'), ''); }
};
