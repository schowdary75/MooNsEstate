import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const BankDetails = createSqlModel('BankDetails', {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default BankDetails;
