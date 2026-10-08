import Papa from "papaparse";
import { LABELS, type BOARDS } from "./schema";

/**
 * CSV plano: uma linha por questão. Colunas (cabeçalho obrigatório):
 *   board, exam_name, year, day, format, pdf_url, answer_pdf_url,
 *   number, kind, area, subject, topic, work, language, section,
 *   statement_md, A, B, C, D, E, correct, explanation_md, official_mirror_md, max_score, external_id, images
 * `images` = URLs separadas por "|". Linhas com a mesma (exam_name, year) formam uma prova;
 * sem exam_name a questão é avulsa.
 */
export function csvToRaw(text: string): { raw: unknown; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const errors = parsed.errors.map((e) => `linha ${e.row != null ? e.row + 2 : "?"}: ${e.message}`);
  const rows = parsed.data;
  const board = (rows.find((r) => r.board?.trim())?.board ?? "").trim().toUpperCase() as (typeof BOARDS)[number];

  const exams = new Map<string, Record<string, unknown>>();
  const standalone: unknown[] = [];
  for (const r of rows) {
    const s = (k: string) => r[k]?.trim() || undefined;
    const alternatives = LABELS.filter((l) => s(l) !== undefined).map((l) => ({ label: l, text_md: r[l].trim() }));
    const q = {
      number: s("number"),
      year: s("year"),
      kind: s("kind") ?? "objective",
      area: s("area"),
      subject: s("subject"),
      topic: s("topic"),
      work: s("work"),
      language: s("language"),
      section: s("section"),
      statement_md: r.statement_md ?? "",
      images: s("images")?.split("|").map((u) => u.trim()).filter(Boolean) ?? [],
      alternatives,
      correct: s("correct")?.toUpperCase(),
      explanation_md: s("explanation_md"),
      official_mirror_md: s("official_mirror_md"),
      max_score: s("max_score"),
      external_id: s("external_id"),
    };
    if (s("exam_name")) {
      const key = `${s("exam_name")}|${s("year")}`;
      if (!exams.has(key)) {
        exams.set(key, {
          name: s("exam_name"), year: s("year"), day: s("day"), format: s("format"),
          pdf_url: s("pdf_url"), answer_pdf_url: s("answer_pdf_url"), questions: [],
        });
      }
      (exams.get(key)!.questions as unknown[]).push(q);
    } else standalone.push(q);
  }
  return { raw: { version: 1, board, exams: [...exams.values()], questions: standalone }, errors };
}
