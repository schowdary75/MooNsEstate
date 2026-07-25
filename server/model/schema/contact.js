const { createSqlModel } = require('../../db/sqlModelWrapper');

const Contact = createSqlModel('Contacts', {
    email: String,
    phone: String,
    title: String,
    fullName: String,
    physicalAddress: String,
    interestProperty: Array,
    quotes: Array,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

const initializeContactSchema = async () => {};

module.exports = { Contact, initializeContactSchema };
