const { createSqlModel } = require('../../db/sqlModelWrapper');

const BankDetails = createSqlModel('BankDetails', {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = BankDetails;
