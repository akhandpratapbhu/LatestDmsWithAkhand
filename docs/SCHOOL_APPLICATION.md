# School Management Application

Plan and configuration guide for the **School Management** project on the Configure System platform (`slug: school-management`, DB: `school_management_db`).

Related: [ENTERPRISE_BUILDER.md](./ENTERPRISE_BUILDER.md) · [HOSPITAL_APPLICATION.md](./HOSPITAL_APPLICATION.md) (same Phase-1 shell pattern)

---

## 1. Vision

Build a **School Management System (SMS)** as a metadata-driven project on this platform—not a separate codebase.

| Layer | What it provides |
| --- | --- |
| Platform shell | Projects list, feature marketplace, open project |
| Project DB | Users, IAM roles, menus, login branding |
| Platform DB + `organizationId` | Dynamic Forms, submissions (student/academic records), grids |
| Menu Builder | Sidebar IA → each operational screen is a **published form** at `/{slug}/data/:formId` |

**Goal:** Admissions registers a student → assigns class/section → teachers mark attendance → accountant collects fees → exams publish results, with role-appropriate menus and CRUD. Phase 1 delivers a **working school shell** (menus + published forms + grids). Deeper workflows (timetable engine, parent portal, report cards PDF, library circulation) come later on the same builders.

---

## 2. Actors / roles

Domain roles are seeded via `npm run prisma:seed:org-roles -w @dms/api` (and expected before/alongside the school app seed). Map to modules:

| Role code | Name | Primary modules |
| --- | --- | --- |
| `SCHOOL_ADMIN` | School Admin | Everything: IAM, menus, forms, masters, fees, reports, settings |
| `PRINCIPAL` | Principal | Oversight: students, academics, attendance, exams, reports (mostly view + leadership) |
| `TEACHER` | Teacher | Classes, subjects, attendance, exams/results; students (view) |
| `STUDENT` | Student | Limited self-service: attendance, results, fees (view) |
| `ACCOUNTANT` | Accountant | Fee structure, fee collection, reports |
| `LIBRARIAN` | Librarian | Library books / catalog |
| `COUNSELOR` | Counselor | Students (view), admission enquiries (view/update) |
| `ADMISSIONS_OFFICER` | Admissions Officer | Student registration, enquiries |

Platform membership (`OWNER` / `ADMIN` / `MEMBER`) still gates **who can open the project**; IAM roles gate **what they see inside**.

---

## 3. Information architecture (Phase 1)

Platform groups (`Workspace`, `Access Control`, `Configuration`, `Governance`) remain for builders/admin. School IA is added as **school menu groups**:

```text
Dashboard                          → /school-management  (existing Workspace)

Admissions
  ├── Student Registration         → form STUDENT_REG
  └── Admission Enquiries          → form ADMISSION_ENQUIRY

Academics
  ├── Classes / Sections           → form CLASS_SECTION
  ├── Subjects                     → form SUBJECT
  └── Timetable                    → form TIMETABLE

Teachers
  └── Teachers / Staff             → form TEACHER_STAFF

Attendance
  └── Attendance                   → form ATTENDANCE

Examinations
  └── Exams / Results              → form EXAM_RESULT

Fees / Accounts
  ├── Fee Structure                → form FEE_STRUCTURE
  └── Fee Collection               → form FEE_COLLECTION

Library
  └── Library Books                → form LIBRARY_BOOK

Masters
  ├── Departments                  → form DEPARTMENT
  └── Academic Year                → form ACADEMIC_YEAR

Reports / Dashboard Builder          → /app/dashboards (Configuration)
Settings
  ├── Login page                   → /settings/login (platform)
  ├── Users / IAM / Forms / Menus  → existing Configuration & Access groups
```

**URL pattern for form screens:** `/school-management/data/:formId` (canonical path stored as `/app/data/:formId`).

---

## 4. End-to-end flows

### 4.1 Student journey (operations)

```text
1. Admissions Officer → Admission Enquiry (capture lead)
2. Admissions Officer → Student Registration (enroll student)
3. School Admin / Admissions → Classes / Sections (assign class & section)
4. Teacher → Attendance (daily mark present / absent)
5. Accountant → Fee Structure (define tuition / term fees)
6. Accountant → Fee Collection (record payment)
7. Teacher → Exams / Results (enter marks / publish grade)
8. (Later) Report card / parent portal / library issue-return
```

### 4.2 Admin setup flow (builders)

```text
1. Ensure project exists (school-management) + project DB provisioned
2. Enable features: forms, menu-builder, users, roles, login-page, dashboard, …
3. Seed domain roles (School Admin, Teacher, Student, …)
4. Create & publish Dynamic Forms (tabs → sections → controls)
5. Create Menu Groups + Menus; set Menu.formId → auto path /app/data/:formId
6. Sync menu.* + {resource}.view|create|update|delete permissions
7. Assign RoleMenu + RolePermission per role
8. Tune Login page (companyName, welcome, description) + theme `school`
9. Log in at /school-management/login → verify sidebar + CRUD grids
```

**Automated:** `npm run prisma:seed:school -w @dms/api` performs steps 2–8 for Phase 1 (including role dashboards).

### 4.3 Role dashboards

Uses the existing **Dashboard Builder** (project DB `Dashboard` + `LandingPage`).

| Role | Dashboard | Phase-1 widgets |
| --- | --- | --- |
| `SCHOOL_ADMIN` / `PRINCIPAL` | School / Principal Overview | Students, teachers, classes, fees, attendance, exams (form submission counts) |
| `TEACHER` | Teacher Workspace | Classes, students, attendance, exam results counts |
| `STUDENT` | Student Home | Fees / results / attendance summary (school-wide form totals until personal portals exist) |

- Home: `/{slug}/dashboard` → role landing → live values from `GET /school/dashboard-stats`.
- Builder: `/{slug}/dashboards` — project grid to list/edit.
- Seed: `prisma:seed:school` or `npm run prisma:seed:role-dashboards -w @dms/api`.

---

## 5. Forms to build (Phase 1)

All forms use real builder types: `TEXT`, `TEXTAREA`, `NUMBER`, `EMAIL`, `SELECT`, `DATE`, `CHECKBOX`, etc. Status: **PUBLISHED**.

| Code | Name | Key fields |
| --- | --- | --- |
| `STUDENT_REG` | Student Registration | `admissionNo`, `fullName`, `dateOfBirth`, `gender`, `className`, `section`, `parentName`, `phone`, `email`, `address`, `status` |
| `ADMISSION_ENQUIRY` | Admission Enquiry | `enquiryNo`, `studentName`, `seekingClass`, `parentName`, `phone`, `email`, `enquiryDate`, `source`, `notes`, `status` |
| `TEACHER_STAFF` | Teacher / Staff | `employeeCode`, `fullName`, `roleType`, `department`, `subjects`, `phone`, `email`, `joiningDate`, `status` |
| `CLASS_SECTION` | Class / Section | `classCode`, `className`, `section`, `classTeacher`, `capacity`, `roomNo`, `academicYear`, `status` |
| `SUBJECT` | Subject | `subjectCode`, `subjectName`, `className`, `credits`, `teacherName`, `status` |
| `TIMETABLE` | Timetable | `className`, `section`, `dayOfWeek`, `period`, `subjectName`, `teacherName`, `roomNo`, `status` |
| `ATTENDANCE` | Attendance | `attendanceDate`, `className`, `section`, `studentName`, `admissionNo`, `status`, `markedBy`, `remarks` |
| `FEE_STRUCTURE` | Fee Structure | `feeCode`, `feeName`, `className`, `academicYear`, `amount`, `dueDate`, `frequency`, `status` |
| `FEE_COLLECTION` | Fee Collection | `receiptNo`, `studentName`, `admissionNo`, `feeName`, `amount`, `paidDate`, `paymentMode`, `paymentStatus` |
| `LIBRARY_BOOK` | Library Book | `isbn`, `title`, `author`, `category`, `copies`, `available`, `shelfLocation`, `status` |
| `EXAM_RESULT` | Exam / Result | `examName`, `examDate`, `className`, `subjectName`, `studentName`, `admissionNo`, `marksObtained`, `maxMarks`, `grade`, `status` |
| `DEPARTMENT` | Department | `code`, `name`, `headOfDept`, `phone`, `location`, `status` |
| `ACADEMIC_YEAR` | Academic Year | `code`, `name`, `startDate`, `endDate`, `isCurrent`, `status` |

---

## 6. Menus to create

| Menu group (code) | Submenu label | Linked form code |
| --- | --- | --- |
| `ADMISSIONS` | Student Registration | `STUDENT_REG` |
| `ADMISSIONS` | Admission Enquiries | `ADMISSION_ENQUIRY` |
| `ACADEMICS` | Classes / Sections | `CLASS_SECTION` |
| `ACADEMICS` | Subjects | `SUBJECT` |
| `ACADEMICS` | Timetable | `TIMETABLE` |
| `TEACHERS` | Teachers / Staff | `TEACHER_STAFF` |
| `ATTENDANCE` | Attendance | `ATTENDANCE` |
| `EXAMINATIONS` | Exams / Results | `EXAM_RESULT` |
| `FEES` | Fee Structure | `FEE_STRUCTURE` |
| `FEES` | Fee Collection | `FEE_COLLECTION` |
| `LIBRARY` | Library Books | `LIBRARY_BOOK` |
| `MASTERS` | Departments | `DEPARTMENT` |
| `MASTERS` | Academic Year | `ACADEMIC_YEAR` |

Parent row per group can be a non-navigating group header (menus live as group children with `formId`). Platform menus under Workspace / Access / Configuration stay as-is.

---

## 7. Permissions matrix (guidance)

Menu access = `menu.{resource}` (+ `RoleMenu`). Record CRUD = `{resource}.view|create|update|delete` (auto-derived from menu label slug).

| Module | School Admin | Principal | Teacher | Student | Accountant | Librarian | Counselor | Admissions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Student Registration | CRUD | R | R | — | R | — | R | CRUD |
| Admission Enquiries | CRUD | R | — | — | — | — | RU | CRUD |
| Classes / Sections | CRUD | R | R | R | R | — | R | R |
| Subjects | CRUD | R | R | R | — | — | — | — |
| Timetable | CRUD | R | R | R | — | — | — | — |
| Teachers / Staff | CRUD | R | R | — | — | — | — | R |
| Attendance | CRUD | R | CRUD | R | — | — | R | — |
| Exams / Results | CRUD | R | CRUD | R | — | — | R | — |
| Fee Structure | CRUD | R | — | — | CRUD | — | — | — |
| Fee Collection | CRUD | R | — | R | CRUD | — | — | — |
| Library Books | CRUD | R | R | R | — | CRUD | — | — |
| Departments / Academic Year | CRUD | R | R | — | R | R | R | R |
| Forms / Menus / IAM / Users | Full | — | — | — | — | — | — | — |
| Reports | Full | R | — | — | R | — | — | — |

`R` = view (+ menu), `C/U/D` = create/update/delete. School Admin receives the full permission catalog. Principal gets broad view via seed grants on operational menus.

---

## 8. What is configured now vs later

### Phase 1 — Now (seeded via `prisma:seed:school`)

- [x] Project `school-management` + `school_management_db`
- [x] Features: `forms`, `menu-builder`, `users`, `roles`, `login-page`, dashboard, grids, reports, …
- [x] Domain IAM roles (Principal, Teacher, Student, Accountant, Librarian, …) via org-roles seed
- [x] Published Phase-1 Dynamic Forms (table in §5) — 13 forms
- [x] School menu groups + form-linked submenus — Admissions → Masters
- [x] Menu + CRUD permissions granted to School Admin and operational roles
- [x] Login branding: companyName **School Management**, school welcome/description
- [x] Visual theme preset `school` (org + login page) — academic navy + warm gold
- [ ] Sample submission rows (optional; create via UI)
- [ ] Demo student/teacher portal users (optional; not required for Phase 1 shell)

- [x] Role landing dashboards (Admin / Principal / Teacher / Student) — form-count based Phase 1
- [ ] Reports beyond role dashboards (custom chart aggregates)

### Phase 2 — Next

- [ ] Class roster linked to student registration (lookups)
- [ ] Attendance bulk mark-by-class
- [ ] Fee reminders / outstanding balance views
- [ ] Exam schedule separate from result entry
- [ ] Library issue / return circulation form
- [ ] Per-student / per-teacher scoped dashboard metrics (not school-wide form totals)

### Phase 3 — Later

- [ ] Parent / guardian portal
- [ ] Cross-form lookups (student picker → admission no. auto-fill)
- [ ] Workflow / status machines (enquiry → admission → fee)
- [ ] Report card generation / PDF
- [ ] Timetable conflict checks
- [ ] Notifications for fee due / exam publish

---

## 9. How to open and verify

### URLs

| Step | URL |
| --- | --- |
| School login | `/school-management/login` |
| After login (dashboard) | `/school-management` or `/school-management/dashboard` |
| Form records (example) | `/school-management/data/:formId` |
| Forms builder | `/school-management/forms` |
| Menu builder | `/school-management/menus` |
| IAM | `/school-management/iam` |
| Dashboard Builder | `/school-management/dashboards` |
| Login settings | `/school-management/settings/login` |
| Platform projects | `/app/projects` |

**Slug verified:** `school-management` (same as org-roles target and theme map).

### Test paths

1. **School login** — open `/school-management/login`, sign in as a project user with `SCHOOL_ADMIN`. Confirm sidebar shows Admissions, Academics, Teachers, Attendance, Examinations, Fees / Accounts, Library, Masters.
2. **Open a module** — e.g. Student Registration → grid → **Add** → submit → row appears.
3. **Platform admin** — `/app/projects` → open **school management** → same workspace under project context.
4. **Role check** — assign `TEACHER` to a user; they should see Attendance / Exams, not IAM/Menus builders. Assign `ACCOUNTANT` → Fees menus.
5. **Role dashboards** — Admin/Principal see school-wide form counts on `/school-management/dashboard`; Teacher/Student landings differ. Edit via **Dashboard Builder**.

### Re-seed

```bash
npm run prisma:seed:org-roles -w @dms/api    # domain roles (SCHOOL_ADMIN, TEACHER, …)
npm run prisma:seed:school -w @dms/api       # forms + menus + role dashboards + theme
npm run prisma:seed:role-dashboards -w @dms/api  # optional: dashboards only
```

Idempotent: forms/menus upsert by code/label; permissions use `skipDuplicates`.

---

## 10. Implementation notes (platform constraints)

- Forms live on the **platform** DB (`DynamicForm` / `FormTab` / `FormSection` / `FormControl`); menus/IAM/login live on the **project** DB.
- There is no separate “FormDefinition” model — use `DynamicForm` + nested controls.
- Linking `Menu.formId` sets path to `/app/data/:formId`; AppShell resolves under `/{slug}/…`.
- Do not invent AI tutoring features; keep forms as structured data entry + grids.
- Script: `apps/api/prisma/seed-school-app.ts`.
- Appointment-style custom modules (hospital patient portal) are **out of scope** for Phase 1 school shell.
