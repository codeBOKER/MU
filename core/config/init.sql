-- PostgreSQL initialization for my-agent core
-- Executed on first database creation.

-- Extensions (tables are created by Alembic migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- The POSTGRES_USER below owns this database and is a superuser in the
-- official image, so no extra GRANT is needed (the DB name is configurable).
