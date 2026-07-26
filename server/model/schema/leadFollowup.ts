import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const LeadFollowup = createSqlModel('LeadFollowup', {
  leadId: String,
  assignedTo: String,
  followUpDate: Date,
  followUpType: { type: String, default: 'call' }, // call, site_visit, whatsapp, email, meeting, quote, other
  status: { type: String, default: 'pending' }, // pending, completed, cancelled, overdue
  priority: { type: String, default: 'medium' }, // urgent, high, medium, low
  notes: String,
  outcome: String,
  completedAt: Date,
  createBy: String,
  createdDate: Date,
  updatedDate: Date,
  deleted: { type: Boolean, default: false }
});

export const initializeLeadFollowupSchema = async () => {};

export default LeadFollowup;
