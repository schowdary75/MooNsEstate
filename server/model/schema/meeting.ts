import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Meeting = createSqlModel('Meetings', {
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

export default Meeting;
