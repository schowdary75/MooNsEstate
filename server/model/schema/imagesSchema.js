const { createSqlModel } = require('../../db/sqlModelWrapper');

const ImagesSchema = createSqlModel('ImagesSchemas', {
    authImg: String,
    logoImg: String,
    logoSmImg: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = ImagesSchema;