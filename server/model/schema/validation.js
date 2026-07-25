const { createSqlModel } = require('../../db/sqlModelWrapper');

const Validation = createSqlModel('Validations', {
    name: String,
    value: String,
    message: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = Validation;