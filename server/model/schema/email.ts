import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Email = createSqlModel('Emails', {
    sender: String,
    recipient: String,
    subject: String,
    message: String,
    createByLead: String,
    createBy: String,
    createByContact: String,
    html: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default Email;
