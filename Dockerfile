FROM node:25-alpine AS build

WORKDIR /usr/src/app

ARG VITE_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_OPEN_TRIP_MAP
ARG VITE_VAPID_PUBLIC_KEY

ENV VITE_BASE_URL=$VITE_BASE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_OPEN_TRIP_MAP=$VITE_OPEN_TRIP_MAP \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

COPY package*.json package-lock.json ./

RUN npm ci --legacy-peer-deps

COPY ./ ./

RUN npm run build

# ─────────────────────────────
# ETAPA DE PRODUCȚIE (NGINX)
# ─────────────────────────────
FROM nginx:stable-alpine AS production

# 1. Ștergem absolut orice configurație default a Nginx-ului pentru a evita conflictele
RUN rm -rf /etc/nginx/conf.d/*

# 2. Copiem fișierul tău "nginx" din rădăcina proiectului și îl redenumim în "default.conf"
COPY --from=build /usr/src/app/nginx /etc/nginx/conf.d/default.conf

# 3. Copiem fișierele de frontend din etapa de build
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]