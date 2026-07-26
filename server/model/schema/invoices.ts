import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Invoices = createSqlModel('Invoices', {
    title: String,
    invoiceNumber: String,
    status: String,
    grandTotal: String,
    items: Array,
    account: String,
    contact: String,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default Invoices;
