const { createSqlModel } = require('../../db/sqlModelWrapper');

const Opprtunity = createSqlModel('Opprtunities', {
    opportunityName: String,
    accountName: String,
    amount: String,
    stage: String,
    probability: String,
    closeDate: String,
    leadSource: String,
    description: String,
    assignUser: String,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = Opprtunity;