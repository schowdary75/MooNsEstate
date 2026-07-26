import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const CustomField = createSqlModel('CustomField', {
    moduleName: String,
    icon: String,
    no: Number,
    headings: Array,
    fields: Array,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default CustomField;
