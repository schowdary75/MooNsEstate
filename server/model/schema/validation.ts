import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Validation = createSqlModel('Validations', {
    name: String,
    value: String,
    message: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default Validation;
