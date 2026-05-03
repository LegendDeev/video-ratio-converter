# Use official Node LTS on Debian slim (has apt for ffmpeg)
FROM node:20-slim

# Install ffmpeg (includes ffprobe)
RUN apt-get update && \
    apt-get install -y ffmpeg --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source files
COPY . .

# Create upload/output directories
RUN mkdir -p uploads outputs

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
