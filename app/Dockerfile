FROM node:22-alpine

WORKDIR /docker_root

RUN corepack enable && corepack prepare pnpm@10 --activate

# Root project (core/ RAG engine + its dependencies: @langchain/*, chromadb, openai, ...)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# App project (SvelteKit frontend) — separate pnpm project with its own lockfile.
WORKDIR /docker_root/app
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Source code. node_modules from the install steps above survive (Docker merges dirs, not replaces).
WORKDIR /docker_root
COPY app/ ./app/
COPY core/ ./core/
COPY rag.config.ts ./

WORKDIR /docker_root/app
RUN pnpm run build

EXPOSE 3000
CMD ["node", "build"]