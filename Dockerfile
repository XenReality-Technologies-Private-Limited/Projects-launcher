FROM node:25-trixie-slim AS builder
WORKDIR /root/xenreality
COPY . /root/xenreality/
RUN npm install && \
    npm run build

# To fix 404 routing issue, Read: https://stackoverflow.com/questions/43555282/react-js-application-showing-404-not-found-in-nginx-server
FROM nginx:1.29.4-alpine-slim
COPY --from=builder /root/xenreality/dist /usr/share/nginx/html
RUN cd /etc/nginx/conf.d \
    && awk '/index  index.html index.htm;/{print;print "        try_files $uri $uri/ $uri.html /index.html;";next}1' default.conf > tmp.conf \
    && mv tmp.conf default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
