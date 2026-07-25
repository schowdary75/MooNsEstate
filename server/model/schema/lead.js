const { createSqlModel } = require('../../db/sqlModelWrapper');

const Lead = createSqlModel('Leads', {
    leadName: String,
    leadEmail: String,
    leadPhoneNumber: String,
    leadAddress: String,
    leadStatus: String,
    leadSource: String,
    createBy: String,
    assignedTo: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

const initializeLeadSchema = async () => {};

module.exports = { Lead, initializeLeadSchema };
