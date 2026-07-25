const { createSqlModel } = require('../../db/sqlModelWrapper');

const PhoneCall = createSqlModel('PhoneCalls', {
    sender: String,
    recipient: String,
    callDuration: String,
    startDate: String,
    endDate: String,
    createByLead: String,
    createBy: String,
    createByContact: String,
    callNotes: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = PhoneCall;
