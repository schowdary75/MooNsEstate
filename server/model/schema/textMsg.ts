import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const TextMsg = createSqlModel('TextMsgs', {
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

export default TextMsg;
