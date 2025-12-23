import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

/**
 * POST /shortlink
 * Body: { "query": "https://maps.app.goo.gl/..." }
 */
app.post('/shortlink', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query requerida' });
    }

    const response = await fetch(query, {
      redirect: 'follow',
      follow: 10,
    });

    const finalUrl = response.url;

    const match = finalUrl.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);

    if (!match) {
      return res.status(422).json({
        resolved_url: finalUrl,
        error: 'No se encontraron coordenadas',
      });
    }

    res.json({
      resolved_url: finalUrl,
      lat: parseFloat(match[1]),
      lon: parseFloat(match[2]),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Healthcheck
 */
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Microservicios running on port ${PORT}`);
});
