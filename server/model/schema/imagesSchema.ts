import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const ImagesSchema = createSqlModel('ImagesSchemas', {
    authImg: String,
    logoImg: String,
    logoSmImg: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default ImagesSchema;
