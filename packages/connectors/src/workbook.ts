import { createRequire } from "node:module";

interface Cell { t?: string; v?: unknown; f?: string; z?: string }
interface Sheet { "!ref"?: string; "!data"?: Cell[][] }
interface Workbook { SheetNames: string[]; Sheets: Record<string, Sheet>; Workbook?: { WBProps?: { date1904?: boolean } } }
interface Reader {
  version: string;
  readFile(path: string, options: Record<string, unknown>): Workbook;
  utils: { decode_range(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } } };
}
export interface RawRow { rowNumber: number; cells: unknown[] }
export interface ParsedSheet { name: string; headers: string[]; rowCount: number; rows(): Generator<RawRow> }
export function requireReader(): Reader {
  try {
    const reader = createRequire(import.meta.url)("xlsx") as Reader;
    if (reader.version !== "0.20.3") throw new Error();
    return reader;
  } catch { throw new Error("SHEETJS_0_20_3_REQUIRED"); }
}
export function classify(headers: string[]): "REG" | "LEG" {
  const names = new Set(headers.map(value => value.normalize("NFC").trim().toUpperCase()));
  if (names.has("NO LEGALIZACION") && names.has("NUMERO TORNAGUIA") && names.has("F. LEGALIZACION")) return "LEG";
  if (names.has("N. TORNAGUIA") && names.has("F. EXPEDICION") && names.has("TOTAL IMPUESTO")) return "REG";
  throw new Error("UNSUPPORTED_WORKBOOK_SCHEMA");
}
function encode(cell: Cell | undefined): unknown {
  if (!cell) return null;
  const value = cell.v;
  const result: Record<string, unknown> = { type: cell.t ?? "z", value: value ?? null };
  if (typeof value === "string" && value.includes("\u0000")) {
    result.value = null; result.valueBase64 = Buffer.from(value, "utf8").toString("base64");
  }
  if (cell.f !== undefined) result.formula = cell.f;
  if (cell.z !== undefined) result.numberFormat = cell.z;
  return result;
}
export function workbookSheetNames(path:string):string[]{
  const names=requireReader().readFile(path,{bookSheets:true}).SheetNames;
  if(!names.length||names.length>100||names.some(n=>!n||n.length>128||n.includes("\u0000")))throw new Error("INVALID_SHEET_LIST");
  return names;
}
export function parseWorkbook(path: string, sheetIndex?:number) {
  const reader = requireReader();
  const workbook = reader.readFile(path, { dense: true, cellHTML:false, cellDates: false, cellNF: true, cellText: false, cellFormula: true, sheetStubs: true,...(sheetIndex===undefined?{}:{sheets:sheetIndex}) });
  let kind: "REG" | "LEG" | undefined;
  const names=sheetIndex===undefined?workbook.SheetNames:[workbook.SheetNames[sheetIndex]!];
  const sheets: ParsedSheet[] = names.map(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet?.["!ref"] || !sheet["!data"]) throw new Error("EMPTY_OR_UNSUPPORTED_SHEET");
    const range = reader.utils.decode_range(sheet["!ref"]);
    if (range.s.r !== 0 || range.s.c !== 0 || range.e.c > 255 || range.e.r > 1_000_000) throw new Error("UNEXPECTED_SHEET_RANGE");
    const data = sheet["!data"];
    const headers = Array.from({length: range.e.c+1}, (_,c) => String(data[0]?.[c]?.v ?? ""));
    if (headers.some(header => header.includes("\u0000"))) throw new Error("INVALID_HEADER");
    const sheetKind = classify(headers);
    if (kind && kind !== sheetKind) throw new Error("MIXED_DATASET_TYPES");
    kind = sheetKind;
    return { name, headers, rowCount: range.e.r,
      *rows() {
        for (let r=1; r<=range.e.r; r++) {
          yield { rowNumber: r+1, cells: headers.map((_,c) => encode(data[r]?.[c])) };
        }
      }
    };
  });
  if (!kind || !sheets.length) throw new Error("EMPTY_WORKBOOK");
  return { kind, sheets, readerVersion: reader.version, dateSystem: workbook.Workbook?.WBProps?.date1904 ? "1904" : "1900" };
}
