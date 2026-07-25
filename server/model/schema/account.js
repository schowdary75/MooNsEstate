const { createSqlModel } = require('../../db/sqlModelWrapper');

const Account = createSqlModel('Accounts', {
    name: String,
    officePhone: Number,
    alternatePhone: Number,
    website: String,
    fax: String,
    ownership: String,
    emailAddress: String,
    nonPrimaryEmail: String,
    billingStreet: String,
    shippingStreet: String,
    description: String,
    type: String,
    industry: String,
    assignUser: String,
    createBy: String,
    modifiedBy: String,
    createdDate: Date,
    modifiedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = Account;