import { z } from 'zod';

/**
 * Client settings from `config.json` next to index.html (docs/spec.md, section 4).
 * Missing keys take their defaults, so `{}` is a valid file.
 */
export const AppConfigSchema = z.object({
  /** Directory of the PHP API relative to the app, or null for the serverless mode. */
  apiBase: z.string().trim().min(1).nullable().default('api'),
  /** "proxy": pages and images go through api/fetch.php; "direct": the browser fetches sites itself. */
  fetchMode: z.enum(['proxy', 'direct']).default('proxy'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/* ---- Collection: result of parseCollection() (docs/spec.md, sections 5 and 7) ---- */

export const SiteSchema = z.enum(['gelster', 'ooogelingen']);
export type Site = z.infer<typeof SiteSchema>;

export const ArticleSchema = z.object({
  code: z.string(),
  title: z.string().optional(),
  /** Absolute image URL. */
  image: z.string(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const FeatureCellSchema = z.object({
  /** Sanitized HTML (same tag whitelist as the description). */
  html: z.string(),
  colSpan: z.number().int().positive().optional(),
  rowSpan: z.number().int().positive().optional(),
  header: z.boolean().optional(),
});
export type FeatureCell = z.infer<typeof FeatureCellSchema>;

export const FeatureRowSchema = z.object({ cells: z.array(FeatureCellSchema) });
export type FeatureRow = z.infer<typeof FeatureRowSchema>;

export const CollectionSchema = z.object({
  sourceUrl: z.string(),
  site: SiteSchema,
  fetchedAt: z.string(),
  /** h1 of the page, e.g. «Marmoleum Cocoa». */
  name: z.string(),
  /** Kind of flooring, e.g. «Натуральный линолеум с какао»; '' when not found. */
  flooringKind: z.string(),
  /** «Forbo» or ''. */
  manufacturer: z.string(),
  /** Sanitized HTML: p, ul, ol, li, b, strong, i, em, u, a, br, sup, sub. */
  descriptionHtml: z.string(),
  /** Absolute URL or null. */
  mainImage: z.string().nullable(),
  articles: z.array(ArticleSchema),
  features: z.array(FeatureRowSchema),
  warnings: z.array(z.string()),
});
export type Collection = z.infer<typeof CollectionSchema>;

/* ---- Project (IndexedDB) ---- */

export const UNITS = ['шт.', 'м²', 'пог.м'] as const;
export const UnitSchema = z.enum(UNITS);
export type Unit = z.infer<typeof UnitSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.number().nonnegative().nullable(),
  unit: UnitSchema,
  priceRub: z.number().nonnegative().nullable(),
});
export type Item = z.infer<typeof ItemSchema>;

export const CurrencyModeSchema = z.enum(['rub', 'rubAndEuro']);
export type CurrencyMode = z.infer<typeof CurrencyModeSchema>;

export const ProjectFormSchema = z.object({
  managerId: z.string(),
  /** Snapshot of the manager's name at the moment of choice. */
  managerName: z.string(),
  client: z.string(),
  clientName: z.string(),
  clientSex: z.enum(['m', 'f']),
  link: z.string(),
  euroRate: z.number().nullable(),
  mainCurrency: CurrencyModeSchema,
  extraCurrency: CurrencyModeSchema,
  mainItems: z.array(ItemSchema),
  extraItems: z.array(ItemSchema),
  delivery: z.object({
    mode: z.enum(['default', 'none', 'custom']),
    custom: z.array(z.string()),
  }),
});
export type ProjectForm = z.infer<typeof ProjectFormSchema>;

export const SelectedArticleSchema = z.object({ code: z.string(), image: z.string(), caption: z.string() });
export type SelectedArticle = z.infer<typeof SelectedArticleSchema>;

/** Manual edits on top of the collection snapshot; null fields are recomputed from the form ("auto"). */
export const KpEditsSchema = z.object({
  date: z.string().nullable(),
  title: z.string().nullable(),
  greeting: z.string().nullable(),
  intro: z.string().nullable(),
  collectionHeading: z.string().nullable(),
  descriptionHtml: z.string(),
  selectedArticles: z.array(SelectedArticleSchema),
  featuresTitle: z.string(),
  features: z.array(FeatureRowSchema),
  comments: z.array(z.string()),
});
export type KpEdits = z.infer<typeof KpEditsSchema>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  version: z.literal(1),
  updatedAt: z.string(),
  form: ProjectFormSchema,
  collection: CollectionSchema.nullable(),
  /** null until the preview has been opened once. */
  kp: KpEditsSchema.nullable(),
});
export type Project = z.infer<typeof ProjectSchema>;

/* ---- API ---- */

export const ManagerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Signature image URL relative to the app. */
  signature: z.string(),
});
export type Manager = z.infer<typeof ManagerSchema>;

export const RatesSchema = z.object({
  /** Roubles per 1 euro. */
  eur: z.number().positive(),
  /** Roubles per 1 US dollar. */
  usd: z.number().positive(),
  /** Date of the CBR quote, ISO `YYYY-MM-DD`. */
  date: z.string(),
});
export type Rates = z.infer<typeof RatesSchema>;

/* ---- Export file ---- */

export const ExportFileSchema = z.object({
  format: z.literal('gelster-kp'),
  version: z.literal(1),
  exportedAt: z.string(),
  projects: z.array(ProjectSchema),
  /** Image URL → data: URL. */
  images: z.record(z.string(), z.string().startsWith('data:')),
});
export type ExportFile = z.infer<typeof ExportFileSchema>;
