import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Quotes = createSqlModel('Quotes', {
    title: String,
    quoteNumber: String,
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

export default Quotes;
