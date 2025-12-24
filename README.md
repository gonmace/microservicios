# microservicios

docker build -t magoreal/shortlink:1.0 .

docker run -d \
  --name shortlink \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  magoreal/shortlink:1.0

sudo cp ms.magoreal.com /etc/nginx/sites-available/

sudo ln -s /etc/nginx/sites-available/ms.magoreal.com /etc/nginx/sites-enabled/

sudo nginx -t

sudo systemctl reload nginx

sudo certbot --nginx -d ms.magoreal.com

curl https://ms.magoreal.com/health

curl -X POST https://ms.magoreal.com/shortlink -H "Content-Type: application/json" -d '{"query":"https://maps.app.goo.gl/kKWq7eRUpJPtMYJL9"}'
