const { createSqlModel } = require('../../db/sqlModelWrapper');

const Document = createSqlModel('Documents', {
    folderName: String,
    files: Array,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = Document;
