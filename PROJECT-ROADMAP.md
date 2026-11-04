# Development roadmap

## Phase 1 — included foundation
- Public pages and online admission form
- Login and role-aware navigation
- SQLite schema and seeded demo accounts
- Basic school record CRUD endpoints
- Result submission/approval state and fee calculations
- Responsive Navy/Sky Blue UI

## Phase 2 — before school pilot
- Replace demo accounts with admin-created accounts and password reset
- Link each student account to exactly one student record (currently demo role only)
- Teacher-to-class/subject assignments enforced in every query
- Edit/delete controls and pagination/filtering on tables
- School-confirmed grading scales, academic sessions and terms
- Student/parent result access and student-specific fee visibility
- Admission approval-to-student conversion
- Uploads using safe object storage, file type checks and malware scanning
- Audit log, backups, rate limits, CSRF strategy as appropriate, and automated tests

## Phase 3 — production
- PostgreSQL and migration tooling
- Deployment pipeline and secrets manager
- HTTPS domain, monitoring, backups/restore drills
- Security/privacy review and user acceptance testing
- Staff training and handover documentation
