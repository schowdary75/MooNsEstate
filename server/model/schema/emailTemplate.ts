import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const EmailTemplate = createSqlModel('EmailTemplates', {
    name: String,
    subject: String,
    html: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default EmailTemplate;
