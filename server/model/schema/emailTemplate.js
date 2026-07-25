const { createSqlModel } = require('../../db/sqlModelWrapper');

const EmailTemplate = createSqlModel('EmailTemplates', {
    name: String,
    subject: String,
    html: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = EmailTemplate;