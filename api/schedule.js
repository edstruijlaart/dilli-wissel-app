// Vercel API proxy voor VoetbalAssist programma
// Voorkomt CORS issues bij direct browser fetch

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const club = req.query.club || 'Dilettant';
  const weken = parseInt(req.query.weken) || 2;
  const team = req.query.team; // optioneel: filter op teamnaam (bijv. "JO8-2")

  const now = new Date();
  const van = new Date(now); van.setHours(0, 0, 0, 0);
  const tot = new Date(van); tot.setDate(tot.getDate() + weken * 7);

  // Seizoen: juli tot juli
  const seizoenStart = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1);
  const seizoenEnd = new Date(seizoenStart.getFullYear() + 1, 6, 1);

  const body = {
    datumVan: van.toISOString().split('.')[0],
    datumTot: tot.toISOString().split('.')[0],
    datumBeginSeizoen: seizoenStart.toISOString().split('.')[0],
    datumEindeSeizoen: seizoenEnd.toISOString().split('.')[0],
    vandaag: now.toISOString(),
    programmaEnUitslagenType: 1,
    klantAfkorting: club,
    clubWedstrijdenStandaardSorterenOp: "team",
    lang: "nl"
  };

  try {
    const apiRes = await fetch(
      `https://site-api.voetbalassi.st/${club}/front/programmaenuitslagen/PostWedstrijden`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Accept': 'application/json, text/plain, */*',
          'Origin': `https://www.${club.toLowerCase()}.nl`,
          'Referer': `https://www.${club.toLowerCase()}.nl/`
        },
        body: JSON.stringify(body)
      }
    );

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'VoetbalAssist API error', status: apiRes.status });
    }

    let data = await apiRes.json();

    // Filter op team als opgegeven
    if (team) {
      data = data.filter(m =>
        m.thuisClubEnTeamNaamFriendly?.toLowerCase().includes(team.toLowerCase()) ||
        m.uitClubEnTeamNaamFriendly?.toLowerCase().includes(team.toLowerCase())
      );
    }

    // Alleen relevante velden teruggeven (kleiner response)
    const matches = data.map(m => ({
      id: m.id,
      datum: m.datum,
      thuis: m.thuisClubEnTeamNaamFriendly,
      uit: m.uitClubEnTeamNaamFriendly,
      thuisLogo: m.thuisteamLogo,
      uitLogo: m.uitteamLogo,
      isThuiswedstrijd: m.isThuiswedstrijd,
      veld: m.verkrijgVeldtekst,
      uitslag: m.uitslag,
      afgelast: m.statusAfgelast,
      scheidsrechter: m.scheidsrechter,
      wedstrijdnummer: m.wedstrijdnummer
    }));

    // Cache 5 minuten
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(matches);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch schedule', message: err.message });
  }
}
