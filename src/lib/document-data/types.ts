// The data a secretary records by hand for one supporting document
// (manual-document-data, MD-4, MD-5, MD-33). Pure, with no "server-only", so
// the schema CHECK, the validation, the signals and the form share one list.

// The document types of RF-14 (d). The schema derives its CHECK from this list,
// so the two cannot drift. `otro` is the type that raises the RN-13 signal.
export const TIPOS_DOCUMENTO = [
  "constancia_medica",
  "constancia_institucional",
  "otro",
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

// The three marks of one document (Anexo D, D11). `null` means "not registered
// yet", never "No": the signals tell the two apart.
export type DocumentMarks = {
  type: TipoDocumento | null;
  hasSignature: boolean | null;
  hasSeal: boolean | null;
};

// The four manual data of RF-14 (a). A non-null value was entered by hand and
// wins over the extracted one (RN-24). The rest period is dates only; its days
// are derived in code and never entered or stored.
export type ManualFields = {
  studentName: string | null;
  issuer: string | null;
  issueDate: string | null;
  restFrom: string | null;
  restTo: string | null;
};

// The closed list of field names the audit row may carry (MD-33). Names only:
// the name, the issuer and the dates are personal data (RNF-06).
export const DOCUMENT_DATA_FIELDS = [
  "nombreEstudiante",
  "emisor",
  "fechaEmision",
  "reposo",
  "tipoDocumento",
  "tieneFirma",
  "tieneSello",
] as const;

export type DocumentDataField = (typeof DOCUMENT_DATA_FIELDS)[number];
