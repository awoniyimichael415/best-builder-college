
import { Fragment, useEffect, useState } from 'react';
import {
  GraduationCap, Menu, X, ArrowRight, BookOpen, Users,
  ShieldCheck, Phone, MapPin, Mail, LayoutDashboard,
  LogOut, UserRound, ClipboardList, Wallet, Megaphone,
  School, BookMarked, CheckCircle2, Clock3, Search,
  Pencil, UserX, UserCheck, Plus, RefreshCw, Save, KeyRound, LockKeyhole, ChevronDown
} from 'lucide-react';

const API = 'http://localhost:4000/api';

type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  student_id?: number | null;
};

type Student = {
  id: number;
  admission_no: string;
  full_name: string;
  class_name: string;
  gender?: string;
  dob?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  address?: string;
  active: number;
};

const classes = [
  'Creche', 'Kindergarten', 'Nursery',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5',
  'JSS 1', 'JSS 2', 'JSS 3',
  'SSS 1', 'SSS 2', 'SSS 3'
];

const subjects = [
  'Mathematics', 'English Language', 'Yoruba', 'Basic Science',
  'Basic Technology', 'Civic Education', 'Social Studies',
  'Physical and Health Education', 'History', 'Information Technology',
  'Digital Technology', 'Arabic', 'Business Studies', 'Economics',
  'Government', 'Literature in English', 'Commerce',
  'Financial Accounting', 'Marketing', 'Physics', 'Chemistry',
  'Biology', 'Agricultural Science', 'Further Mathematics',
  'National Values', 'Pre-Vocational Studies', 'Verbal Reasoning',
  'Quantitative Reasoning', 'Cultural and Creative Art'
];

async function request(
  path: string,
  token: string,
  opts: RequestInit = {}
) {
  const response = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed. Please try again.');
  }

  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [page, setPage] = useState('Home');
  const [menu, setMenu] = useState(false);
  const [token, setToken] = useState(
    localStorage.getItem('bbc_token') || ''
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>({});
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [form, setForm] = useState<any>({});

  const resourceMap: Record<string, string> = {
    Students: 'students',
    Teachers: 'teachers',
    Classes: 'classes',
    Subjects: 'subjects',
    Admissions: 'admissions',
    Results: 'results',
    Fees: 'fees',
    Announcements: 'announcements'
  };

  const isPortal = Boolean(user);

  useEffect(() => {
    if (!token) return;

    request('/auth/me', token)
      .then((data: any) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('bbc_token');
        setToken('');
        setUser(null);
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    request('/dashboard', token)
      .then(setDashboard)
      .catch((e: Error) => setError(e.message));

    if (resourceMap[page]) {
      loadResource(page);
    }
  }, [user, page, token]);

  async function loadResource(resource: string) {
    try {
      const data = await request(
        `/${resourceMap[resource]}`,
        token
      );
      setRows(data || []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function login(e: any) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await request('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });

      localStorage.setItem('bbc_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setPage('Dashboard');
      setNotice('Welcome back.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('bbc_token');
    setToken('');
    setUser(null);
    setPage('Home');
    setRows([]);
    setForm({});
  }

  function go(nextPage: string) {
    setPage(nextPage);
    setMenu(false);
    setError('');
    setNotice('');
    setForm({});
  }

  async function submitAdmission(e: any) {
    e.preventDefault();
    setError('');
    setNotice('');

    try {
      const data = await request('/admissions', '', {
        method: 'POST',
        body: JSON.stringify(form)
      });

      setNotice(data.message);
      setForm({});
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function saveRecord(e: any) {
    e.preventDefault();
    setError('');
    setNotice('');

    try {
      await request(`/${resourceMap[page]}`, token, {
        method: 'POST',
        body: JSON.stringify(form)
      });

      setNotice('Record saved successfully.');
      setForm({});
      await loadResource(page);

      const data = await request('/dashboard', token);
      setDashboard(data);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function updateRecord(e: any, id: number) {
    e.preventDefault();
    setError('');
    setNotice('');

    try {
      await request(`/${resourceMap[page]}/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(form)
      });

      setNotice('Record updated successfully.');
      setForm({});
      await loadResource(page);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await request(`/${resourceMap[page]}/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await loadResource(page);
      setNotice('Status updated successfully.');
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function recordFeePayment(feeId: number, payment: any) {
    setError('');
    setNotice('');

    try {
      const data = await request(`/fees/${feeId}/payments`, token, {
        method: 'POST',
        body: JSON.stringify(payment)
      });

      setNotice(data.message || 'Payment recorded successfully.');
      await loadResource('Fees');
      const dashboardData = await request('/dashboard', token);
      setDashboard(dashboardData);
      return data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }

  async function createStudentAccount(studentId: number, credentials: { email: string; temporaryPassword: string }) {
    setError('');
    setNotice('');
    try {
      const data = await request(`/students/${studentId}/account`, token, {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      setNotice(data.message || 'Student portal account created successfully.');
      await loadResource('Students');
      return data;
    } catch (e: any) {
      setError(e.message || 'Could not create the student portal account.');
      throw e;
    }
  }

  async function createTeacherAccount(teacherId: number, credentials: { temporaryPassword: string }) {
    setError('');
    setNotice('');
    try {
      const data = await request(`/teachers/${teacherId}/account`, token, {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      setNotice(data.message || 'Teacher portal account created successfully.');
      await loadResource('Teachers');
      return data;
    } catch (e: any) {
      setError(e.message || 'Could not create the teacher portal account.');
      throw e;
    }
  }

  async function setStudentActive(id: number, active: number) {
    setError('');
    setNotice('');

    try {
      await request(`/students/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ active })
      });

      await loadResource('Students');

      const data = await request('/dashboard', token);
      setDashboard(data);

      setNotice(
        active
          ? 'Student record reactivated successfully.'
          : 'Student deactivated. The record has been preserved.'
      );
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function setTeacherActive(id: number, active: number) {
    setError('');
    setNotice('');

    try {
      await request(`/teachers/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ active })
      });

      await loadResource('Teachers');
      const data = await request('/dashboard', token);
      setDashboard(data);
      setNotice(
        active
          ? 'Teacher reactivated. Their linked portal account is active again.'
          : 'Teacher deactivated. Their linked portal account can no longer sign in.'
      );
    } catch (e: any) {
      setError(e.message);
    }
  }

  const navPublic = [
    'Home', 'About Us', 'Academics', 'Admissions', 'Contact'
  ];

  const navPortal = user?.role === 'admin'
    ? [
        'Dashboard', 'Students', 'Teachers', 'Classes',
        'Subjects', 'Admissions', 'Results', 'Fees', 'Announcements'
      ]
    : user?.role === 'teacher'
      ? ['Dashboard', 'Results', 'Announcements']
      : ['Dashboard', 'Profile', 'Results', 'Fees', 'Announcements'];

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => go(isPortal ? 'Dashboard' : 'Home')}
        >
          <span className="brandmark">
            <img src="/images/logo.jpeg" alt="Best Builder College logo" />
          </span>
          <span>
            <b>BEST BUILDER</b>
            <small>COLLEGE · EDE</small>
          </span>
        </button>

        <button
          className="mobile-toggle"
          onClick={() => setMenu(!menu)}
          aria-label="Toggle navigation"
        >
          {menu ? <X /> : <Menu />}
        </button>

        <nav className={menu ? 'nav open' : 'nav'}>
          {(isPortal ? navPortal : navPublic).map((item) => (
            <button
              key={item}
              className={page === item ? 'navlink active' : 'navlink'}
              onClick={() => go(item)}
            >
              {item}
            </button>
          ))}

          {!isPortal ? (
            <button className="nav-cta" onClick={() => go('Login')}>
              Portal Login <ArrowRight size={16} />
            </button>
          ) : (
            <button className="nav-cta" onClick={logout}>
              <LogOut size={16} /> Sign out
            </button>
          )}
        </nav>
      </header>

      {error && (
        <div className="alert error" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {notice && (
        <div className="alert success" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      {isPortal ? (
        <main className="portal">
          <aside className="sidebar">
            <div className="usercard">
              <div className="avatar">{user.name.slice(0, 1)}</div>
              <b>{user.name}</b>
              <span>{user.role.toUpperCase()}</span>
            </div>

            {navPortal.map((item) => (
              <button
                key={item}
                className={
                  page === item ? 'side-link selected' : 'side-link'
                }
                onClick={() => go(item)}
              >
                {item === 'Dashboard' ? <LayoutDashboard /> :
                 item === 'Profile' ? <UserRound /> :
                 item === 'Students' ? <Users /> :
                 item === 'Teachers' ? <UserRound /> :
                 item === 'Classes' ? <School /> :
                 item === 'Subjects' ? <BookMarked /> :
                 item === 'Results' ? <ClipboardList /> :
                 item === 'Fees' ? <Wallet /> :
                 item === 'Announcements' ? <Megaphone /> :
                 <ClipboardList />}
                {item}
              </button>
            ))}
          </aside>

          <section className="portal-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">SCHOOL MANAGEMENT</span>
                <h1>{page}</h1>
                <p>
                  Welcome to your Best Builder College workspace.
                </p>
              </div>
              <span className="session-pill">
                <span className="dot" /> Portal active
              </span>
            </div>

            {page === 'Dashboard' && user.role === 'student' ? (
              <StudentDashboard
                token={token}
                user={user}
                dashboard={dashboard}
                go={go}
              />
            ) : page === 'Dashboard' ? (
              <>
                <div className="stats-grid">
                  {[
                    ['Total Students', dashboard.students ?? 0, Users],
                    ['Total Teachers', dashboard.teachers ?? 0, UserRound],
                    ['Classes', classes.length, School],
                    ['Pending Admissions', dashboard.pendingAdmissions ?? 0, Clock3]
                  ].map(([label, value, Icon]: any) => (
                    <div className="stat-card" key={label}>
                      <span className="stat-icon"><Icon size={21} /></span>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>Current records</small>
                    </div>
                  ))}
                </div>

                <div className="dashboard-grid">
                  <div className="panel">
                    <div className="panel-title">
                      <h3>Recent admissions</h3>
                      <button
                        className="text-btn"
                        onClick={() => go('Admissions')}
                      >
                        View all <ArrowRight size={15} />
                      </button>
                    </div>

                    {(dashboard.recentAdmissions || []).length ? (
                      dashboard.recentAdmissions.map((item: any) => (
                        <div className="list-row" key={item.id}>
                          <div className="row-icon"><UserRound /></div>
                          <div className="row-main">
                            <b>{item.applicant_name}</b>
                            <small>{item.class_applying}</small>
                          </div>
                          <span className={`status ${item.status.toLowerCase()}`}>
                            {item.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        New admission applications will appear here.
                      </p>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-title">
                      <h3>Announcements</h3>
                      <Megaphone />
                    </div>

                    {(dashboard.announcements || []).map((item: any) => (
                      <div className="announcement" key={item.id}>
                        <b>{item.title}</b>
                        <p>{item.body}</p>
                        <small>{item.created_at}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : page === 'Profile' && user.role === 'student' ? (
              <StudentProfile token={token} user={user} />
            ) : page === 'Fees' && user.role === 'student' ? (
              <StudentFees token={token} rows={rows} />
            ) : page === 'Announcements' && user.role === 'student' ? (
              <StudentAnnouncements rows={dashboard.announcements || []} />
            ) : page === 'Announcements' && user.role === 'teacher' ? (
              <TeacherAnnouncements rows={dashboard.announcements || []} />
            ) : resourceMap[page] ? (
              <ResourceView
                page={page}
                rows={rows}
                role={user.role}
                token={token}
                form={form}
                setForm={setForm}
                saveRecord={saveRecord}
                updateRecord={updateRecord}
                updateStatus={updateStatus}
                recordFeePayment={recordFeePayment}
                setStudentActive={setStudentActive}
                setTeacherActive={setTeacherActive}
                createStudentAccount={createStudentAccount}
                createTeacherAccount={createTeacherAccount}
              />
            ) : (
              <div className="panel">
                <h3>Your portal</h3>
                <p>Select a section from the menu to manage your school information.</p>
              </div>
            )}
          </section>
        </main>
      ) : page === 'Login' ? (
        <main className="login-page">
          <div className="login-aside">
            <span className="eyebrow light">KNOWLEDGE & MORAL</span>
            <h1>Your school.<br />Connected.</h1>
            <p>
              A secure place for school administrators, teachers and students
              to access the information they need.
            </p>
            <div className="login-perk">
              <ShieldCheck /> Role-based access for your school community
            </div>
          </div>

          <form className="login-card" onSubmit={login}>
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Portal sign in</h2>
            <p>Enter your school account details to continue.</p>

            <label>
              Email address
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@school.edu.ng"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>

            <button className="primary-btn full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in securely'}
              <ArrowRight size={17} />
            </button>
            <small className="form-foot">
              Need access? Contact the school administrator.
            </small>
          </form>
        </main>
      ) : page === 'Admissions' ? (
        <main className="content-page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">TAKE THE NEXT STEP</span>
              <h1>Admission application</h1>
              <p>Begin your child's learning journey with Best Builder College.</p>
            </div>
          </div>

          <form className="panel admission-form" onSubmit={submitAdmission}>
            <h3>Applicant information</h3>
            <div className="form-grid">
              <Field label="Applicant full name" name="applicant_name" required form={form} setForm={setForm} />
              <Field label="Date of birth" name="dob" type="date" form={form} setForm={setForm} />

              <label>
                Gender
                <select
                  value={form.gender || ''}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </label>

              <label>
                Class applying for
                <select
                  required
                  value={form.class_applying || ''}
                  onChange={(e) => setForm({ ...form, class_applying: e.target.value })}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <Field label="Previous school (if any)" name="previous_school" form={form} setForm={setForm} />
            </div>

            <h3>Parent / guardian</h3>
            <div className="form-grid">
              <Field label="Parent / guardian name" name="guardian_name" required form={form} setForm={setForm} />
              <Field label="Phone number" name="guardian_phone" required form={form} setForm={setForm} />
              <Field label="Email address" name="guardian_email" type="email" form={form} setForm={setForm} />
              <Field label="Residential address" name="address" form={form} setForm={setForm} />
            </div>

            <button className="primary-btn">
              Submit application <ArrowRight size={17} />
            </button>
          </form>
        </main>
      ) : (
        <PublicPage page={page} go={go} />
      )}

      <footer className="footer">
        <div className="footer-brand">
          <img src="/images/logo.jpeg" alt="Best Builder College logo" />
          <div>
            <b>BEST BUILDER COLLEGE</b>
            <small>Knowledge & Moral</small>
          </div>
        </div>
        <p>47, Wakajaye Zone 11, Ede, Osun State</p>
        <p>© {new Date().getFullYear()} Best Builder College. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Field({
  label, name, type = 'text', required = false, form, setForm
}: any) {
  return (
    <label>
      {label}
      <input
        type={type}
        required={required}
        value={form[name] || ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </label>
  );
}

function PublicPage({ page, go }: any) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [previewImage]);

  if (page === 'Home') {
    return (
      <>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow light">WELCOME TO BEST BUILDER COLLEGE</span>
            <h1>Building brighter<br /><em>futures.</em></h1>
            <p>
              Quality, affordable and globally competitive education rooted
              in knowledge, character and opportunity.
            </p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => go('Admissions')}>
                Apply for admission <ArrowRight />
              </button>
              <button className="outline-btn" onClick={() => go('About Us')}>
                Discover our school
              </button>
            </div>
            <div className="hero-note">
              <span><CheckCircle2 /> Motivation</span>
              <span><CheckCircle2 /> Dependability</span>
              <span><CheckCircle2 /> Efficiency</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-circle" />
            <div className="art-card">
              <GraduationCap size={58} />
              <b>Learn with purpose.</b>
              <span>Grow with confidence.</span>
            </div>
            <div className="floating-tag">KNOWLEDGE & MORAL</div>
          </div>
        </section>

        <section className="feature-strip">
          <div><BookOpen /><b>Quality learning</b><span>Education for every stage</span></div>
          <div><Users /><b>Supportive community</b><span>Working together to thrive</span></div>
          <div><ShieldCheck /><b>Character matters</b><span>Learning with strong values</span></div>
        </section>

        <section className="section school-gallery-section" aria-labelledby="school-gallery-title">
          <style>{`
            .school-gallery-section .school-gallery-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              align-items: start;
              gap: 18px;
              margin-top: 30px;
            }
            .school-gallery-section .school-gallery-item {
              margin: 0;
              overflow: hidden;
              border-radius: 16px;
              background: #eef5fb;
              box-shadow: 0 10px 28px rgba(15, 39, 74, 0.09);
            }
            .school-gallery-section .school-gallery-item button {
              display: block;
              width: 100%;
              padding: 0;
              border: 0;
              background: transparent;
              cursor: zoom-in;
            }
            .school-gallery-section .school-gallery-item img {
              display: block;
              width: 100%;
              height: auto;
              object-fit: contain;
              transition: transform 220ms ease;
            }
            .school-gallery-section .school-gallery-item button:hover img {
              transform: scale(1.025);
            }
            .school-gallery-preview {
              position: fixed;
              inset: 0;
              z-index: 9999;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 64px 20px 24px;
              background: rgba(5, 15, 30, 0.92);
            }
            .school-gallery-preview img {
              display: block;
              max-width: 96vw;
              max-height: calc(100vh - 100px);
              width: auto;
              height: auto;
              object-fit: contain;
              border-radius: 6px;
              box-shadow: 0 18px 60px rgba(0, 0, 0, 0.4);
            }
            .school-gallery-preview-close {
              position: absolute;
              top: 18px;
              right: 20px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 46px;
              height: 46px;
              border: 1px solid rgba(255, 255, 255, 0.5);
              border-radius: 50%;
              color: #fff;
              background: rgba(255, 255, 255, 0.12);
              font-size: 30px;
              line-height: 1;
              cursor: pointer;
            }
            .school-gallery-preview-close:hover {
              background: rgba(255, 255, 255, 0.25);
            }
            @media (max-width: 900px) {
              .school-gallery-section .school-gallery-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px;
              }
            }
            @media (max-width: 480px) {
              .school-gallery-section .school-gallery-grid { gap: 10px; }
              .school-gallery-section .school-gallery-item { border-radius: 10px; }
              .school-gallery-preview { padding: 58px 10px 16px; }
              .school-gallery-preview img { max-width: 98vw; max-height: calc(100vh - 84px); }
              .school-gallery-preview-close { top: 10px; right: 10px; width: 42px; height: 42px; }
            }
            @media (prefers-reduced-motion: reduce) {
              .school-gallery-section .school-gallery-item img { transition: none; }
            }
          `}</style>
          <div className="section-intro">
            <span className="eyebrow">A LOOK INSIDE OUR SCHOOL</span>
            <h2 id="school-gallery-title">Moments at Best Builder College.</h2>
            <p>Explore a few glimpses of our learning environment and school community. Select any image to view it in full.</p>
          </div>
          <div className="school-gallery-grid">
            <figure className="school-gallery-item">
              <button type="button" onClick={() => setPreviewImage({ src: '/images/Image%201.png', alt: 'Best Builder College school gallery image 1' })} aria-label="Preview school gallery image 1">
                <img src="/images/Image%201.png" alt="Best Builder College school gallery image 1" loading="lazy" />
              </button>
            </figure>
            <figure className="school-gallery-item">
              <button type="button" onClick={() => setPreviewImage({ src: '/images/image%202.png', alt: 'Best Builder College school gallery image 2' })} aria-label="Preview school gallery image 2">
                <img src="/images/image%202.png" alt="Best Builder College school gallery image 2" loading="lazy" />
              </button>
            </figure>
            <figure className="school-gallery-item">
              <button type="button" onClick={() => setPreviewImage({ src: '/images/image%203.png', alt: 'Best Builder College school gallery image 3' })} aria-label="Preview school gallery image 3">
                <img src="/images/image%203.png" alt="Best Builder College school gallery image 3" loading="lazy" />
              </button>
            </figure>
            <figure className="school-gallery-item">
              <button type="button" onClick={() => setPreviewImage({ src: '/images/image%204.png', alt: 'Best Builder College school gallery image 4' })} aria-label="Preview school gallery image 4">
                <img src="/images/image%204.png" alt="Best Builder College school gallery image 4" loading="lazy" />
              </button>
            </figure>
          </div>
          {previewImage && (
            <div
              className="school-gallery-preview"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={(event) => {
                if (event.target === event.currentTarget) setPreviewImage(null);
              }}
            >
              <button
                type="button"
                className="school-gallery-preview-close"
                onClick={() => setPreviewImage(null)}
                aria-label="Close image preview"
                title="Close preview"
              >
                <X size={28} />
              </button>
              <img src={previewImage.src} alt={previewImage.alt} />
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-intro">
            <span className="eyebrow">OUR ACADEMIC JOURNEY</span>
            <h2>Room to learn.<br />Space to become.</h2>
            <p>From early years through senior secondary, we support each learner's growth.</p>
          </div>
          <div className="program-grid">
            {['Creche & Kindergarten', 'Nursery', 'Primary', 'Junior Secondary', 'Senior Secondary'].map((item, i) => (
              <div className="program-card" key={item}>
                <span>0{i + 1}</span>
                <h3>{item}</h3>
                <p>Age-appropriate learning, confidence and a strong foundation for the next stage.</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <div>
            <span className="eyebrow light">YOUR CHILD'S NEXT CHAPTER</span>
            <h2>Let's build their future together.</h2>
          </div>
          <button className="white-btn" onClick={() => go('Admissions')}>
            Start an application <ArrowRight />
          </button>
        </section>
      </>
    );
  }

  if (page === 'About Us') {
    return (
      <main className="content-page">
        <span className="eyebrow">OUR STORY</span>
        <h1>Growing through education.</h1>
        <p className="lead">
          Best Builder College was established in July 2016 as Best Builder
          Academy, beginning with Kindergarten, Nursery and Primary education.
          After a period of closure and the relocation of a nearby school,
          the academy resumed operations and continued its development as
          Best Builder College.
        </p>

        <section className="proprietor-section" aria-labelledby="proprietor-title">
          <style>{`
            .proprietor-section {
              display: grid;
              grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1.15fr);
              align-items: center;
              gap: clamp(24px, 5vw, 52px);
              margin: 38px 0;
              padding: clamp(20px, 4vw, 38px);
              border: 1px solid #dce8f3;
              border-radius: 22px;
              background: linear-gradient(135deg, #f3f8fd 0%, #ffffff 75%);
              box-shadow: 0 14px 36px rgba(15, 39, 74, 0.08);
            }
            .proprietor-photo-wrap {
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 260px;
              border-radius: 16px;
              background: #e6f0fa;
            }
            .proprietor-photo {
              display: block;
              width: 100%;
              height: auto;
              max-height: 520px;
              object-fit: contain;
            }
            .proprietor-copy h2 {
              margin: 8px 0 14px;
              color: #12315a;
              font-size: clamp(1.65rem, 3vw, 2.3rem);
              line-height: 1.2;
            }
            .proprietor-copy p {
              margin: 0;
              color: #52657a;
              line-height: 1.85;
            }
            .proprietor-rule {
              width: 64px;
              height: 4px;
              margin: 18px 0;
              border-radius: 999px;
              background: #4aa8e8;
            }
            @media (max-width: 700px) {
              .proprietor-section {
                grid-template-columns: 1fr;
                gap: 22px;
              }
              .proprietor-photo-wrap { min-height: 0; }
              .proprietor-photo { max-height: 440px; }
            }
          `}</style>
          <div className="proprietor-photo-wrap">
            <img
              className="proprietor-photo"
              src="/images/proprietor.jpeg"
              alt="Proprietor of Best Builder College"
              loading="lazy"
            />
          </div>
          <div className="proprietor-copy">
            <span className="eyebrow">SCHOOL LEADERSHIP</span>
            <h2 id="proprietor-title">Meet Our Proprietor</h2>
            <div className="proprietor-rule" />
            <p>
              Best Builder College is guided by a commitment to qualitative,
              affordable and globally competitive education. Our school’s
              journey reflects a dedication to helping learners grow in
              knowledge, character and confidence, guided by our motto:
              “Knowledge &amp; Moral.”
            </p>
          </div>
        </section>

        <div className="values-grid">
          <div className="panel">
            <h3>Our vision</h3>
            <p>To become a global-best qualitative educational services provider in Osun State.</p>
          </div>
          <div className="panel">
            <h3>Our mission</h3>
            <p>To provide qualitative, affordable and globally competitive education through experience in education.</p>
          </div>
          <div className="panel">
            <h3>Our core values</h3>
            <p>Motivation · Dependability · Efficiency</p>
          </div>
        </div>
        <p className="motto">“Knowledge & Moral”</p>
      </main>
    );
  }

  if (page === 'Academics') {
    return (
      <main className="content-page">
        <span className="eyebrow">ACADEMIC PROGRAMMES</span>
        <h1>A strong foundation at every stage.</h1>
        <p className="lead">Explore the learning levels offered at Best Builder College.</p>
        <div className="program-grid">
          {['Creche', 'Kindergarten', 'Nursery', 'Primary 1–5', 'Junior Secondary · JSS 1–3', 'Senior Secondary · SSS 1–3'].map((item, i) => (
            <div className="program-card" key={item}>
              <span>0{i + 1}</span>
              <h3>{item}</h3>
              <p>Supporting knowledge, skills, confidence and positive values.</p>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="content-page">
      <span className="eyebrow">
        {page === 'Contact' ? 'GET IN TOUCH' : 'BEST BUILDER COLLEGE'}
      </span>
      <h1>
        {page === 'Contact'
          ? 'We would love to hear from you.'
          : 'A school community built on values.'}
      </h1>
      <div className="contact-grid">
        <div className="panel contact-card">
          <MapPin />
          <h3>Visit us</h3>
          <p>47, Wakajaye Zone 11,<br />Ede, Osun State, Nigeria</p>
        </div>
        <div className="panel contact-card">
          <Phone />
          <h3>Call the school</h3>
          <p>
            <a href="tel:08066508315">0806 650 8315</a><br />
            <a href="tel:09069598713">0906 959 8713</a>
          </p>
        </div>
        <div className="panel contact-card">
          <Mail />
          <h3>Admissions</h3>
          <p>Use our online application form to begin the admissions process.</p>
          <button className="text-btn" onClick={() => go('Admissions')}>
            Apply online <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}

function ResourceView({
  page, rows, role, token, form, setForm, saveRecord,
  updateRecord, updateStatus, recordFeePayment, setStudentActive, setTeacherActive,
  createStudentAccount, createTeacherAccount
}: any) {
  const admin = role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [paymentFee, setPaymentFee] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', payment_method: 'Cash', reference: '', notes: ''
  });
  const [paymentHistory, setPaymentHistory] = useState<Record<number, any[]>>({});
  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);
  const [accountStudent, setAccountStudent] = useState<Student | null>(null);
  const [accountTeacher, setAccountTeacher] = useState<any | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [studentOptions, setStudentOptions] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [classStudentRows, setClassStudentRows] = useState<Student[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [teacherSubjectOptions, setTeacherSubjectOptions] = useState<string[]>(subjects);
  const [teacherClassOptions, setTeacherClassOptions] = useState<string[]>(classes);
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState<'subjects' | 'classes' | null>(null);

  useEffect(() => {
    if (page !== 'Teachers' || !admin) return;
    let cancelled = false;

    Promise.all([request('/subjects', token), request('/classes', token)])
      .then(([subjectData, classData]: any[]) => {
        if (cancelled) return;
        const subjectRows = Array.isArray(subjectData) ? subjectData : (subjectData?.subjects || []);
        const classRows = Array.isArray(classData) ? classData : (classData?.classes || []);
        const savedSubjects = [...new Set(subjectRows.map((item: any) => String(item.name || '').trim()).filter(Boolean))];
        const savedClasses = [...new Set(classRows.map((item: any) => String(item.name || '').trim()).filter(Boolean))];
        setTeacherSubjectOptions(savedSubjects.length ? savedSubjects : subjects);
        setTeacherClassOptions(savedClasses.length ? savedClasses : classes);
      })
      .catch(() => {
        if (!cancelled) {
          setTeacherSubjectOptions(subjects);
          setTeacherClassOptions(classes);
        }
      });

    return () => { cancelled = true; };
  }, [page, admin, token]);

  const splitTeacherSelections = (value: unknown): string[] =>
    String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

  const toggleTeacherSelection = (field: 'subjects' | 'classes', value: string, checked: boolean) => {
    const current = splitTeacherSelections(form[field]);
    const next = checked
      ? [...current, value]
      : current.filter((item) => item !== value);
    setForm({ ...form, [field]: next.join(', ') });
  };

  useEffect(() => {
    if (page !== 'Classes' || !admin) return;
    let cancelled = false;
    setClassesLoading(true);

    request('/students', token)
      .then((data: any) => {
        const studentRows = Array.isArray(data) ? data : (data?.students || []);
        if (!cancelled) setClassStudentRows(studentRows);
      })
      .catch(() => {
        if (!cancelled) setClassStudentRows([]);
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, admin, token]);

  useEffect(() => {
    if (!['Fees', 'Results'].includes(page) || (!admin && !(page === 'Results' && role === 'teacher'))) return;
    let cancelled = false;
    setStudentsLoading(true);
    request('/students', token)
      .then((data: any) => {
        if (!cancelled) setStudentOptions(Array.isArray(data) ? data : (data?.students || []));
      })
      .catch(() => {
        if (!cancelled) setStudentOptions([]);
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, admin, token]);

  const fieldDefs: Record<string, [string, string][]> = {
    Students: [
      ['admission_no', 'Admission number'],
      ['full_name', 'Full name'],
      ['class_name', 'Class'],
      ['gender', 'Gender'],
      ['dob', 'Date of birth'],
      ['guardian_name', 'Guardian name'],
      ['guardian_phone', 'Guardian phone'],
      ['guardian_email', 'Guardian email'],
      ['address', 'Residential address']
    ],
    Teachers: [
      ['full_name', 'Full name'], ['phone', 'Phone'],
      ['email', 'Email'], ['qualification', 'Qualification'],
      ['subjects', 'Subjects'], ['classes', 'Classes']
    ],
    Classes: [['name', 'Class name'], ['level', 'Level']],
    Subjects: [['name', 'Subject name'], ['class_name', 'Class']],
    Admissions: [
      ['applicant_name', 'Applicant full name'],
      ['dob', 'Date of birth'],
      ['gender', 'Gender'],
      ['class_applying', 'Class applying for'],
      ['previous_school', 'Previous school (if any)'],
      ['guardian_name', 'Parent / guardian name'],
      ['guardian_phone', 'Phone number'],
      ['guardian_email', 'Email address'],
      ['address', 'Residential address']
    ],
    Results: [
      ['student_id', 'Student'], ['subject', 'Subject'],
      ['class_name', 'Class'], ['session', 'Academic session'],
      ['term', 'Term'], ['ca', 'Continuous assessment (CA) score'],
      ['exam', 'Examination score']
    ],
    Fees: [
      ['student_id', 'Student ID'], ['session', 'Academic session'],
      ['term', 'Term'], ['amount', 'Fee amount']
    ],
    Announcements: [['title', 'Title'], ['body', 'Message']]
  };

  const columns: Record<string, string[]> = {
    Students: [
      'admission_no', 'full_name', 'class_name',
      'guardian_phone', 'active'
    ],
    Teachers: ['full_name', 'phone', 'email', 'qualification'],
    Classes: ['name', 'level', 'student_count'],
    Subjects: ['name', 'class_name'],
    Admissions: [
      'applicant_name', 'class_applying', 'guardian_name',
      'guardian_phone', 'status'
    ],
    Results: [
      'student_id', 'subject', 'class_name', 'total', 'term', 'status'
    ],
    Fees: [
      'student_id', 'session', 'term', 'amount', 'paid', 'balance', 'status'
    ],
    Announcements: ['title', 'body', 'created_at']
  };

  async function submitStudentAccount(e: any) {
    e.preventDefault();
    if (!accountStudent) return;
    setAccountSubmitting(true);
    try {
      await createStudentAccount(accountStudent.id, {
        email: accountEmail.trim(),
        temporaryPassword
      });
      setAccountStudent(null);
      setAccountEmail('');
      setTemporaryPassword('');
    } catch {
      // The parent displays the API error; keep the form open for correction.
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function submitTeacherAccount(e: any) {
    e.preventDefault();
    if (!accountTeacher) return;
    setAccountSubmitting(true);
    try {
      await createTeacherAccount(accountTeacher.id, { temporaryPassword });
      setAccountTeacher(null);
      setTemporaryPassword('');
    } catch {
      // The parent displays the API error; keep the form open for correction.
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function openPaymentHistory(feeId: number) {
    if (historyOpenId === feeId) {
      setHistoryOpenId(null);
      return;
    }

    setHistoryOpenId(feeId);
    setHistoryLoadingId(feeId);
    try {
      const data = await request(`/fees/${feeId}/payments`, token);
      setPaymentHistory((current) => ({ ...current, [feeId]: data.payments || [] }));
    } catch (e: any) {
      setPaymentHistory((current) => ({ ...current, [feeId]: [] }));
    } finally {
      setHistoryLoadingId(null);
    }
  }

  async function submitPayment(e: any) {
    e.preventDefault();
    if (!paymentFee) return;

    try {
      await recordFeePayment(paymentFee.id, {
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference.trim(),
        notes: paymentForm.notes.trim()
      });
      setPaymentFee(null);
      setPaymentForm({ amount: '', payment_method: 'Cash', reference: '', notes: '' });
      setPaymentHistory((current) => ({ ...current, [paymentFee.id]: [] }));
      if (historyOpenId === paymentFee.id) {
        const data = await request(`/fees/${paymentFee.id}/payments`, token);
        setPaymentHistory((current) => ({ ...current, [paymentFee.id]: data.payments || [] }));
      }
    } catch {
      // The parent displays the API error; keep the form open so it can be corrected.
    }
  }

  const money = (value: unknown) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 2
  }).format(Number(value || 0));

  const title = (value: string) =>
    value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const classRowsForDisplay = (() => {
    if (page !== 'Classes') return [];

    const savedClassRows = Array.isArray(rows) ? rows : [];
    const byName = new Map<string, any>();

    [...classes.map((name) => ({ name })), ...savedClassRows].forEach((item: any) => {
      const name = String(item?.name || '').trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      const existing = byName.get(key) || {};
      byName.set(key, { ...existing, ...item, name });
    });

    return Array.from(byName.values()).map((classRow: any) => {
      const studentCount = classStudentRows.filter((student: any) =>
        Number(student.active) === 1 &&
        String(student.class_name || '').trim().toLocaleLowerCase() ===
          String(classRow.name).trim().toLocaleLowerCase()
      ).length;

      return {
        ...classRow,
        level: classRow.level || '',
        student_count: studentCount
      };
    });
  })();

  const filteredRows = page === 'Students'
    ? (rows as Student[]).filter((student) => {
        const matchesSearch = [
          student.admission_no,
          student.full_name,
          student.class_name,
          student.guardian_phone,
          student.guardian_name
        ].some((value) =>
          String(value || '').toLowerCase().includes(search.toLowerCase())
        );

        const isActive = Number(student.active) === 1;
        return matchesSearch && (showInactive || isActive);
      })
    : page === 'Teachers'
      ? rows.filter((teacher: any) => {
          const matchesSearch = [teacher.full_name, teacher.email, teacher.phone, teacher.subjects, teacher.classes]
            .some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
          const isActive = Number(teacher.active) === 1;
          return matchesSearch && (showInactive || isActive);
        })
      : rows;

  const displayRows = page === 'Classes' ? classRowsForDisplay : filteredRows;

  function beginAdd() {
    setForm(
      page === 'Fees'
        ? { session: '2026/2027', term: 'First Term', amount: '' }
        : page === 'Results'
          ? { session: '2026/2027', term: 'First Term', ca: '', exam: '' }
          : {}
    );
    setEditingId(null);
    setShowForm(true);
  }

  function beginEdit(student: Student) {
    setForm({
      admission_no: student.admission_no,
      full_name: student.full_name,
      class_name: student.class_name,
      gender: student.gender || '',
      dob: student.dob || '',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      guardian_email: student.guardian_email || '',
      address: student.address || ''
    });

    setEditingId(student.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({});
  }

  function handleSubmit(e: any) {
    if (editingId !== null) {
      updateRecord(e, editingId);
    } else {
      saveRecord(e);
    }

    setShowForm(false);
    setEditingId(null);
  }

  function deactivate(student: Student) {
    const confirmed = window.confirm(
      `Deactivate ${student.full_name} (${student.admission_no})? ` +
      'Their record will be preserved and can be reactivated later.'
    );

    if (confirmed) {
      setStudentActive(student.id, 0);
    }
  }

  function reactivate(student: Student) {
    const confirmed = window.confirm(
      `Reactivate ${student.full_name}'s student record?`
    );

    if (confirmed) {
      setStudentActive(student.id, 1);
    }
  }

  return (
    <div className="panel resource-panel">
      <div className="panel-title">
        <div>
          <h3>{page} records</h3>
          <p className="muted">
            {page === 'Classes'
              ? `Showing ${displayRows.length} class(es)${classesLoading ? ' · updating student counts…' : ''}`
              : `Showing ${filteredRows.length} of ${rows.length} record(s)`}
          </p>
        </div>

        {(admin || (page === 'Results' && role === 'teacher')) && (
          <button
            className="primary-btn small"
            onClick={showForm ? cancelForm : beginAdd}
          >
            {showForm ? 'Cancel' : <><Plus size={15} /> Add record</>}
          </button>
        )}
      </div>

      {(page === 'Students' || page === 'Teachers') && admin && (
        <div className="student-toolbar">
          <div className="student-search">
            <Search size={18} />
            <input
              type="search"
              placeholder={page === 'Teachers' ? 'Search teacher name, email, phone or subject...' : 'Search name, admission number, class or guardian...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search students"
            />
          </div>

          <label className="inactive-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => window.location.reload()}
            title="Refresh the page"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      )}

      {showForm && (
        <form className="record-form" onSubmit={handleSubmit}>
          <div className="form-section-heading">
            <h3>{editingId !== null ? `Edit ${page === 'Teachers' ? 'teacher' : 'student'} record` : page === 'Admissions' ? 'Add admission application' : `Add ${page.toLowerCase()} record`}</h3>
            <p>
              {editingId !== null
                ? 'Update the information below and save your changes.'
                : page === 'Admissions'
                  ? 'Complete the applicant and parent/guardian information below. Required fields are marked by the form.'
                  : page === 'Teachers'
                    ? 'Select one or more subjects and classes assigned to this teacher. These options come from your school records.'
                    : 'Enter the required information below.'}
            </p>
          </div>

          <div className="form-grid">
            {(fieldDefs[page] || []).map(([name, label]) => (
              <div className="record-field" key={name}>
                <span className="field-label">{label}</span>

                {page === 'Teachers' && (name === 'subjects' || name === 'classes') ? (
                  <div className="teacher-dropdown-wrap" style={{ position: 'relative', width: '100%' }}>
                    <button
                      type="button"
                      className="teacher-dropdown-trigger"
                      aria-expanded={teacherDropdownOpen === name}
                      onClick={() => setTeacherDropdownOpen(teacherDropdownOpen === name ? null : name as 'subjects' | 'classes')}
                      style={{
                        width: '100%', minHeight: '42px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: '10px', padding: '10px 12px',
                        border: '1px solid #dbe3ef', borderRadius: '9px', background: '#fff',
                        color: '#243247', textAlign: 'left', cursor: 'pointer'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {splitTeacherSelections(form[name]).length
                          ? `${splitTeacherSelections(form[name]).length} ${name === 'subjects' ? 'subject' : 'class'}${splitTeacherSelections(form[name]).length === 1 ? '' : 'es'} selected`
                          : `Select ${name === 'subjects' ? 'subjects' : 'classes'}`}
                      </span>
                      <ChevronDown size={17} />
                    </button>

                    {teacherDropdownOpen === name && (
                      <div
                        className="teacher-dropdown-panel"
                        style={{
                          position: 'absolute', zIndex: 30, top: 'calc(100% + 6px)', left: 0,
                          width: 'min(100%, 360px)', minWidth: '240px', maxHeight: '260px',
                          overflowY: 'auto', padding: '10px', border: '1px solid #dbe3ef',
                          borderRadius: '10px', background: '#fff',
                          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.16)'
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '12px', padding: '2px 2px 9px', marginBottom: '5px',
                          borderBottom: '1px solid #e8edf4'
                        }}>
                          <strong style={{ fontSize: '13px' }}>Choose {name === 'subjects' ? 'subjects' : 'classes'}</strong>
                          <button
                            type="button"
                            aria-label={`Close ${name} dropdown`}
                            title="Close"
                            onClick={() => setTeacherDropdownOpen(null)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', border: 0, borderRadius: '7px',
                              background: '#f1f5f9', color: '#334155', cursor: 'pointer'
                            }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {(name === 'subjects' ? teacherSubjectOptions : teacherClassOptions).map((option) => (
                          <label key={option} style={{
                            display: 'flex', flexDirection: 'row', alignItems: 'center',
                            justifyContent: 'flex-start', gap: '9px', width: '100%',
                            padding: '8px 4px', borderRadius: '6px', cursor: 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={splitTeacherSelections(form[name]).includes(option)}
                              onChange={(e) => toggleTeacherSelection(name as 'subjects' | 'classes', option, e.target.checked)}
                              style={{
                                display: 'inline-block', width: '16px', minWidth: '16px',
                                maxWidth: '16px', height: '16px', minHeight: '16px',
                                flex: '0 0 16px', margin: 0, padding: 0
                              }}
                            />
                            <span style={{ display: 'inline-block', flex: '1 1 auto', lineHeight: 1.4 }}>
                              {option}
                            </span>
                          </label>
                        ))}
                        {(name === 'subjects' ? teacherSubjectOptions : teacherClassOptions).length === 0 && (
                          <small>No {name === 'subjects' ? 'subjects' : 'classes'} are available. Add them from the {name === 'subjects' ? 'Subjects' : 'Classes'} page first.</small>
                        )}
                      </div>
                    )}
                  </div>
                ) : (page === 'Fees' || page === 'Results') && name === 'student_id' ? (
                  <select
                    required
                    value={form.student_id ?? ''}
                    onChange={(e) => {
                      const selectedId = e.target.value === '' ? '' : Number(e.target.value);
                      const selectedStudent = studentOptions.find((student) => Number(student.id) === Number(selectedId));
                      setForm({
                        ...form,
                        student_id: selectedId,
                        ...(page === 'Results' ? { class_name: selectedStudent?.class_name || '' } : {})
                      });
                    }}
                  >
                    <option value="">{studentsLoading ? 'Loading students…' : 'Select a student'}</option>
                    {studentOptions.filter((student) => Number(student.active) !== 0).map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name} — {student.admission_no} — {student.class_name}
                      </option>
                    ))}
                  </select>
                ) : page === 'Results' && name === 'subject' ? (
                  <select required value={form[name] || ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })}>
                    <option value="">Select subject</option>
                    {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                ) : page === 'Results' && name === 'class_name' ? (
                  <input
                    required
                    type="text"
                    value={form[name] || ''}
                    readOnly
                    placeholder="Select a student first"
                  />
                ) : (page === 'Fees' || page === 'Results') && name === 'session' ? (
                  <input
                    required
                    type="text"
                    placeholder="e.g. 2026/2027"
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  />
                ) : (page === 'Fees' || page === 'Results') && name === 'term' ? (
                  <select required value={form[name] || ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })}>
                    <option value="">Select term</option>
                    {['First Term', 'Second Term', 'Third Term'].map((term) => <option key={term} value={term}>{term}</option>)}
                  </select>
                ) : page === 'Students' && name === 'class_name' ? (
                  <select
                    required
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                ) : (page === 'Students' || page === 'Admissions') && name === 'gender' ? (
                  <select
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                ) : (page === 'Students' || page === 'Admissions') && name === 'class_applying' ? (
                  <select
                    required
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                ) : (page === 'Students' || page === 'Admissions') && name === 'dob' ? (
                  <input
                    type="date"
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  />
                ) : page === 'Admissions' && name === 'guardian_email' ? (
                  <input
                    type="email"
                    maxLength={254}
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  />
                ) : page === 'Admissions' && name === 'address' ? (
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  />
                ) : name === 'body' ? (
                  <textarea
                    required
                    value={form[name] || ''}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  />
                ) : (
                  <input
                    required={[
                      'admission_no', 'full_name', 'class_name', 'name',
                      'applicant_name', 'class_applying', 'guardian_name',
                      'guardian_phone', 'student_id', 'subject',
                      'session', 'term', 'amount'
                    ].includes(name)}
                    type={
                      ['ca', 'exam', 'student_id', 'amount', 'paid'].includes(name)
                        ? 'number'
                        : name === 'dob'
                          ? 'date'
                          : 'text'
                    }
                    min={['ca', 'exam', 'amount', 'paid', 'student_id'].includes(name) ? 0 : undefined}
                    value={form[name] ?? ''}
                    onChange={(e) => setForm({
                      ...form,
                      [name]: ['ca', 'exam', 'student_id', 'amount', 'paid'].includes(name)
                        ? (e.target.value === '' ? '' : Number(e.target.value))
                        : e.target.value
                    })}
                  />
                )}
              </div>
            ))}
          </div>

          {page === 'Fees' && <p className="form-hint">Choose the student by name and admission number. The fee starts with ₦0 paid; record received money using the Record payment action after saving.</p>}
          {page === 'Results' && <p className="form-hint">Choose a student first. The class is filled automatically from the student record. Enter the academic session, term, subject, CA score and examination score.</p>}
          <div className="form-actions">
            <button type="submit" className="primary-btn">
              {editingId !== null ? 'Save changes' : 'Save record'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={cancelForm}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {page === 'Students' && admin && accountStudent && (
        <form className="record-form student-account-form" onSubmit={submitStudentAccount}>
          <div className="form-section-heading">
            <h3>Create portal login</h3>
            <p>
              Create secure login details for {accountStudent.full_name} ({accountStudent.admission_no}).
              The account will be linked to this student's existing record.
            </p>
          </div>
          <div className="form-grid">
            <label>
              Student
              <input value={`${accountStudent.full_name} — ${accountStudent.admission_no}`} readOnly />
            </label>
            <label>
              Login email
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="student@school.edu.ng"
              />
              <small>Use a unique email address the student or guardian can access.</small>
            </label>
            <label>
              Temporary password
              <input
                type="password"
                required
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <small>Share this privately and ask the student to change it after signing in.</small>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={accountSubmitting}>
              <LockKeyhole size={16} />
              {accountSubmitting ? 'Creating account…' : 'Create portal account'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={accountSubmitting}
              onClick={() => {
                setAccountStudent(null);
                setAccountEmail('');
                setTemporaryPassword('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {page === 'Teachers' && admin && accountTeacher && (
        <form className="record-form student-account-form" onSubmit={submitTeacherAccount}>
          <div className="form-section-heading">
            <h3>Create teacher portal login</h3>
            <p>
              Create secure login details for {accountTeacher.full_name}. The account will use the email already saved on this teacher record.
            </p>
          </div>
          <div className="form-grid">
            <label>
              Teacher
              <input value={accountTeacher.full_name} readOnly />
            </label>
            <label>
              Login email
              <input type="email" value={accountTeacher.email || ''} readOnly />
              <small>This email must be unique across all portal accounts.</small>
            </label>
            <label>
              Temporary password
              <input
                type="password"
                required
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <small>Share this privately and ask the teacher to change it after signing in.</small>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={accountSubmitting}>
              <LockKeyhole size={16} />
              {accountSubmitting ? 'Creating account…' : 'Create portal account'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={accountSubmitting}
              onClick={() => {
                setAccountTeacher(null);
                setTemporaryPassword('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {page === 'Fees' && admin && paymentFee && (
        <form className="fee-payment-form" onSubmit={submitPayment}>
          <div className="fee-payment-heading">
            <div>
              <span className="eyebrow">PAYMENT ENTRY</span>
              <h3>Record a payment</h3>
              <p>Fee #{paymentFee.id} · {paymentFee.session} · {paymentFee.term}</p>
            </div>
            <button type="button" className="secondary-btn" onClick={() => setPaymentFee(null)}>Cancel</button>
          </div>
          <div className="fee-payment-summary">
            <span>Fee amount <strong>{money(paymentFee.amount)}</strong></span>
            <span>Already paid <strong>{money(paymentFee.paid)}</strong></span>
            <span>Outstanding <strong>{money(paymentFee.balance)}</strong></span>
          </div>
          <div className="form-grid">
            <label>Payment amount
              <input
                type="number" min="0.01" max={Number(paymentFee.balance)} step="0.01"
                required value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </label>
            <label>Payment method
              <select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
                {['Cash', 'Bank Transfer', 'POS', 'Online', 'Cheque', 'Other'].map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label>Reference (optional)
              <input maxLength={100} value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="Receipt or transfer reference" />
            </label>
            <label>Notes (optional)
              <input maxLength={500} value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Additional details" />
            </label>
          </div>
          <p className="form-hint">Only record payments that the school has actually received and confirmed.</p>
          <div className="form-actions">
            <button type="submit" className="primary-btn">Confirm payment received</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {(columns[page] || []).map((column) => (
                <th key={column}>{title(column)}</th>
              ))}
              {(page === 'Students' || page === 'Teachers') && admin ? <th>Portal account</th> : null}
              {page === 'Admissions' || page === 'Results' ? <th>Action</th> : null}
              {(page === 'Students' || page === 'Teachers' || (page === 'Fees' && admin)) ? <th>Actions</th> : null}
            </tr>
          </thead>

          <tbody>
            {displayRows.map((row: any) => (
              <Fragment key={row.id}>
              <tr>
                {(columns[page] || []).map((column) => (
                  <td key={column}>
                    {page === 'Students' && column === 'active' ? (
                      <span className={`status ${Number(row.active) === 1 ? 'approved' : 'rejected'}`}>
                        {Number(row.active) === 1 ? 'Active' : 'Inactive'}
                      </span>
                    ) : column === 'status' ? (
                      <span className={`status ${String(row[column]).toLowerCase()}`}>
                        {row[column]}
                      </span>
                    ) : page === 'Classes' && column === 'student_count' ? (
                      <strong>{Number(row.student_count || 0)}</strong>
                    ) : column === 'body' ? (
                      String(row[column] || '').slice(0, 75)
                    ) : page === 'Fees' && column === 'student_id' ? (
                      (() => {
                        const student = studentOptions.find((item) => Number(item.id) === Number(row.student_id));
                        return student ? `${student.full_name} (${student.admission_no})` : `Student ID: ${row.student_id ?? '—'}`;
                      })()
                    ) : page === 'Fees' && ['amount', 'paid', 'balance'].includes(column) ? (
                      money(row[column])
                    ) : (
                      row[column] ?? '—'
                    )}
                  </td>
                ))}

                {page === 'Admissions' && admin && (
                  <td>
                    <div className="student-actions">
                      <button
                        type="button"
                        className="secondary-btn compact-btn"
                        onClick={() => setSelectedAdmission(row)}
                        aria-label={`Show admission details for ${row.applicant_name}`}
                      >
                        <ClipboardList size={14} /> Show details
                      </button>
                      <select
                        aria-label={`Admission status for ${row.applicant_name}`}
                        value={row.status || 'Pending'}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                      >
                        <option>Pending</option>
                        <option>Approved</option>
                        <option>Rejected</option>
                      </select>
                    </div>
                  </td>
                )}

                {page === 'Results' && admin && (
                  <td>
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                    >
                      <option>Submitted</option>
                      <option>Approved</option>
                      <option>Rejected</option>
                    </select>
                  </td>
                )}

                {page === 'Students' && admin && (
                  <td>
                    {row.portal_account_email ? (
                      <div className="portal-account-status">
                        <span className="status approved">Account created</span>
                        <small>{row.portal_account_email}</small>
                      </div>
                    ) : (
                      <span className="status rejected">No account</span>
                    )}
                  </td>
                )}

                {page === 'Teachers' && admin && (
                  <td>
                    {row.portal_account_email ? (
                      <div className="portal-account-status">
                        <span className={`status ${Number(row.active) === 1 ? 'approved' : 'rejected'}`}>
                          {Number(row.active) === 1 ? 'Account active' : 'Account deactivated'}
                        </span>
                        <small>{row.portal_account_email}</small>
                      </div>
                    ) : (
                      <span className="status rejected">No account</span>
                    )}
                  </td>
                )}

                {page === 'Students' && admin && (
                  <td>
                    <div className="student-actions">
                      {!row.portal_account_email && Number(row.active) === 1 && (
                        <button
                          type="button"
                          className="icon-action edit-action"
                          onClick={() => {
                            setAccountStudent(row);
                            setAccountEmail(row.guardian_email || '');
                            setTemporaryPassword('');
                          }}
                          title={`Create portal login for ${row.full_name}`}
                          aria-label={`Create portal login for ${row.full_name}`}
                        >
                          <KeyRound size={15} />
                          <span>Create Login</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-action edit-action"
                        onClick={() => beginEdit(row)}
                        title={`Edit ${row.full_name}`}
                        aria-label={`Edit ${row.full_name}`}
                      >
                        <Pencil size={15} />
                        <span>Edit</span>
                      </button>

                      {Number(row.active) === 1 ? (
                        <button
                          type="button"
                          className="icon-action deactivate-action"
                          onClick={() => deactivate(row)}
                          title={`Deactivate ${row.full_name}`}
                        >
                          <UserX size={15} />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="icon-action reactivate-action"
                          onClick={() => reactivate(row)}
                          title={`Reactivate ${row.full_name}`}
                        >
                          <UserCheck size={15} />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </div>
                  </td>
                )}

                {page === 'Teachers' && admin && (
                  <td>
                    <div className="student-actions">
                      <button
                        type="button"
                        className="secondary-btn compact-btn"
                        onClick={() => setSelectedTeacher(row)}
                        aria-label={`Show teacher details for ${row.full_name}`}
                      >
                        <ClipboardList size={14} /> Show details
                      </button>
                      {!row.portal_account_email && Number(row.active) === 1 && (
                        <button
                          type="button"
                          className="icon-action edit-action"
                          disabled={!row.email}
                          onClick={() => {
                            setAccountTeacher(row);
                            setTemporaryPassword('');
                          }}
                          title={`Create portal login for ${row.full_name}`}
                          aria-label={`Create portal login for ${row.full_name}`}
                        >
                          <KeyRound size={15} />
                          <span>Create Login</span>
                        </button>
                      )}
                      {!row.email && <small>Add an email to this teacher record first.</small>}
                      <button
                        type="button"
                        className={`icon-action ${Number(row.active) === 1 ? 'deactivate-action' : 'reactivate-action'}`}
                        onClick={() => {
                          const action = Number(row.active) === 1 ? 'deactivate' : 'reactivate';
                          const confirmed = window.confirm(
                            `${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${row.full_name}? ${action === 'deactivate' ? 'Their linked teacher portal account will be blocked from signing in.' : 'Their linked teacher portal account will be enabled again.'}`
                          );
                          if (confirmed) setTeacherActive(row.id, Number(row.active) === 1 ? 0 : 1);
                        }}
                        title={`${Number(row.active) === 1 ? 'Deactivate' : 'Reactivate'} ${row.full_name}`}
                        aria-label={`${Number(row.active) === 1 ? 'Deactivate' : 'Reactivate'} ${row.full_name}`}
                      >
                        {Number(row.active) === 1 ? <UserX size={15} /> : <UserCheck size={15} />}
                        <span>{Number(row.active) === 1 ? 'Deactivate' : 'Reactivate'}</span>
                      </button>
                    </div>
                  </td>
                )}

                {page === 'Fees' && admin && (
                  <td>
                    <div className="fee-row-actions">
                      <button
                        type="button"
                        className="secondary-btn compact-btn"
                        disabled={Number(row.balance) <= 0}
                        onClick={() => {
                          setPaymentFee(row);
                          setPaymentForm({ amount: '', payment_method: 'Cash', reference: '', notes: '' });
                        }}
                      >
                        <Wallet size={14} /> Record payment
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => openPaymentHistory(row.id)}
                      >
                        {historyOpenId === row.id ? 'Hide history' : 'Payment history'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
              {page === 'Fees' && admin && historyOpenId === row.id && (
                <tr key={`payments-${row.id}`} className="fee-history-row">
                  <td colSpan={(columns[page] || []).length + 1}>
                    <div className="fee-history-panel">
                      <h4>Payment history · {row.session} · {row.term}</h4>
                      {historyLoadingId === row.id ? (
                        <p className="muted">Loading payment history…</p>
                      ) : (paymentHistory[row.id] || []).length ? (
                        <div className="table-wrap fee-history-table">
                          <table>
                            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Received by</th></tr></thead>
                            <tbody>
                              {(paymentHistory[row.id] || []).map((payment: any) => (
                                <tr key={payment.id}>
                                  <td>{payment.created_at || '—'}</td>
                                  <td>{money(payment.amount)}</td>
                                  <td>{payment.payment_method}</td>
                                  <td>{payment.reference || '—'}</td>
                                  <td>{payment.received_by_name || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="muted">
                          {Number(row.paid) > 0
                            ? 'This fee has a previously recorded paid total, but no dated transactions are available in the new payment history.'
                            : 'No payment transactions have been recorded for this fee yet.'}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {page === 'Teachers' && admin && selectedTeacher && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedTeacher(null);
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(8, 20, 43, 0.68)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-details-title"
            className="panel"
            style={{
              width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px', background: '#fff', boxShadow: '0 24px 70px rgba(0,0,0,.25)'
            }}
          >
            <div className="panel-title" style={{ alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <span className="eyebrow">TEACHER PROFILE</span>
                <h3 id="teacher-details-title">{selectedTeacher.full_name || 'Teacher details'}</h3>
                <p className="muted">Teacher record #{selectedTeacher.id}</p>
              </div>
              <button type="button" className="secondary-btn" onClick={() => setSelectedTeacher(null)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
              {([
                ['Full name', selectedTeacher.full_name],
                ['Phone number', selectedTeacher.phone],
                ['Email address', selectedTeacher.email],
                ['Qualification', selectedTeacher.qualification],
                ['Assigned subjects', splitTeacherSelections(selectedTeacher.subjects).join(', ')],
                ['Assigned classes', splitTeacherSelections(selectedTeacher.classes).join(', ')],
                ['Teacher status', Number(selectedTeacher.active) === 1 ? 'Active' : 'Inactive'],
                ['Portal account', selectedTeacher.portal_account_email || 'No portal account'],
                ['Date added', selectedTeacher.created_at ? new Date(selectedTeacher.created_at).toLocaleString('en-NG') : 'Not available']
              ] as [string, any][]).map(([label, value]) => (
                <div key={label} style={{ padding: '12px 14px', border: '1px solid #e5eaf2', borderRadius: '10px', minWidth: 0 }}>
                  <small style={{ display: 'block', color: '#64748b', marginBottom: '6px' }}>{label}</small>
                  <strong style={{ display: 'block', color: '#102a56', fontWeight: 600, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {value === null || value === undefined || value === '' ? 'Not provided' : String(value)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="primary-btn" onClick={() => setSelectedTeacher(null)}>Done</button>
            </div>
          </section>
        </div>
      )}

      {page === 'Admissions' && admin && selectedAdmission && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedAdmission(null);
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(8, 20, 43, 0.68)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admission-details-title"
            className="panel"
            style={{
              width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px', background: '#fff', boxShadow: '0 24px 70px rgba(0,0,0,.25)'
            }}
          >
            <div className="panel-title" style={{ alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <span className="eyebrow">ADMISSION APPLICATION</span>
                <h3 id="admission-details-title">{selectedAdmission.applicant_name || 'Applicant details'}</h3>
                <p className="muted">Application #{selectedAdmission.id}</p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedAdmission(null)}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
              {([
                ['Applicant full name', selectedAdmission.applicant_name],
                ['Date of birth', selectedAdmission.dob ? String(selectedAdmission.dob).slice(0, 10) : 'Not provided'],
                ['Gender', selectedAdmission.gender],
                ['Class applying for', selectedAdmission.class_applying],
                ['Previous school', selectedAdmission.previous_school],
                ['Parent / guardian name', selectedAdmission.guardian_name],
                ['Phone number', selectedAdmission.guardian_phone],
                ['Email address', selectedAdmission.guardian_email],
                ['Residential address', selectedAdmission.address],
                ['Application status', selectedAdmission.status || 'Pending'],
                ['Date submitted', selectedAdmission.created_at ? new Date(selectedAdmission.created_at).toLocaleString('en-NG') : 'Not available']
              ] as [string, any][]).map(([label, value]) => (
                <div key={label} style={{ padding: '12px 14px', border: '1px solid #e5eaf2', borderRadius: '10px', minWidth: 0 }}>
                  <small style={{ display: 'block', color: '#64748b', marginBottom: '6px' }}>{label}</small>
                  <strong style={{ display: 'block', color: '#102a56', fontWeight: 600, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {value === null || value === undefined || value === '' ? 'Not provided' : String(value)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="primary-btn" onClick={() => setSelectedAdmission(null)}>Done</button>
            </div>
          </section>
        </div>
      )}

      {!displayRows.length && (
        <div className="empty">
          <ClipboardList size={32} />
          <b>{page === 'Classes' ? 'No classes available' : search ? 'No matching students found' : 'No records found'}</b>
          <span>
            {page === 'Classes'
              ? 'The standard school classes will appear here once the class list is loaded.'
              : page === 'Students'
                ? 'Try another search or add a new student record.'
                : 'Records will appear here when they are available.'}
          </span>
        </div>
      )}
    </div>
  );
}

function TeacherAnnouncements({ rows }: { rows: any[] }) {
  const [search, setSearch] = useState('');

  const announcements = (rows || []).filter((item: any) => {
    const query = search.trim().toLowerCase();
    return !query || [item.title, item.body, item.created_at]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });

  function formatDate(value?: string) {
    if (!value) return 'Date not provided';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat('en-NG', {
          day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(parsed);
  }

  return (
    <div className="student-announcements-page teacher-announcements-page">
      <div className="student-announcements-intro">
        <div className="student-announcements-icon"><Megaphone size={25} /></div>
        <div>
          <span className="eyebrow">STAFF UPDATES</span>
          <h2>Announcements from the school</h2>
          <p>Read important notices, school updates, and reminders shared by the administration.</p>
        </div>
      </div>

      <div className="student-announcements-toolbar">
        <div className="student-announcements-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Search school announcements"
            placeholder="Search announcements..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="announcement-count">{announcements.length} notice{announcements.length === 1 ? '' : 's'}</span>
      </div>

      {announcements.length ? (
        <div className="student-announcements-list">
          {announcements.map((item: any) => (
            <article className="panel student-announcement-card" key={item.id}>
              <div className="student-announcement-card-top">
                <span className="student-announcement-badge"><Megaphone size={14} /> School notice</span>
                <time>{formatDate(item.created_at)}</time>
              </div>
              <h3>{item.title || 'School announcement'}</h3>
              <p>{item.body || 'No additional details were provided.'}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Megaphone size={32} />
          <b>{search ? 'No matching announcements' : 'No announcements available yet'}</b>
          <span>{search ? 'Try a different search term.' : 'School notices published by the administration will appear here.'}</span>
        </div>
      )}
    </div>
  );
}

function StudentAnnouncements({ rows }: { rows: any[] }) {
  const [search, setSearch] = useState('');

  const announcements = (rows || []).filter((item: any) => {
    const query = search.trim().toLowerCase();
    return !query || [item.title, item.body, item.created_at]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });

  function formatAnnouncementDate(value?: string) {
    if (!value) return 'Date not provided';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat('en-NG', {
          day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(parsed);
  }

  return (
    <div className="student-announcements-page">
      <div className="student-announcements-intro">
        <div className="student-announcements-icon"><Megaphone size={25} /></div>
        <div>
          <span className="eyebrow">SCHOOL UPDATES</span>
          <h2>Announcements from your school</h2>
          <p>Important notices and updates shared by Best Builder College will appear here.</p>
        </div>
      </div>

      <div className="student-announcements-toolbar">
        <div className="student-announcements-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Search announcements"
            placeholder="Search announcements..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="announcement-count">{announcements.length} notice{announcements.length === 1 ? '' : 's'}</span>
      </div>

      {announcements.length ? (
        <div className="student-announcements-list">
          {announcements.map((item: any) => (
            <article className="panel student-announcement-card" key={item.id}>
              <div className="student-announcement-card-top">
                <span className="student-announcement-badge"><Megaphone size={14} /> School notice</span>
                <time>{formatAnnouncementDate(item.created_at)}</time>
              </div>
              <h3>{item.title || 'School announcement'}</h3>
              <p>{item.body || 'No additional details were provided.'}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty student-announcements-empty">
          <Megaphone size={32} />
          <b>{search ? 'No matching announcements' : 'No announcements yet'}</b>
          <span>{search ? 'Try a different search term.' : 'When the school publishes a notice, it will appear here.'}</span>
        </div>
      )}
    </div>
  );
}

function StudentFees({ token, rows }: any) {
  const [histories, setHistories] = useState<Record<number, any[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHistories() {
      setLoadingHistory(true);
      const entries = await Promise.all((rows || []).map(async (fee: any) => {
        try {
          const data = await request(`/fees/${fee.id}/payments`, token);
          return [Number(fee.id), data.payments || []] as const;
        } catch {
          return [Number(fee.id), []] as const;
        }
      }));

      if (!cancelled) {
        setHistories(Object.fromEntries(entries));
        setLoadingHistory(false);
      }
    }

    loadHistories();
    return () => { cancelled = true; };
  }, [rows, token]);

  const money = (value: unknown) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 2
  }).format(Number(value || 0));

  const totalAmount = (rows || []).reduce((sum: number, fee: any) => sum + Number(fee.amount || 0), 0);
  const totalPaid = (rows || []).reduce((sum: number, fee: any) => sum + Number(fee.paid || 0), 0);
  const totalBalance = (rows || []).reduce((sum: number, fee: any) => sum + Number(fee.balance || 0), 0);

  return (
    <div className="student-fees-page">
      <div className="fee-summary-grid">
        <div className="fee-summary-card"><span>Total fees</span><strong>{money(totalAmount)}</strong></div>
        <div className="fee-summary-card"><span>Total paid</span><strong>{money(totalPaid)}</strong></div>
        <div className="fee-summary-card outstanding"><span>Outstanding balance</span><strong>{money(totalBalance)}</strong></div>
      </div>

      {!rows?.length ? (
        <div className="empty fee-empty"><Wallet size={32} /><b>No fee records yet</b><span>Your fee statements will appear here when the school adds them.</span></div>
      ) : (
        <div className="student-fee-list">
          {rows.map((fee: any) => (
            <article className="panel student-fee-card" key={fee.id}>
              <div className="student-fee-card-heading">
                <div><span className="eyebrow">{fee.session}</span><h3>{fee.term}</h3></div>
                <span className={`status ${String(fee.status || 'Unpaid').toLowerCase().replaceAll(' ', '-')}`}>{fee.status || 'Unpaid'}</span>
              </div>
              <div className="student-fee-amounts">
                <div><span>Fee amount</span><strong>{money(fee.amount)}</strong></div>
                <div><span>Paid</span><strong>{money(fee.paid)}</strong></div>
                <div><span>Balance</span><strong>{money(fee.balance)}</strong></div>
              </div>
              <div className="fee-history-section">
                <h4><ClipboardList size={16} /> Payment history</h4>
                {loadingHistory ? <p className="muted">Loading payment history…</p> : (histories[fee.id] || []).length ? (
                  <div className="table-wrap fee-history-table">
                    <table>
                      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
                      <tbody>
                        {(histories[fee.id] || []).map((payment: any) => (
                          <tr key={payment.id}>
                            <td>{payment.created_at || '—'}</td><td>{money(payment.amount)}</td>
                            <td>{payment.payment_method}</td><td>{payment.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : Number(fee.paid) > 0 ? (
                  <p className="fee-legacy-note">A paid total was already on this fee record before the payment-history ledger was introduced. Older transactions are not available as dated entries.</p>
                ) : (
                  <p className="muted">No payments have been recorded for this fee yet.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type StudentProfileData = {
  id: number;
  admission_no: string;
  full_name: string;
  class_name: string;
  gender?: string | null;
  dob?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  address?: string | null;
  active: number;
};

function StudentProfile({ token, user }: any) {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    address: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setProfileError('');

      try {
        const data = await request('/student/profile', token);
        const loaded = data?.profile || null;
        if (!cancelled) {
          setProfile(loaded);
          if (loaded) {
            setProfileForm({
              address: loaded.address || '',
              guardian_name: loaded.guardian_name || '',
              guardian_phone: loaded.guardian_phone || '',
              guardian_email: loaded.guardian_email || '',
            });
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setProfileError(error.message || 'Could not load your student profile.');
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [token, user.id]);

  const formatDate = (value?: string | null) => {
    if (!value) return 'Not provided';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat('en-NG', {
          day: 'numeric', month: 'long', year: 'numeric'
        }).format(parsed);
  };

  const detail = (label: string, value?: string | number | null) => (
    <div className="student-profile-detail" key={label}>
      <span>{label}</span>
      <strong>{value === null || value === undefined || value === '' ? 'Not provided' : value}</strong>
    </div>
  );

  async function saveProfile(e: any) {
    e.preventDefault();
    setProfileError('');
    setProfileNotice('');
    setSavingProfile(true);

    try {
      const data = await request('/student/profile', token, {
        method: 'PATCH',
        body: JSON.stringify({
          address: profileForm.address.trim(),
          guardian_name: profileForm.guardian_name.trim(),
          guardian_phone: profileForm.guardian_phone.trim(),
          guardian_email: profileForm.guardian_email.trim(),
        }),
      });
      setProfile(data?.profile || profile);
      setProfileNotice(data?.message || 'Your profile has been updated.');
    } catch (error: any) {
      setProfileError(error.message || 'Could not update your profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: any) {
    e.preventDefault();
    setPasswordError('');
    setPasswordNotice('');

    if (newPassword.length < 8) {
      setPasswordError('Your new password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const data = await request('/student/change-password', token, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordNotice(data?.message || 'Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordError(error.message || 'Could not change your password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="student-profile-page">
      {profileError && <div className="alert error" role="alert">{profileError}</div>}
      {profileNotice && <div className="alert success" role="status">{profileNotice}</div>}

      {loadingProfile ? (
        <div className="panel student-profile-loading" aria-live="polite">
          <RefreshCw size={22} />
          <p>Loading your student profile…</p>
        </div>
      ) : profile ? (
        <>
          <section className="student-profile-hero panel">
            <div className="student-profile-avatar"><UserRound size={34} /></div>
            <div className="student-profile-hero-copy">
              <span className="eyebrow">STUDENT PROFILE</span>
              <h2>{profile.full_name || user.name}</h2>
              <p>{profile.class_name || 'Class not assigned'} · Admission No. {profile.admission_no || 'Not assigned'}</p>
            </div>
            <span className={`status ${Number(profile.active) === 1 ? 'approved' : 'rejected'}`}>
              {Number(profile.active) === 1 ? 'Active student' : 'Inactive student'}
            </span>
          </section>

          <section className="panel student-profile-section">
            <div className="panel-title">
              <div>
                <h3>Personal information</h3>
                <p className="muted">These details are maintained by the school. Contact the administrator to correct protected information.</p>
              </div>
              <UserRound />
            </div>
            <div className="student-profile-grid">
              {detail('Full name', profile.full_name || user.name)}
              {detail('Admission number', profile.admission_no)}
              {detail('Class', profile.class_name)}
              {detail('Account email', user.email)}
              {detail('Gender', profile.gender)}
              {detail('Date of birth', formatDate(profile.dob))}
              {detail('Student record status', Number(profile.active) === 1 ? 'Active' : 'Inactive')}
            </div>
          </section>

          <section className="panel student-profile-section">
            <div className="panel-title">
              <div>
                <h3>Edit address and guardian details</h3>
                <p className="muted">You can update your residential address and parent/guardian contact information.</p>
              </div>
              <Pencil />
            </div>

            <form className="student-profile-edit-form" onSubmit={saveProfile}>
              <div className="form-grid">
                <label>
                  Parent / guardian name
                  <input
                    type="text"
                    maxLength={150}
                    minLength={2}
                    value={profileForm.guardian_name}
                    onChange={(e) => setProfileForm({ ...profileForm, guardian_name: e.target.value })}
                    placeholder="Enter guardian's full name"
                  />
                </label>
                <label>
                  Guardian phone
                  <input
                    type="tel"
                    maxLength={40}
                    minLength={7}
                    value={profileForm.guardian_phone}
                    onChange={(e) => setProfileForm({ ...profileForm, guardian_phone: e.target.value })}
                    placeholder="Enter guardian's phone number"
                  />
                </label>
                <label>
                  Guardian email
                  <input
                    type="email"
                    maxLength={254}
                    value={profileForm.guardian_email}
                    onChange={(e) => setProfileForm({ ...profileForm, guardian_email: e.target.value })}
                    placeholder="guardian@example.com"
                  />
                </label>
                <label className="student-profile-address-field">
                  Residential address
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Enter your current residential address"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-btn" disabled={savingProfile}>
                  <Save size={16} /> {savingProfile ? 'Saving changes…' : 'Save profile changes'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel student-profile-section">
            <div className="panel-title">
              <div>
                <h3>Change password</h3>
                <p className="muted">Use your current password to set a new password for your school account.</p>
              </div>
              <LockKeyhole />
            </div>

            {passwordError && <div className="alert error" role="alert">{passwordError}</div>}
            {passwordNotice && <div className="alert success" role="status">{passwordNotice}</div>}

            <form className="student-password-form" onSubmit={changePassword}>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={200}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </label>
              <div className="form-grid">
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={200}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={200}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-btn" disabled={savingPassword}>
                  <KeyRound size={16} /> {savingPassword ? 'Changing password…' : 'Change password'}
                </button>
              </div>
              <p className="student-profile-note">Choose a unique password and do not share it with anyone. Your current password is never displayed or stored in the page.</p>
            </form>
          </section>
        </>
      ) : (
        <div className="panel student-empty-state">
          <UserRound size={28} />
          <b>Student profile unavailable</b>
          <p>Your profile could not be found. Please contact the school administrator.</p>
        </div>
      )}
    </div>
  );
}

function StudentDashboard({ token, user, dashboard, go }: any) {
  const [results, setResults] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [loadingStudentData, setLoadingStudentData] = useState(true);
  const [studentError, setStudentError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadStudentData() {
      setLoadingStudentData(true);
      setStudentError('');

      try {
        const [resultRows, feeRows] = await Promise.all([
          request('/results', token),
          request('/fees', token),
        ]);

        if (!cancelled) {
          setResults(Array.isArray(resultRows) ? resultRows : []);
          setFees(Array.isArray(feeRows) ? feeRows : []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setStudentError(error.message || 'Could not load your student information.');
        }
      } finally {
        if (!cancelled) setLoadingStudentData(false);
      }
    }

    loadStudentData();

    return () => {
      cancelled = true;
    };
  }, [token, user.id]);

  const totalFees = fees.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPaid = fees.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const totalBalance = fees.reduce((sum, item) => sum + Number(item.balance || 0), 0);

  const money = (value: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 2,
    }).format(value);

  const recentResults = [...results].slice(0, 5);
  const recentFees = [...fees].slice(0, 4);

  return (
    <div className="student-dashboard">
      <div className="student-welcome panel">
        <div className="student-welcome-icon">
          <GraduationCap size={30} />
        </div>
        <div>
          <span className="eyebrow">YOUR LEARNING SPACE</span>
          <h2>Welcome, {user.name}!</h2>
          <p>Here is an overview of your approved academic results and school fees.</p>
          <small>
            {user.student_id
              ? `Student record ID: ${user.student_id}`
              : 'Your student record is linked to your school account.'}
          </small>
        </div>
      </div>

      {studentError && (
        <div className="alert error" role="alert">{studentError}</div>
      )}

      <div className="stats-grid student-stats-grid">
        <div className="stat-card">
          <span className="stat-icon"><ClipboardList size={21} /></span>
          <span>Approved Results</span>
          <strong>{loadingStudentData ? '…' : results.length}</strong>
          <small>Results available to you</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><Wallet size={21} /></span>
          <span>Total Fees</span>
          <strong>{loadingStudentData ? '…' : money(totalFees)}</strong>
          <small>Fees recorded for your account</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><CheckCircle2 size={21} /></span>
          <span>Total Paid</span>
          <strong>{loadingStudentData ? '…' : money(totalPaid)}</strong>
          <small>Payments recorded</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><Clock3 size={21} /></span>
          <span>Outstanding Balance</span>
          <strong>{loadingStudentData ? '…' : money(totalBalance)}</strong>
          <small>Remaining fees</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-title">
            <div>
              <h3>Recent approved results</h3>
              <p className="muted">Only your approved results are shown here.</p>
            </div>
            <button className="text-btn" onClick={() => go('Results')}>
              View results <ArrowRight size={15} />
            </button>
          </div>

          {loadingStudentData ? (
            <p className="muted">Loading your results…</p>
          ) : recentResults.length ? (
            <div className="student-summary-list">
              {recentResults.map((item: any) => (
                <div className="list-row" key={item.id}>
                  <div className="row-icon"><BookMarked /></div>
                  <div className="row-main">
                    <b>{item.subject}</b>
                    <small>{item.class_name} · {item.session} · {item.term}</small>
                  </div>
                  <strong className="student-score">{Number(item.total || 0)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="student-empty-state">
              <ClipboardList size={25} />
              <p>No approved results are available yet.</p>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <div>
              <h3>School fees</h3>
              <p className="muted">Your fee and payment records.</p>
            </div>
            <button className="text-btn" onClick={() => go('Fees')}>
              View fees <ArrowRight size={15} />
            </button>
          </div>

          {loadingStudentData ? (
            <p className="muted">Loading your fee records…</p>
          ) : recentFees.length ? (
            <div className="student-summary-list">
              {recentFees.map((item: any) => (
                <div className="list-row" key={item.id}>
                  <div className="row-icon"><Wallet /></div>
                  <div className="row-main">
                    <b>{item.session} · {item.term}</b>
                    <small>Paid {money(Number(item.paid || 0))} of {money(Number(item.amount || 0))}</small>
                  </div>
                  <span className={`status ${String(item.status || '').toLowerCase().replaceAll(' ', '-')}`}>
                    {item.status || 'Unpaid'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="student-empty-state">
              <Wallet size={25} />
              <p>No fee records are available yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="panel student-announcements">
        <div className="panel-title">
          <h3>School announcements</h3>
          <Megaphone />
        </div>
        {(dashboard.announcements || []).length ? (
          dashboard.announcements.map((item: any) => (
            <div className="announcement" key={item.id}>
              <b>{item.title}</b>
              <p>{item.body}</p>
              <small>{item.created_at}</small>
            </div>
          ))
        ) : (
          <p className="muted">There are no current announcements.</p>
        )}
      </div>
    </div>
  );
}

