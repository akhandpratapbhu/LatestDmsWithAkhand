/**
 * Phase-1 Hospital Management app seed.
 *
 * - Ensures enabledFeatures on hospital-management org
 * - Upserts published Dynamic Forms (platform DB)
 * - Upserts hospital MenuGroups + form-linked Menus (project DB)
 * - Creates menu.* + CRUD permissions; grants Hospital Admin + ops roles
 * - Updates LoginPageConfig branding
 *
 * Prerequisites: org slug `hospital-management` with project DB;
 * prefer domain roles via `npm run prisma:seed:org-roles -w @dms/api`.
 *
 * Run:
 *   npm run prisma:seed:hospital -w @dms/api
 */
import { PrismaClient } from '@prisma/client';
import { PrismaClient as ProjectClient } from '@dms/project-client';
import { seedHospitalRoleDashboards } from './seed-role-dashboards';

const SLUG = (process.env.SEED_ORG_SLUG || 'hospital-management').trim();

const REQUIRED_FEATURES = [
  'dashboard',
  'users',
  'roles',
  'forms',
  'project-forms',
  'grids',
  'reports',
  'chat',
  'notifications',
  'audit',
  'activity',
  'sessions',
  'calls',
  'login-page',
  'menu-builder',
  'features',
] as const;

/** Premium features pre-subscribed for the hospital demo so Chat/Calls work out of the box. */
const REQUIRED_SUBSCRIPTIONS = ['chat', 'calls'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any;

type ControlDef = {
  fieldKey: string;
  label: string;
  controlType:
    | 'TEXT'
    | 'TEXTAREA'
    | 'NUMBER'
    | 'EMAIL'
    | 'SELECT'
    | 'MULTI_SELECT'
    | 'CHECKBOX'
    | 'DATE'
    | 'FILE';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  sortOrder: number;
};

type SectionDef = {
  name: string;
  code: string;
  columns?: number;
  controls: ControlDef[];
};

type FormDef = {
  code: string;
  name: string;
  description: string;
  tab: { name: string; code: string };
  section: SectionDef;
};

type MenuLeaf = {
  label: string;
  formCode: string;
  icon?: string;
  sortOrder: number;
  /** Roles that get this menu + view (+ create/update/delete when listed) */
  roles: Array<{
    code: string;
    actions: Array<'view' | 'create' | 'update' | 'delete'>;
  }>;
};

type MenuGroupDef = {
  code: string;
  name: string;
  sortOrder: number;
  icon?: string;
  menus: MenuLeaf[];
};

const STATUS_ACTIVE = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

const GENDER = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

const BLOOD_GROUP = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
];

const APPT_STATUS = [
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Checked in', value: 'CHECKED_IN' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'No show', value: 'NO_SHOW' },
];

const VISIT_TYPE = [
  { label: 'New', value: 'NEW' },
  { label: 'Follow-up', value: 'FOLLOW_UP' },
  { label: 'Emergency', value: 'EMERGENCY' },
];

const QUEUE_STATUS = [
  { label: 'Waiting', value: 'WAITING' },
  { label: 'Called', value: 'CALLED' },
  { label: 'With doctor', value: 'WITH_DOCTOR' },
  { label: 'Done', value: 'DONE' },
];

const PRIORITY = [
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Urgent', value: 'URGENT' },
  { label: 'STAT', value: 'STAT' },
];

const ROLE_TYPE = [
  { label: 'Doctor', value: 'DOCTOR' },
  { label: 'Nurse', value: 'NURSE' },
  { label: 'Technician', value: 'TECHNICIAN' },
  { label: 'Other', value: 'OTHER' },
];

const LAB_STATUS = [
  { label: 'Ordered', value: 'ORDERED' },
  { label: 'Collected', value: 'COLLECTED' },
  { label: 'In lab', value: 'IN_LAB' },
  { label: 'Reported', value: 'REPORTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PAYMENT_MODE = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Insurance', value: 'INSURANCE' },
  { label: 'Credit', value: 'CREDIT' },
];

const PAYMENT_STATUS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Waived', value: 'WAIVED' },
];

const WARD_TYPE = [
  { label: 'General', value: 'GENERAL' },
  { label: 'ICU', value: 'ICU' },
  { label: 'Private', value: 'PRIVATE' },
  { label: 'Semi-private', value: 'SEMI_PRIVATE' },
  { label: 'Maternity', value: 'MATERNITY' },
];

const MED_FORM = [
  { label: 'Tablet', value: 'TABLET' },
  { label: 'Capsule', value: 'CAPSULE' },
  { label: 'Syrup', value: 'SYRUP' },
  { label: 'Injection', value: 'INJECTION' },
  { label: 'Ointment', value: 'OINTMENT' },
  { label: 'Other', value: 'OTHER' },
];

const FORMS: FormDef[] = [
  {
    code: 'PATIENT_REG',
    name: 'Patient Registration',
    description: 'Register and maintain patient demographics',
    tab: { name: 'Patient', code: 'PATIENT' },
    section: {
      name: 'Demographics',
      code: 'DEMOGRAPHICS',
      columns: 2,
      controls: [
        { fieldKey: 'uhid', label: 'UHID', controlType: 'TEXT', required: true, sortOrder: 1, placeholder: 'HOS-0001' },
        { fieldKey: 'fullName', label: 'Full name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'dateOfBirth', label: 'Date of birth', controlType: 'DATE', required: true, sortOrder: 3 },
        { fieldKey: 'gender', label: 'Gender', controlType: 'SELECT', required: true, sortOrder: 4, options: GENDER },
        { fieldKey: 'phone', label: 'Phone', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'email', label: 'Email', controlType: 'EMAIL', sortOrder: 6 },
        { fieldKey: 'bloodGroup', label: 'Blood group', controlType: 'SELECT', sortOrder: 7, options: BLOOD_GROUP },
        { fieldKey: 'emergencyContact', label: 'Emergency contact', controlType: 'TEXT', sortOrder: 8 },
        { fieldKey: 'address', label: 'Address', controlType: 'TEXTAREA', sortOrder: 9 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 10, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'APPOINTMENT',
    name: 'Appointment',
    description: 'Book and track outpatient appointments',
    tab: { name: 'Appointment', code: 'APPT' },
    section: {
      name: 'Booking',
      code: 'BOOKING',
      columns: 2,
      controls: [
        { fieldKey: 'patientName', label: 'Patient name', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'patientUhid', label: 'Patient UHID', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'doctorName', label: 'Doctor', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'department', label: 'Department', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'appointmentDate', label: 'Date', controlType: 'DATE', required: true, sortOrder: 5 },
        { fieldKey: 'appointmentTime', label: 'Time', controlType: 'TEXT', required: true, sortOrder: 6, placeholder: '10:30' },
        { fieldKey: 'visitType', label: 'Visit type', controlType: 'SELECT', required: true, sortOrder: 7, options: VISIT_TYPE },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 8, options: APPT_STATUS },
        { fieldKey: 'notes', label: 'Notes', controlType: 'TEXTAREA', sortOrder: 9 },
      ],
    },
  },
  {
    code: 'OP_QUEUE',
    name: 'OP Queue',
    description: 'Outpatient waiting / token queue',
    tab: { name: 'Queue', code: 'QUEUE' },
    section: {
      name: 'Token',
      code: 'TOKEN',
      columns: 2,
      controls: [
        { fieldKey: 'patientName', label: 'Patient name', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'uhid', label: 'UHID', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'tokenNo', label: 'Token no.', controlType: 'NUMBER', required: true, sortOrder: 3 },
        { fieldKey: 'doctorName', label: 'Doctor', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'department', label: 'Department', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'checkInTime', label: 'Check-in time', controlType: 'TEXT', sortOrder: 6, placeholder: '09:15' },
        { fieldKey: 'priority', label: 'Priority', controlType: 'SELECT', required: true, sortOrder: 7, options: PRIORITY },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 8, options: QUEUE_STATUS },
      ],
    },
  },
  {
    code: 'DOCTOR_PROFILE',
    name: 'Doctor / Staff Profile',
    description: 'Clinical staff directory',
    tab: { name: 'Profile', code: 'PROFILE' },
    section: {
      name: 'Staff',
      code: 'STAFF',
      columns: 2,
      controls: [
        { fieldKey: 'employeeCode', label: 'Employee code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'fullName', label: 'Full name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'roleType', label: 'Role type', controlType: 'SELECT', required: true, sortOrder: 3, options: ROLE_TYPE },
        { fieldKey: 'department', label: 'Department', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'specialty', label: 'Specialty', controlType: 'TEXT', sortOrder: 5 },
        { fieldKey: 'phone', label: 'Phone', controlType: 'TEXT', sortOrder: 6 },
        { fieldKey: 'email', label: 'Email', controlType: 'EMAIL', sortOrder: 7 },
        { fieldKey: 'licenseNo', label: 'License no.', controlType: 'TEXT', sortOrder: 8 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 9, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'OPD_CONSULT',
    name: 'OPD Consultation',
    description: 'Outpatient consultation notes',
    tab: { name: 'Consult', code: 'CONSULT' },
    section: {
      name: 'Clinical',
      code: 'CLINICAL',
      columns: 2,
      controls: [
        { fieldKey: 'patientName', label: 'Patient name', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'uhid', label: 'UHID', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'doctorName', label: 'Doctor', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'visitDate', label: 'Visit date', controlType: 'DATE', required: true, sortOrder: 4 },
        { fieldKey: 'chiefComplaint', label: 'Chief complaint', controlType: 'TEXTAREA', required: true, sortOrder: 5 },
        { fieldKey: 'diagnosis', label: 'Diagnosis', controlType: 'TEXTAREA', sortOrder: 6 },
        { fieldKey: 'prescription', label: 'Prescription', controlType: 'TEXTAREA', sortOrder: 7 },
        { fieldKey: 'followUpDate', label: 'Follow-up date', controlType: 'DATE', sortOrder: 8 },
        {
          fieldKey: 'status',
          label: 'Status',
          controlType: 'SELECT',
          required: true,
          sortOrder: 9,
          options: [
            { label: 'Draft', value: 'DRAFT' },
            { label: 'Signed', value: 'SIGNED' },
            { label: 'Closed', value: 'CLOSED' },
          ],
        },
      ],
    },
  },
  {
    code: 'NURSING_NOTE',
    name: 'Nursing Notes',
    description: 'Ward nursing observations and vitals',
    tab: { name: 'Notes', code: 'NOTES' },
    section: {
      name: 'Observation',
      code: 'OBS',
      columns: 2,
      controls: [
        { fieldKey: 'patientName', label: 'Patient name', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'uhid', label: 'UHID', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'ward', label: 'Ward', controlType: 'TEXT', sortOrder: 3 },
        { fieldKey: 'bedNo', label: 'Bed no.', controlType: 'TEXT', sortOrder: 4 },
        { fieldKey: 'vitals', label: 'Vitals', controlType: 'TEXTAREA', sortOrder: 5, placeholder: 'BP / Pulse / Temp / SpO2' },
        { fieldKey: 'nursingNotes', label: 'Nursing notes', controlType: 'TEXTAREA', required: true, sortOrder: 6 },
        { fieldKey: 'notedBy', label: 'Noted by', controlType: 'TEXT', required: true, sortOrder: 7 },
        { fieldKey: 'notedAt', label: 'Noted at', controlType: 'DATE', required: true, sortOrder: 8 },
        {
          fieldKey: 'status',
          label: 'Status',
          controlType: 'SELECT',
          required: true,
          sortOrder: 9,
          options: [
            { label: 'Open', value: 'OPEN' },
            { label: 'Reviewed', value: 'REVIEWED' },
          ],
        },
      ],
    },
  },
  {
    code: 'LAB_ORDER',
    name: 'Lab Order',
    description: 'Laboratory test orders and result summary',
    tab: { name: 'Order', code: 'ORDER' },
    section: {
      name: 'Lab',
      code: 'LAB',
      columns: 2,
      controls: [
        { fieldKey: 'orderNo', label: 'Order no.', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'patientName', label: 'Patient name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'uhid', label: 'UHID', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'testName', label: 'Test name', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'orderedBy', label: 'Ordered by', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'orderDate', label: 'Order date', controlType: 'DATE', required: true, sortOrder: 6 },
        { fieldKey: 'priority', label: 'Priority', controlType: 'SELECT', required: true, sortOrder: 7, options: PRIORITY },
        { fieldKey: 'resultSummary', label: 'Result summary', controlType: 'TEXTAREA', sortOrder: 8 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 9, options: LAB_STATUS },
      ],
    },
  },
  {
    code: 'MEDICINE',
    name: 'Medicine / Pharmacy',
    description: 'Pharmacy formulary and stock',
    tab: { name: 'Medicine', code: 'MED' },
    section: {
      name: 'Item',
      code: 'ITEM',
      columns: 2,
      controls: [
        { fieldKey: 'sku', label: 'SKU', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'medicineName', label: 'Medicine name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'genericName', label: 'Generic name', controlType: 'TEXT', sortOrder: 3 },
        { fieldKey: 'strength', label: 'Strength', controlType: 'TEXT', sortOrder: 4, placeholder: '500 mg' },
        { fieldKey: 'form', label: 'Form', controlType: 'SELECT', sortOrder: 5, options: MED_FORM },
        { fieldKey: 'stockQty', label: 'Stock qty', controlType: 'NUMBER', required: true, sortOrder: 6 },
        { fieldKey: 'unitPrice', label: 'Unit price', controlType: 'NUMBER', sortOrder: 7 },
        { fieldKey: 'expiryDate', label: 'Expiry date', controlType: 'DATE', sortOrder: 8 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 9, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'BILL_INVOICE',
    name: 'Bill / Invoice',
    description: 'Patient billing and payment status',
    tab: { name: 'Bill', code: 'BILL' },
    section: {
      name: 'Invoice',
      code: 'INVOICE',
      columns: 2,
      controls: [
        { fieldKey: 'invoiceNo', label: 'Invoice no.', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'patientName', label: 'Patient name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'uhid', label: 'UHID', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'billDate', label: 'Bill date', controlType: 'DATE', required: true, sortOrder: 4 },
        { fieldKey: 'serviceItems', label: 'Service items', controlType: 'TEXTAREA', required: true, sortOrder: 5 },
        { fieldKey: 'amount', label: 'Amount', controlType: 'NUMBER', required: true, sortOrder: 6 },
        { fieldKey: 'taxAmount', label: 'Tax amount', controlType: 'NUMBER', sortOrder: 7 },
        { fieldKey: 'totalAmount', label: 'Total amount', controlType: 'NUMBER', required: true, sortOrder: 8 },
        { fieldKey: 'paymentMode', label: 'Payment mode', controlType: 'SELECT', sortOrder: 9, options: PAYMENT_MODE },
        { fieldKey: 'paymentStatus', label: 'Payment status', controlType: 'SELECT', required: true, sortOrder: 10, options: PAYMENT_STATUS },
      ],
    },
  },
  {
    code: 'DEPARTMENT',
    name: 'Department',
    description: 'Hospital departments master',
    tab: { name: 'Department', code: 'DEPT' },
    section: {
      name: 'Details',
      code: 'DETAILS',
      columns: 2,
      controls: [
        { fieldKey: 'code', label: 'Code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'name', label: 'Name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'headOfDept', label: 'Head of department', controlType: 'TEXT', sortOrder: 3 },
        { fieldKey: 'phone', label: 'Phone', controlType: 'TEXT', sortOrder: 4 },
        { fieldKey: 'location', label: 'Location', controlType: 'TEXT', sortOrder: 5 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 6, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'WARD_ROOM',
    name: 'Ward / Room',
    description: 'Wards, rooms, and bed capacity',
    tab: { name: 'Ward', code: 'WARD' },
    section: {
      name: 'Capacity',
      code: 'CAPACITY',
      columns: 2,
      controls: [
        { fieldKey: 'wardCode', label: 'Ward code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'wardName', label: 'Ward name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'roomNo', label: 'Room no.', controlType: 'TEXT', sortOrder: 3 },
        { fieldKey: 'bedCapacity', label: 'Bed capacity', controlType: 'NUMBER', required: true, sortOrder: 4 },
        { fieldKey: 'occupiedBeds', label: 'Occupied beds', controlType: 'NUMBER', sortOrder: 5 },
        { fieldKey: 'wardType', label: 'Ward type', controlType: 'SELECT', required: true, sortOrder: 6, options: WARD_TYPE },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 7, options: STATUS_ACTIVE },
      ],
    },
  },
];

const CRUD = ['view', 'create', 'update', 'delete'] as const;

function roleAccess(
  codes: string[],
  actions: Array<'view' | 'create' | 'update' | 'delete'> = [...CRUD],
) {
  return codes.map((code) => ({ code, actions }));
}

const MENU_GROUPS: MenuGroupDef[] = [
  {
    code: 'FRONT_DESK',
    name: 'Front Desk',
    sortOrder: 2,
    icon: 'users',
    menus: [
      {
        label: 'Patient Registration',
        formCode: 'PATIENT_REG',
        icon: 'user',
        sortOrder: 1,
        roles: [
          ...roleAccess(['RECEPTIONIST']),
          ...roleAccess(['NURSE', 'LAB_TECHNICIAN', 'ACCOUNTANT'], ['view']),
        ],
      },
      {
        label: 'Appointments',
        formCode: 'APPOINTMENT',
        icon: 'activity',
        sortOrder: 2,
        roles: [
          ...roleAccess(['RECEPTIONIST']),
          ...roleAccess(['NURSE'], ['view']),
        ],
      },
      {
        label: 'OP Queue',
        formCode: 'OP_QUEUE',
        icon: 'table',
        sortOrder: 3,
        roles: [
          ...roleAccess(['RECEPTIONIST']),
          ...roleAccess(['NURSE'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'CLINICAL',
    name: 'Clinical',
    sortOrder: 3,
    icon: 'activity',
    menus: [
      {
        label: 'Doctors / Staff',
        formCode: 'DOCTOR_PROFILE',
        icon: 'users',
        sortOrder: 1,
        roles: [
          ...roleAccess(['NURSE', 'RECEPTIONIST'], ['view']),
        ],
      },
      {
        label: 'OPD Consultation',
        formCode: 'OPD_CONSULT',
        icon: 'form',
        sortOrder: 2,
        roles: [
          ...roleAccess(['NURSE', 'RADIOLOGIST'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'NURSING',
    name: 'Nursing',
    sortOrder: 4,
    icon: 'activity',
    menus: [
      {
        label: 'Nursing Notes',
        formCode: 'NURSING_NOTE',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['NURSE']),
        ],
      },
    ],
  },
  {
    code: 'LABORATORY',
    name: 'Laboratory',
    sortOrder: 5,
    icon: 'table',
    menus: [
      {
        label: 'Lab Orders',
        formCode: 'LAB_ORDER',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['LAB_TECHNICIAN']),
          ...roleAccess(['NURSE', 'RADIOLOGIST'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'PHARMACY',
    name: 'Pharmacy',
    sortOrder: 6,
    icon: 'form',
    menus: [
      {
        label: 'Medicines',
        formCode: 'MEDICINE',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['PHARMACIST']),
          ...roleAccess(['NURSE', 'ACCOUNTANT'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'BILLING',
    name: 'Billing',
    sortOrder: 7,
    icon: 'layout',
    menus: [
      {
        label: 'Bills / Invoices',
        formCode: 'BILL_INVOICE',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['ACCOUNTANT']),
          ...roleAccess(['RECEPTIONIST'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'MASTERS',
    name: 'Masters',
    sortOrder: 8,
    icon: 'building',
    menus: [
      {
        label: 'Departments',
        formCode: 'DEPARTMENT',
        icon: 'building',
        sortOrder: 1,
        roles: roleAccess(
          ['NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECHNICIAN', 'ACCOUNTANT', 'RADIOLOGIST'],
          ['view'],
        ),
      },
      {
        label: 'Wards & Rooms',
        formCode: 'WARD_ROOM',
        icon: 'building',
        sortOrder: 2,
        roles: roleAccess(
          ['NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECHNICIAN', 'ACCOUNTANT', 'RADIOLOGIST'],
          ['view'],
        ),
      },
    ],
  },
];

function slugifyResource(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'custom';
}

async function ensureFeatures(platform: PrismaClient, orgId: string, current: unknown) {
  const existing = Array.isArray(current) ? (current as string[]) : [];
  const merged = Array.from(new Set([...existing, ...REQUIRED_FEATURES]));

  const org = await platform.organization.findUnique({
    where: { id: orgId },
    select: { featureSubscriptions: true },
  });
  const existingSubs = Array.isArray(org?.featureSubscriptions)
    ? (org!.featureSubscriptions as string[])
    : [];
  const mergedSubs = Array.from(new Set([...existingSubs, ...REQUIRED_SUBSCRIPTIONS]));

  const featuresOk =
    merged.length === existing.length && REQUIRED_FEATURES.every((f) => existing.includes(f));
  const subsOk =
    mergedSubs.length === existingSubs.length &&
    REQUIRED_SUBSCRIPTIONS.every((f) => existingSubs.includes(f));

  if (featuresOk && subsOk) {
    console.log('  Features + subscriptions already include Phase-1 set (incl. login-page)');
    return;
  }
  await platform.organization.update({
    where: { id: orgId },
    data: { enabledFeatures: merged, featureSubscriptions: mergedSubs },
  });
  console.log(`  enabledFeatures → ${merged.join(', ')}`);
  console.log(`  featureSubscriptions → ${mergedSubs.join(', ')}`);
}

async function upsertForm(platform: PrismaClient, organizationId: string, def: FormDef) {
  let form = await platform.dynamicForm.findUnique({
    where: { organizationId_code: { organizationId, code: def.code } },
    include: { tabs: true, sections: { include: { controls: true } } },
  });

  if (!form) {
    form = await platform.dynamicForm.create({
      data: {
        organizationId,
        name: def.name,
        code: def.code,
        description: def.description,
        layoutType: 'TABS',
        status: 'PUBLISHED',
        isActive: true,
        tabs: { create: [{ name: def.tab.name, code: def.tab.code, sortOrder: 1 }] },
      },
      include: { tabs: true, sections: { include: { controls: true } } },
    });
    console.log(`  + form ${def.code}`);
  } else {
    form = await platform.dynamicForm.update({
      where: { id: form.id },
      data: {
        name: def.name,
        description: def.description,
        status: 'PUBLISHED',
        isActive: true,
      },
      include: { tabs: true, sections: { include: { controls: true } } },
    });
    console.log(`  ~ form ${def.code} (published)`);
  }

  let tab = form.tabs.find((t) => t.code === def.tab.code);
  if (!tab) {
    tab = await platform.formTab.create({
      data: { formId: form.id, name: def.tab.name, code: def.tab.code, sortOrder: 1 },
    });
  }

  let section = form.sections.find((s) => s.code === def.section.code);
  if (!section) {
    section = await platform.formSection.create({
      data: {
        formId: form.id,
        tabId: tab.id,
        name: def.section.name,
        code: def.section.code,
        columns: def.section.columns ?? 2,
        sortOrder: 1,
      },
      include: { controls: true },
    });
  } else if (!section.tabId) {
    await platform.formSection.update({
      where: { id: section.id },
      data: { tabId: tab.id, name: def.section.name, columns: def.section.columns ?? 2 },
    });
  }

  const existingKeys = new Set(
    (section.controls ?? []).map((c: { fieldKey: string }) => c.fieldKey),
  );

  for (const c of def.section.controls) {
    if (existingKeys.has(c.fieldKey)) continue;
    const created = await platform.formControl.create({
      data: {
        sectionId: section.id,
        fieldKey: c.fieldKey,
        label: c.label,
        controlType: c.controlType,
        placeholder: c.placeholder,
        required: c.required ?? false,
        options: c.options ?? [],
        sortOrder: c.sortOrder,
        colSpan: 1,
        validations:
          c.required
            ? { create: [{ ruleType: 'REQUIRED', message: `${c.label} is required` }] }
            : undefined,
      },
    });
    void created;
  }

  return form.id as string;
}

async function ensureGroup(
  db: TenantDb,
  organizationId: string,
  code: string,
  name: string,
  sortOrder: number,
) {
  const existing = await db.menuGroup.findFirst({ where: { organizationId, code } });
  if (existing) {
    return db.menuGroup.update({
      where: { id: existing.id },
      data: { name, sortOrder, isActive: true },
    });
  }
  return db.menuGroup.create({
    data: { organizationId, name, code, sortOrder, isActive: true },
  });
}

async function ensurePermission(
  db: TenantDb,
  organizationId: string,
  code: string,
  name: string,
  type: 'MENU' | 'SCREEN' | 'API' | 'DATA',
  resource?: string,
  action?: string,
) {
  const existing = await db.permission.findFirst({ where: { organizationId, code } });
  if (existing) return existing;
  return db.permission.create({
    data: {
      organizationId,
      code,
      name,
      type,
      resource: resource ?? null,
      action: action ?? null,
    },
  });
}

async function ensureMenuWithForm(
  db: TenantDb,
  organizationId: string,
  groupId: string,
  label: string,
  formId: string,
  icon: string | undefined,
  sortOrder: number,
) {
  const path = `/app/data/${formId}`;
  const resource = slugifyResource(label);
  const menuPerm = await ensurePermission(
    db,
    organizationId,
    `menu.${resource}`,
    `${label} menu`,
    'MENU',
    resource,
    'access',
  );

  for (const action of CRUD) {
    const type = action === 'view' ? 'SCREEN' : 'API';
    await ensurePermission(
      db,
      organizationId,
      `${resource}.${action}`,
      `${resource} ${action}`,
      type,
      resource,
      action,
    );
  }

  let menu = await db.menu.findFirst({
    where: { organizationId, groupId, label, parentId: null },
  });

  if (!menu) {
    // Prefer matching an existing form-linked menu with same label anywhere
    menu = await db.menu.findFirst({
      where: { organizationId, label, formId: { not: null } },
    });
  }

  if (!menu) {
    menu = await db.menu.create({
      data: {
        organizationId,
        groupId,
        label,
        path,
        icon: icon ?? 'form',
        formId,
        permissionId: menuPerm.id,
        sortOrder,
        isActive: true,
      },
    });
    console.log(`  + menu ${label}`);
  } else {
    menu = await db.menu.update({
      where: { id: menu.id },
      data: {
        groupId,
        parentId: null,
        path,
        icon: icon ?? menu.icon ?? 'form',
        formId,
        permissionId: menuPerm.id,
        sortOrder,
        isActive: true,
      },
    });
    console.log(`  ~ menu ${label}`);
  }

  return { menu, resource, menuPermId: menuPerm.id as string };
}

async function grantRoleAccess(
  db: TenantDb,
  organizationId: string,
  roleCode: string,
  menuId: string,
  resource: string,
  actions: Array<'view' | 'create' | 'update' | 'delete'>,
  menuPermId: string,
) {
  const role = await db.iamRole.findFirst({ where: { organizationId, code: roleCode } });
  if (!role) {
    console.warn(`  WARN: role ${roleCode} missing — skip grants`);
    return;
  }

  await db.roleMenu.createMany({
    data: [{ roleId: role.id, menuId }],
    skipDuplicates: true,
  });

  const permCodes = [`menu.${resource}`, ...actions.map((a) => `${resource}.${a}`)];
  const perms: Array<{ id: string; code: string }> = await db.permission.findMany({
    where: { organizationId, code: { in: [...permCodes, menuPermId ? `menu.${resource}` : ''] } },
  });
  const byCode = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  const ids = permCodes.map((c) => byCode[c]).filter(Boolean);
  // Also include menuPermId directly
  if (menuPermId && !ids.includes(menuPermId)) ids.push(menuPermId);

  if (ids.length) {
    await db.rolePermission.createMany({
      data: ids.map((permissionId: string) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
}

async function grantAdminFullAccess(db: TenantDb, organizationId: string) {
  const admin =
    (await db.iamRole.findFirst({ where: { organizationId, code: 'HOSPITAL_ADMIN' } })) ??
    (await db.iamRole.findFirst({ where: { organizationId, code: 'ADMIN' } }));
  if (!admin) {
    console.warn('  WARN: no HOSPITAL_ADMIN / ADMIN role — skip full grant');
    return;
  }

  const perms: Array<{ id: string }> = await db.permission.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const menus: Array<{ id: string }> = await db.menu.findMany({
    where: { organizationId },
    select: { id: true },
  });

  if (perms.length) {
    await db.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: admin.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  if (menus.length) {
    await db.roleMenu.createMany({
      data: menus.map((m) => ({ roleId: admin.id, menuId: m.id })),
      skipDuplicates: true,
    });
  }
  console.log(`  Granted all ${perms.length} perms + ${menus.length} menus → ${admin.code}`);
}

async function reorderPlatformGroups(db: TenantDb, organizationId: string) {
  const updates: Array<[string, number]> = [
    ['MAIN', 1],
    ['ADMINISTRATION', 20],
    ['GOVERNANCE', 21],
    ['ACCESS', 98],
    ['CONFIG', 99],
  ];
  for (const [code, sortOrder] of updates) {
    await db.menuGroup.updateMany({
      where: { organizationId, code },
      data: { sortOrder },
    });
  }
}

async function deactivateMisnestedHospitalsMenu(db: TenantDb, organizationId: string) {
  const bad = await db.menu.findMany({
    where: {
      organizationId,
      label: { equals: 'hospitals', mode: 'insensitive' },
    },
  });
  for (const m of bad) {
    await db.menu.update({
      where: { id: m.id },
      data: { isActive: false },
    });
    console.log(`  Deactivated leftover menu "${m.label}"`);
  }
}

async function updateLogin(db: TenantDb, organizationId: string) {
  const existing = await db.loginPageConfig.findUnique({ where: { organizationId } });
  const data = {
    companyName: 'Hospital Management',
    welcomeText: 'Sign in to Hospital Management',
    description:
      'Patient registration, clinical care, laboratory, pharmacy, and billing — in one hospital workspace.',
    theme: 'hospital',
    primaryColor: '#0d9488',
    enablePasswordLogin: true,
  };
  if (!existing) {
    await db.loginPageConfig.create({ data: { organizationId, ...data } });
    console.log('  Created LoginPageConfig');
    return;
  }
  await db.loginPageConfig.update({ where: { organizationId }, data });
  console.log('  Updated LoginPageConfig branding');
}

async function ensureOrgTheme(platform: PrismaClient, orgId: string) {
  await platform.organization.update({
    where: { id: orgId },
    data: { theme: 'hospital' },
  });
  console.log('  Organization theme → hospital');
}

async function main() {
  const platform = new PrismaClient();
  let project: ProjectClient | null = null;

  try {
    const org = await platform.organization.findFirst({
      where: { slug: SLUG },
      select: {
        id: true,
        name: true,
        slug: true,
        databaseName: true,
        connectionString: true,
        enabledFeatures: true,
      },
    });

    if (!org) {
      throw new Error(
        `Organization slug "${SLUG}" not found. Create the Hospital Management project first.`,
      );
    }
    if (!org.connectionString) {
      throw new Error(
        `Org ${org.slug} has no connectionString — provision the project DB before seeding.`,
      );
    }

    console.log(`\n── Hospital app seed (${org.slug} / ${org.databaseName}) ──\n`);

    console.log('1) Features');
    await ensureFeatures(platform, org.id, org.enabledFeatures);

    console.log('\n2) Dynamic forms (platform DB)');
    const formIds: Record<string, string> = {};
    for (const def of FORMS) {
      formIds[def.code] = await upsertForm(platform, org.id, def);
    }

    project = new ProjectClient({
      datasources: { db: { url: org.connectionString } },
    });
    const db: TenantDb = project;

    const roleCount = await db.iamRole.count({ where: { organizationId: org.id } });
    if (roleCount === 0) {
      console.warn(
        '\nWARN: no IAM roles in project DB. Run: npm run prisma:seed:org-roles -w @dms/api\n',
      );
    } else {
      console.log(`\n3) IAM roles present: ${roleCount}`);
    }

    console.log('\n4) Menu groups + menus (project DB)');
    await reorderPlatformGroups(db, org.id);
    await deactivateMisnestedHospitalsMenu(db, org.id);

    for (const groupDef of MENU_GROUPS) {
      const group = await ensureGroup(
        db,
        org.id,
        groupDef.code,
        groupDef.name,
        groupDef.sortOrder,
      );
      console.log(`  Group ${groupDef.code} — ${groupDef.name}`);

      for (const leaf of groupDef.menus) {
        const formId = formIds[leaf.formCode];
        if (!formId) throw new Error(`Missing form ${leaf.formCode}`);
        const { menu, resource, menuPermId } = await ensureMenuWithForm(
          db,
          org.id,
          group.id,
          leaf.label,
          formId,
          leaf.icon,
          leaf.sortOrder,
        );

        for (const grant of leaf.roles) {
          await grantRoleAccess(
            db,
            org.id,
            grant.code,
            menu.id,
            resource,
            grant.actions,
            menuPermId,
          );
        }
      }
    }

    console.log('\n5) Hospital Admin full access');
    await grantAdminFullAccess(db, org.id);

    console.log('\n6) Login page + org theme');
    await ensureOrgTheme(platform, org.id);
    await updateLogin(db, org.id);

    console.log('\n7) Role-wise dashboards');
    await seedHospitalRoleDashboards(db, org.id);

    console.log('\n── Done ──');
    console.log(`Login:   /${SLUG}/login`);
    console.log(`App:     /${SLUG}`);
    console.log(`Forms:   ${Object.keys(formIds).length} published`);
    console.log(`Menus:   ${MENU_GROUPS.reduce((n, g) => n + g.menus.length, 0)} form-linked`);
    for (const [code, id] of Object.entries(formIds)) {
      console.log(`  ${code} → /${SLUG}/data/${id}`);
    }
  } finally {
    if (project) await project.$disconnect();
    await platform.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
