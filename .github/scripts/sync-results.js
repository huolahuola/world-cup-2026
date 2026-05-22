/**
 * 2026 World Cup Auto-Sync Script
 * Fetches finished match results from API-Football and updates Firebase.
 * Runs via GitHub Actions every 30 minutes during the tournament.
 */

const admin = require('firebase-admin');
const https = require('https');

// ─── Init Firebase Admin ──────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ourworldcup2026-default-rtdb.firebaseio.com'
});
const db = admin.database();

const API_KEY  = process.env.API_FOOTBALL_KEY;
const LEAGUE   = 1;     // FIFA World Cup
const SEASON   = 2026;

// ─── Chinese ↔ English Team Name Mapping ─────────────────
const EN_TO_ZH = {
  // North America
  'United States': '美国', 'USA': '美国',
  'Mexico': '墨西哥',
  'Canada': '加拿大',
  'Panama': '巴拿马',
  'Costa Rica': '哥斯达黎加',
  'Honduras': '洪都拉斯',
  'Jamaica': '牙买加',
  'El Salvador': '萨尔瓦多',
  // South America
  'Brazil': '巴西',
  'Argentina': '阿根廷',
  'Uruguay': '乌拉圭',
  'Colombia': '哥伦比亚',
  'Ecuador': '厄瓜多尔',
  'Chile': '智利',
  'Venezuela': '委内瑞拉',
  'Bolivia': '玻利维亚',
  'Peru': '秘鲁',
  'Paraguay': '巴拉圭',
  // Europe
  'France': '法国',
  'Germany': '德国',
  'Spain': '西班牙',
  'England': '英格兰',
  'Portugal': '葡萄牙',
  'Netherlands': '荷兰',
  'Belgium': '比利时',
  'Italy': '意大利',
  'Croatia': '克罗地亚',
  'Switzerland': '瑞士',
  'Denmark': '丹麦',
  'Austria': '奥地利',
  'Poland': '波兰',
  'Turkey': '土耳其',
  'Serbia': '塞尔维亚',
  'Hungary': '匈牙利',
  'Czech Republic': '捷克',
  'Czechia': '捷克',
  'Scotland': '苏格兰',
  'Romania': '罗马尼亚',
  'Slovakia': '斯洛伐克',
  'Slovenia': '斯洛文尼亚',
  'Albania': '阿尔巴尼亚',
  'Ukraine': '乌克兰',
  'Wales': '威尔士',
  'Greece': '希腊',
  'Norway': '挪威',
  'Sweden': '瑞典',
  'Finland': '芬兰',
  // Asia
  'Japan': '日本',
  'Korea Republic': '韩国', 'South Korea': '韩国',
  'Australia': '澳大利亚',
  'Iran': '伊朗',
  'Saudi Arabia': '沙特', 'Saudi Arabia': '沙特阿拉伯',
  'Qatar': '卡塔尔',
  'China': '中国',
  'Uzbekistan': '乌兹别克斯坦',
  'Jordan': '约旦',
  'Iraq': '伊拉克',
  'UAE': '阿联酋', 'United Arab Emirates': '阿联酋',
  'Indonesia': '印度尼西亚',
  'Thailand': '泰国',
  'Vietnam': '越南',
  // Africa
  'Morocco': '摩洛哥',
  'Senegal': '塞内加尔',
  'Nigeria': '尼日利亚',
  'Cameroon': '喀麦隆',
  'Ghana': '加纳',
  'Egypt': '埃及',
  'Tunisia': '突尼斯',
  'Algeria': '阿尔及利亚',
  'South Africa': '南非',
  "Ivory Coast": '科特迪瓦', "Cote d'Ivoire": '科特迪瓦',
  'Mali': '马里',
  'DR Congo': '刚果',
  'Cape Verde': '佛得角',
  'Zambia': '赞比亚',
  'Tanzania': '坦桑尼亚',
  'Angola': '安哥拉',
  // Oceania
  'New Zealand': '新西兰',
  // Other
  'North Korea': '朝鲜',
  'Bosnia and Herzegovina': '波黑',
  'Bosnia-Herzegovina': '波黑',
  'North Macedonia': '北马其顿',
  'Georgia': '格鲁吉亚',
  'Azerbaijan': '阿塞拜疆',
};

function toZh(enName) {
  if (!enName) return enName;
  // Direct mapping
  if (EN_TO_ZH[enName]) return EN_TO_ZH[enName];
  // Partial match fallback
  const key = Object.keys(EN_TO_ZH).find(k =>
    enName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(enName.toLowerCase())
  );
  return key ? EN_TO_ZH[key] : enName;
}

// ─── HTTP Helper ──────────────────────────────────────────
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ─── Scoring Helpers ──────────────────────────────────────
function calcMatchPts(ph, pa, rh, ra) {
  if (ph === rh && pa === ra) return 3;
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) return 1;
  return 0;
}

// ─── Fetch Fixtures ───────────────────────────────────────
async function getFinishedFixtures() {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}&date=${today}&status=FT`;
  console.log(`Fetching: ${url}`);
  const data = await fetchJson(url, { 'x-apisports-key': API_KEY });
  console.log(`API response: errors=${JSON.stringify(data.errors)}, count=${data.results}`);
  return data.response || [];
}

// ─── Process One Room ─────────────────────────────────────
async function processRoom(roomId, fixtures) {
  const [matchesSnap, predsSnap, scoresSnap, usersSnap] = await Promise.all([
    db.ref(`rooms/${roomId}/matches`).once('value'),
    db.ref(`rooms/${roomId}/predictions`).once('value'),
    db.ref(`rooms/${roomId}/scores`).once('value'),
    db.ref(`rooms/${roomId}/users`).once('value'),
  ]);

  const matches = matchesSnap.val() || {};
  const preds   = predsSnap.val()   || {};
  const scores  = JSON.parse(JSON.stringify(scoresSnap.val() || {})); // deep copy
  const users   = usersSnap.val()   || {};

  const updates = {};
  let updatedCount = 0;

  for (const fixture of fixtures) {
    const apiHome = fixture.teams.home.name;
    const apiAway = fixture.teams.away.name;
    const zhHome  = toZh(apiHome);
    const zhAway  = toZh(apiAway);
    const homeGoals = fixture.goals.home;
    const awayGoals = fixture.goals.away;

    if (homeGoals === null || awayGoals === null) continue;

    // Find match in Firebase (by Chinese names)
    const matchEntry = Object.entries(matches).find(([, m]) =>
      m.status !== 'finished' && (
        m.homeTeam === zhHome || m.homeTeam === apiHome
      ) && (
        m.awayTeam === zhAway || m.awayTeam === apiAway
      )
    );

    if (!matchEntry) {
      console.log(`  No match found for: ${zhHome} vs ${zhAway} (API: ${apiHome} vs ${apiAway})`);
      continue;
    }

    const [matchId] = matchEntry;
    console.log(`  Found match ${matchId}: ${zhHome} ${homeGoals}-${awayGoals} ${zhAway}`);

    updates[`rooms/${roomId}/matches/${matchId}/homeScore`] = homeGoals;
    updates[`rooms/${roomId}/matches/${matchId}/awayScore`] = awayGoals;
    updates[`rooms/${roomId}/matches/${matchId}/status`]    = 'finished';
    updatedCount++;

    // Calculate points for all predictions of this match
    Object.entries(preds)
      .filter(([, p]) => p.matchId === matchId && p.points === null)
      .forEach(([predKey, pred]) => {
        const pts = calcMatchPts(pred.homeScore, pred.awayScore, homeGoals, awayGoals);
        updates[`rooms/${roomId}/predictions/${predKey}/points`] = pts;

        const uid = pred.userId;
        if (!scores[uid]) {
          // Look up user name
          const userName = (users[uid] && users[uid].name) || '未知';
          scores[uid] = { name: userName, total: 0, exact: 0, correct: 0, wrong: 0 };
        }
        scores[uid].total   = (scores[uid].total   || 0) + pts;
        if (pts === 3)      scores[uid].exact   = (scores[uid].exact   || 0) + 1;
        else if (pts === 1) scores[uid].correct = (scores[uid].correct || 0) + 1;
        else                scores[uid].wrong   = (scores[uid].wrong   || 0) + 1;
        updates[`rooms/${roomId}/scores/${uid}`] = scores[uid];
      });
  }

  if (updatedCount > 0) {
    await db.ref('/').update(updates);
    console.log(`Room [${roomId}]: updated ${updatedCount} match(es)`);
  } else {
    console.log(`Room [${roomId}]: nothing to update`);
  }
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log(`\n=== World Cup Sync @ ${new Date().toISOString()} ===`);

  if (!API_KEY) {
    console.error('Missing API_FOOTBALL_KEY');
    process.exit(1);
  }

  const fixtures = await getFinishedFixtures();
  console.log(`Finished fixtures today: ${fixtures.length}`);

  if (fixtures.length === 0) {
    console.log('Nothing to sync. Exiting.');
    await admin.app().delete();
    process.exit(0);
  }

  const roomsSnap = await db.ref('rooms').once('value');
  if (!roomsSnap.exists()) {
    console.log('No rooms in database.');
    await admin.app().delete();
    process.exit(0);
  }

  const roomIds = Object.keys(roomsSnap.val());
  console.log(`Processing ${roomIds.length} room(s): ${roomIds.join(', ')}`);

  await Promise.allSettled(roomIds.map(id => processRoom(id, fixtures)));

  console.log('=== Sync complete ===\n');
  await admin.app().delete();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
