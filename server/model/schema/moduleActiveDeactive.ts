import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const ModuleActiveDeactive = createSqlModel('ModuleActiveDeactives', {
    moduleName: String,
    isActive: { type: Boolean, default: true },
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default ModuleActiveDeactive;
