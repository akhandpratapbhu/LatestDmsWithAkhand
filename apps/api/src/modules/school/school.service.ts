import { Injectable } from '@nestjs/common';
import { FormsService } from '../forms/forms.service';

/** Form codes used by Phase-1 school role dashboards. */
export const SCHOOL_DASHBOARD_FORM_CODES = [
  'STUDENT_REG',
  'TEACHER_STAFF',
  'CLASS_SECTION',
  'ATTENDANCE',
  'FEE_COLLECTION',
  'EXAM_RESULT',
  'ADMISSION_ENQUIRY',
  'LIBRARY_BOOK',
] as const;

@Injectable()
export class SchoolService {
  constructor(private readonly forms: FormsService) {}

  /**
   * Lightweight school dashboard stats from Dynamic Form submission counts.
   * Phase-1: no custom school domain tables — form counts are best-effort.
   */
  async getDashboardStats(organizationId: string) {
    const allForms = await this.forms.list(organizationId);
    const byCode = new Map(
      allForms.map((f: {
        id: string;
        code: string;
        name: string;
        _count?: { submissions?: number };
      }) => [f.code, f]),
    );

    const forms: Record<string, { name: string; count: number }> = {};
    let submissionsTotal = 0;

    for (const code of SCHOOL_DASHBOARD_FORM_CODES) {
      const form = byCode.get(code);
      const count = form?._count?.submissions ?? 0;
      forms[code] = {
        name: form?.name ?? code,
        count,
      };
      submissionsTotal += count;
    }

    // Also include any other published forms for completeness
    for (const f of allForms) {
      if (forms[f.code]) continue;
      const count = f._count?.submissions ?? 0;
      forms[f.code] = { name: f.name, count };
      submissionsTotal += count;
    }

    return {
      forms,
      totals: {
        forms: allForms.length,
        submissions: submissionsTotal,
        students: forms.STUDENT_REG?.count ?? 0,
        teachers: forms.TEACHER_STAFF?.count ?? 0,
        classes: forms.CLASS_SECTION?.count ?? 0,
        attendanceRecords: forms.ATTENDANCE?.count ?? 0,
        feeCollections: forms.FEE_COLLECTION?.count ?? 0,
        examResults: forms.EXAM_RESULT?.count ?? 0,
      },
    };
  }
}
