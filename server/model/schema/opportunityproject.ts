import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const OpportunityProject = createSqlModel('OpportunityProjects', {
    projectName: String,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default OpportunityProject;
