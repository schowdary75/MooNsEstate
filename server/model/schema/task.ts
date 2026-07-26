import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Task = createSqlModel('Tasks', {
    title: String,
    category: String,
    description: String,
    notes: String,
    assignTo: String,
    assignToLead: String,
    reminder: String,
    start: String,
    end: String,
    backgroundColor: String,
    borderColor: String,
    textColor: String,
    display: String,
    url: String,
    allDay: Boolean,
    createBy: String,
    status: { type: String, default: 'todo' },
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export default Task;
