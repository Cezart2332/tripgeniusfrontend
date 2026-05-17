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

# 1. Ștergem absolut orice configurație default a Nginx-ului
RUN rm -rf /etc/nginx/conf.d/*

# 2. Copiem fișierul tău de configurare și îl redenumim explicit în default.conf
# NOTĂ: Dacă în repo-ul tău fișierul de Nginx se află direct în folderul "nginx" 
# și se numește "nginx.conf", folosește linia de mai jos:
COPY --from=build /usr/src/app/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# (Alternativă: dacă fișierul tău din repo se numește doar "nginx" fără extensie,
# comanda ar fi: COPY --from=build /usr/src/app/nginx /etc/nginx/conf.d/default.conf)

# 3. Copiem fișierele de frontend din etapa de build
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]