export const RULE_VERSION = "conservative-1";
export interface Issue { rule_code: string; field_name: string; severity: "info" | "warning" | "error"; message: string }
export interface Cell { value?: unknown; type?: string; formula?: string; valueBase64?: string }
export function upper(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleUpperCase("es-CO") || null;
}
export function dateValue(value: unknown, system: string): string | null {
  let result: string;
  if (typeof value === "number" && Number.isFinite(value)) {
    const day = Math.floor(value);
    if (system === "1900" && day === 60) return null;
    const base = system === "1904" ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
    const ms = base + (day - (system === "1900" && day > 60 ? 1 : 0)) * 86400000;
    if (!Number.isFinite(ms) || Math.abs(ms) > 8640000000000000) return null;
    result = new Date(ms).toISOString().slice(0, 10);
  } else {
    const s = String(value ?? "").trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00:00)?$/.exec(s);
    const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!iso && !local) return null;
    result = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : `${local![3]}-${local![2]}-${local![1]}`;
    const parsed = new Date(result + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== result) return null;
  }
  // Technical review window, not a legal rule. Values outside remain in raw evidence.
  return result >= "2000-01-01" && result <= "2030-12-31" ? result : null;
}
export function normalize(headers: string[], cells: (Cell | null)[], kind: "REG" | "LEG", system: string) {
  const fields: Record<string, unknown> = {};
  const issues: Issue[] = [];
  const issue = (code: string, field: string, message: string, severity: Issue["severity"] = "warning") => issues.push({rule_code:code, field_name:field, message, severity});
  headers.forEach((h,i) => {
    const cell = cells[i]; const key = upper(h)!;
    fields[key] = typeof cell?.value === "string" ? upper(cell.value) : cell?.value ?? null;
    if (cell?.formula || cell?.type === "e" || cell?.valueBase64) issue("UNTRUSTED_CELL", key, "Fórmula, error o contenido especial: revisar el original.", "error");
  });
  const get = (key: string) => fields[key];
  const text = (key: string) => upper(get(key));
  const date = (key: string) => { const v = get(key); const d = dateValue(v, system); if (!d) issue(v == null || v === "" ? "MISSING_DATE" : "INVALID_DATE", key, "Fecha ausente, inválida o fuera de la ventana técnica 2000–2030."); return d; };
  const num = (key: string, scale: number) => {
    const v = get(key); const s = String(v ?? "").trim();
    if (!s) { issue("MISSING_NUMBER",key,"Valor numérico ausente; no se convierte a cero."); return null; }
    if (!/^-?\d+(?:\.\d+)?$/.test(s) || !Number.isFinite(Number(s)) || Math.abs(Number(s)) >= 1e15 || (s.split(".")[1]?.length ?? 0) > scale) {
      issue("INVALID_NUMBER",key,"Formato ambiguo, precisión no admitida o número fuera de rango."); return null;
    }
    if (Number(s) < 0) issue("NEGATIVE_NUMBER",key,"Valor negativo excluido del indicador.");
    if (Number(s) === 0) issue("ZERO_NUMBER",key,"Cero conservado y pendiente de interpretación.","info");
    return s;
  };
  const docKey = kind === "REG" ? "N. TORNAGUIA" : "NUMERO TORNAGUIA";
  const document = text(docKey);
  if (!document || !/^\d+$/.test(document)) issue("INVALID_DOCUMENT",docKey,"Número ausente o no numérico; no se infiere identidad.");
  const yearKey = kind === "REG" ? "VIGENCIA" : "VIGENCIA TORNAGUIA";
  const year = Number(get(yearKey));
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2030;
  if (!validYear) issue("INVALID_YEAR",yearKey,"Vigencia fuera de la ventana técnica 2000–2030.");
  const quantity = num(kind === "REG" ? "TOTAL CANTIDAD" : "CANTIDAD EN SU PRESENTACION",6);
  const amount = num(kind === "REG" ? "TOTAL IMPUESTO" : "TOTAL",2);
  if (quantity !== null && Number(quantity) > 1_000_000) issue("EXTREME_QUANTITY", "quantity", "Cantidad superior al umbral técnico de revisión (1.000.000); posible desplazamiento.", "error");
  issue("UNIT_UNCONFIRMED","quantity_unit","Unidad/presentación no homologada: cantidad excluida de sumas.","info");
  const expedition = date(kind === "REG" ? "F. EXPEDICION" : "FECHA TORNAGUIA");
  const expiry = date(kind === "REG" ? "F. VENCIMIENTO" : "VENCIMIENTO TORNAGUIA");
  const legalization = kind === "LEG" ? date("F. LEGALIZACION") : null;
  const chronology = !!(expedition && expiry && expiry < expedition) || !!(legalization && expedition && legalization < expedition);
  if (chronology) issue("DATE_ORDER","dates","Secuencia temporal inconsistente; revisar sin inferir incumplimiento.");
  const quarantine = issues.some(i => i.severity === "error");
  return { record: {
    dataset_kind: kind, document_number_original: String(cells[headers.findIndex(h => upper(h) === docKey)]?.value ?? "") || null,
    document_number_normalized: document, document_year: validYear ? year : null,
    document_type: text("TIPO TORNAGUIA"), invoice: text("FACTURA"),
    expedition_date: expedition, expiry_date: expiry, legalization_date: legalization,
    origin_label: text(kind === "REG" ? "LUGAR DE EXPEDICION" : "MUNICIPIO ORIGEN"),
    destination_label: text(kind === "REG" ? "DESTINO" : "MUNICIPIO LEGALIZACION"),
    quantity, declared_amount: amount, normalized_fields: fields,
    identity_rule_version: RULE_VERSION,
    quality_status: quarantine ? "quarantine" : issues.some(i => i.severity === "warning") ? "warning" : "valid",
    eligible_for_quantity: false, eligible_for_amount: !quarantine && amount !== null && Number(amount) >= 0,
    eligible_for_timeliness: !quarantine && !chronology && !!legalization && !!expiry,
  }, issues };
}
