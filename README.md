# Best Builder College Portal

A full-stack starter implementation based on the **BEST BUILDER COLLEGE — School Portal Development Proposal**.

Brand: Navy Blue + Sky Blue. Responsive public website and role-aware school portal.

## Stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: SQLite via better-sqlite3
- Authentication: bcrypt password hashing + JWT
- Validation: Zod

## Requirements
- Node.js 20+
- npm

## Run locally
Open this folder in VS Code, then open two terminals.

### 1. API
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
The API starts at `http://localhost:4000`. On first start it creates `data/school.db` and seeds demo data.

### 2. Web app
```bash
cd client
npm install
npm run dev
```
Open the URL printed by Vite (usually `http://localhost:5173`).

## Demo logins
- Administrator: `admin@bestbuilder.edu.ng` / `ChangeMe123!`
- Teacher: `teacher@bestbuilder.edu.ng` / `ChangeMe123!`
- Student: `student@bestbuilder.edu.ng` / `ChangeMe123!`

**Change demo passwords and JWT_SECRET before any deployment.** Demo data is fictional.

## What's included
- Public home, about, academics, admissions, contact and login views
- Role-based login for Administrator, Teacher and Student
- Dashboard overview
- CRUD API foundation for students, teachers, classes, subjects, admissions, results, fees and announcements
- Admission application submission and status workflow
- Results submission/approval status field
- Fee balance and payment status calculation
- Server-side role checks, request validation, password hashing and basic security headers
- Navy/sky-blue responsive interface

## Important before production
This is a development-ready foundation, not a certified production deployment. Before real school data is entered:
1. Replace demo credentials and `JWT_SECRET`; use a secret manager.
2. Add HTTPS, backups, monitoring, rate limiting, audit logging and recovery procedures.
3. Review Nigeria Data Protection Act obligations, retention, parental consent, and access controls.
4. Have the school confirm grading/assessment rules, terms/sessions, admission workflow and fee policy.
5. Add automated tests, verify all role permissions, and conduct a security review.
6. Configure a persistent database/volume and deployment-specific environment variables. SQLite is suitable for local development and small deployments; use PostgreSQL for higher concurrency.
7. Upload storage is not enabled yet; avoid uploading real student photographs/documents until a vetted storage workflow is implemented.

## GitHub
```bash
git init
git add .
git commit -m "Initial Best Builder College portal"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
Do not commit `.env`, database files, credentials or student data.
