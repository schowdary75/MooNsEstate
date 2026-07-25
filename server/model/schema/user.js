const { createSqlModel } = require('../../db/sqlModelWrapper');

const User = createSqlModel('User', {
    username: String,
    password: String,
    role: { type: String, default: 'user' },
    emailsent: { type: Number, default: 0 },
    textsent: { type: Number, default: 0 },
    outboundcall: { type: Number, default: 0 },
    phoneNumber: Number,
    firstName: String,
    lastName: String,
    roles: Array,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

module.exports = User;
