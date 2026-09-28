-- ============================================================================
-- Synthex Studio: PostgreSQL Cloud SQL Production Schema with pgvector
-- Multi-Tenant Data Architecture for Organizations, Users, and Projects
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ----------------------------------------------------------------------------
-- 1. Users & Accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    clerk_id VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    stripe_customer_id VARCHAR(128) UNIQUE,
    subscription_tier VARCHAR(32) NOT NULL DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'byok', 'pro', 'team')),
    subscription_status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
    context_credits INTEGER NOT NULL DEFAULT 100 CHECK (context_credits >= 0),
    trial_ends_at BIGINT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- ----------------------------------------------------------------------------
-- 2. Context Credits Transaction Ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    action VARCHAR(64) NOT NULL,
    balance_after INTEGER NOT NULL,
    metadata JSONB,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON credit_transactions(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Projects (Workspaces)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    organization_id VARCHAR(128),
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);

-- ----------------------------------------------------------------------------
-- 4. Knowledge Graph Nodes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
    id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    organization_id VARCHAR(128),
    type VARCHAR(32) NOT NULL,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    width DOUBLE PRECISION,
    height DOUBLE PRECISION,
    color VARCHAR(32),
    title TEXT NOT NULL,
    content TEXT,
    items JSONB,
    image_url TEXT,
    caption TEXT,
    url TEXT,
    domain VARCHAR(255),
    description TEXT,
    section_id VARCHAR(64),
    file_data TEXT,
    file_name VARCHAR(255),
    file_size BIGINT,
    file_type VARCHAR(32),
    page_count INTEGER,
    metadata JSONB,
    embedding vector(1536), -- text-embedding-3-small (1536-dimensional)
    created_at BIGINT NOT NULL,
    PRIMARY KEY (project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_user ON nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
-- HNSW index for ultra-fast cosine similarity vector search
CREATE INDEX IF NOT EXISTS idx_nodes_embedding_hnsw ON nodes USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- 5. Knowledge Graph Connections (Relationships)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connections (
    id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    organization_id VARCHAR(128),
    from_node VARCHAR(64) NOT NULL,
    to_node VARCHAR(64) NOT NULL,
    label VARCHAR(64),
    arrowhead VARCHAR(32) DEFAULT 'end',
    line_style VARCHAR(32) DEFAULT 'curved',
    stroke_pattern VARCHAR(32) DEFAULT 'solid',
    color VARCHAR(32) DEFAULT 'neutral',
    animated BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    PRIMARY KEY (project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_connections_project ON connections(project_id);
CREATE INDEX IF NOT EXISTS idx_connections_endpoints ON connections(project_id, from_node, to_node);

-- ----------------------------------------------------------------------------
-- 6. Research Sessions & Audit Trails
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_sessions (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    organization_id VARCHAR(128),
    query TEXT NOT NULL,
    mode VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    summary TEXT NOT NULL,
    trail JSONB NOT NULL,
    changes JSONB NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_sessions_project ON research_sessions(project_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Graph Revisions (Undo/Redo & Point-in-Time Checkpoints)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS graph_revisions (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    node_count INTEGER NOT NULL,
    edge_count INTEGER NOT NULL,
    graph_data JSONB NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graph_revisions_project ON graph_revisions(project_id, created_at DESC);
