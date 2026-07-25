const { createSqlModel } = require('../../db/sqlModelWrapper');

const CustomField = createSqlModel('CustomField', {
    moduleName: String,
    icon: String,
    no: Number,
    headings: Array,
    fields: Array,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = CustomField;