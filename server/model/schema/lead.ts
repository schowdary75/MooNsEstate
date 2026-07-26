import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Lead = createSqlModel('Leads', {
    leadName: String,
    leadEmail: String,
    leadPhoneNumber: String,
    leadAddress: String,
    leadStatus: String,
    leadSource: String,
    priority: { type: String, default: 'medium' },
    nextFollowUpDate: Date,
    lastContactedDate: Date,
    score: { type: Number, default: 0 },
    createBy: String,
    assignedTo: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export const initializeLeadSchema = async () => {};

export default Lead;
