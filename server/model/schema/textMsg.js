const { createSqlModel } = require('../../db/sqlModelWrapper');

const TextMsg = createSqlModel('TextMsgs', {
    sender: String,
    to: String,
    message: String,
    createByLead: String,
    createBy: String,
    createByContact: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = TextMsg;