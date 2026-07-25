const { createSqlModel } = require('../../db/sqlModelWrapper');

const Property = createSqlModel('Properties', {
    propertyType: String,
    propertyAddress: String,
    listingPrice: String,
    propertyPhotos: Array,
    virtualToursOrVideos: Array,
    floorPlans: Array,
    propertyDocuments: Array,
    unitType: Array,
    units: Array,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

const initializePropertySchema = async () => {};

module.exports = { Property, initializePropertySchema };
