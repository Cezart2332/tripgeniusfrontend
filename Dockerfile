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
