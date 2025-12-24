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

    let finalUrl = response.url;
    
    // Decodificar URL en caso de que esté codificada
    try {
      finalUrl = decodeURIComponent(finalUrl);
    } catch (e) {
      // Si falla la decodificación, usar la URL original
    }

    // Intentar múltiples formatos de coordenadas de Google Maps
    let lat, lon;
    
    // Formato 1: @lat,lon o @lat,lon,zoom
    let match = finalUrl.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
    if (match) {
      lat = parseFloat(match[1]);
      lon = parseFloat(match[2]);
    } else {
      // Formato 2: !3dlat...!4dlon (formato de datos embebidos, permite caracteres intermedios)
      // Hacer la expresión más flexible con los dígitos
      match = finalUrl.match(/!3d(-?\d+\.\d+).*?!4d(-?\d+\.\d+)/);
      if (match) {
        lat = parseFloat(match[1]);
        lon = parseFloat(match[2]);
      }
    }

    if (!match) {
      return res.status(422).json({
        resolved_url: finalUrl,
        error: 'No se encontraron coordenadas',
      });
    }

    res.json({
      resolved_url: finalUrl,
      lat: lat,
      lon: lon,
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
