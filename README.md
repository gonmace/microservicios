# microservicios

docker build -t magoreal/shortlink:1.0 .

docker run -d \
  --name shortlink \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  magoreal/shortlink:1.0
