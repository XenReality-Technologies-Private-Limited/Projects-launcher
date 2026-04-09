FROM node:25-trixie-slim AS builder
WORKDIR /root/xenreality
COPY . /root/xenreality/
RUN npm install && \
    npm run build

# To fix 404 routing issue, Read: https://stackoverflow.com/questions/43555282/react-js-application-showing-404-not-found-in-nginx-server
FROM nginx:1.29.4-alpine-slim
COPY --from=builder /root/xenreality/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
