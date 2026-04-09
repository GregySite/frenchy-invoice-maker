export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  // Type de document
  documentType: string;
  // Émetteur
  senderName: string;
  senderAddress: string;
  senderPhone: string;
  senderEmail: string;
  senderSiret: string;
  // Client
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  // Lignes
  items: InvoiceItem[];
  // TVA
  vatRate: number;
  // Notes
  notes: string;
  // Devise
  currency: string;
}

export const defaultInvoice: InvoiceData = {
  invoiceNumber: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: '',
  documentType: '320', // Facture + Reçu par défaut
  senderName: '',
  senderAddress: '',
  senderPhone: '',
  senderEmail: '',
  senderSiret: '',
  clientName: '',
  clientAddress: '',
  clientEmail: '',
  items: [{ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }],
  vatRate: 17,
  notes: '',
  currency: '₪',
};
