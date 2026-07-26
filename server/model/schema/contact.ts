import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Contact = createSqlModel('Contacts', {
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

export const initializeContactSchema = async () => {};

export default Contact;
