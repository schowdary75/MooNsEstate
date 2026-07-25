const { createSqlModel } = require('../../db/sqlModelWrapper');

const Email = createSqlModel('Emails', {
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

module.exports = Email;
