import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const PhoneCall = createSqlModel('PhoneCalls', {
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

export default PhoneCall;
