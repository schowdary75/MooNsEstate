const { createSqlModel } = require('../../db/sqlModelWrapper');

const RoleAccess = createSqlModel('RoleAccess', {
    roleName: String,
    access: Array,
    description: String,
    modifyDate: Date,
    createdDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = RoleAccess;