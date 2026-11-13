/**
 * Edits made on the KP page (docs/spec.md, section 8 «Редактирование»): pure functions from a project and one
 * change to the next project. The values arrive already cleaned (see blocks/Editable.tsx). A change that alters
 * nothing returns the same project object, so the caller knows there is nothing to save.
 */
import type { FeatureCell, KpEdits, Project } from '../../shared/schema.ts';
import {
  autoTexts,
  buildComments,
  createInitialKp,
  DEFAULT_PALETTE_TEXT,
  joinDescription,
  splitDescription,
  type AutoField,
} from './model.ts';

export type KpChange =
  /** null: back to the text derived from the form. */
  | { kind: 'auto'; field: AutoField; value: string | null }
  /** The paragraph is replaced by these pieces (Enter splits a paragraph); no pieces deletes it. */
  | { kind: 'paragraph'; index: number; pieces: string[] }
  | { kind: 'caption'; index: number; text: string }
  | { kind: 'featuresTitle'; text: string }
  | { kind: 'featureCell'; row: number; cell: number; html: string }
  | { kind: 'deleteFeatureRow'; row: number }
  | { kind: 'comment'; index: number; text: string }
  /** Removes (true) or brings back (false) the main photo. */
  | { kind: 'mainImageHidden'; hidden: boolean }
  /** Removes (true) or brings back (false) the «Всю палитру…» line. */
  | { kind: 'paletteHidden'; hidden: boolean }
  /** Text before the palette link; null, empty or the default text: back to auto. */
  | { kind: 'paletteText'; value: string | null };

function withKp(project: Project, kp: KpEdits): Project {
  return { ...project, kp };
}

export function applyChange(project: Project, change: KpChange, now: Date = new Date()): Project {
  const kp = project.kp ?? createInitialKp(project.collection);
  switch (change.kind) {
    case 'auto': {
      let value = change.value;
      // An emptied field or the very text of the form goes back to «auto»: nothing to keep apart from the form.
      if (value !== null && (value.trim() === '' || value === autoTexts(project, now)[change.field])) value = null;
      if (kp[change.field] === value) return project;
      return withKp(project, { ...kp, [change.field]: value });
    }
    case 'paragraph': {
      const paragraphs = splitDescription(kp.descriptionHtml);
      const target = paragraphs[change.index];
      if (!target) return project;
      if (change.pieces.length === 1 && change.pieces[0] === target.html) return project;
      paragraphs.splice(
        change.index,
        1,
        // Only the first piece keeps the number: the rest continue the same numbered list.
        ...change.pieces.map((html, i) => (i === 0 ? { ...target, html } : { html, list: target.list })),
      );
      return withKp(project, { ...kp, descriptionHtml: joinDescription(paragraphs) });
    }
    case 'caption': {
      const article = kp.selectedArticles[change.index];
      if (!article || article.caption === change.text) return project;
      const selectedArticles = kp.selectedArticles.map((a, i) => (i === change.index ? { ...a, caption: change.text } : a));
      return withKp(project, { ...kp, selectedArticles });
    }
    case 'featuresTitle':
      return kp.featuresTitle === change.text ? project : withKp(project, { ...kp, featuresTitle: change.text });
    case 'featureCell': {
      const cell = kp.features[change.row]?.cells[change.cell];
      if (!cell || cell.html === change.html) return project;
      const features = kp.features.map((row, r) =>
        r === change.row ? { cells: row.cells.map((c, i) => (i === change.cell ? { ...c, html: change.html } : c)) } : row,
      );
      return withKp(project, { ...kp, features });
    }
    case 'deleteFeatureRow':
      if (!kp.features[change.row]) return project;
      return withKp(project, { ...kp, features: deleteFeatureRow(kp.features, change.row) });
    case 'comment':
      return editComment(project, kp, change.index, change.text.trim());
    case 'mainImageHidden':
      return kp.mainImageHidden === change.hidden ? project : withKp(project, { ...kp, mainImageHidden: change.hidden });
    case 'paletteHidden':
      return kp.paletteHidden === change.hidden ? project : withKp(project, { ...kp, paletteHidden: change.hidden });
    case 'paletteText': {
      let value = change.value;
      if (value !== null && (value.trim() === '' || value === DEFAULT_PALETTE_TEXT)) value = null;
      return kp.paletteText === value ? project : withKp(project, { ...kp, paletteText: value });
    }
  }
}

/**
 * Comments are the delivery lines of the form followed by kp.comments. A delivery line edited on the page is
 * written back to the form as a custom delivery comment: the form stays the one place where it is set.
 */
function editComment(project: Project, kp: KpEdits, index: number, text: string): Project {
  const fromForm = buildComments(project.form.delivery, []);
  if (index < fromForm.length) {
    if (fromForm[index] === text) return project;
    const custom = fromForm.map((line, i) => (i === index ? text : line)).filter((line) => line !== '');
    const delivery = custom.length > 0 ? { mode: 'custom' as const, custom } : { mode: 'none' as const, custom: [''] };
    return { ...project, form: { ...project.form, delivery } };
  }
  const own = buildComments({ mode: 'none', custom: [] }, kp.comments);
  const at = index - fromForm.length;
  if (own[at] === undefined || own[at] === text) return project;
  const comments = own.map((line, i) => (i === at ? text : line)).filter((line) => line !== '');
  return withKp(project, { ...kp, comments });
}

/** Column where each cell starts, taking the cells spanned down from rows above into account. */
function cellColumns(rows: readonly { cells: readonly FeatureCell[] }[]): number[][] {
  const taken = rows.map(() => new Set<number>());
  return rows.map((row, r) => {
    let column = 0;
    return row.cells.map((cell) => {
      while (taken[r]?.has(column)) column += 1;
      const start = column;
      const colSpan = cell.colSpan ?? 1;
      for (let dr = 0; dr < (cell.rowSpan ?? 1) && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < colSpan; dc++) taken[r + dr]?.add(start + dc);
      }
      column += colSpan;
      return start;
    });
  });
}

function withRowSpan(cell: FeatureCell, rowSpan: number): FeatureCell {
  const copy = { ...cell };
  if (rowSpan > 1) copy.rowSpan = rowSpan;
  else delete copy.rowSpan;
  return copy;
}

/**
 * Removes a row of the features table without breaking it: a cell spanning down into the row from above becomes
 * one row shorter, a cell of the row that spans further down moves into the next row at its column.
 */
export function deleteFeatureRow(rows: KpEdits['features'], index: number): KpEdits['features'] {
  const columns = cellColumns(rows);
  const result = rows.map((row, r) => ({
    cells: row.cells.map((cell) => {
      const span = cell.rowSpan ?? 1;
      return r < index && r + span > index ? withRowSpan(cell, span - 1) : cell;
    }),
  }));
  const deleted = rows[index];
  const next = rows[index + 1];
  if (deleted && next) {
    const moving = deleted.cells
      .map((cell, i) => ({ cell: withRowSpan(cell, (cell.rowSpan ?? 1) - 1), column: columns[index]?.[i] ?? 0 }))
      .filter((_, i) => (deleted.cells[i]?.rowSpan ?? 1) > 1);
    if (moving.length > 0) {
      const staying = next.cells.map((cell, i) => ({ cell, column: columns[index + 1]?.[i] ?? 0 }));
      result[index + 1] = {
        cells: [...staying, ...moving].sort((a, b) => a.column - b.column).map((entry) => entry.cell),
      };
    }
  }
  result.splice(index, 1);
  return result;
}
