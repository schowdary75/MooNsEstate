const express = require('express');
const leadFollowup = require('./leadFollowup');
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, leadFollowup.index);
router.post('/add', auth, leadFollowup.add);
router.put('/complete/:id', auth, leadFollowup.complete);
router.put('/cancel/:id', auth, leadFollowup.cancel);
router.put('/edit/:id', auth, leadFollowup.edit);
router.delete('/delete/:id', auth, leadFollowup.deleteData);
router.post('/deleteMany', auth, leadFollowup.deleteMany);
router.post('/ai-script', auth, leadFollowup.generateAiScript);

module.exports = router;
export {};
