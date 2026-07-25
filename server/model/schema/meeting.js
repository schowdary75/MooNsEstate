const { createSqlModel } = require('../../db/sqlModelWrapper');

const Meeting = createSqlModel('Meetings', {
    agenda: String,
    attendes: Array,
    attendesLead: Array,
    location: String,
    related: String,
    dateTime: String,
    notes: String,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = Meeting;
