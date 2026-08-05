/**
 * Phase-1 School Management app seed.
 *
 * - Ensures enabledFeatures on school-management org
 * - Upserts published Dynamic Forms (platform DB)
 * - Upserts school MenuGroups + form-linked Menus (project DB)
 * - Creates menu.* + CRUD permissions; grants School Admin + ops roles
 * - Updates LoginPageConfig branding + theme `school`
 *
 * Prerequisites: org slug `school-management` (or name/slug containing "school")
 * with project DB; prefer domain roles via `npm run prisma:seed:org-roles -w @dms/api`.
 *
 * Run:
 *   npm run prisma:seed:school -w @dms/api
 */
import { PrismaClient } from '@prisma/client';
import { PrismaClient as ProjectClient } from '@dms/project-client';
import { seedSchoolRoleDashboards } from './seed-role-dashboards';

const SLUG = 'school-management';

const REQUIRED_FEATURES = [
  'dashboard',
  'users',
  'roles',
  'forms',
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
] as const;

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

const ENQUIRY_STATUS = [
  { label: 'New', value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Visit scheduled', value: 'VISIT_SCHEDULED' },
  { label: 'Admitted', value: 'ADMITTED' },
  { label: 'Closed', value: 'CLOSED' },
];

const ENQUIRY_SOURCE = [
  { label: 'Walk-in', value: 'WALK_IN' },
  { label: 'Website', value: 'WEBSITE' },
  { label: 'Referral', value: 'REFERRAL' },
  { label: 'Phone', value: 'PHONE' },
  { label: 'Other', value: 'OTHER' },
];

const STAFF_ROLE = [
  { label: 'Teacher', value: 'TEACHER' },
  { label: 'Principal', value: 'PRINCIPAL' },
  { label: 'Admin staff', value: 'ADMIN_STAFF' },
  { label: 'Counselor', value: 'COUNSELOR' },
  { label: 'Other', value: 'OTHER' },
];

const DAY_OF_WEEK = [
  { label: 'Monday', value: 'MONDAY' },
  { label: 'Tuesday', value: 'TUESDAY' },
  { label: 'Wednesday', value: 'WEDNESDAY' },
  { label: 'Thursday', value: 'THURSDAY' },
  { label: 'Friday', value: 'FRIDAY' },
  { label: 'Saturday', value: 'SATURDAY' },
];

const ATTENDANCE_STATUS = [
  { label: 'Present', value: 'PRESENT' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Late', value: 'LATE' },
  { label: 'Excused', value: 'EXCUSED' },
];

const FEE_FREQUENCY = [
  { label: 'One-time', value: 'ONE_TIME' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Term', value: 'TERM' },
  { label: 'Annual', value: 'ANNUAL' },
];

const PAYMENT_MODE = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Cheque', value: 'CHEQUE' },
];

const PAYMENT_STATUS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Waived', value: 'WAIVED' },
];

const BOOK_CATEGORY = [
  { label: 'Textbook', value: 'TEXTBOOK' },
  { label: 'Reference', value: 'REFERENCE' },
  { label: 'Fiction', value: 'FICTION' },
  { label: 'Magazine', value: 'MAGAZINE' },
  { label: 'Other', value: 'OTHER' },
];

const EXAM_STATUS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Locked', value: 'LOCKED' },
];

const FORMS: FormDef[] = [
  {
    code: 'STUDENT_REG',
    name: 'Student Registration',
    description: 'Register and maintain student demographics and class assignment',
    tab: { name: 'Student', code: 'STUDENT' },
    section: {
      name: 'Demographics',
      code: 'DEMOGRAPHICS',
      columns: 2,
      controls: [
        { fieldKey: 'admissionNo', label: 'Admission no.', controlType: 'TEXT', required: true, sortOrder: 1, placeholder: 'SCH-0001' },
        { fieldKey: 'fullName', label: 'Full name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'dateOfBirth', label: 'Date of birth', controlType: 'DATE', required: true, sortOrder: 3 },
        { fieldKey: 'gender', label: 'Gender', controlType: 'SELECT', required: true, sortOrder: 4, options: GENDER },
        { fieldKey: 'className', label: 'Class', controlType: 'TEXT', required: true, sortOrder: 5, placeholder: 'Grade 8' },
        { fieldKey: 'section', label: 'Section', controlType: 'TEXT', required: true, sortOrder: 6, placeholder: 'A' },
        { fieldKey: 'parentName', label: 'Parent / guardian', controlType: 'TEXT', required: true, sortOrder: 7 },
        { fieldKey: 'phone', label: 'Phone', controlType: 'TEXT', required: true, sortOrder: 8 },
        { fieldKey: 'email', label: 'Email', controlType: 'EMAIL', sortOrder: 9 },
        { fieldKey: 'address', label: 'Address', controlType: 'TEXTAREA', sortOrder: 10 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 11, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'ADMISSION_ENQUIRY',
    name: 'Admission Enquiry',
    description: 'Capture and track admission leads',
    tab: { name: 'Enquiry', code: 'ENQUIRY' },
    section: {
      name: 'Lead',
      code: 'LEAD',
      columns: 2,
      controls: [
        { fieldKey: 'enquiryNo', label: 'Enquiry no.', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'studentName', label: 'Student name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'seekingClass', label: 'Seeking class', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'parentName', label: 'Parent / guardian', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'phone', label: 'Phone', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'email', label: 'Email', controlType: 'EMAIL', sortOrder: 6 },
        { fieldKey: 'enquiryDate', label: 'Enquiry date', controlType: 'DATE', required: true, sortOrder: 7 },
        { fieldKey: 'source', label: 'Source', controlType: 'SELECT', sortOrder: 8, options: ENQUIRY_SOURCE },
        { fieldKey: 'notes', label: 'Notes', controlType: 'TEXTAREA', sortOrder: 9 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 10, options: ENQUIRY_STATUS },
      ],
    },
  },
  {
    code: 'TEACHER_STAFF',
    name: 'Teacher / Staff',
    description: 'Teaching and school staff directory',
    tab: { name: 'Profile', code: 'PROFILE' },
    section: {
      name: 'Staff',
      code: 'STAFF',
      columns: 2,
      controls: [
        { fieldKey: 'employeeCode', label: 'Employee code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'fullName', label: 'Full name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'roleType', label: 'Role type', controlType: 'SELECT', required: true, sortOrder: 3, options: STAFF_ROLE },
        { fieldKey: 'department', label: 'Department', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'subjects', label: 'Subjects', controlType: 'TEXT', sortOrder: 5, placeholder: 'Math, Science' },
        { fieldKey: 'phone', label: 'Phone', controlType: 'TEXT', sortOrder: 6 },
        { fieldKey: 'email', label: 'Email', controlType: 'EMAIL', sortOrder: 7 },
        { fieldKey: 'joiningDate', label: 'Joining date', controlType: 'DATE', sortOrder: 8 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 9, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'CLASS_SECTION',
    name: 'Class / Section',
    description: 'Classes, sections, capacity, and class teacher',
    tab: { name: 'Class', code: 'CLASS' },
    section: {
      name: 'Details',
      code: 'DETAILS',
      columns: 2,
      controls: [
        { fieldKey: 'classCode', label: 'Class code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'className', label: 'Class name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'section', label: 'Section', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'classTeacher', label: 'Class teacher', controlType: 'TEXT', sortOrder: 4 },
        { fieldKey: 'capacity', label: 'Capacity', controlType: 'NUMBER', required: true, sortOrder: 5 },
        { fieldKey: 'roomNo', label: 'Room no.', controlType: 'TEXT', sortOrder: 6 },
        { fieldKey: 'academicYear', label: 'Academic year', controlType: 'TEXT', required: true, sortOrder: 7, placeholder: '2025-26' },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 8, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'SUBJECT',
    name: 'Subject',
    description: 'Subject master by class',
    tab: { name: 'Subject', code: 'SUBJECT' },
    section: {
      name: 'Details',
      code: 'DETAILS',
      columns: 2,
      controls: [
        { fieldKey: 'subjectCode', label: 'Subject code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'subjectName', label: 'Subject name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'className', label: 'Class', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'credits', label: 'Credits / periods', controlType: 'NUMBER', sortOrder: 4 },
        { fieldKey: 'teacherName', label: 'Teacher', controlType: 'TEXT', sortOrder: 5 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 6, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'TIMETABLE',
    name: 'Timetable',
    description: 'Weekly class timetable slots',
    tab: { name: 'Slot', code: 'SLOT' },
    section: {
      name: 'Schedule',
      code: 'SCHEDULE',
      columns: 2,
      controls: [
        { fieldKey: 'className', label: 'Class', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'section', label: 'Section', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'dayOfWeek', label: 'Day', controlType: 'SELECT', required: true, sortOrder: 3, options: DAY_OF_WEEK },
        { fieldKey: 'period', label: 'Period', controlType: 'NUMBER', required: true, sortOrder: 4 },
        { fieldKey: 'subjectName', label: 'Subject', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'teacherName', label: 'Teacher', controlType: 'TEXT', required: true, sortOrder: 6 },
        { fieldKey: 'roomNo', label: 'Room no.', controlType: 'TEXT', sortOrder: 7 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 8, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'ATTENDANCE',
    name: 'Attendance',
    description: 'Daily student attendance records',
    tab: { name: 'Attendance', code: 'ATT' },
    section: {
      name: 'Mark',
      code: 'MARK',
      columns: 2,
      controls: [
        { fieldKey: 'attendanceDate', label: 'Date', controlType: 'DATE', required: true, sortOrder: 1 },
        { fieldKey: 'className', label: 'Class', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'section', label: 'Section', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'studentName', label: 'Student name', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'admissionNo', label: 'Admission no.', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 6, options: ATTENDANCE_STATUS },
        { fieldKey: 'markedBy', label: 'Marked by', controlType: 'TEXT', required: true, sortOrder: 7 },
        { fieldKey: 'remarks', label: 'Remarks', controlType: 'TEXTAREA', sortOrder: 8 },
      ],
    },
  },
  {
    code: 'FEE_STRUCTURE',
    name: 'Fee Structure',
    description: 'Define tuition and other fee heads',
    tab: { name: 'Structure', code: 'STRUCTURE' },
    section: {
      name: 'Fee head',
      code: 'FEE_HEAD',
      columns: 2,
      controls: [
        { fieldKey: 'feeCode', label: 'Fee code', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'feeName', label: 'Fee name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'className', label: 'Class', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'academicYear', label: 'Academic year', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'amount', label: 'Amount', controlType: 'NUMBER', required: true, sortOrder: 5 },
        { fieldKey: 'dueDate', label: 'Due date', controlType: 'DATE', sortOrder: 6 },
        { fieldKey: 'frequency', label: 'Frequency', controlType: 'SELECT', required: true, sortOrder: 7, options: FEE_FREQUENCY },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 8, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'FEE_COLLECTION',
    name: 'Fee Collection',
    description: 'Record student fee payments',
    tab: { name: 'Payment', code: 'PAYMENT' },
    section: {
      name: 'Receipt',
      code: 'RECEIPT',
      columns: 2,
      controls: [
        { fieldKey: 'receiptNo', label: 'Receipt no.', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'studentName', label: 'Student name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'admissionNo', label: 'Admission no.', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'feeName', label: 'Fee name', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'amount', label: 'Amount', controlType: 'NUMBER', required: true, sortOrder: 5 },
        { fieldKey: 'paidDate', label: 'Paid date', controlType: 'DATE', required: true, sortOrder: 6 },
        { fieldKey: 'paymentMode', label: 'Payment mode', controlType: 'SELECT', sortOrder: 7, options: PAYMENT_MODE },
        { fieldKey: 'paymentStatus', label: 'Payment status', controlType: 'SELECT', required: true, sortOrder: 8, options: PAYMENT_STATUS },
      ],
    },
  },
  {
    code: 'LIBRARY_BOOK',
    name: 'Library Book',
    description: 'Library catalog and stock',
    tab: { name: 'Book', code: 'BOOK' },
    section: {
      name: 'Catalog',
      code: 'CATALOG',
      columns: 2,
      controls: [
        { fieldKey: 'isbn', label: 'ISBN', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'title', label: 'Title', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'author', label: 'Author', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'category', label: 'Category', controlType: 'SELECT', sortOrder: 4, options: BOOK_CATEGORY },
        { fieldKey: 'copies', label: 'Copies', controlType: 'NUMBER', required: true, sortOrder: 5 },
        { fieldKey: 'available', label: 'Available', controlType: 'NUMBER', sortOrder: 6 },
        { fieldKey: 'shelfLocation', label: 'Shelf location', controlType: 'TEXT', sortOrder: 7 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 8, options: STATUS_ACTIVE },
      ],
    },
  },
  {
    code: 'EXAM_RESULT',
    name: 'Exam / Result',
    description: 'Exam marks and published grades',
    tab: { name: 'Result', code: 'RESULT' },
    section: {
      name: 'Marks',
      code: 'MARKS',
      columns: 2,
      controls: [
        { fieldKey: 'examName', label: 'Exam name', controlType: 'TEXT', required: true, sortOrder: 1 },
        { fieldKey: 'examDate', label: 'Exam date', controlType: 'DATE', required: true, sortOrder: 2 },
        { fieldKey: 'className', label: 'Class', controlType: 'TEXT', required: true, sortOrder: 3 },
        { fieldKey: 'subjectName', label: 'Subject', controlType: 'TEXT', required: true, sortOrder: 4 },
        { fieldKey: 'studentName', label: 'Student name', controlType: 'TEXT', required: true, sortOrder: 5 },
        { fieldKey: 'admissionNo', label: 'Admission no.', controlType: 'TEXT', required: true, sortOrder: 6 },
        { fieldKey: 'marksObtained', label: 'Marks obtained', controlType: 'NUMBER', required: true, sortOrder: 7 },
        { fieldKey: 'maxMarks', label: 'Max marks', controlType: 'NUMBER', required: true, sortOrder: 8 },
        { fieldKey: 'grade', label: 'Grade', controlType: 'TEXT', sortOrder: 9 },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 10, options: EXAM_STATUS },
      ],
    },
  },
  {
    code: 'DEPARTMENT',
    name: 'Department',
    description: 'School departments master',
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
    code: 'ACADEMIC_YEAR',
    name: 'Academic Year',
    description: 'Academic year calendar master',
    tab: { name: 'Year', code: 'YEAR' },
    section: {
      name: 'Period',
      code: 'PERIOD',
      columns: 2,
      controls: [
        { fieldKey: 'code', label: 'Code', controlType: 'TEXT', required: true, sortOrder: 1, placeholder: 'AY-2025-26' },
        { fieldKey: 'name', label: 'Name', controlType: 'TEXT', required: true, sortOrder: 2 },
        { fieldKey: 'startDate', label: 'Start date', controlType: 'DATE', required: true, sortOrder: 3 },
        { fieldKey: 'endDate', label: 'End date', controlType: 'DATE', required: true, sortOrder: 4 },
        {
          fieldKey: 'isCurrent',
          label: 'Current year',
          controlType: 'SELECT',
          required: true,
          sortOrder: 5,
          options: [
            { label: 'Yes', value: 'YES' },
            { label: 'No', value: 'NO' },
          ],
        },
        { fieldKey: 'status', label: 'Status', controlType: 'SELECT', required: true, sortOrder: 6, options: STATUS_ACTIVE },
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
    code: 'ADMISSIONS',
    name: 'Admissions',
    sortOrder: 2,
    icon: 'users',
    menus: [
      {
        label: 'Student Registration',
        formCode: 'STUDENT_REG',
        icon: 'user',
        sortOrder: 1,
        roles: [
          ...roleAccess(['ADMISSIONS_OFFICER']),
          ...roleAccess(['PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'COUNSELOR'], ['view']),
        ],
      },
      {
        label: 'Admission Enquiries',
        formCode: 'ADMISSION_ENQUIRY',
        icon: 'form',
        sortOrder: 2,
        roles: [
          ...roleAccess(['ADMISSIONS_OFFICER']),
          ...roleAccess(['COUNSELOR'], ['view', 'update']),
          ...roleAccess(['PRINCIPAL'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'ACADEMICS',
    name: 'Academics',
    sortOrder: 3,
    icon: 'layout',
    menus: [
      {
        label: 'Classes / Sections',
        formCode: 'CLASS_SECTION',
        icon: 'building',
        sortOrder: 1,
        roles: [
          ...roleAccess(['PRINCIPAL', 'TEACHER', 'STUDENT', 'ACCOUNTANT', 'COUNSELOR', 'ADMISSIONS_OFFICER'], ['view']),
        ],
      },
      {
        label: 'Subjects',
        formCode: 'SUBJECT',
        icon: 'form',
        sortOrder: 2,
        roles: [
          ...roleAccess(['PRINCIPAL', 'TEACHER', 'STUDENT'], ['view']),
        ],
      },
      {
        label: 'Timetable',
        formCode: 'TIMETABLE',
        icon: 'activity',
        sortOrder: 3,
        roles: [
          ...roleAccess(['PRINCIPAL', 'TEACHER', 'STUDENT'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'TEACHERS',
    name: 'Teachers',
    sortOrder: 4,
    icon: 'users',
    menus: [
      {
        label: 'Teachers / Staff',
        formCode: 'TEACHER_STAFF',
        icon: 'users',
        sortOrder: 1,
        roles: [
          ...roleAccess(['PRINCIPAL', 'TEACHER', 'ADMISSIONS_OFFICER'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'ATTENDANCE',
    name: 'Attendance',
    sortOrder: 5,
    icon: 'activity',
    menus: [
      {
        label: 'Attendance',
        formCode: 'ATTENDANCE',
        icon: 'table',
        sortOrder: 1,
        roles: [
          ...roleAccess(['TEACHER']),
          ...roleAccess(['PRINCIPAL', 'STUDENT', 'COUNSELOR'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'EXAMINATIONS',
    name: 'Examinations',
    sortOrder: 6,
    icon: 'form',
    menus: [
      {
        label: 'Exams / Results',
        formCode: 'EXAM_RESULT',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['TEACHER']),
          ...roleAccess(['PRINCIPAL', 'STUDENT', 'COUNSELOR'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'FEES',
    name: 'Fees / Accounts',
    sortOrder: 7,
    icon: 'layout',
    menus: [
      {
        label: 'Fee Structure',
        formCode: 'FEE_STRUCTURE',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['ACCOUNTANT']),
          ...roleAccess(['PRINCIPAL'], ['view']),
        ],
      },
      {
        label: 'Fee Collection',
        formCode: 'FEE_COLLECTION',
        icon: 'form',
        sortOrder: 2,
        roles: [
          ...roleAccess(['ACCOUNTANT']),
          ...roleAccess(['PRINCIPAL', 'STUDENT'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'LIBRARY',
    name: 'Library',
    sortOrder: 8,
    icon: 'form',
    menus: [
      {
        label: 'Library Books',
        formCode: 'LIBRARY_BOOK',
        icon: 'form',
        sortOrder: 1,
        roles: [
          ...roleAccess(['LIBRARIAN']),
          ...roleAccess(['PRINCIPAL', 'TEACHER', 'STUDENT'], ['view']),
        ],
      },
    ],
  },
  {
    code: 'MASTERS',
    name: 'Masters',
    sortOrder: 9,
    icon: 'building',
    menus: [
      {
        label: 'Departments',
        formCode: 'DEPARTMENT',
        icon: 'building',
        sortOrder: 1,
        roles: roleAccess(
          ['PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'COUNSELOR', 'ADMISSIONS_OFFICER'],
          ['view'],
        ),
      },
      {
        label: 'Academic Year',
        formCode: 'ACADEMIC_YEAR',
        icon: 'activity',
        sortOrder: 2,
        roles: roleAccess(
          ['PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'COUNSELOR', 'ADMISSIONS_OFFICER'],
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
  if (merged.length === existing.length && REQUIRED_FEATURES.every((f) => existing.includes(f))) {
    console.log('  Features already include Phase-1 set');
    return;
  }
  await platform.organization.update({
    where: { id: orgId },
    data: { enabledFeatures: merged },
  });
  console.log(`  enabledFeatures → ${merged.join(', ')}`);
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
    await platform.formControl.create({
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
    where: { organizationId, code: { in: permCodes } },
  });
  const byCode = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  const ids = permCodes.map((c) => byCode[c]).filter(Boolean);
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
    (await db.iamRole.findFirst({ where: { organizationId, code: 'SCHOOL_ADMIN' } })) ??
    (await db.iamRole.findFirst({ where: { organizationId, code: 'ADMIN' } }));
  if (!admin) {
    console.warn('  WARN: no SCHOOL_ADMIN / ADMIN role — skip full grant');
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
    ['ACCESS', 20],
    ['CONFIG', 21],
    ['GOVERNANCE', 22],
  ];
  for (const [code, sortOrder] of updates) {
    await db.menuGroup.updateMany({
      where: { organizationId, code },
      data: { sortOrder },
    });
  }
}

async function updateLogin(db: TenantDb, organizationId: string) {
  const existing = await db.loginPageConfig.findUnique({ where: { organizationId } });
  const data = {
    companyName: 'School Management',
    welcomeText: 'Sign in to School Management',
    description:
      'Admissions, academics, attendance, fees, exams, and library — in one school workspace.',
    theme: 'school',
    primaryColor: '#b45309',
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
    data: { theme: 'school' },
  });
  console.log('  Organization theme → school');
}

async function resolveSchoolOrg(platform: PrismaClient) {
  const bySlug = await platform.organization.findFirst({
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
  if (bySlug) return bySlug;

  const byContains = await platform.organization.findFirst({
    where: {
      OR: [
        { slug: { contains: 'school', mode: 'insensitive' } },
        { name: { contains: 'school', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      databaseName: true,
      connectionString: true,
      enabledFeatures: true,
    },
  });
  return byContains;
}

async function main() {
  const platform = new PrismaClient();
  let project: ProjectClient | null = null;

  try {
    const org = await resolveSchoolOrg(platform);

    if (!org) {
      throw new Error(
        `School organization not found (slug "${SLUG}" or name/slug containing "school"). Create the School Management project first.`,
      );
    }
    if (!org.connectionString) {
      throw new Error(
        `Org ${org.slug} has no connectionString — provision the project DB before seeding.`,
      );
    }

    console.log(`\n── School app seed (${org.slug} / ${org.databaseName}) ──\n`);

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

    console.log('\n5) School Admin full access');
    await grantAdminFullAccess(db, org.id);

    console.log('\n6) Login page + org theme');
    await ensureOrgTheme(platform, org.id);
    await updateLogin(db, org.id);

    console.log('\n7) Role-wise dashboards');
    await seedSchoolRoleDashboards(db, org.id);

    console.log('\n── Done ──');
    console.log(`Login:   /${org.slug}/login`);
    console.log(`App:     /${org.slug}`);
    console.log(`Forms:   ${Object.keys(formIds).length} published`);
    console.log(`Menus:   ${MENU_GROUPS.reduce((n, g) => n + g.menus.length, 0)} form-linked`);
    for (const [code, id] of Object.entries(formIds)) {
      console.log(`  ${code} → /${org.slug}/data/${id}`);
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
