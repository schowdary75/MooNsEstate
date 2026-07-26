import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const RoleAccess = createSqlModel('RoleAccess', {
    roleName: String,
    access: Array,
    description: String,
    modifyDate: Date,
    createdDate: Date,
    deleted: { type: Boolean, default: false }
});

export default RoleAccess;
