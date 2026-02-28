docker build  -t iptv . && docker run -d \
  --name iptv-app \
  -p 7000:7000 \
  iptv:latest 