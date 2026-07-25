const { createSqlModel } = require('../../db/sqlModelWrapper');

const ModuleActiveDeactive = createSqlModel('ModuleActiveDeactives', {
    moduleName: String,
    isActive: { type: Boolean, default: true },
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = ModuleActiveDeactive;
