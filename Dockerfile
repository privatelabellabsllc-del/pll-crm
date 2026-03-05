FROM node:20-alpine

WORKDIR /app

# Install server deps
COPY server/package.json server/
RUN cd server && npm install --production

# Install client deps and build
COPY client/package.json client/
RUN cd client && npm install
COPY client/ client/
RUN cd client && npm run build

# Copy server code
COPY server/ server/

# Create data directory
RUN mkdir -p data

ENV PORT=3001
ENV NODE_ENV=production
ENV JWT_SECRET=change-me-in-production

EXPOSE 3001

CMD ["node", "server/index.js"]
