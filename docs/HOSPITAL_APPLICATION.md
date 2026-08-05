# Hospital Management Application

Plan and configuration guide for the **Hospital Management** project on the Enterprise Builder / DMS platform (`slug: hospital-management`, DB: `hospital_management_db`).

Related: [ENTERPRISE_BUILDER.md](./ENTERPRISE_BUILDER.md)

---

## 1. Vision

Build a **Hospital Management System (HMS)** as a metadata-driven project on this platform—not a separate codebase.

| Layer | What it provides |
| --- | --- |
| Platform shell | Projects list, feature marketplace, open project |
| Project DB | Users, IAM roles, menus, login branding |
| Platform DB + `organizationId` | Dynamic Forms, submissions (patient/clinical records), grids |
| Menu Builder | Sidebar IA → each operational screen is a **published form** at `/{slug}/data/:formId` |

**Goal:** Front desk registers a patient → books an appointment → doctor consults → lab/pharmacy → billing → discharge, with role-appropriate menus and CRUD. Phase 1 delivers a **working HMS shell** (menus + published forms + grids). Deeper clinical workflows (bed board, EMR timeline, inventory, HL7) come later on the same builders.

---

## 2. Actors / roles

Domain roles are seeded via `npm run prisma:seed:org-roles -w @dms/api` (and refreshed by the hospital app seed). Map to modules:

| Role code | Name | Primary modules |
| --- | --- | --- |
| `HOSPITAL_ADMIN` | Hospital Admin | Everything: IAM, menus, forms, masters, billing, reports, settings |
| `DOCTOR` | Doctor | Doctor portal: My Schedule, My Patients (not Front Desk form packs) |
| `PATIENT` | Patient | Patient portal: Book Appointment, My Appointments, Profile |
| `NURSE` | Nurse | Nursing notes, wards/rooms, patients (view), appointments (view) |
| `RECEPTIONIST` | Receptionist | Patient registration, appointments (form), OP queue |
| `PHARMACIST` | Pharmacist | Medicines / pharmacy |
| `LAB_TECHNICIAN` | Lab Technician | Lab orders / results entry |
| `ACCOUNTANT` | Accountant | Bills / invoices, reports |
| `RADIOLOGIST` | Radiologist | Clinical / imaging-related forms (Phase 1: clinical + lab view) |

Platform membership (`OWNER` / `ADMIN` / `MEMBER`) still gates **who can open the project**; IAM roles gate **what they see inside**.

---

## 3. Information architecture (Phase 1)

Platform groups (`Workspace`, `Access Control`, `Configuration`, `Governance`) remain for builders/admin. Clinical IA is added as **hospital menu groups**:

```text
Dashboard                          → /hospital-management  (existing Workspace)

Front Desk
  ├── Patient Registration         → form PATIENT_REG
  ├── Appointments                 → form APPOINTMENT
  └── OP Queue                     → form OP_QUEUE

Clinical
  ├── Doctors / Staff              → form DOCTOR_PROFILE
  └── OPD Consultation             → form OPD_CONSULT

Nursing
  └── Nursing Notes                → form NURSING_NOTE

Laboratory
  └── Lab Orders                   → form LAB_ORDER

Pharmacy
  └── Medicines                    → form MEDICINE

Billing
  └── Bills / Invoices             → form BILL_INVOICE

Masters
  ├── Departments                  → form DEPARTMENT
  └── Wards & Rooms                → form WARD_ROOM

Reports / Dashboard Builder          → /app/dashboards (Configuration)
Settings
  ├── Login page                   → /settings/login (platform)
  ├── Users / IAM / Forms / Menus  → existing Configuration & Access groups
```

**URL pattern for form screens:** `/hospital-management/data/:formId` (canonical path stored as `/app/data/:formId`).

---

## 4. End-to-end flows

### 4.1 Patient journey (operations)

```text
1. Receptionist → Patient Registration (create patient)
2. Receptionist → Appointments (book doctor / slot)
3. Receptionist → OP Queue (mark arrived / waiting)
4. Doctor → OPD Consultation (notes, diagnosis, orders)
5. Lab Tech → Lab Orders (collect / result)
6. Pharmacist → Medicines (dispense / stock note)
7. Accountant → Bills / Invoices (charge + payment status)
8. (Later) Discharge / IPD bed release
```

### 4.2 Admin setup flow (builders)

```text
1. Ensure project exists (hospital-management) + project DB provisioned
2. Enable features: forms, menu-builder, users, roles, login-page, dashboard, …
3. Seed domain roles (Hospital Admin, Doctor, …)
4. Create & publish Dynamic Forms (tabs → sections → controls)
5. Create Menu Groups + Menus; set Menu.formId → auto path /app/data/:formId
6. Sync menu.* + {resource}.view|create|update|delete permissions
7. Assign RoleMenu + RolePermission per role
8. Tune Login page (companyName, welcome, description)
9. Log in at /hospital-management/login → verify sidebar + CRUD grids
```

**Automated:** `npm run prisma:seed:hospital -w @dms/api` performs steps 2–8 for Phase 1.

---

## 4.3 Patient ↔ doctor appointment booking (custom module)

Beyond the Front Desk `APPOINTMENT` dynamic form, the hospital project DB has first-class appointment tables and a Nest module under `apps/api/src/modules/hospital/`:

| Model | Purpose |
| --- | --- |
| `DoctorProfile` | userId, specialty, department, active |
| `PatientProfile` | userId, optional demographics |
| `AppointmentSlot` | doctorId, startAt/endAt, AVAILABLE / BOOKED / CANCELLED |
| `Appointment` | patient + doctor + slot, specialty, status BOOKED / CANCELLED / COMPLETED |

**UI routes** (menus use canonical `/app/...` paths):

| Path | Who | Page |
| --- | --- | --- |
| `/hospital-management/hospital/book` | Patient | Specialty → doctor → slot → confirm |
| `/hospital-management/hospital/my-appointments` | Patient | List + cancel (releases slot) |
| `/hospital-management/hospital/profile` | Patient | Own patient profile |
| `/hospital-management/hospital/schedule` | Doctor | Own appointments + mark complete |
| `/hospital-management/hospital/patients` | Doctor | Patients who booked with them |

**API** (requires `X-Organization-Id`): `GET /hospital/specialties`, `GET /hospital/doctors?specialty=`, `GET /hospital/doctors/:id/slots`, `POST /hospital/appointments`, `GET /hospital/appointments/mine`, `GET /hospital/dashboard-stats`, `POST /hospital/appointments/:id/cancel`, `POST /hospital/appointments/:id/complete`.

Authorization: patients only see/book/cancel their own; doctors only their own schedule; Hospital Admin / org OWNER|ADMIN can see all.

### 4.4 Role dashboards

Uses the existing **Dashboard Builder** (`Dashboard` + `Widget` + `LandingPage` in the project DB).

| Role | Dashboard | Live widgets |
| --- | --- | --- |
| `HOSPITAL_ADMIN` | Hospital Admin Overview | Pending / today / doctors / patients + org-wide upcoming list |
| `DOCTOR` | My Clinical Schedule | Own pending / today / patients / completed + upcoming list |
| `PATIENT` | My Care Home | Own upcoming / today / total + next appointments list |

- Home: `/{slug}/dashboard` → `GET /dashboards/me` (role landing) → widgets resolve via `GET /hospital/dashboard-stats` (scoped).
- Builder grid: `/{slug}/dashboards` (Configuration → **Dashboard Builder**) — list by name/role/updated, Edit to add/remove widgets.
- Widget `config.dataSource` examples: `hospital.pendingAppointments`, `hospital.upcomingAppointments`, `hospital.doctorsCount`.
- Seed: included in `prisma:seed:hospital`, or `npm run prisma:seed:role-dashboards -w @dms/api`.

### Demo accounts

Password for all: **`Password1!`**

| Email | Role |
| --- | --- |
| `patient1@hospital.local` | Patient |
| `patient2@hospital.local` | Patient |
| `dr.heart@hospital.local` | Doctor (Cardiology) |
| `dr.ortho@hospital.local` | Doctor (Orthopedics) |
| `dr.general@hospital.local` | Doctor (General Medicine) |
| `nurse1@hospital.local` | Nurse (light) |

### Seed / re-seed appointments

```bash
# Push project schema (includes appointment tables) to hospital_management_db
DATABASE_URL="postgresql://dms:dms_secret@localhost:5435/hospital_management_db?schema=public" \
  npm run prisma:push:project -w @dms/api

npm run prisma:seed:org-roles -w @dms/api              # includes PATIENT role
npm run prisma:seed:hospital -w @dms/api               # forms + admin menus
npm run prisma:seed:hospital-appointments -w @dms/api  # users, slots, portal menus
```

### Demo test script

1. Open `/hospital-management/login` → `patient1@hospital.local` / `Password1!`
2. **Book Appointment** → Heart / Chest → Cardiology doctor → pick a slot → Confirm
3. Log out → `dr.heart@hospital.local` → **My Schedule** → see the booking
4. Log out → patient1 → **My Appointments** → **Cancel** (slot becomes available again)

Symptom → specialty mapping: Heart → Cardiology, Bone → Orthopedics, General/Fever → General Medicine.

---

## 5. Forms to build (Phase 1)

All forms use real builder types: `TEXT`, `TEXTAREA`, `NUMBER`, `EMAIL`, `SELECT`, `DATE`, `CHECKBOX`, etc. Status: **PUBLISHED**.

| Code | Name | Key fields |
| --- | --- | --- |
| `PATIENT_REG` | Patient Registration | `uhid`, `fullName`, `dateOfBirth`, `gender`, `phone`, `email`, `address`, `bloodGroup`, `emergencyContact`, `status` |
| `APPOINTMENT` | Appointment | `patientName`, `patientUhid`, `doctorName`, `department`, `appointmentDate`, `appointmentTime`, `visitType`, `status`, `notes` |
| `OP_QUEUE` | OP Queue | `patientName`, `uhid`, `tokenNo`, `doctorName`, `department`, `checkInTime`, `priority`, `status` |
| `DOCTOR_PROFILE` | Doctor / Staff Profile | `employeeCode`, `fullName`, `roleType`, `department`, `specialty`, `phone`, `email`, `licenseNo`, `status` |
| `OPD_CONSULT` | OPD Consultation | `patientName`, `uhid`, `doctorName`, `visitDate`, `chiefComplaint`, `diagnosis`, `prescription`, `followUpDate`, `status` |
| `NURSING_NOTE` | Nursing Notes | `patientName`, `uhid`, `ward`, `bedNo`, `vitals`, `nursingNotes`, `notedBy`, `notedAt`, `status` |
| `LAB_ORDER` | Lab Order | `orderNo`, `patientName`, `uhid`, `testName`, `orderedBy`, `orderDate`, `priority`, `resultSummary`, `status` |
| `MEDICINE` | Medicine / Pharmacy | `sku`, `medicineName`, `genericName`, `strength`, `form`, `stockQty`, `unitPrice`, `expiryDate`, `status` |
| `BILL_INVOICE` | Bill / Invoice | `invoiceNo`, `patientName`, `uhid`, `billDate`, `serviceItems`, `amount`, `taxAmount`, `totalAmount`, `paymentMode`, `paymentStatus` |
| `DEPARTMENT` | Department | `code`, `name`, `headOfDept`, `phone`, `location`, `status` |
| `WARD_ROOM` | Ward / Room | `wardCode`, `wardName`, `roomNo`, `bedCapacity`, `occupiedBeds`, `wardType`, `status` |

---

## 6. Menus to create

| Menu group (code) | Submenu label | Linked form code |
| --- | --- | --- |
| `FRONT_DESK` | Patient Registration | `PATIENT_REG` |
| `FRONT_DESK` | Appointments | `APPOINTMENT` |
| `FRONT_DESK` | OP Queue | `OP_QUEUE` |
| `CLINICAL` | Doctors / Staff | `DOCTOR_PROFILE` |
| `CLINICAL` | OPD Consultation | `OPD_CONSULT` |
| `NURSING` | Nursing Notes | `NURSING_NOTE` |
| `LABORATORY` | Lab Orders | `LAB_ORDER` |
| `PHARMACY` | Medicines | `MEDICINE` |
| `BILLING` | Bills / Invoices | `BILL_INVOICE` |
| `MASTERS` | Departments | `DEPARTMENT` |
| `MASTERS` | Wards & Rooms | `WARD_ROOM` |

Parent row per group can be a non-navigating group header (menus live as group children with `formId`). Platform menus under Workspace / Access / Configuration stay as-is.

---

## 7. Permissions matrix (guidance)

Menu access = `menu.{resource}` (+ `RoleMenu`). Record CRUD = `{resource}.view|create|update|delete` (auto-derived from menu label slug).

| Module | Hospital Admin | Doctor | Nurse | Receptionist | Pharmacist | Lab Tech | Accountant |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Patient Registration | CRUD | R | R | CRUD | — | R | R |
| Appointments | CRUD | RU | R | CRUD | — | — | — |
| OP Queue | CRUD | RU | R | CRUD | — | — | — |
| Doctors / Staff | CRUD | R | R | R | — | — | — |
| OPD Consultation | CRUD | CRUD | R | — | — | — | — |
| Nursing Notes | CRUD | R | CRUD | — | — | — | — |
| Lab Orders | CRUD | CRU | R | — | — | CRUD | — |
| Medicines | CRUD | R | R | — | CRUD | — | R |
| Bills / Invoices | CRUD | R | — | R | — | — | CRUD |
| Departments / Wards | CRUD | R | R | R | R | R | R |
| Forms / Menus / IAM / Users | Full | — | — | — | — | — | — |
| Reports | Full | R | — | — | — | — | R |

`R` = view (+ menu), `C/U/D` = create/update/delete. Hospital Admin receives the full permission catalog.

---

## 8. What is configured now vs later

### Phase 1 — Now (seeded via `prisma:seed:hospital`)

- [x] Project `hospital-management` + `hospital_management_db`
- [x] Features: `forms`, `menu-builder`, `users`, `roles`, `login-page`, dashboard, grids, reports, …
- [x] Domain IAM roles (Doctor, Nurse, Receptionist, …)
- [x] Published Phase-1 Dynamic Forms (table in §5) — 11 forms
- [x] Hospital menu groups + form-linked submenus — Front Desk → Masters
- [x] Menu + CRUD permissions granted to Hospital Admin and operational roles
- [x] Login branding: companyName **Hospital Management**, hospital welcome/description
- [x] Visual theme preset `hospital` (org + login page) — clinical teal chrome in workspace & login
- [ ] Sample submission rows (optional; create via UI)

- [x] Role landing dashboards (Doctor / Patient / Hospital Admin) with live appointment widgets
- [ ] Reports beyond role dashboards (custom chart aggregates)

### Phase 2 — Next

- [ ] IPD admission / bed board / discharge forms
- [ ] EMR / clinical notes timeline (richer than single OPD form)
- [ ] Lab result line-items + specimen tracking
- [ ] Pharmacy dispense linked to prescription
- [ ] Billing line-items linked to services master
- [ ] Service / tariff master form

### Phase 3 — Later

- [ ] Cross-form lookups (patient picker → UHID auto-fill)
- [ ] Workflow / status machines (appointment → consult → bill)
- [ ] Notifications for queue / critical labs
- [ ] HR / roster beyond Doctor profile
- [ ] External integrations (labs, insurers, national IDs)

---

## 9. How to open and verify

### URLs

| Step | URL |
| --- | --- |
| Hospital login | `/hospital-management/login` |
| After login (dashboard) | `/hospital-management` or `/hospital-management/dashboard` |
| Form records (example) | `/hospital-management/data/:formId` |
| Forms builder | `/hospital-management/forms` |
| Menu builder | `/hospital-management/menus` |
| IAM | `/hospital-management/iam` |
| Dashboard Builder | `/hospital-management/dashboards` |
| Login settings | `/hospital-management/settings/login` |
| Platform projects | `/app/projects` |

### Test paths

1. **Hospital login** — open `/hospital-management/login`, sign in as a project user with `HOSPITAL_ADMIN` (e.g. seeded admin email). Confirm sidebar shows Front Desk, Clinical, Nursing, Laboratory, Pharmacy, Billing, Masters.
2. **Open a module** — e.g. Patient Registration → grid → **Add** → submit → row appears.
3. **Platform admin** — `/app/projects` → open **hospital management** → same workspace under project context.
4. **Role check** — assign `RECEPTIONIST` to a user; they should see Front Desk menus, not IAM/Menus builders.
5. **Role dashboards** — login as `dr.heart@hospital.local` → `/hospital-management/dashboard` shows doctor-scoped stats; login as Hospital Admin → org-wide doctors/pending. Open **Dashboard Builder** → Edit → add widget → Save.

### Re-seed

```bash
npm run prisma:seed:org-roles -w @dms/api                 # domain roles (incl. PATIENT)
npm run prisma:seed:hospital -w @dms/api                  # forms + menus + role dashboards
npm run prisma:seed:hospital-appointments -w @dms/api     # demo users, slots, portal menus
npm run prisma:seed:role-dashboards -w @dms/api           # optional: dashboards only
```

Idempotent: forms/menus upsert by code/label; permissions use `skipDuplicates`; appointment seed upserts users/profiles and refreshes open slots.

---

## 10. Implementation notes (platform constraints)

- Forms live on the **platform** DB (`DynamicForm` / `FormTab` / `FormSection` / `FormControl`); menus/IAM/login live on the **project** DB.
- There is no separate “FormDefinition” model — use `DynamicForm` + nested controls.
- Linking `Menu.formId` sets path to `/app/data/:formId`; AppShell resolves under `/{slug}/…`.
- Do not invent medical AI features; keep forms as structured data entry + grids.
- Script: `apps/api/prisma/seed-hospital-app.ts`.
