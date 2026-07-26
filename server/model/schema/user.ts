import { createSqlModel } from '../../db/sqlModelWrapper.js';

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
});

(User as any).default = User;

export default User;
