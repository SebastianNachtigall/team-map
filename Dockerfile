# Base stage for both development and production
FROM python:3.11.7-slim as base
WORKDIR /app

# Install node and npm
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install them
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy package files and install npm dependencies
COPY package*.json .
RUN npm install

# Development stage
FROM base as development
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=development
ENV FLASK_DEBUG=1
ENV PORT=5002

# Copy the rest of the application for development
COPY . .

# Production stage
FROM base as production
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production
ENV PORT=${PORT:-5002}

# Copy the rest of the application
COPY . .

# Build frontend assets
RUN npm run build

# Set the default command
CMD ["python", "app.py"]
