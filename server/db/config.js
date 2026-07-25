const prisma = require('./prisma');
const User = require('../model/schema/user');
const bcrypt = require('bcrypt');
const { createNewModule } = require("../controllers/customField/customField.js");
const { leadFields } = require('./leadFields.js');
const { contactFields } = require('./contactFields.js');
const { propertiesFields } = require('./propertiesFields.js');

const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("Connected to MySQL Database via Prisma ORM.");

        const mockRes = {
            status: () => ({ json: () => {} }),
            json: () => {}
        };

        // Seed default custom field modules
        try {
            await createNewModule({ body: { moduleName: 'Leads', fields: leadFields, headings: [], isDefault: true } }, mockRes);
            await createNewModule({ body: { moduleName: 'Contacts', fields: contactFields, headings: [], isDefault: true } }, mockRes);
            await createNewModule({ body: { moduleName: 'Properties', fields: propertiesFields, headings: [], isDefault: true } }, mockRes);
        } catch (e) {
            // Ignore duplicate seed warnings
        }

        // Seed default superAdmin user
        let adminExisting = await User.find({ role: 'superAdmin' });
        if (!adminExisting || adminExisting.length <= 0) {
            const phoneNumber = 7874263694;
            const firstName = 'MooN';
            const lastName = 'Estates';
            const username = 'admin@gmail.com';
            const password = 'admin123';
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const user = new User({
                _id: '64d33173fd7ff3fa0924a109',
                username,
                password: hashedPassword,
                firstName,
                lastName,
                phoneNumber,
                role: 'superAdmin'
            });
            await user.save();
            console.log("Admin created successfully via Prisma ORM..");
        } else if (adminExisting[0].deleted === true) {
            await User.findByIdAndUpdate(adminExisting[0]._id, { deleted: false });
            console.log("Admin Updated successfully via Prisma ORM..");
        }

        console.log("Prisma ORM Setup Completed Successfully..");
    } catch (err) {
        console.log("Prisma connection error:", err.message);
    }
};

module.exports = connectDB;