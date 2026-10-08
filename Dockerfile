# Build the Vite app, then serve dist/ with nginx.
# VITE_API_URL is baked in at build time: docker build --build-arg VITE_API_URL=https://... .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:8000
ARG VITE_MOCK=false
ENV VITE_API_URL=$VITE_API_URL VITE_MOCK=$VITE_MOCK
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
