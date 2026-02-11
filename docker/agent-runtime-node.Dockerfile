FROM node:22-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.22 (download from official source)
RUN curl -fsSL https://go.dev/dl/go1.22.0.linux-amd64.tar.gz | tar -xz -C /usr/local

# Add Go to PATH
ENV PATH="/usr/local/go/bin:${PATH}"

# Install Playwright with Chromium
RUN npm install -g playwright && \
    playwright install chromium --with-deps

# Install pnpm
RUN npm install -g pnpm

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Keep container running
CMD ["tail", "-f", "/dev/null"]
