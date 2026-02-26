const { query } = require('../config/db');
const logger = require('../config/logger');

const runMigrations = async () => {
  try {
    logger.info('Running database migrations...');

    // Enable UUID extension
    await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Organizations table
    await query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        org_code CHAR(6) UNIQUE NOT NULL,
        admin_id UUID,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Users table
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('admin', 'employee');
        END IF;
      END $$
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'employee',
        organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        department VARCHAR(100),
        position VARCHAR(100),
        skills TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add foreign key to organizations.admin_id after users table exists
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_org_admin'
        ) THEN
          ALTER TABLE organizations
          ADD CONSTRAINT fk_org_admin
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // Employee join requests table
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
          CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END $$
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS employee_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        org_code CHAR(6) NOT NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        department VARCHAR(100),
        position VARCHAR(100),
        status request_status DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        processed_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Tasks table
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
          CREATE TYPE task_status AS ENUM ('assigned', 'in_progress', 'completed');
        END IF;
      END $$
    `);

    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
          CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
        END IF;
      END $$
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        status task_status DEFAULT 'assigned',
        priority task_priority DEFAULT 'medium',
        due_date TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // AI scores table
    await query(`
      CREATE TABLE IF NOT EXISTS ai_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        productivity_score DECIMAL(5,2) DEFAULT 0,
        task_completion_rate DECIMAL(5,2) DEFAULT 0,
        on_time_rate DECIMAL(5,2) DEFAULT 0,
        performance_trend VARCHAR(20) DEFAULT 'stable',
        recommendations TEXT[] DEFAULT '{}',
        last_calculated TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Blockchain logs table (Web3 workforce logging)
    await query(`
      CREATE TABLE IF NOT EXISTS blockchain_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,          -- 'task_completion' | 'payroll_event'
        transaction_hash VARCHAR(66),              -- Polygon tx hash (0x...)
        block_number VARCHAR(20),                  -- block number as string
        activity_hash VARCHAR(64),                 -- SHA-256 hex of the event data
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add wallet_address column to users if not exists
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'wallet_address'
        ) THEN
          ALTER TABLE users ADD COLUMN wallet_address VARCHAR(42);
        END IF;
      END $$
    `);

    // Indexes for performance
    await query(`CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_requests_org ON employee_requests(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_requests_status ON employee_requests(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_org_code ON organizations(org_code)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blockchain_logs_user ON blockchain_logs(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blockchain_logs_type ON blockchain_logs(event_type)`);

    logger.info('Database migrations completed successfully');
  } catch (err) {
    logger.error('Migration failed:', err);
    throw err;
  }
};

module.exports = { runMigrations };