const { createSqlModel } = require('../../db/sqlModelWrapper');

const Invoices = createSqlModel('Invoices', {
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

module.exports = Invoices;
