-- Cherry Studio Enterprise Database Initialization
-- This script runs when PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial system roles
-- Note: Actual schema will be created by Drizzle ORM migrations

-- Create admin user placeholder (actual user creation done through app)
-- This is just for initial database setup verification

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE cherry_studio TO cherry;

-- Create schema for organization
CREATE SCHEMA IF NOT EXISTS enterprise;
GRANT ALL ON SCHEMA enterprise TO cherry;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Cherry Studio Enterprise database initialized successfully';
END $$;
