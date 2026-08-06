import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ControlType,
  FormLayoutType,
  FormStatus,
  Prisma,
  ValidationRuleType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProjectDbService } from '../project-db/project-db.service';

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly projectDb: ProjectDbService,
  ) {}

  private formInclude = {
    tabs: { orderBy: { sortOrder: 'asc' as const } },
    sections: {
      orderBy: { sortOrder: 'asc' as const },
      include: {
        controls: {
          orderBy: { sortOrder: 'asc' as const },
          include: { validations: { orderBy: { sortOrder: 'asc' as const } } },
        },
      },
    },
  };

  async list(organizationId: string) {
    const forms = await this.prisma.dynamicForm.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { sections: true, tabs: true, submissions: true } },
      },
    });

    const linkedByForm = new Map<
      string,
      Array<{ id: string; label: string; path: string | null }>
    >();
    const project = await this.projectDb.getClient(organizationId);
    if (project) {
      const menus = await project.menu.findMany({
        where: {
          organizationId,
          formId: { not: null },
          isActive: true,
        },
        select: { id: true, label: true, path: true, formId: true },
        orderBy: { sortOrder: 'asc' },
      });
      for (const menu of menus as Array<{
        id: string;
        label: string;
        path: string | null;
        formId: string | null;
      }>) {
        if (!menu.formId) continue;
        const list = linkedByForm.get(menu.formId) ?? [];
        list.push({ id: menu.id, label: menu.label, path: menu.path });
        linkedByForm.set(menu.formId, list);
      }
    }

    return forms.map((form) => ({
      ...form,
      linkedMenus: linkedByForm.get(form.id) ?? [],
    }));
  }

  async get(organizationId: string, id: string) {
    const form = await this.prisma.dynamicForm.findFirst({
      where: { id, organizationId },
      include: this.formInclude,
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      code: string;
      description?: string;
      layoutType?: FormLayoutType;
      layoutConfig?: Record<string, unknown>;
    },
    userId?: string,
  ) {
    const form = await this.prisma.dynamicForm.create({
      data: {
        organizationId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        layoutType: data.layoutType ?? 'TABS',
        layoutConfig: (data.layoutConfig ?? {}) as Prisma.InputJsonValue,
      },
      include: this.formInclude,
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      resource: 'form',
      resourceId: form.id,
      summary: `Created form ${form.name}`,
    });
    await this.audit.recordActivity({
      organizationId,
      userId,
      type: 'FORM_CREATED',
      title: `Form created: ${form.name}`,
      link: '/app/forms',
      metadata: { formId: form.id, code: form.code },
    });
    return form;
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      layoutType: FormLayoutType;
      layoutConfig: Record<string, unknown>;
      status: FormStatus;
      isActive: boolean;
    }>,
  ) {
    await this.ensureForm(organizationId, id);
    return this.prisma.dynamicForm.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        layoutType: data.layoutType,
        status: data.status,
        isActive: data.isActive,
        ...(data.layoutConfig
          ? { layoutConfig: data.layoutConfig as Prisma.InputJsonValue }
          : {}),
      },
      include: this.formInclude,
    });
  }

  async addTab(organizationId: string, formId: string, data: { name: string; code: string; sortOrder?: number }) {
    await this.ensureForm(organizationId, formId);
    return this.prisma.formTab.create({
      data: {
        formId,
        name: data.name,
        code: data.code.toUpperCase(),
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async addSection(
    organizationId: string,
    formId: string,
    data: {
      name: string;
      code: string;
      tabId?: string;
      columns?: number;
      sortOrder?: number;
      collapsible?: boolean;
    },
  ) {
    await this.ensureForm(organizationId, formId);
    return this.prisma.formSection.create({
      data: {
        formId,
        name: data.name,
        code: data.code.toUpperCase(),
        tabId: data.tabId,
        columns: data.columns ?? 2,
        sortOrder: data.sortOrder ?? 0,
        collapsible: data.collapsible ?? false,
      },
    });
  }

  async addControl(
    organizationId: string,
    sectionId: string,
    data: {
      fieldKey: string;
      label: string;
      controlType?: ControlType;
      placeholder?: string;
      helpText?: string;
      defaultValue?: string;
      options?: unknown[];
      colSpan?: number;
      sortOrder?: number;
      required?: boolean;
      config?: Record<string, unknown>;
      validations?: Array<{ ruleType: ValidationRuleType; value?: string; message: string }>;
    },
  ) {
    const section = await this.prisma.formSection.findUnique({
      where: { id: sectionId },
      include: { form: true },
    });
    if (!section || section.form.organizationId !== organizationId) {
      throw new NotFoundException('Section not found');
    }

    return this.prisma.formControl.create({
      data: {
        sectionId,
        fieldKey: data.fieldKey,
        label: data.label,
        controlType: data.controlType ?? 'TEXT',
        placeholder: data.placeholder,
        helpText: data.helpText,
        defaultValue: data.defaultValue,
        options: (data.options ?? []) as Prisma.InputJsonValue,
        colSpan: data.colSpan ?? 1,
        sortOrder: data.sortOrder ?? 0,
        required: data.required ?? false,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        validations: data.validations?.length
          ? {
              create: data.validations.map((v, i) => ({
                ruleType: v.ruleType,
                value: v.value,
                message: v.message,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { validations: true },
    });
  }

  async updateControl(
    organizationId: string,
    controlId: string,
    data: Partial<{
      label: string;
      controlType: ControlType;
      placeholder: string | null;
      required: boolean;
      options: unknown[];
      sortOrder: number;
    }>,
  ) {
    const control = await this.prisma.formControl.findUnique({
      where: { id: controlId },
      include: { section: { include: { form: true } } },
    });
    if (!control || control.section.form.organizationId !== organizationId) {
      throw new NotFoundException('Control not found');
    }
    return this.prisma.formControl.update({
      where: { id: controlId },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.controlType !== undefined ? { controlType: data.controlType } : {}),
        ...(data.placeholder !== undefined ? { placeholder: data.placeholder } : {}),
        ...(data.required !== undefined ? { required: data.required } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.options !== undefined
          ? { options: data.options as Prisma.InputJsonValue }
          : {}),
      },
      include: { validations: true },
    });
  }

  async deleteControl(organizationId: string, controlId: string) {
    const control = await this.prisma.formControl.findUnique({
      where: { id: controlId },
      include: { section: { include: { form: true } } },
    });
    if (!control || control.section.form.organizationId !== organizationId) {
      throw new NotFoundException('Control not found');
    }
    await this.prisma.formValidation.deleteMany({ where: { controlId } });
    await this.prisma.formControl.delete({ where: { id: controlId } });
    return { ok: true };
  }

  async addValidation(
    organizationId: string,
    controlId: string,
    data: { ruleType: ValidationRuleType; value?: string; message: string; sortOrder?: number },
  ) {
    const control = await this.prisma.formControl.findUnique({
      where: { id: controlId },
      include: { section: { include: { form: true } } },
    });
    if (!control || control.section.form.organizationId !== organizationId) {
      throw new NotFoundException('Control not found');
    }
    return this.prisma.formValidation.create({
      data: {
        controlId,
        ruleType: data.ruleType,
        value: data.value,
        message: data.message,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async submit(
    organizationId: string,
    formId: string,
    userId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const form = await this.get(organizationId, formId);
    if (form.status !== 'PUBLISHED' && form.status !== 'DRAFT') {
      throw new BadRequestException('Form is not available');
    }

    const errors: string[] = [];
    for (const section of form.sections) {
      for (const control of section.controls) {
        if (!control.isActive) continue;
        const value = payload[control.fieldKey];
        const validations = [...control.validations];
        if (control.required) {
          validations.unshift({
            id: 'required',
            controlId: control.id,
            ruleType: 'REQUIRED',
            value: null,
            message: `${control.label} is required`,
            sortOrder: -1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        for (const rule of validations) {
          const msg = this.validateValue(value, rule.ruleType, rule.value, rule.message);
          if (msg) errors.push(msg);
        }
      }
    }
    if (errors.length) {
      throw new BadRequestException(errors);
    }

    return this.prisma.formSubmission.create({
      data: {
        formId,
        submittedBy: userId,
        data: payload as Prisma.InputJsonValue,
      },
    });
  }

  listSubmissions(organizationId: string, formId: string) {
    return this.prisma.formSubmission.findMany({
      where: { formId, form: { organizationId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getSubmission(organizationId: string, formId: string, submissionId: string) {
    const row = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, formId, form: { organizationId } },
    });
    if (!row) throw new NotFoundException('Submission not found');
    return row;
  }

  async updateSubmission(
    organizationId: string,
    formId: string,
    submissionId: string,
    payload: Record<string, unknown>,
  ) {
    const existing = await this.getSubmission(organizationId, formId, submissionId);
    const form = await this.get(organizationId, formId);
    if (form.status !== 'PUBLISHED' && form.status !== 'DRAFT') {
      throw new BadRequestException('Form is not available');
    }

    const errors: string[] = [];
    for (const section of form.sections) {
      for (const control of section.controls) {
        if (!control.isActive) continue;
        const value = payload[control.fieldKey];
        const validations = [...control.validations];
        if (control.required) {
          validations.unshift({
            id: 'required',
            controlId: control.id,
            ruleType: 'REQUIRED',
            value: null,
            message: `${control.label} is required`,
            sortOrder: -1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        for (const rule of validations) {
          const msg = this.validateValue(value, rule.ruleType, rule.value, rule.message);
          if (msg) errors.push(msg);
        }
      }
    }
    if (errors.length) {
      throw new BadRequestException(errors);
    }

    return this.prisma.formSubmission.update({
      where: { id: existing.id },
      data: { data: payload as Prisma.InputJsonValue },
    });
  }

  async deleteSubmission(organizationId: string, formId: string, submissionId: string) {
    const existing = await this.getSubmission(organizationId, formId, submissionId);
    await this.prisma.formSubmission.delete({ where: { id: existing.id } });
    return { ok: true };
  }

  private validateValue(
    value: unknown,
    ruleType: ValidationRuleType | string,
    ruleValue: string | null | undefined,
    message: string,
  ): string | null {
    const str = value == null ? '' : String(value);
    switch (ruleType) {
      case 'REQUIRED':
        return str.trim() ? null : message;
      case 'EMAIL':
        return !str || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) ? null : message;
      case 'MIN_LENGTH':
        return !ruleValue || str.length >= Number(ruleValue) ? null : message;
      case 'MAX_LENGTH':
        return !ruleValue || str.length <= Number(ruleValue) ? null : message;
      case 'MIN':
        return value == null || value === '' || Number(value) >= Number(ruleValue) ? null : message;
      case 'MAX':
        return value == null || value === '' || Number(value) <= Number(ruleValue) ? null : message;
      case 'PATTERN':
        return !ruleValue || !str || new RegExp(ruleValue).test(str) ? null : message;
      default:
        return null;
    }
  }

  private async ensureForm(organizationId: string, id: string) {
    const form = await this.prisma.dynamicForm.findFirst({ where: { id, organizationId } });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }
}
