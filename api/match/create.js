import { redis, generateCode, MATCH_TTL, corsHeaders } from '../_lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { team, homeTeam, awayTeam, players, keeper, playersOnField, halfDuration, halves, subInterval } = req.body;

    // Check of team al een actieve wedstrijd heeft
    if (team) {
      const keys = [];
      let cursor = 0;
      do {
        const [nextCursor, results] = await redis.scan(cursor, { match: 'match:*', count: 100 });
        cursor = nextCursor;
        keys.push(...results.filter(k => !k.includes(':events')));
      } while (cursor && cursor !== 0 && cursor !== '0');

      for (const key of keys) {
        try {
          const existing = await redis.get(key);
          if (existing) {
            const existingMatch = typeof existing === 'string' ? JSON.parse(existing) : existing;
            // Check of hetzelfde team en nog niet afgelopen
            if (existingMatch.team === team && existingMatch.status !== 'ended') {
              return res.status(409).json({
                error: 'Team heeft al een actieve wedstrijd',
                existingCode: key.replace('match:', '')
              });
            }
          }
        } catch {}
      }
    }

    // Genereer unieke 4-letter code
    let code, exists;
    do {
      code = generateCode();
      exists = await redis.exists(`match:${code}`);
    } while (exists);

    const match = {
      code,
      status: 'setup',
      team: team || '',
      homeTeam: team || homeTeam || 'Dilettant',
      awayTeam: awayTeam || '',
      players: players || [],
      keeper: keeper || null,
      matchKeeper: keeper || null,
      playersOnField: playersOnField || 5,
      halfDuration: halfDuration || 20,
      halves: halves || 2,
      subInterval: subInterval || 5,
      onField: [],
      onBench: [],
      homeScore: 0,
      awayScore: 0,
      currentHalf: 1,
      timerStartedAt: null,
      elapsedAtPause: 0,
      subTimerStartedAt: null,
      subElapsedAtPause: 0,
      playTime: {},
      isRunning: false,
      isPaused: false,
      halfBreak: false,
      createdAt: new Date().toISOString(),
    };

    await redis.set(`match:${code}`, JSON.stringify(match), { ex: MATCH_TTL });
    await redis.set(`match:${code}:events`, JSON.stringify([]), { ex: MATCH_TTL });

    res.status(201).json({ code, match });
  } catch (err) {
    console.error('Create match error:', err);
    res.status(500).json({ error: 'Failed to create match' });
  }
}
