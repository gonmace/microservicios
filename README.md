# Microservicios

Microservicio que resuelve URLs cortas de Google Maps y extrae las coordenadas (latitud y longitud).

## Desarrollo Local (sin Docker)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar el servidor
```bash
# Opción 1: Usando npm
npm start

# Opción 2: Directamente con Node.js
node index.js
```

El servidor se ejecutará en `http://localhost:3000`

**Nota:** Para desarrollo con auto-reload, puedes instalar `nodemon` globalmente y ejecutar `nodemon index.js`

## Endpoints

### Health Check
Verifica que el servicio esté funcionando:

```bash
curl http://localhost:3000/health
```

Respuesta:
```json
{
  "status": "ok"
}
```

### Resolver URL corta de Google Maps
Convierte una URL corta de Google Maps en coordenadas:

```bash
curl -X POST http://localhost:3000/shortlink \
  -H "Content-Type: application/json" \
  -d '{"query":"https://maps.app.goo.gl/kKWq7eRUpJPtMYJL9"}'
```

Respuesta exitosa:
```json
{
  "resolved_url": "https://www.google.com/maps/@-34.603722,-58.381592,15z",
  "lat": -34.603722,
  "lon": -58.381592
}
```

Respuesta con error (si no se encuentran coordenadas):
```json
{
  "resolved_url": "https://www.google.com/maps/...",
  "error": "No se encontraron coordenadas"
}
```

## Despliegue con Docker


### 1. Construir la imagen
```bash
docker build -t magoreal/shortlink:1.0 .
```

### 2. Ejecutar el contenedor
```bash
docker run -d \
  --name shortlink \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  magoreal/shortlink:1.0
```

### 3. Configurar Nginx (opcional)
```bash
sudo cp ms.magoreal.com /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/ms.magoreal.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d ms.magoreal.com
```

### 4. Probar el servicio desplegado
```bash
curl https://ms.magoreal.com/health
curl -X POST https://ms.magoreal.com/shortlink \
  -H "Content-Type: application/json" \
  -d '{"query":"https://maps.app.goo.gl/kKWq7eRUpJPtMYJL9"}'
```



```bash
git pull
docker build -t magoreal/shortlink:latest .
docker stop shortlink
docker rm shortlink
docker run -d --name shortlink -p 127.0.0.1:3000:3000 --restart unless-stopped magoreal/shortlink:latest
```