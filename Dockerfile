# Run build-all.ps1 (Windows) or build-all.sh (Linux) before building this image.
# The _deploy/ directory must exist and contain all built PoC assets.
FROM nginx:1.29.4-alpine-slim
COPY _deploy/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
