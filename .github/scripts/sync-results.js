/**
 * 2026 World Cup Auto-Sync Script
 * Uses football-data.org API (free tier)
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
const API_TOKEN = process.env.API_FOOTBALL_KEY;

// ─── Chinese ↔ English Team Name Mapping ─────────────────
const EN_TO_ZH = {
  // North America
  'United States': '美国', 'USA': '美国', 'US': '美国',
  'Mexico': '墨西哥', 'MEX': '墨西哥',
  'Canada': '加拿大', 'CAN': '加拿大',
  'Panama': '巴拿马', 'Costa Rica': '哥斯达黎加',
  'Honduras': '洪都拉斯', 'Jamaica': '牙买加',
  'El Salvador': '萨尔瓦多',
  // South America
  'Brazil': '巴西', 'BRA': '巴西',
  'Argentina': '阿根廷', 'ARG': '阿根廷',
  'Uruguay': '乌拉圭', 'URU': '乌拉圭',
  'Colombia': '哥伦比亚', 'COL': '哥伦比亚',
  'Ecuador': '厄瓜多尔', 'ECU': '厄瓜多尔',
  'Chile': '智利', 'CHI': '智利',
  'Venezuela': '委内瑞拉', 'VEN': '委内瑞拉',
  'Bolivia': '玻利维亚', 'BOL': '玻利维亚',
  'Peru': '秘鲁', 'PER': '秘鲁',
  'Paraguay': '巴拉圭', 'PAR': '巴拉圭',
  // Europe
  'France': '法国', 'FRA': '法国',
  'Germany': '德国', 'GER': '德国',
  'Spain': '西班牙', 'ESP': '西班牙',
  'England': '英格兰', 'ENG': '英格兰',
  'Portugal': '葡萄牙', 'POR': '葡萄牙',
  'Netherlands': '荷兰', 'NED': '荷兰', 'Holland': '荷兰',
  'Belgium': '比利时', 'BEL': '比利时',
  'Italy': '意大利', 'ITA': '意大利',
  'Croatia': '克罗地亚', 'CRO': '克罗地亚',
  'Switzerland': '瑞士', 'SUI': '瑞士',
  'Denmark': '丹麦', 'DEN': '丹麦',
  'Austria': '奥地利', 'AUT': '奥地利',
  'Poland': '波兰', 'POL': '波兰',
  'Turkey': '土耳其', 'TUR': '土耳其', 'Türkiye': '土耳其',
  'Serbia': '塞尔维亚', 'SRB': '塞尔维亚',
  'Hungary': '匈牙利', 'HUN': '匈牙利',
  'Czech Republic': '捷克', 'Czechia': '捷克', 'CZE': '捷克',
  'Scotland': '苏格兰', 'SCO': '苏格兰',
  'Romania': '罗马尼亚', 'ROU': '罗马尼亚',
  'Slovakia': '斯洛伐克', 'SVK': '斯洛伐克',
  'Slovenia': '斯洛文尼亚', 'SVN': '斯洛文尼亚',
  'Albania': '阿尔巴尼亚', 'ALB': '阿尔巴尼亚',
  'Ukraine': '乌克兰', 'UKR': '乌克兰',
  'Wales': '威尔士', 'WAL': '威尔士',
  'Greece': '希腊', 'GRE': '希腊',
  'Norway': '挪威', 'NOR': '挪威',
  'Sweden': '瑞典', 'SWE': '瑞典',
  'Georgia': '格鲁吉亚', 'GEO': '格鲁吉亚',
  'North Macedonia': '北马其顿', 'MKD': '北马其顿',
  'Bosnia and Herzegovina': '波黑', 'Bosnia-Herzegovina': '波黑', 'BIH': '波黑',
  'Kosovo': '科索沃', 'KVX': '科索沃',
  // Asia
  'Japan': '日本', 'JPN': '日本',
  'Korea Republic': '韩国', 'South Korea': '韩国', 'Korea, Republic of': '韩国', 'KOR': '韩国',
  'Australia': '澳大利亚', 'AUS': '澳大利亚',
  'Iran': '伊朗', 'IRI': '伊朗',
  'Saudi Arabia': '沙特', 'KSA': '沙特', 'Saudi Arabia': '沙特阿拉伯',
  'Qatar': '卡塔尔', 'QAT': '卡塔尔',
  'China PR': '中国', 'China': '中国', 'CHN': '中国',
  'Uzbekistan': '乌兹别克斯坦', 'UZB': '乌兹别克斯坦',
  'Jordan': '约旦', 'JOR': '约旦',
  'Iraq': '伊拉克', 'IRQ': '伊拉克',
  'United Arab Emirates': '阿联酋', 'UAE': '阿联酋',
  'Indonesia': '印度尼西亚', 'IDN': '印度尼西亚',
  'Palestine': '巴勒斯坦', 'PLE': '巴勒斯坦',
  'Bahrain': '巴林', 'BHR': '巴林',
  'Oman': '阿曼', 'OMA': '阿曼',
  // Africa
  'Morocco': '摩洛哥', 'MAR': '摩洛哥',
  'Senegal': '塞内加尔', 'SEN': '塞内加尔',
  'Nigeria': '尼日利亚', 'NGA': '尼日利亚',
  'Cameroon': '喀麦隆', 'CMR': '喀麦隆',
  'Ghana': '加纳', 'GHA': '加纳',
  'Egypt': '埃及', 'EGY': '埃及',
  'Tunisia': '突尼斯', 'TUN': '突尼斯',
  'Algeria': '阿尔及利亚', 'ALG': '阿尔及利亚',
  'South Africa': '南非', 'RSA': '南非',
  "Ivory Coast": '科特迪瓦', "Côte d'Ivoire": '科特迪瓦', "Cote d'Ivoire": '科特迪瓦', 'CIV': '科特迪瓦',
  'Mali': '马里', 'MLI': '马里',
  'DR Congo': '刚果', 'Congo DR': '刚果', 'COD': '刚果',
  'Cape Verde': '佛得角', 'CPV': '佛得角',
  'Zambia': '赞比亚', 'ZAM': '赞比亚',
  'Angola': '安哥拉', 'ANG': '安哥拉',
  'Tanzania': '坦桑尼亚', 'TAN': '坦桑尼亚',
  'Mozambique': '莫桑比克',
  'Uganda': '乌干达',
  'Zimbabwe': '津巴布韦',
  "Burkina Faso": '布基纳法索',
  'Guinea': '几内亚',
  'Benin': '贝宁',
  // Oceania
  'New Zealand': '新西兰', 'NZL': '新西兰',
  'New Caledonia': '新喀里多尼亚',
  'Fiji': '斐济',
  // Other
  'North Korea': '朝鲜', 'Korea DPR': '朝鲜', 'PRK': '朝鲜',
};

function toZh(name) {
  if (!name) return name;
  if (EN_TO_ZH[name]) return EN_TO_ZH[name];
  // Partial match fallback
  const key = Object.keys(EN_TO_ZH).find(k =>
    name.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(name.toLowerCase())
  );
  return key ? EN_TO_ZH[key] : name;
}

// ─── HTTP Helper ──────────────────────────────────────────
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.slice(0, 300))); }
      });
    }).on('error', reject);
  });
}

// ─── Scoring ──────────────────────────────────────────────
function calcMatchPts(ph, pa, rh, ra) {
  if (ph === rh && pa === ra) return 3;
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) return 1;
  return 0;
}

// ─── Fetch Today's Finished Matches ───────────────────────
async function getFinishedMatches() {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED&dateFrom=${today}&dateTo=${today}`;
  console.log(`Fetching: ${url}`);
  const data = await fetchJson(url, { 'X-Auth-Token': API_TOKEN });

  if (data.errorCode) {
    throw new Error(`API error ${data.errorCode}: ${data.message}`);
  }
  return data.matches || [];
}

// ─── Process One Firebase Room ────────────────────────────
async function processRoom(roomId, apiMatches) {
  const [matchesSnap, predsSnap, scoresSnap, usersSnap] = await Promise.all([
    db.ref(`rooms/${roomId}/matches`).once('value'),
    db.ref(`rooms/${roomId}/predictions`).once('value'),
    db.ref(`rooms/${roomId}/scores`).once('value'),
    db.ref(`rooms/${roomId}/users`).once('value'),
  ]);

  const fbMatches = matchesSnap.val() || {};
  const preds     = predsSnap.val()   || {};
  const scores    = JSON.parse(JSON.stringify(scoresSnap.val() || {}));
  const users     = usersSnap.val()   || {};

  const updates = {};
  let updatedCount = 0;

  for (const m of apiMatches) {
    const homeGoals = m.score?.fullTime?.home;
    const awayGoals = m.score?.fullTime?.away;
    if (homeGoals === null || homeGoals === undefined) continue;
    if (awayGoals === null || awayGoals === undefined) continue;

    const zhHome = toZh(m.homeTeam?.name);
    const zhAway = toZh(m.awayTeam?.name);

    // Match by Chinese name or original English name
    const entry = Object.entries(fbMatches).find(([, fbm]) =>
      fbm.status !== 'finished' && (
        fbm.homeTeam === zhHome || fbm.homeTeam === m.homeTeam?.name
      ) && (
        fbm.awayTeam === zhAway || fbm.awayTeam === m.awayTeam?.name
      )
    );

    if (!entry) {
      console.log(`  No match found for: ${zhHome}(${m.homeTeam?.name}) vs ${zhAway}(${m.awayTeam?.name})`);
      continue;
    }

    const [matchId] = entry;
    console.log(`  ✓ ${zhHome} ${homeGoals}-${awayGoals} ${zhAway} → matchId: ${matchId}`);

    updates[`rooms/${roomId}/matches/${matchId}/homeScore`] = homeGoals;
    updates[`rooms/${roomId}/matches/${matchId}/awayScore`] = awayGoals;
    updates[`rooms/${roomId}/matches/${matchId}/status`]    = 'finished';
    updatedCount++;

    // Calculate & update prediction points
    Object.entries(preds)
      .filter(([, p]) => p.matchId === matchId && p.points === null)
      .forEach(([predKey, pred]) => {
        const pts = calcMatchPts(pred.homeScore, pred.awayScore, homeGoals, awayGoals);
        updates[`rooms/${roomId}/predictions/${predKey}/points`] = pts;

        const uid = pred.userId;
        if (!scores[uid]) {
          scores[uid] = {
            name: users[uid]?.name || '未知',
            total: 0, exact: 0, correct: 0, wrong: 0
          };
        }
        scores[uid].total = (scores[uid].total || 0) + pts;
        if (pts === 3)      scores[uid].exact   = (scores[uid].exact   || 0) + 1;
        else if (pts === 1) scores[uid].correct = (scores[uid].correct || 0) + 1;
        else                scores[uid].wrong   = (scores[uid].wrong   || 0) + 1;
        updates[`rooms/${roomId}/scores/${uid}`] = scores[uid];
      });
  }

  if (updatedCount > 0) {
    await db.ref('/').update(updates);
    console.log(`  Room [${roomId}]: ${updatedCount} match(es) updated`);
  } else {
    console.log(`  Room [${roomId}]: nothing new`);
  }
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log(`\n=== WC2026 Sync @ ${new Date().toISOString()} ===`);

  if (!API_TOKEN) { console.error('Missing API_FOOTBALL_KEY'); process.exit(1); }

  const apiMatches = await getFinishedMatches();
  console.log(`Finished matches today: ${apiMatches.length}`);

  if (!apiMatches.length) {
    console.log('Nothing to sync.');
    await admin.app().delete();
    return;
  }

  const roomsSnap = await db.ref('rooms').once('value');
  if (!roomsSnap.exists()) {
    console.log('No rooms in DB.');
    await admin.app().delete();
    return;
  }

  const roomIds = Object.keys(roomsSnap.val());
  console.log(`Rooms: ${roomIds.join(', ')}`);
  await Promise.allSettled(roomIds.map(id => processRoom(id, apiMatches)));

  console.log('=== Done ===\n');
  await admin.app().delete();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
