// Fetches the public HackTheBox profile for the user id in src/consts.ts-compatible config
// and writes src/data/htb.json. Runs before every build (see package.json).
// The endpoints are public but CORS-locked to app.hackthebox.com, so this has to happen
// at build time rather than in the browser. Any failure keeps the previous snapshot.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const USER_ID = process.env.HTB_USER_ID ?? '5938';
const OUT = new URL('../src/data/htb.json', import.meta.url);
const AVATAR_DIR = new URL('../public/assets/images/htb/', import.meta.url);
const AVATAR_PUBLIC = '/assets/images/htb/avatar.png';
const BASE = `https://labs.hackthebox.com/api/v4/profile`;
const ENDPOINTS = {
  profile: `${BASE}/${USER_ID}`,
  machines: `${BASE}/progress/machines/${USER_ID}`,
  challenges: `${BASE}/progress/challenges/${USER_ID}`,
  prolabs: `${BASE}/progress/prolab/${USER_ID}`,
  fortresses: `${BASE}/progress/fortress/${USER_ID}`,
  badges: `${BASE}/badges/${USER_ID}`,
};

async function get(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'rahulr.in build (https://rahulr.in)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

try {
  const [profile, machines, challenges, prolabs, fortresses, badges] = await Promise.all(
    Object.values(ENDPOINTS).map(get),
  );
  const p = profile.profile;
  // keep a local copy of the avatar so the card does not depend on HTB's S3 bucket (or get blocked by ad/tracker shields)
  let avatar = p.avatar;
  try {
    const img = await fetch(p.avatar, { signal: AbortSignal.timeout(20000) });
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(new URL('avatar.png', AVATAR_DIR), Buffer.from(await img.arrayBuffer()));
    avatar = AVATAR_PUBLIC;
  } catch (err) {
    console.warn(`[htb] avatar download failed (${err.message}); using remote URL`);
  }
  const data = {
    fetchedAt: new Date().toISOString(),
    userId: Number(USER_ID),
    profileUrl: `https://app.hackthebox.com/public/users/${USER_ID}`,
    name: p.name,
    avatar,
    rank: p.rank,
    rankId: p.rank_id,
    nextRank: p.next_rank,
    rankProgress: p.current_rank_progress,
    ranking: p.ranking,
    points: p.points,
    userOwns: p.user_owns,
    systemOwns: p.system_owns,
    respects: p.respects,
    userBloods: p.user_bloods,
    systemBloods: p.system_bloods,
    joined: p.joined_date,
    country: p.country_name,
    team: p.team ? { name: p.team.name, ranking: p.team.ranking, members: p.team.member_count, logo: p.team.logo_thumb_url } : null,
    machines: {
      solved: machines.profile.machine_owns.solved,
      total: machines.profile.machine_owns.total,
      percentage: machines.profile.machine_owns.completion_percentage,
      byDifficulty: machines.profile.machine_difficulties.map((d) => ({
        name: d.name,
        owned: d.owned_machines,
        total: d.total_machines,
        percentage: d.completion_percentage,
      })),
    },
    challenges: {
      solved: challenges.profile.challenge_owns.solved,
      total: challenges.profile.challenge_owns.total,
      percentage: challenges.profile.challenge_owns.percentage,
      byCategory: challenges.profile.challenge_categories.map((c) => ({
        name: c.name,
        owned: c.owned_flags,
        total: c.total_flags,
        percentage: c.completion_percentage,
      })),
    },
    prolabs: prolabs.profile.prolabs.map((l) => ({
      name: l.name,
      avatar: l.avatar,
      percentage: l.completion_percentage,
      owned: l.owned_flags,
      total: l.total_flags,
    })),
    fortresses: fortresses.profile.fortresses.map((f) => ({
      name: f.name,
      avatar: f.avatar,
      percentage: f.completion_percentage,
      owned: f.owned_flags,
      total: f.total_flags,
    })),
    badges: badges.badges.map((b) => ({ name: b.name, description: b.description, icon: b.icon, earned: b.pivot?.created_at })),
  };
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`[htb] wrote ${data.name}: ${data.rank}, #${data.ranking}, ${data.points} pts, ${data.prolabs.length} pro labs`);
} catch (err) {
  let stale = 'no snapshot';
  try { stale = `keeping snapshot from ${JSON.parse(await readFile(OUT, 'utf8')).fetchedAt}`; } catch {}
  console.warn(`[htb] fetch failed (${err.message}); ${stale}`);
}
