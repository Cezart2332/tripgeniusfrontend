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

FROM nginx:stable-alpine AS production

COPY --from=build /usr/src/app/nginx /etc/nginx/conf.d
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Non-root nginx user; setcap allows binding to port 80 without running as root.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
	&& touch /var/run/nginx.pid \
	&& chown nginx:nginx /var/run/nginx.pid \
	&& apk add --no-cache libcap \
	&& setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx

USER nginx

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/health || exit 1
