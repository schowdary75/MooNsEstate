const { createSqlModel } = require('../../db/sqlModelWrapper');

const OpportunityProject = createSqlModel('OpportunityProjects', {
    projectName: String,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = OpportunityProject;
