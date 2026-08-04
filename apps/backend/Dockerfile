FROM node:20-alpine

# Install OpenSSL and libc6-compat for Prisma binary compatibility on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy root lockfile and workspace configurations
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/

# Install workspace dependencies
RUN npm ci --workspace=apps/backend

# Copy backend source code
COPY apps/backend ./apps/backend

# Generate Prisma client and compile NestJS application
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma
RUN npm run build --workspace=apps/backend

EXPOSE 4000

# Start production server
CMD ["npm", "run", "start:prod", "--workspace=apps/backend"]
