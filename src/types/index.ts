// ============================================
// BiblioGest - Tipos TypeScript
// ============================================

export interface CustomField {
  fieldNumber: string;
  fieldName: string;
  value: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "LIBRARIAN" | "ASSISTANT";
}

export interface ReaderFormData {
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface LoanFormData {
  readerId: string;
  exemplarId: string;
  loanDate: string;
  dueDate: string;
}

export interface LabelData {
  type: "SPINE" | "FRONT";
  exemplarId: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  type?: string;
}

export interface CatalogFormData {
  materialType: "BOOK" | "PERIODICAL" | "OTHER";
  title: string;
  subtitle?: string;
  authors: string[];
  contributors: string[];
  edition?: string;
  publisher?: string;
  publicationPlace?: string;
  publicationYear?: string;
  isbn?: string;
  issn?: string;
  subjects: string[];
  classification?: string;
  cdd?: string;
  cdu?: string;
  callNumber?: string;
  cutterCode?: string;
  accessionNumber?: string;
  totalCopies: number;
  volume?: string;
  number?: string;
  period?: string;
  physicalDesc?: string;
  generalNote?: string;
  bibReference?: string;
  customFields: CustomField[];
}

export interface SearchFilters {
  query: string;
  materialType?: string;
  author?: string;
  subject?: string;
  year?: string;
  classification?: string;
  callNumber?: string;
}
