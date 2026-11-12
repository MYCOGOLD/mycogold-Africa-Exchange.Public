FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN addgroup -S mycg && adduser -S mycg -G mycg
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
USER mycg
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget --spider -q http://localhost:3000/api/mycg/health || exit 1
CMD ["npm", "start"]