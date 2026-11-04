# Dockerfile untuk Sistem Kantin SMPN 77
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Salin package.json
COPY package*.json ./

# Install dependensi (termasuk build tools untuk sqlite3 jika diperlukan)
RUN apk add --no-cache python3 make g++ && \
    npm install --production && \
    apk del python3 make g++

# Salin seluruh file aplikasi
COPY . .

# Expose port
EXPOSE 3000

# Volume untuk persistensi file database SQLite
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/kantin77.db
ENV PORT=3000

# Jalankan server
CMD ["node", "server.js"]
