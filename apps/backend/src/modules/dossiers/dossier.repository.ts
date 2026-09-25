import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AdminDossierCase,
  AdminDossierDetail,
  AdminDossierListResponse,
  DossierListItem,
} from "@redactle/shared";

const CASE_INCLUDE = {
  puzzle: {
    select: {
      id: true,
      articleId: true,
      title: true,
      status: true,
    },
  },
} as const;

export class DossierRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private nameOrIdWhere(q?: string) {
    const query = q?.trim();
    if (!query) {
      return undefined;
    }
    return {
      OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { id: { contains: query, mode: "insensitive" as const } },
        { slug: { contains: query, mode: "insensitive" as const } },
      ],
    };
  }

  async listPublished(page: number, pageSize: number, q?: string) {
    const skip = (page - 1) * pageSize;
    const search = this.nameOrIdWhere(q);
    const where = { status: "PUBLISHED" as const, ...(search ?? {}) };
    const [rows, total] = await Promise.all([
      this.prisma.dossier.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { title: "asc" },
        include: { _count: { select: { caseFiles: true } } },
      }),
      this.prisma.dossier.count({ where }),
    ]);
    return { rows, total };
  }

  findPublishedBySlug(slug: string) {
    return this.prisma.dossier.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        caseFiles: {
          orderBy: { position: "asc" },
          include: CASE_INCLUDE,
        },
      },
    });
  }

  findPublishedCase(slug: string, caseId: string) {
    return this.prisma.dossierCaseFile.findFirst({
      where: {
        id: caseId,
        dossier: { slug, status: "PUBLISHED" },
      },
      include: {
        puzzle: true,
        dossier: true,
      },
    });
  }

  async listAdmin(page: number, pageSize: number, q?: string): Promise<AdminDossierListResponse> {
    const skip = (page - 1) * pageSize;
    const where = this.nameOrIdWhere(q);
    const [rows, total] = await Promise.all([
      this.prisma.dossier.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { caseFiles: true } } },
      }),
      this.prisma.dossier.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        coverImage: row.coverImage,
        status: row.status,
        caseCount: row._count.caseFiles,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }

  findAdminById(id: string) {
    return this.prisma.dossier.findUnique({
      where: { id },
      include: {
        caseFiles: {
          orderBy: { position: "asc" },
          include: CASE_INCLUDE,
        },
      },
    });
  }

  create(data: {
    slug: string;
    title: string;
    description: string;
    coverImage?: string | null;
  }) {
    return this.prisma.dossier.create({ data });
  }

  update(
    id: string,
    data: Prisma.DossierUpdateInput,
  ) {
    return this.prisma.dossier.update({ where: { id }, data });
  }

  async nextPosition(dossierId: string): Promise<number> {
    const last = await this.prisma.dossierCaseFile.aggregate({
      where: { dossierId },
      _max: { position: true },
    });
    return (last._max.position ?? 0) + 1;
  }

  addCase(data: { dossierId: string; puzzleId: string; position: number }) {
    return this.prisma.dossierCaseFile.create({ data });
  }

  findCase(dossierId: string, caseId: string) {
    return this.prisma.dossierCaseFile.findFirst({
      where: { id: caseId, dossierId },
    });
  }

  deleteCase(caseId: string) {
    return this.prisma.dossierCaseFile.delete({ where: { id: caseId } });
  }

  listCases(dossierId: string) {
    return this.prisma.dossierCaseFile.findMany({
      where: { dossierId },
      orderBy: { position: "asc" },
    });
  }

  async remapPositions(_dossierId: string, orderedCaseIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const [index, caseId] of orderedCaseIds.entries()) {
        await tx.dossierCaseFile.update({
          where: { id: caseId },
          data: { position: -(index + 1) },
        });
      }
      for (const [index, caseId] of orderedCaseIds.entries()) {
        await tx.dossierCaseFile.update({
          where: { id: caseId },
          data: { position: index + 1 },
        });
      }
    });
  }

  async findActivePuzzleForArticle(articleId: string, generatorVersion: string) {
    const preferred = await this.prisma.puzzle.findFirst({
      where: {
        articleId,
        generatorVersion,
        status: { in: ["DRAFT", "READY", "PUBLISHED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (preferred) {
      return preferred;
    }
    return this.prisma.puzzle.findFirst({
      where: {
        articleId,
        status: { in: ["DRAFT", "READY", "PUBLISHED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findPuzzleById(puzzleId: string) {
    return this.prisma.puzzle.findUnique({ where: { id: puzzleId } });
  }

  toListItem(row: { id: string; slug: string; title: string; description: string; coverImage: string | null; _count: { caseFiles: number } }): DossierListItem {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverImage: row.coverImage,
      caseCount: row._count.caseFiles,
    };
  }

  toAdminDetail(row: NonNullable<Awaited<ReturnType<DossierRepository["findAdminById"]>>>): AdminDossierDetail {
    const cases: AdminDossierCase[] = row.caseFiles.map((item) => ({
      id: item.id,
      position: item.position,
      puzzleId: item.puzzle.id,
      articleId: item.puzzle.articleId,
      title: item.puzzle.title,
      puzzleStatus: item.puzzle.status,
    }));
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverImage: row.coverImage,
      status: row.status,
      caseCount: cases.length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      cases,
    };
  }
}
