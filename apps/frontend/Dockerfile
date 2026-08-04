FROM node:20-alpine AS builder
WORKDIR /app

# Copy root lockfile and workspace configurations
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/

# Install workspace dependencies
RUN npm ci --workspace=apps/frontend

# Copy frontend source code
COPY apps/frontend ./apps/frontend

# Build-time environment variables mapping
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL
ENV NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

# Compile Next.js production build
RUN npm run build --workspace=apps/frontend

FROM node:20-alpine
WORKDIR /app

# Copy built assets and dependencies from builder stage
COPY --from=builder /app ./

EXPOSE 3300

# Start production Next.js server
CMD ["npm", "run", "start", "--workspace=apps/frontend"]
