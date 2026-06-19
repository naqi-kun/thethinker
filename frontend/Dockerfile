FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite inlines VITE_* at build time, so the Google OAuth client ID must be a
# build arg (it's the public client ID — the secret stays backend-only). Supplied
# via compose build.args; without it the "Continue with Google" button is disabled.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf.template
EXPOSE 80
CMD ["/bin/sh", "-c", "export PORT=\"${PORT:-80}\" BACKEND_URL=\"${BACKEND_URL:-127.0.0.1:8081}\" && envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
