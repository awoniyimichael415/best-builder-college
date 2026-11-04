
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  pool,
  query,
  withTransaction,
  initializeDatabase,
} from './db.js';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;

if (!configuredSecret || configuredSecret.length < 32) {
  if (isProduction) {
    throw new Error('Production requires a JWT_SECRET of at least 32 characters.');
  }
  console.warn('WARNING: Set a strong JWT_SECRET in server/.env before deployment.');
}

const JWT_SECRET = configuredSecret || 'development-only-change-this-secret';
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

type Role = 'admin' | 'teacher' | 'student';

type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  student_id: number | null;
};

type AuthRequest = Request & {
  user?: AuthUser;
};

const validRoles: Role[] = ['admin', 'teacher', 'student'];

function validId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, min = 1, max = 200): value is string {
  return typeof value === 'string' &&
    value.trim().length >= min &&
    value.trim().length <= max;
}

function numberInRange(value: unknown, min: number, max: number): boolean {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

function isEmail(value: unknown): boolean {
  return typeof value === 'string' &&
    z.string().email().safeParse(value).success;
}

function sendDatabaseError(res: Response, error: unknown) {
  const code = (error as any)?.code;

  if (code === '23505') {
    return res.status(409).json({
      error: 'A record with the same unique value already exists.',
    });
  }

  if (code === '23503') {
    return res.status(400).json({
      error: 'The selected related record does not exist or cannot be used.',
    });
  }

  if (code === '23514') {
    return res.status(400).json({
      error: 'The supplied information violates a database rule.',
    });
  }

  console.error('Database operation failed:', error);

  return res.status(400).json({
    error: 'The operation could not be completed. Check the supplied information.',
  });
}

function normalizeResourceData(
  key: string,
  input: Record<string, any>,
  allowedFields: string[],
): { data?: Record<string, any>; error?: string } {
  const data: Record<string, any> = {};

  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) {
      return { error: `The field "${field}" is not allowed.` };
    }
    data[field] = input[field];
  }

  const textFields = [
    'admission_no', 'full_name', 'class_name', 'gender', 'dob',
    'guardian_name', 'guardian_phone', 'guardian_email', 'address',
    'phone', 'email', 'qualification', 'subjects', 'classes', 'name',
    'level', 'applicant_name', 'class_applying', 'previous_school',
    'title', 'body', 'subject', 'session', 'term', 'status',
  ];

  for (const field of textFields) {
    if (Object.hasOwn(data, field)) {
      if (typeof data[field] !== 'string') {
        return { error: `The field "${field}" must be text.` };
      }
      data[field] = data[field].trim();
    }
  }

  const maxLengths: Record<string, number> = {
    admission_no: 60,
    full_name: 150,
    class_name: 100,
    gender: 30,
    dob: 30,
    guardian_name: 150,
    guardian_phone: 40,
    guardian_email: 254,
    address: 1000,
    phone: 40,
    email: 254,
    qualification: 200,
    subjects: 500,
    classes: 500,
    name: 150,
    level: 100,
    applicant_name: 150,
    class_applying: 100,
    previous_school: 200,
    title: 200,
    body: 5000,
    subject: 150,
    session: 50,
    term: 50,
    status: 30,
  };

  for (const [field, max] of Object.entries(maxLengths)) {
    if (typeof data[field] === 'string' && data[field].length > max) {
      return { error: `The field "${field}" is too long.` };
    }
  }

  for (const field of ['email', 'guardian_email']) {
    if (
      Object.hasOwn(data, field) &&
      data[field] !== '' &&
      !isEmail(data[field])
    ) {
      return { error: `Enter a valid ${field.replace('_', ' ')}.` };
    }
  }

  // PostgreSQL BOOLEAN columns use true/false, not SQLite 1/0.
  for (const field of ['active', 'published']) {
    if (Object.hasOwn(data, field)) {
      if (![0, 1, '0', '1', true, false].includes(data[field])) {
        return { error: `${field} must be either true or false.` };
      }
      data[field] = data[field] === true ||
        data[field] === 1 ||
        data[field] === '1';
    }
  }

  for (const field of [
    'student_id', 'ca', 'exam', 'total', 'amount', 'paid', 'balance',
  ]) {
    if (Object.hasOwn(data, field)) {
      if (
        data[field] === '' ||
        data[field] === null ||
        data[field] === undefined ||
        !Number.isFinite(Number(data[field]))
      ) {
        return { error: `The field "${field}" must be a valid number.` };
      }
      data[field] = Number(data[field]);
    }
  }

  if (Object.hasOwn(data, 'student_id')) {
    const studentId = validId(data.student_id);
    if (!studentId) return { error: 'Select a valid student.' };
    data.student_id = studentId;
  }

  // Empty optional dates must become SQL NULL, not an empty string.
  for (const field of ['dob']) {
    if (Object.hasOwn(data, field)) {
      if (data[field] === '') {
        data[field] = null;
      } else if (
        typeof data[field] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data[field]) ||
        Number.isNaN(Date.parse(`${data[field]}T00:00:00Z`))
      ) {
        return { error: 'Enter a valid date in YYYY-MM-DD format.' };
      }
    }
  }

  if (key === 'students') {
    if (
      Object.hasOwn(data, 'admission_no') &&
      !requiredText(data.admission_no, 1, 60)
    ) return { error: 'Enter a valid admission number.' };

    if (
      Object.hasOwn(data, 'full_name') &&
      !requiredText(data.full_name, 2, 150)
    ) return { error: 'Student name must contain at least 2 characters.' };

    if (
      Object.hasOwn(data, 'class_name') &&
      !requiredText(data.class_name, 1, 100)
    ) return { error: 'Enter a valid class name.' };
  }

  if (key === 'results') {
    for (const field of ['ca', 'exam']) {
      if (Object.hasOwn(data, field) && !numberInRange(data[field], 0, 100)) {
        return { error: `${field.toUpperCase()} score must be between 0 and 100.` };
      }
    }

    if (
      Object.hasOwn(data, 'status') &&
      !['Draft', 'Submitted', 'Approved', 'Rejected'].includes(data.status)
    ) return { error: 'Invalid result status.' };
  }

  if (key === 'fees') {
    for (const field of ['amount', 'paid']) {
      if (
        Object.hasOwn(data, field) &&
        !numberInRange(data[field], 0, 100000000000)
      ) return { error: `${field} must be a valid non-negative amount.` };
    }
  }

  if (
    key === 'admissions' &&
    Object.hasOwn(data, 'status') &&
    !['Pending', 'Approved', 'Rejected'].includes(data.status)
  ) {
    return { error: 'Invalid admission status.' };
  }

  return { data };
}

// Authentication is asynchronous because PostgreSQL queries are asynchronous.
async function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in.' });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.id !== 'number' ||
      !Number.isSafeInteger(payload.id)
    ) {
      return res.status(401).json({
        error: 'Invalid session. Please sign in again.',
      });
    }

    const result = await query(
      `SELECT id, name, email, role, student_id
       FROM users
       WHERE id = $1 AND active = TRUE`,
      [payload.id],
    );

    const user = result.rows[0];

    if (!user || !validRoles.includes(user.role as Role)) {
      return res.status(401).json({
        error: 'Your account is unavailable. Please sign in again.',
      });
    }

    req.user = {
      id: Number(user.id),
      name: String(user.name),
      email: String(user.email),
      role: user.role as Role,
      student_id: user.student_id == null ? null : Number(user.student_id),
    };

    return next();
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid session. Please sign in again.',
      });
    }

    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please sign in again.',
      });
    }

    console.error('Authentication failed:', error);
    return res.status(500).json({
      error: 'Could not verify your session.',
    });
  }
}

function roles(...allowed: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: 'You do not have permission for this action.',
      });
    }
    return next();
  };
}

// HEALTH
app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({
      ok: true,
      database: 'connected',
      service: 'Best Builder College Portal API',
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(503).json({
      ok: false,
      database: 'unavailable',
      service: 'Best Builder College Portal API',
    });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  const parsed = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(200),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter a valid email and password.',
    });
  }

  try {
    const email = parsed.data.email.toLowerCase();

    const result = await query(
      `SELECT id, name, email, role, password_hash, student_id
       FROM users
       WHERE LOWER(email) = $1 AND active = TRUE`,
      [email],
    );

    const user = result.rows[0];

    if (
      !user ||
      !validRoles.includes(user.role as Role) ||
      typeof user.password_hash !== 'string' ||
      !(await bcrypt.compare(parsed.data.password, user.password_hash))
    ) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    const studentId = user.student_id == null
      ? null
      : Number(user.student_id);

    if (user.role === 'student') {
      if (!studentId) {
        return res.status(403).json({
          error: 'Your student account is not linked to a student record. Please contact the school administrator.',
        });
      }

      const student = await query(
        'SELECT id FROM students WHERE id = $1 AND active = TRUE',
        [studentId],
      );

      if (!student.rows[0]) {
        return res.status(403).json({
          error: 'Your student record is inactive or unavailable. Please contact the school administrator.',
        });
      }
    }

    const token = jwt.sign(
      { id: Number(user.id) },
      JWT_SECRET,
      { expiresIn: '8h' },
    );

    return res.json({
      token,
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: studentId,
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({
      error: 'Could not sign in. Please try again.',
    });
  }
});

app.get('/api/auth/me', auth, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

// STUDENT PROFILE
app.get('/api/student/profile', auth, roles('student'), async (req: AuthRequest, res) => {
  const studentId = req.user?.student_id;

  if (!studentId) {
    return res.status(403).json({
      error: 'Your account is not linked to a student record. Please contact the school administrator.',
    });
  }

  try {
    const result = await query(
      `SELECT id, admission_no, full_name, class_name, gender, dob,
              guardian_name, guardian_phone, guardian_email, address, active
       FROM students
       WHERE id = $1 AND active = TRUE`,
      [studentId],
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        error: 'Your student profile could not be found. Please contact the school administrator.',
      });
    }

    return res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error('Student profile request failed:', error);
    return res.status(500).json({
      error: 'Could not load your student profile.',
    });
  }
});

const studentProfileUpdateSchema = z.object({
  address: z.string().trim().max(1000).optional(),
  guardian_name: z.string().trim().min(2).max(150).optional(),
  guardian_phone: z.string().trim().min(7).max(40).optional(),
  guardian_email: z.union([
    z.string().trim().email().max(254),
    z.literal(''),
  ]).optional(),
}).strict().refine(data => Object.keys(data).length > 0, {
  message: 'Provide at least one profile field to update.',
});

app.patch('/api/student/profile', auth, roles('student'), async (req: AuthRequest, res) => {
  const studentId = req.user?.student_id;

  if (!studentId) {
    return res.status(403).json({
      error: 'Your account is not linked to a student record.',
    });
  }

  const parsed = studentProfileUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter valid profile information. Only address and guardian contact details can be changed.',
    });
  }

  try {
    const data = parsed.data;
    const fields = Object.keys(data) as Array<keyof typeof data>;

    const values = fields.map(field => data[field] ?? null);
    const assignments = fields.map(
      (field, index) => `${String(field)} = $${index + 1}`,
    );

    values.push(String(studentId));

    const updated = await query(
      `UPDATE students
       SET ${assignments.join(', ')}
       WHERE id = $${values.length} AND active = TRUE
       RETURNING id, admission_no, full_name, class_name, gender, dob,
                 guardian_name, guardian_phone, guardian_email, address, active`,
      values,
    );

    if (!updated.rows[0]) {
      return res.status(404).json({
        error: 'Your student profile could not be found.',
      });
    }

    return res.json({
      message: 'Your profile has been updated.',
      profile: updated.rows[0],
    });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

// STUDENT PASSWORD CHANGE
app.post('/api/student/change-password', auth, roles('student'), async (req: AuthRequest, res) => {
  const parsed = z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  }).strict().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter your current password and a new password of at least 8 characters.',
    });
  }

  try {
    const result = await query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1 AND active = TRUE AND role = 'student'`,
      [req.user!.id],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        error: 'Your account could not be found.',
      });
    }

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.password_hash))) {
      return res.status(400).json({
        error: 'Your current password is incorrect.',
      });
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return res.status(400).json({
        error: 'Choose a new password different from your current password.',
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2 AND role = 'student'`,
      [passwordHash, req.user!.id],
    );

    return res.json({
      message: 'Your password has been changed successfully. Please use the new password next time you sign in.',
    });
  } catch (error) {
    console.error('Student password change failed:', error);
    return res.status(500).json({
      error: 'Could not change your password. Please try again.',
    });
  }
});

// FEE PAYMENT SCHEMA
const feePaymentSchema = z.object({
  amount: z.coerce.number().finite().positive().max(100000000000),
  payment_method: z.enum([
    'Cash', 'Bank Transfer', 'POS', 'Online', 'Cheque', 'Other',
  ]).default('Cash'),
  reference: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
}).strict();

// FEE PAYMENT HISTORY
app.get('/api/fees/:id/payments', auth, async (req: AuthRequest, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Invalid fee record ID.' });
  }

  const user = req.user!;

  if (user.role !== 'admin' && user.role !== 'student') {
    return res.status(403).json({
      error: 'You do not have permission to view payment history.',
    });
  }

  if (user.role === 'student' && !user.student_id) {
    return res.status(403).json({
      error: 'Your account is not linked to a student record.',
    });
  }

  try {
    const fee = user.role === 'admin'
      ? await query(
          'SELECT id, student_id FROM fees WHERE id = $1',
          [id],
        )
      : await query(
          'SELECT id, student_id FROM fees WHERE id = $1 AND student_id = $2',
          [id, user.student_id],
        );

    if (!fee.rows[0]) {
      return res.status(404).json({ error: 'Fee record not found.' });
    }

    const payments = await query(
      `SELECT p.id, p.fee_id, p.student_id, p.amount, p.payment_method,
              p.reference, p.notes, p.created_at,
              u.name AS received_by_name
       FROM fee_payments p
       LEFT JOIN users u ON u.id = p.received_by
       WHERE p.fee_id = $1 AND p.student_id = $2
       ORDER BY p.id DESC`,
      [id, fee.rows[0].student_id],
    );

    return res.json({ payments: payments.rows });
  } catch (error) {
    console.error('Could not load fee payment history:', error);
    return res.status(500).json({
      error: 'Could not load payment history.',
    });
  }
});

// RECORD FEE PAYMENT: ledger and fee summary update atomically.
app.post('/api/fees/:id/payments', auth, roles('admin'), async (req: AuthRequest, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Invalid fee record ID.' });
  }

  const parsed = feePaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter a valid positive payment amount, payment method, reference and notes.',
    });
  }

  const amount = Math.round(parsed.data.amount * 100) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      error: 'Payment amount must be greater than zero.',
    });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Lock the fee row to prevent concurrent overpayments.
      const feeResult = await client.query(
        'SELECT * FROM fees WHERE id = $1 FOR UPDATE',
        [id],
      );

      const fee = feeResult.rows[0];

      if (!fee) return { error: 'not_found' as const };

      const currentAmount = Math.round(Number(fee.amount) * 100) / 100;
      const currentPaid = Math.round(Number(fee.paid || 0) * 100) / 100;
      const balance = Math.round((currentAmount - currentPaid) * 100) / 100;

      if (balance <= 0) return { error: 'already_paid' as const };
      if (amount > balance) {
        return { error: 'exceeds_balance' as const, balance };
      }

      const nextPaid = Math.round((currentPaid + amount) * 100) / 100;
      const nextBalance = Math.round((currentAmount - nextPaid) * 100) / 100;

      const nextStatus = nextBalance === 0
        ? 'Paid'
        : nextPaid === 0
          ? 'Unpaid'
          : 'Partially Paid';

      const paymentResult = await client.query(
        `INSERT INTO fee_payments (
          fee_id, student_id, amount, payment_method,
          reference, notes, received_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          id,
          Number(fee.student_id),
          amount,
          parsed.data.payment_method,
          parsed.data.reference,
          parsed.data.notes,
          req.user!.id,
        ],
      );

      await client.query(
        `UPDATE fees
         SET paid = $1, balance = $2, status = $3
         WHERE id = $4`,
        [nextPaid, nextBalance, nextStatus, id],
      );

      const paymentDetails = await client.query(
        `SELECT p.id, p.fee_id, p.student_id, p.amount,
                p.payment_method, p.reference, p.notes,
                p.created_at, u.name AS received_by_name
         FROM fee_payments p
         LEFT JOIN users u ON u.id = p.received_by
         WHERE p.id = $1`,
        [paymentResult.rows[0].id],
      );

      const updatedFee = await client.query(
        'SELECT * FROM fees WHERE id = $1',
        [id],
      );

      return {
        payment: paymentDetails.rows[0],
        fee: updatedFee.rows[0],
      } as const;
    });

    if ('error' in result) {
      if (result.error === 'not_found') {
        return res.status(404).json({ error: 'Fee record not found.' });
      }

      if (result.error === 'already_paid') {
        return res.status(400).json({
          error: 'This fee record has no outstanding balance.',
        });
      }

      return res.status(400).json({
        error: `Payment exceeds the outstanding balance of ${Number(result.balance ?? 0).toFixed(2)}.`,
      });
    }

    return res.status(201).json({
      message: 'Payment recorded successfully.',
      payment: result.payment,
      fee: result.fee,
    });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

// PUBLIC ADMISSIONS
const admissionSchema = z.object({
  applicant_name: z.string().trim().min(2).max(150),
  dob: z.string().max(30).optional(),
  gender: z.string().max(30).optional(),
  class_applying: z.string().trim().min(1).max(100),
  previous_school: z.string().max(200).optional(),
  guardian_name: z.string().trim().min(2).max(150),
  guardian_phone: z.string().trim().min(7).max(40),
  guardian_email: z.union([
    z.string().trim().email().max(254),
    z.literal(''),
  ]).optional(),
  address: z.string().max(1000).optional(),
}).strict();

app.post('/api/admissions', async (req, res) => {
  const parsed = admissionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Please complete the required admission fields with valid information.',
    });
  }

  const d = parsed.data;

  const dob = d.dob?.trim() || null;

  if (
    dob &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
      Number.isNaN(Date.parse(`${dob}T00:00:00Z`)))
  ) {
    return res.status(400).json({
      error: 'Enter a valid date of birth.',
    });
  }

  try {
    const result = await query(
      `INSERT INTO admissions (
        applicant_name, dob, gender, class_applying, previous_school,
        guardian_name, guardian_phone, guardian_email, address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        d.applicant_name,
        dob,
        d.gender || '',
        d.class_applying,
        d.previous_school || '',
        d.guardian_name,
        d.guardian_phone,
        d.guardian_email || '',
        d.address || '',
      ],
    );

    return res.status(201).json({
      id: result.rows[0].id,
      message: 'Application received. The school will review it.',
    });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

// DASHBOARD
app.get('/api/dashboard', auth, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === 'admin';

    const [
      students,
      teachers,
      classes,
      pendingAdmissions,
      announcements,
      recentAdmissions,
    ] = await Promise.all([
      query('SELECT COUNT(*)::int AS n FROM students WHERE active = TRUE'),
      query('SELECT COUNT(*)::int AS n FROM teachers WHERE active = TRUE'),
      query('SELECT COUNT(*)::int AS n FROM classes'),
      query(
        "SELECT COUNT(*)::int AS n FROM admissions WHERE status = 'Pending'",
      ),
      query(
        `SELECT * FROM announcements
         WHERE published = TRUE
         ORDER BY id DESC LIMIT 5`,
      ),
      isAdmin
        ? query(
            `SELECT id, applicant_name, class_applying, status, created_at
             FROM admissions ORDER BY id DESC LIMIT 5`,
          )
        : Promise.resolve({ rows: [] }),
    ]);

    return res.json({
      students: students.rows[0].n,
      teachers: teachers.rows[0].n,
      classes: classes.rows[0].n,
      pendingAdmissions: pendingAdmissions.rows[0].n,
      announcements: announcements.rows,
      recentAdmissions: recentAdmissions.rows,
    });
  } catch (error) {
    console.error('Dashboard request failed:', error);
    return res.status(500).json({
      error: 'Could not load the dashboard.',
    });
  }
});

// RESOURCE CONFIGURATION
type ResourceConfig = {
  table: string;
  fields: string[];
  adminOnly?: boolean;
};

const resources: Record<string, ResourceConfig> = {
  students: {
    table: 'students',
    fields: [
      'admission_no', 'full_name', 'class_name', 'gender', 'dob',
      'guardian_name', 'guardian_phone', 'guardian_email', 'address', 'active',
    ],
  },
  teachers: {
    table: 'teachers',
    fields: [
      'full_name', 'phone', 'email', 'qualification',
      'subjects', 'classes', 'active',
    ],
    adminOnly: true,
  },
  classes: {
    table: 'classes',
    fields: ['name', 'level'],
    adminOnly: true,
  },
  subjects: {
    table: 'subjects',
    fields: ['name', 'class_name'],
    adminOnly: true,
  },
  admissions: {
    table: 'admissions',
    fields: [
      'applicant_name', 'dob', 'gender', 'class_applying',
      'previous_school', 'guardian_name', 'guardian_phone',
      'guardian_email', 'address', 'status',
    ],
    adminOnly: true,
  },
  results: {
    table: 'results',
    fields: [
      'student_id', 'subject', 'class_name', 'session',
      'term', 'ca', 'exam', 'total', 'status',
    ],
  },
  fees: {
    table: 'fees',
    fields: [
      'student_id', 'session', 'term', 'amount',
      'paid', 'balance', 'status',
    ],
    adminOnly: true,
  },
  announcements: {
    table: 'announcements',
    fields: ['title', 'body', 'published'],
    adminOnly: true,
  },
};

// CREATE STUDENT PORTAL ACCOUNT
const createStudentAccountSchema = z.object({
  email: z.string().trim().email().max(254),
  temporaryPassword: z.string().min(8).max(200),
}).strict();

app.post('/api/students/:id/account', auth, roles('admin'), async (req: AuthRequest, res) => {
  const studentId = validId(req.params.id);

  if (!studentId) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }

  const parsed = createStudentAccountSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter a valid login email and a temporary password of at least 8 characters.',
    });
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const passwordHash = await bcrypt.hash(
      parsed.data.temporaryPassword,
      12,
    );

    const result = await withTransaction(async (client) => {
      const studentResult = await client.query(
        `SELECT id, full_name, admission_no, active
         FROM students
         WHERE id = $1
         FOR UPDATE`,
        [studentId],
      );

      const student = studentResult.rows[0];

      if (!student) return { error: 'student_not_found' as const };
      if (!student.active) return { error: 'student_inactive' as const };

      const linked = await client.query(
        `SELECT id FROM users
         WHERE student_id = $1 AND role = 'student'`,
        [studentId],
      );

      if (linked.rows[0]) {
        return { error: 'account_exists' as const };
      }

      const existingEmail = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email],
      );

      if (existingEmail.rows[0]) {
        return { error: 'email_exists' as const };
      }

      const inserted = await client.query(
        `INSERT INTO users (
          name, email, password_hash, role, student_id, active
        )
        VALUES ($1, $2, $3, 'student', $4, TRUE)
        RETURNING id`,
        [String(student.full_name), email, passwordHash, studentId],
      );

      return {
        account: {
          id: Number(inserted.rows[0].id),
          name: String(student.full_name),
          email,
          role: 'student',
          student_id: studentId,
        },
        student: {
          id: studentId,
          admission_no: String(student.admission_no),
          full_name: String(student.full_name),
        },
      } as const;
    });

    if ('error' in result) {
      if (result.error === 'student_not_found') {
        return res.status(404).json({ error: 'Student record not found.' });
      }

      if (result.error === 'student_inactive') {
        return res.status(400).json({
          error: 'An inactive student cannot receive a portal account.',
        });
      }

      if (result.error === 'account_exists') {
        return res.status(409).json({
          error: 'This student already has a linked portal account.',
        });
      }

      return res.status(409).json({
        error: 'That login email is already in use. Choose a different email.',
      });
    }

    return res.status(201).json({
      message: 'Student portal account created successfully. Share the temporary password securely and ask the student to change it after signing in.',
      account: result.account,
      student: result.student,
    });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

// CREATE TEACHER PORTAL ACCOUNT
const createTeacherAccountSchema = z.object({
  temporaryPassword: z.string().min(8).max(200),
}).strict();

app.post('/api/teachers/:id/account', auth, roles('admin'), async (req: AuthRequest, res) => {
  const teacherId = validId(req.params.id);

  if (!teacherId) {
    return res.status(400).json({ error: 'Invalid teacher ID.' });
  }

  const parsed = createTeacherAccountSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter a temporary password of at least 8 characters.',
    });
  }

  try {
    const result = await withTransaction(async (client) => {
      const teacherResult = await client.query(
        `SELECT id, full_name, email, active
         FROM teachers
         WHERE id = $1
         FOR UPDATE`,
        [teacherId],
      );

      const teacher = teacherResult.rows[0];

      if (!teacher) return { error: 'teacher_not_found' as const };
      if (!teacher.active) return { error: 'teacher_inactive' as const };

      if (
        typeof teacher.email !== 'string' ||
        !isEmail(teacher.email.trim())
      ) {
        return { error: 'teacher_email_missing' as const };
      }

      const email = teacher.email.trim().toLowerCase();

      const existing = await client.query(
        'SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)',
        [email],
      );

      if (existing.rows[0]) {
        if (existing.rows[0].role === 'teacher') {
          return { error: 'account_exists' as const };
        }
        return { error: 'email_exists' as const };
      }

      const passwordHash = await bcrypt.hash(
        parsed.data.temporaryPassword,
        12,
      );

      const inserted = await client.query(
        `INSERT INTO users (
          name, email, password_hash, role, active
        )
        VALUES ($1, $2, $3, 'teacher', TRUE)
        RETURNING id`,
        [String(teacher.full_name), email, passwordHash],
      );

      return {
        account: {
          id: Number(inserted.rows[0].id),
          name: String(teacher.full_name),
          email,
          role: 'teacher',
        },
        teacher: {
          id: teacherId,
          full_name: String(teacher.full_name),
        },
      } as const;
    });

    if ('error' in result) {
      if (result.error === 'teacher_not_found') {
        return res.status(404).json({ error: 'Teacher record not found.' });
      }

      if (result.error === 'teacher_inactive') {
        return res.status(400).json({
          error: 'An inactive teacher cannot receive a portal account.',
        });
      }

      if (result.error === 'teacher_email_missing') {
        return res.status(400).json({
          error: 'Add a valid email to this teacher record before creating a login.',
        });
      }

      if (result.error === 'account_exists') {
        return res.status(409).json({
          error: 'This teacher already has a portal account.',
        });
      }

      return res.status(409).json({
        error: 'This email is already used by another account.',
      });
    }

    return res.status(201).json({
      message: 'Teacher portal account created successfully. Share the temporary password securely and ask the teacher to change it after signing in.',
      account: result.account,
      teacher: result.teacher,
    });
  } catch (error) {
    return sendDatabaseError(res, error);
  }
});

// GENERIC RESOURCE ROUTES
for (const [key, cfg] of Object.entries(resources)) {
  app.get(`/api/${key}`, auth, async (req: AuthRequest, res) => {
    const user = req.user!;

    if (
      cfg.adminOnly &&
      !(key === 'fees' && user.role === 'student') &&
      user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Administrator access required.',
      });
    }

    // Teachers may see active students for result entry only.
    if (key === 'students' && user.role === 'teacher') {
      try {
        const result = await query(
          `SELECT id, admission_no, full_name, class_name, active
           FROM students
           WHERE active = TRUE
           ORDER BY full_name ASC
           LIMIT 500`,
        );

        return res.json(result.rows);
      } catch (error) {
        console.error('Could not load students for teacher result entry:', error);
        return res.status(500).json({
          error: 'Could not load students for result entry.',
        });
      }
    }

    // Students cannot enumerate other students.
    if (key === 'students' && user.role !== 'admin') {
      return res.json([]);
    }

    // Students see only their own approved results and fee records.
    if (
      (key === 'results' || key === 'fees') &&
      user.role === 'student'
    ) {
      if (!user.student_id) {
        return res.status(403).json({
          error: 'Your account is not linked to a student record.',
        });
      }

      try {
        const result = key === 'results'
          ? await query(
              `SELECT * FROM results
               WHERE student_id = $1 AND status = 'Approved'
               ORDER BY id DESC LIMIT 500`,
              [user.student_id],
            )
          : await query(
              `SELECT * FROM fees
               WHERE student_id = $1
               ORDER BY id DESC LIMIT 500`,
              [user.student_id],
            );

        return res.json(result.rows);
      } catch (error) {
        console.error(`Could not load ${key}:`, error);
        return res.status(500).json({
          error: `Could not load ${key}.`,
        });
      }
    }

    try {
      let result;

      if (key === 'students' && user.role === 'admin') {
        result = await query(
          `SELECT s.*, u.email AS portal_account_email
           FROM students s
           LEFT JOIN users u
             ON u.student_id = s.id AND u.role = 'student'
           ORDER BY s.id DESC LIMIT 500`,
        );
      } else if (key === 'teachers' && user.role === 'admin') {
        result = await query(
          `SELECT t.*, u.email AS portal_account_email
           FROM teachers t
           LEFT JOIN users u
             ON LOWER(u.email) = LOWER(t.email)
             AND u.role = 'teacher'
           ORDER BY t.id DESC LIMIT 500`,
        );
      } else {
        result = await query(
          `SELECT * FROM ${cfg.table}
           ORDER BY id DESC LIMIT 500`,
        );
      }

      return res.json(result.rows);
    } catch (error) {
      console.error(`Could not list ${key}:`, error);
      return res.status(500).json({
        error: `Could not load ${key}.`,
      });
    }
  });

  // CREATE RESOURCE
  app.post(`/api/${key}`, auth, async (req: AuthRequest, res) => {
    const isAdmin = req.user!.role === 'admin';
    const isTeacherResultEntry =
      key === 'results' && req.user!.role === 'teacher';

    if (!isAdmin && !isTeacherResultEntry) {
      return res.status(403).json({
        error: 'Administrator access required.',
      });
    }

    if (!isRecord(req.body)) {
      return res.status(400).json({
        error: 'A valid record is required.',
      });
    }

    const input = { ...req.body };

    // Totals and approval status are controlled by the server.
    if (key === 'results') {
      delete input.total;
      delete input.status;
    }

    // Payment summary fields are controlled by the server.
    if (key === 'fees') {
      delete input.balance;
      delete input.status;
    }

    const normalized = normalizeResourceData(
      key,
      input,
      cfg.fields,
    );

    if (!normalized.data) {
      return res.status(400).json({
        error: normalized.error || 'Invalid record.',
      });
    }

    const data = normalized.data;
    const fields = cfg.fields.filter(
      field => Object.hasOwn(data, field),
    );

    if (!fields.length) {
      return res.status(400).json({
        error: 'No valid fields supplied.',
      });
    }

    if (
      key === 'students' &&
      (!requiredText(data.admission_no, 1, 60) ||
        !requiredText(data.full_name, 2, 150) ||
        !requiredText(data.class_name, 1, 100))
    ) {
      return res.status(400).json({
        error: 'Admission number, full name and class are required.',
      });
    }

    if (
      key === 'results' &&
      (!validId(data.student_id) ||
        !requiredText(data.subject, 1, 150) ||
        !requiredText(data.class_name, 1, 100) ||
        !requiredText(data.session, 1, 50) ||
        !requiredText(data.term, 1, 50))
    ) {
      return res.status(400).json({
        error: 'Student, subject, class, session and term are required.',
      });
    }

    if (key === 'results') {
      const ca = Number(data.ca ?? 0);
      const exam = Number(data.exam ?? 0);

      if (
        !Number.isFinite(ca) ||
        !Number.isFinite(exam) ||
        ca < 0 || exam < 0 ||
        ca > 100 || exam > 100 ||
        ca + exam > 100
      ) {
        return res.status(400).json({
          error: 'Scores must be non-negative and total no more than 100.',
        });
      }

      data.total = ca + exam;
      data.status = 'Submitted';

      if (!fields.includes('total')) fields.push('total');
      if (!fields.includes('status')) fields.push('status');
    }

    if (key === 'fees') {
      if (
        !Object.hasOwn(data, 'student_id') ||
        !Object.hasOwn(data, 'amount') ||
        !validId(data.student_id) ||
        !numberInRange(data.amount, 0, 100000000000)
      ) {
        return res.status(400).json({
          error: 'Select a student and enter a valid fee amount.',
        });
      }

      const paid = Number(data.paid ?? 0);

      if (paid !== 0) {
        return res.status(400).json({
          error: 'Create the fee record with zero paid, then record each received payment separately.',
        });
      }

      if (
        !requiredText(data.session, 1, 50) ||
        !requiredText(data.term, 1, 50)
      ) {
        return res.status(400).json({
          error: 'Session and term are required.',
        });
      }

      data.paid = 0;
      data.balance = Math.round(Number(data.amount) * 100) / 100;
      data.status = 'Unpaid';

      if (!fields.includes('paid')) fields.push('paid');
      if (!fields.includes('balance')) fields.push('balance');
      if (!fields.includes('status')) fields.push('status');
    }

    try {
      if (key === 'results' || key === 'fees') {
        const student = await query(
          'SELECT id FROM students WHERE id = $1 AND active = TRUE',
          [Number(data.student_id)],
        );

        if (!student.rows[0]) {
          return res.status(400).json({
            error: 'The selected student does not exist or is inactive.',
          });
        }
      }

      const values = fields.map(field => data[field] ?? null);
      const placeholders = fields.map(
        (_field, index) => `$${index + 1}`,
      );

      const result = await query(
        `INSERT INTO ${cfg.table} (${fields.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values,
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return sendDatabaseError(res, error);
    }
  });

  // UPDATE RESOURCE
  app.patch(`/api/${key}/:id`, auth, async (req: AuthRequest, res) => {
    const isAdmin = req.user!.role === 'admin';
    const isTeacherResultEdit =
      key === 'results' && req.user!.role === 'teacher';

    if (!isAdmin && !isTeacherResultEdit) {
      return res.status(403).json({
        error: 'Administrator access required.',
      });
    }

    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: 'Invalid record ID.',
      });
    }

    if (!isRecord(req.body)) {
      return res.status(400).json({
        error: 'A valid update is required.',
      });
    }

    const input = { ...req.body };

    if (key === 'results' && !isAdmin) {
      if (
        Object.hasOwn(input, 'status') &&
        input.status !== 'Submitted'
      ) {
        return res.status(403).json({
          error: 'Teachers cannot approve or reject results.',
        });
      }
      delete input.status;
      delete input.total;
    }

    if (key === 'results' && isAdmin) {
      delete input.total;
    }

    if (key === 'fees') {
      delete input.balance;
      delete input.status;

      if (Object.hasOwn(input, 'paid')) {
        return res.status(400).json({
          error: 'Recorded payments cannot be edited directly. Use the payment-recording endpoint so payment history stays accurate.',
        });
      }
    }

    const normalized = normalizeResourceData(
      key,
      input,
      cfg.fields,
    );

    if (!normalized.data) {
      return res.status(400).json({
        error: normalized.error || 'Invalid update.',
      });
    }

    const data = normalized.data;
    const fields = cfg.fields.filter(
      field => Object.hasOwn(data, field),
    );

    if (!fields.length) {
      return res.status(400).json({
        error: 'No valid fields supplied.',
      });
    }

    try {
      const existingResult = await query(
        `SELECT * FROM ${cfg.table} WHERE id = $1`,
        [id],
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        return res.status(404).json({
          error: 'Record not found.',
        });
      }

      if (key === 'students') {
        if (
          Object.hasOwn(data, 'admission_no') &&
          !requiredText(data.admission_no, 1, 60)
        ) {
          return res.status(400).json({
            error: 'Enter a valid admission number.',
          });
        }

        if (
          Object.hasOwn(data, 'full_name') &&
          !requiredText(data.full_name, 2, 150)
        ) {
          return res.status(400).json({
            error: 'Student name must contain at least 2 characters.',
          });
        }

        if (
          Object.hasOwn(data, 'class_name') &&
          !requiredText(data.class_name, 1, 100)
        ) {
          return res.status(400).json({
            error: 'Enter a valid class name.',
          });
        }
      }

      if (key === 'results') {
        const ca = Number(data.ca ?? existing.ca ?? 0);
        const exam = Number(data.exam ?? existing.exam ?? 0);

        if (
          !Number.isFinite(ca) ||
          !Number.isFinite(exam) ||
          ca < 0 || exam < 0 ||
          ca > 100 || exam > 100 ||
          ca + exam > 100
        ) {
          return res.status(400).json({
            error: 'Scores must be non-negative and total no more than 100.',
          });
        }

        if (Object.hasOwn(data, 'student_id')) {
          const student = await query(
            'SELECT id FROM students WHERE id = $1 AND active = TRUE',
            [data.student_id],
          );

          if (!student.rows[0]) {
            return res.status(400).json({
              error: 'The selected student does not exist or is inactive.',
            });
          }
        }

        if (Object.hasOwn(data, 'ca') || Object.hasOwn(data, 'exam')) {
          data.total = ca + exam;
          if (!fields.includes('total')) fields.push('total');
        }

        if (!isAdmin && (
          Object.hasOwn(data, 'ca') ||
          Object.hasOwn(data, 'exam')
        )) {
          data.status = 'Submitted';
          if (!fields.includes('status')) fields.push('status');
        }

        if (
          Object.hasOwn(data, 'status') &&
          !['Draft', 'Submitted', 'Approved', 'Rejected'].includes(data.status)
        ) {
          return res.status(400).json({
            error: 'Invalid result status.',
          });
        }
      }

      if (key === 'fees') {
        const amount = Number(data.amount ?? existing.amount);
        const paid = Number(existing.paid ?? 0);

        if (
          !Number.isFinite(amount) ||
          !Number.isFinite(paid) ||
          amount < paid ||
          paid < 0
        ) {
          return res.status(400).json({
            error: 'The fee amount cannot be less than the amount already paid.',
          });
        }

        if (Object.hasOwn(data, 'student_id')) {
          const student = await query(
            'SELECT id FROM students WHERE id = $1 AND active = TRUE',
            [data.student_id],
          );

          if (!student.rows[0]) {
            return res.status(400).json({
              error: 'The selected student does not exist or is inactive.',
            });
          }
        }

        data.balance = Math.round((amount - paid) * 100) / 100;
        data.status = paid === 0
          ? 'Unpaid'
          : paid === amount
            ? 'Paid'
            : 'Partially Paid';

        if (!fields.includes('balance')) fields.push('balance');
        if (!fields.includes('status')) fields.push('status');
      }

      const values = fields.map(field => data[field] ?? null);
      const assignments = fields.map(
        (field, index) => `${field} = $${index + 1}`,
      );

      values.push(id);

      const updated = await query(
        `UPDATE ${cfg.table}
         SET ${assignments.join(', ')}
         WHERE id = $${values.length}
         RETURNING *`,
        values,
      );

      // Keep teacher portal access synchronized with teacher activation.
      if (key === 'teachers' && Object.hasOwn(data, 'active')) {
        await query(
          `UPDATE users
           SET active = $1
           WHERE role = 'teacher'
           AND LOWER(email) = LOWER($2)`,
          [data.active, String(existing.email || '')],
        );
      }

      return res.json(updated.rows[0]);
    } catch (error) {
      return sendDatabaseError(res, error);
    }
  });

  // DELETE RESOURCE
  app.delete(`/api/${key}/:id`, auth, roles('admin'), async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: 'Invalid record ID.',
      });
    }

    try {
      const result = await query(
        `DELETE FROM ${cfg.table}
         WHERE id = $1
         RETURNING id`,
        [id],
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Record not found.',
        });
      }

      return res.status(204).end();
    } catch (error) {
      return sendDatabaseError(res, error);
    }
  });
}

// 404
app.use((_req, res) => {
  res.status(404).json({
    error: 'API endpoint not found.',
  });
});

// GLOBAL ERROR HANDLER
app.use(
  (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error('Unhandled server error:', err);

    if (res.headersSent) return;

    return res.status(500).json({
      error: 'Unexpected server error.',
    });
  },
);

// STARTUP: initialize database before accepting requests.
const port = Number(process.env.PORT || 4000);

async function startServer() {
  try {
    await initializeDatabase();

    const server = app.listen(port, () => {
      console.log(
        `Best Builder College API running at http://localhost:${port}`,
      );
      console.log('PostgreSQL database initialization completed.');
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received. Shutting down server...`);

      server.close(async () => {
        try {
          await pool.end();
          console.log('PostgreSQL connection pool closed.');
          process.exit(0);
        } catch (error) {
          console.error('Error closing PostgreSQL pool:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    console.error('Could not start Best Builder College API:', error);
    await pool.end();
    process.exit(1);
  }
}

void startServer();
