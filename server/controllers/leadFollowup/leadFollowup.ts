const { LeadFollowup } = require("../../model/schema/leadFollowup.js");
const { Lead } = require("../../model/schema/lead.js");
const User = require("../../model/schema/user.js");

const index = async (req: any, res: any) => {
  try {
    const query: any = { deleted: false };
    if (req.query.status) query.status = req.query.status;
    if (req.query.followUpType) query.followUpType = req.query.followUpType;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.leadId) query.leadId = req.query.leadId;
    if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;

    let followups = await LeadFollowup.find(query)
      .populate({ path: "leadId", match: { deleted: false } })
      .populate({ path: "assignedTo", match: { deleted: false } })
      .exec();

    // Auto-mark past pending follow-ups as overdue
    const now = new Date();
    followups = followups.map((item: any) => {
      const doc = item.toObject ? item.toObject() : item;
      if (doc.status === 'pending' && doc.followUpDate && new Date(doc.followUpDate) < now) {
        doc.status = 'overdue';
      }
      return doc;
    });

    res.status(200).json(followups);
  } catch (err) {
    console.error("Failed to fetch lead follow-ups:", err);
    res.status(500).json({ error: "Failed to fetch lead follow-ups" });
  }
};

const add = async (req: any, res: any) => {
  try {
    req.body.createdDate = new Date();
    req.body.updatedDate = new Date();
    if (!req.body.status) req.body.status = 'pending';
    if (!req.body.priority) req.body.priority = 'medium';

    const followup = new LeadFollowup(req.body);
    await followup.save();

    // Update Lead's nextFollowUpDate
    if (req.body.leadId && req.body.followUpDate) {
      await Lead.updateOne(
        { _id: req.body.leadId },
        { $set: { nextFollowUpDate: new Date(req.body.followUpDate) } }
      );
    }

    res.status(200).json(followup);
  } catch (err) {
    console.error("Failed to create lead follow-up:", err);
    res.status(400).json({ error: "Failed to create lead follow-up" });
  }
};

const complete = async (req: any, res: any) => {
  try {
    const { outcome, leadStatus } = req.body;
    const now = new Date();

    const followup = await LeadFollowup.findOneAndUpdate(
      { _id: req.params.id, deleted: false },
      {
        $set: {
          status: 'completed',
          outcome: outcome || 'Follow-up completed successfully.',
          completedAt: now,
          updatedDate: now
        }
      },
      { new: true }
    );

    if (!followup) {
      return res.status(404).json({ message: "Follow-up record not found" });
    }

    // Update lead's lastContactedDate & optional leadStatus
    if (followup.leadId) {
      const updateData: any = { lastContactedDate: now };
      if (leadStatus) {
        updateData.leadStatus = leadStatus;
      }
      await Lead.updateOne({ _id: followup.leadId }, { $set: updateData });
    }

    res.status(200).json({ message: "Follow-up completed successfully", followup });
  } catch (err) {
    console.error("Failed to complete follow-up:", err);
    res.status(400).json({ error: "Failed to complete follow-up" });
  }
};

const cancel = async (req: any, res: any) => {
  try {
    const followup = await LeadFollowup.findOneAndUpdate(
      { _id: req.params.id, deleted: false },
      {
        $set: {
          status: 'cancelled',
          updatedDate: new Date()
        }
      },
      { new: true }
    );

    if (!followup) {
      return res.status(404).json({ message: "Follow-up record not found" });
    }

    res.status(200).json({ message: "Follow-up cancelled", followup });
  } catch (err) {
    console.error("Failed to cancel follow-up:", err);
    res.status(400).json({ error: "Failed to cancel follow-up" });
  }
};

const edit = async (req: any, res: any) => {
  try {
    req.body.updatedDate = new Date();
    const result = await LeadFollowup.updateOne(
      { _id: req.params.id },
      { $set: req.body }
    );

    if (req.body.leadId && req.body.followUpDate) {
      await Lead.updateOne(
        { _id: req.body.leadId },
        { $set: { nextFollowUpDate: new Date(req.body.followUpDate) } }
      );
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Failed to update follow-up:", err);
    res.status(400).json({ error: "Failed to update follow-up" });
  }
};

const deleteData = async (req: any, res: any) => {
  try {
    const result = await LeadFollowup.updateOne(
      { _id: req.params.id },
      { $set: { deleted: true, updatedDate: new Date() } }
    );
    res.status(200).json({ message: "Follow-up deleted successfully", result });
  } catch (err) {
    console.error("Failed to delete follow-up:", err);
    res.status(400).json({ error: "Failed to delete follow-up" });
  }
};

const deleteMany = async (req: any, res: any) => {
  try {
    const ids = req.body;
    const result = await LeadFollowup.updateMany(
      { _id: { $in: ids } },
      { $set: { deleted: true, updatedDate: new Date() } }
    );
    res.status(200).json({ message: "Follow-ups deleted successfully", result });
  } catch (err) {
    console.error("Failed to delete follow-ups:", err);
    res.status(400).json({ error: "Failed to delete follow-ups" });
  }
};

const generateAiScript = async (req: any, res: any) => {
  try {
    const { leadName, followupType, notes, propertyInterest } = req.body;
    const typeLabel = followupType || 'call';
    const targetLead = leadName || 'Valued Client';
    const propDetails = propertyInterest || 'Property Listing';
    const contextNotes = notes || 'Discuss property requirements and budget';

    let scriptText = '';

    if (typeLabel === 'site_visit' || typeLabel === 'meeting') {
      scriptText = `Hi ${targetLead}, this is your real estate advisor following up regarding your scheduled site visit for ${propDetails}. ` +
        `I have prepared the location keys, property documents, and comparable market pricing. ` +
        `Notes for our meeting: "${contextNotes}". Looking forward to walking you through the property today!`;
    } else if (typeLabel === 'whatsapp') {
      scriptText = `Hello ${targetLead}! 👋 Following up regarding ${propDetails}. ` +
        `I have shared updated images, floor plans, and pricing details per your request. ` +
        `Let me know if you'd like to schedule a site tour this week! Notes: ${contextNotes}`;
    } else if (typeLabel === 'quote' || typeLabel === 'email') {
      scriptText = `Dear ${targetLead},\n\n` +
        `Thank you for your interest in ${propDetails}. I have attached the latest pricing sheet, payment plan options, and property brochure.\n\n` +
        `Key Takeaways: ${contextNotes}\n\n` +
        `Please let me know if you have any questions or would like to book a private showing.\n\nBest regards,\nYour Real Estate CRM Team`;
    } else {
      scriptText = `Good day ${targetLead}, I'm calling from MooNsEstate regarding your inquiry for ${propDetails}.\n\n` +
        `Call Objective: ${contextNotes}\n\n` +
        `Key Questions to Ask:\n` +
        `1. What is your preferred timeline for property acquisition?\n` +
        `2. Do you require home loan assistance or pre-approval support?\n` +
        `3. Would weekend morning or weekday afternoon work better for a property visit?`;
    }

    res.status(200).json({ script: scriptText });
  } catch (err) {
    console.error("Failed to generate AI script:", err);
    res.status(500).json({ error: "Failed to generate AI script" });
  }
};

module.exports = {
  index,
  add,
  complete,
  cancel,
  edit,
  deleteData,
  deleteMany,
  generateAiScript
};
export {};
