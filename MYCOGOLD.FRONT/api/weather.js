const send = (res, body, status = 200) => res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body))
const places = { Kericho: [-0.37, 35.28], Nakuru: [-0.30, 36.08], Nairobi: [-1.29, 36.82], Kisumu: [-0.10, 34.75], Eldoret: [0.52, 35.27], Nyandarua: [-0.18, 36.52] }
export default async function handler(req, res) {
  try {
    const result = await Promise.all(Object.entries(places).map(async ([name, [latitude, longitude]]) => { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_probability_max,temperature_2m_max&timezone=Africa%2FNairobi&forecast_days=3`); const data = await r.json(); return { name, days: data.daily?.time?.map((date, i) => ({ date, rainRisk: data.daily.precipitation_probability_max[i], maxC: data.daily.temperature_2m_max[i] })) || [] } }))
    return send(res, { locations: result, source: 'Open-Meteo' })
  } catch (error) { console.error('[v0] weather failed', error); return send(res, { locations: [], source: 'Open-Meteo unavailable' }, 200) }
}
