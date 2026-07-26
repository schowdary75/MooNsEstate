import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Document = createSqlModel('Documents', {
    folderName: String,
    files: Array,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default Document;
