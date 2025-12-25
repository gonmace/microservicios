import express from 'express';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';

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
    let match = null;
    
    // Función auxiliar para validar y asignar coordenadas
    const setCoords = (latStr, lonStr) => {
      const parsedLat = parseFloat(latStr);
      const parsedLon = parseFloat(lonStr);
      if (parsedLat >= -90 && parsedLat <= 90 && parsedLon >= -180 && parsedLon <= 180) {
        lat = parsedLat;
        lon = parsedLon;
        return true;
      }
      return false;
    };
    
    // Formato 1: @lat,lon o @lat,lon,zoom
    match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match && setCoords(match[1], match[2])) {
      // Coordenadas asignadas
    }
    
    // Formato 2: !3dlat...!4dlon (formato de datos embebidos, permite caracteres intermedios)
    if (lat === undefined || lon === undefined) {
      match = finalUrl.match(/!3d(-?\d+\.\d+).*?!4d(-?\d+\.\d+)/);
      if (match && setCoords(match[1], match[2])) {
        // Coordenadas asignadas
      }
    }
    
    // Formato 3: ?q=lat,lon (parámetro de consulta)
    if (lat === undefined || lon === undefined) {
      // Primero intentar con expresión regular directa (más rápido)
      match = finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match && setCoords(match[1], match[2])) {
        // Coordenadas asignadas
      } else {
        // Si no funciona, intentar extraer el parámetro q de la URL usando URL API
        try {
          const urlObj = new URL(finalUrl);
          const qParam = urlObj.searchParams.get('q');
          if (qParam) {
            // Intentar parsear como coordenadas lat,lon
            const coordsMatch = qParam.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
            if (coordsMatch && setCoords(coordsMatch[1], coordsMatch[2])) {
              // Coordenadas asignadas desde parámetro q
            }
          }
        } catch (e) {
          // Si falla crear URL object, continuar
        }
      }
    }
    
    // Formato 4: Intentar obtener coordenadas del HTML si no están en la URL
    if (lat === undefined || lon === undefined) {
      // Esto es para casos donde solo hay place ID
      try {
        const htmlResponse = await fetch(finalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });
        const html = await htmlResponse.text();
        
        // Buscar coordenadas en el HTML (múltiples formatos posibles)
        // Intentar varios patrones en orden de especificidad
        
        // Formato 1: Buscar en window.APP_INITIALIZATION_STATE o datos JSON embebidos
        // Google Maps suele tener las coordenadas en datos JSON grandes
        const jsonMatches = html.match(/\[(-?\d{1,2}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/g);
        if (jsonMatches) {
          for (const jsonMatch of jsonMatches) {
            const coords = jsonMatch.match(/\[(-?\d{1,2}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/);
            if (coords) {
              const testLat = parseFloat(coords[1]);
              const testLon = parseFloat(coords[2]);
              // Validar que sean coordenadas razonables (latitud típica de Bolivia/Chile está entre -18 y -33)
              if (testLat >= -90 && testLat <= 90 && testLon >= -180 && testLon <= 180 &&
                  Math.abs(testLat) > 1 && Math.abs(testLon) > 1 &&
                  testLat < 0 && testLon < 0) { // Negativas para Sudamérica
                if (setCoords(coords[1], coords[2])) {
                  break;
                }
              }
            }
          }
        }
        
        // Formato 2: "center":[-17.xxx,-63.xxx] o "location":[-17.xxx,-63.xxx]
        if (lat === undefined || lon === undefined) {
          match = html.match(/"center":\[(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          if (match && setCoords(match[1], match[2])) {
            // Coordenadas encontradas
          } else {
            match = html.match(/"location":\[(-?\d+\.\d+),(-?\d+\.\d+)\]/);
            if (match && setCoords(match[1], match[2])) {
              // Coordenadas encontradas
            } else {
              // Formato 3: Buscar arrays de coordenadas [[lat,lon]]
              match = html.match(/\[\[(-?\d+\.\d+),(-?\d+\.\d+)\]/);
              if (match && setCoords(match[1], match[2])) {
                // Coordenadas encontradas
              } else {
                // Formato 4: Buscar en meta tags o otros lugares comunes
                match = html.match(/property="og:latitude" content="(-?\d+\.\d+)"/) ||
                        html.match(/property="place:location:latitude" content="(-?\d+\.\d+)"/);
                if (match) {
                  const latMatch = match[1];
                  const lonMatch = html.match(/property="og:longitude" content="(-?\d+\.\d+)"/) ||
                                 html.match(/property="place:location:longitude" content="(-?\d+\.\d+)"/);
                  if (lonMatch && setCoords(latMatch, lonMatch[1])) {
                    // Coordenadas encontradas en meta tags
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Si falla obtener el HTML, continuar sin coordenadas
        console.error('Error fetching HTML:', e.message);
      }
    }

    // Si aún no tenemos coordenadas, intentar con Puppeteer (último recurso)
    if (lat === undefined || lon === undefined) {
      try {
        console.log('Intentando obtener coordenadas con Puppeteer...');
        
        // Configuración para Puppeteer en Docker/Alpine
        const launchOptions = {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        };
        
        // Si está definida la variable de entorno, usar esa ruta
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
          launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }
        
        const browser = await puppeteer.launch(launchOptions);
        
        try {
          const page = await browser.newPage();
          
          // Configurar timeout para evitar que se quede colgado
          page.setDefaultTimeout(15000);
          page.setDefaultNavigationTimeout(15000);
          
          // Interceptar respuestas de red para capturar datos JSON que contengan coordenadas
          const coordinates = await Promise.race([
            new Promise(async (resolve) => {
              let foundCoords = null;
              
              // Interceptar respuestas de red
              page.on('response', async (response) => {
                try {
                  const url = response.url();
                  // Buscar en respuestas de API de Google Maps
                  if (url.includes('maps.googleapis.com') || url.includes('googleapis.com')) {
                    const text = await response.text();
                    // Buscar coordenadas en respuestas JSON
                    const coordMatch = text.match(/\[(-?\d{1,2}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/);
                    if (coordMatch && !foundCoords) {
                      const testLat = parseFloat(coordMatch[1]);
                      const testLon = parseFloat(coordMatch[2]);
                      if (testLat >= -90 && testLat <= 90 && testLon >= -180 && testLon <= 180 &&
                          Math.abs(testLat) > 1 && Math.abs(testLon) > 1) {
                        foundCoords = { lat: coordMatch[1], lon: coordMatch[2] };
                      }
                    }
                  }
                } catch (e) {
                  // Ignorar errores al leer respuestas
                }
              });
              
              await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: 15000 });
              
              // Esperar a que la página cargue completamente
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Intentar obtener coordenadas del DOM ejecutando JavaScript
              const domCoords = await page.evaluate(() => {
                // Buscar coordenadas en window object
                if (window.APP_INITIALIZATION_STATE) {
                  const state = window.APP_INITIALIZATION_STATE;
                  const stateStr = JSON.stringify(state);
                  const match = stateStr.match(/\[(-?\d{1,2}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/);
                  if (match) {
                    return { lat: match[1], lon: match[2] };
                  }
                }
                
                // Buscar en datos del mapa
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const script of scripts) {
                  const text = script.textContent || '';
                  const match = text.match(/\[(-?\d{1,2}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/);
                  if (match) {
                    const testLat = parseFloat(match[1]);
                    const testLon = parseFloat(match[2]);
                    if (testLat >= -90 && testLat <= 90 && testLon >= -180 && testLon <= 180 &&
                        Math.abs(testLat) > 1 && Math.abs(testLon) > 1) {
                      return { lat: match[1], lon: match[2] };
                    }
                  }
                }
                return null;
              });
              
              if (domCoords) {
                foundCoords = domCoords;
              }
              
              // Verificar si la URL cambió y ahora tiene coordenadas
              const currentUrl = page.url();
              const urlMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                              currentUrl.match(/!3d(-?\d+\.\d+).*?!4d(-?\d+\.\d+)/) ||
                              currentUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
              
              if (urlMatch && !foundCoords) {
                foundCoords = { lat: urlMatch[1], lon: urlMatch[2] };
                finalUrl = currentUrl;
              }
              
              // Si aún no encontramos, buscar en el HTML completo
              if (!foundCoords) {
                const pageContent = await page.content();
                const coordPattern = /\[(-?\d{1,2}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/g;
                let coordMatches;
                while ((coordMatches = coordPattern.exec(pageContent)) !== null) {
                  const testLat = parseFloat(coordMatches[1]);
                  const testLon = parseFloat(coordMatches[2]);
                  if (testLat >= -90 && testLat <= 90 && testLon >= -180 && testLon <= 180 &&
                      Math.abs(testLat) > 1 && Math.abs(testLon) > 1) {
                    foundCoords = { lat: coordMatches[1], lon: coordMatches[2] };
                    break;
                  }
                }
              }
              
              resolve(foundCoords);
            }),
            // Timeout después de 20 segundos
            new Promise((resolve) => setTimeout(() => resolve(null), 20000))
          ]);
          
          if (coordinates && setCoords(coordinates.lat, coordinates.lon)) {
            console.log('Coordenadas obtenidas con Puppeteer');
          }
        } finally {
          // Asegurarse de cerrar el browser incluso si hay errores
          try {
            await browser.close();
          } catch (closeError) {
            console.error('Error cerrando browser:', closeError.message);
          }
        }
      } catch (e) {
        console.error('Error con Puppeteer:', e.message);
        console.error('Stack:', e.stack);
      }
    }

    if (lat === undefined || lon === undefined) {
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
