import 'dotenv/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is missing. Add your Neon PostgreSQL connection string to server/.env.'
  );
}

/**
 * PostgreSQL connection pool.
 * Neon requires an encrypted connection.
 */
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

/**
 * Reusable query helper.
 * Example:
 * const result = await query('SELECT * FROM students WHERE id = $1', [1]);
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, values);
}

/**
 * Runs multiple database operations in one transaction.
 * If any operation fails, all operations are rolled back.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates the application database tables and indexes.
 * This does not import or migrate any SQLite records.
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // USERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL
          CHECK (role IN ('admin', 'teacher', 'student')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // STUDENTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        admission_no VARCHAR(100) NOT NULL UNIQUE,
        full_name VARCHAR(180) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        gender VARCHAR(30),
        dob DATE,
        guardian_name VARCHAR(180),
        guardian_phone VARCHAR(50),
        guardian_email VARCHAR(255),
        address TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // TEACHERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(180) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        qualification VARCHAR(180),
        subjects TEXT,
        classes TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // CLASSES
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        level VARCHAR(100)
      );
    `);

    // SUBJECTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        class_name VARCHAR(100)
      );
    `);

    // ADMISSIONS
    await client.query(`
      CREATE TABLE IF NOT EXISTS admissions (
        id SERIAL PRIMARY KEY,
        applicant_name VARCHAR(180) NOT NULL,
        dob DATE,
        gender VARCHAR(30),
        class_applying VARCHAR(100),
        previous_school VARCHAR(180),
        guardian_name VARCHAR(180),
        guardian_phone VARCHAR(50),
        guardian_email VARCHAR(255),
        address TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // RESULTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL
          REFERENCES students(id) ON DELETE CASCADE,
        subject VARCHAR(150) NOT NULL,
        class_name VARCHAR(100),
        session VARCHAR(50),
        term VARCHAR(50),
        ca NUMERIC(8, 2) NOT NULL DEFAULT 0,
        exam NUMERIC(8, 2) NOT NULL DEFAULT 0,
        total NUMERIC(8, 2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'Draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // FEES
    await client.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL
          REFERENCES students(id) ON DELETE CASCADE,
        session VARCHAR(50),
        term VARCHAR(50),
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
        balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status VARCHAR(50)
      );
    `);

    // FEE PAYMENT HISTORY
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_payments (
        id SERIAL PRIMARY KEY,
        fee_id INTEGER NOT NULL
          REFERENCES fees(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL
          REFERENCES students(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(100),
        reference VARCHAR(180),
        notes TEXT,
        received_by INTEGER
          REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ANNOUNCEMENTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(220) NOT NULL,
        body TEXT NOT NULL,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Link student portal accounts to student records.
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS student_id INTEGER
      REFERENCES students(id) ON DELETE SET NULL;
    `);

    // One student record can only be linked to one portal account.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_unique
      ON users(student_id)
      WHERE student_id IS NOT NULL;
    `);

    // Prevent duplicate email addresses with different letter casing.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
      ON users(LOWER(email));
    `);

    // Useful indexes for common lookups.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_class_name
      ON students(class_name);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_results_student_id
      ON results(student_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fees_student_id
      ON fees(student_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fee_payments_fee_id
      ON fee_payments(fee_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id
      ON fee_payments(student_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admissions_status
      ON admissions(status);
    `);

    await client.query('COMMIT');

    console.log('PostgreSQL database tables and indexes are ready.');

    await createInitialAdmin();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates the first administrator using environment variables.
 *
 * Required:
 * INITIAL_ADMIN_NAME
 * INITIAL_ADMIN_EMAIL
 * INITIAL_ADMIN_PASSWORD
 *
 * If the administrator already exists, this function does not
 * replace the existing password or account details.
 */
async function createInitialAdmin(): Promise<void> {
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'Initial administrator details are missing. Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in server/.env.'
    );
  }

  if (password.length < 12) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD must contain at least 12 characters.'
    );
  }

  const existing = await query<{ id: number; role: string }>(
    `
      SELECT id, role
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [email]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].role !== 'admin') {
      throw new Error(
        'The INITIAL_ADMIN_EMAIL already belongs to a non-admin account. Choose a different email address.'
      );
    }

    console.log('Initial administrator already exists. No account changes made.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        active
      )
      VALUES ($1, $2, $3, 'admin', TRUE);
    `,
    [name, email, passwordHash]
  );

  console.log('Initial administrator account created successfully.');
}

/**
 * Gracefully closes the PostgreSQL connection pool.
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}