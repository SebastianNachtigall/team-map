FROM python:3.11.7-slim

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

# Copy the rest of the application
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5002
ENV FLASK_ENV=development
ENV FLASK_DEBUG=1

# Default command (can be overridden by docker-compose)
CMD ["gunicorn", "wsgi:application", "--bind", "0.0.0.0:$PORT", "--log-file", "-"]
