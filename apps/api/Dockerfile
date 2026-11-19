# Imagen de la API. Alternativa portable al blueprint de Render (Fly, Railway, etc.).
FROM node:22-alpine
WORKDIR /app

# Monorepo: instalamos solo el workspace de la API con sus dependencias runtime.
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm ci --workspace apps/api --omit=dev && npm cache clean --force

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["npm", "start", "--workspace", "apps/api"]
