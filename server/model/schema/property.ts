import { createSqlModel } from '../../db/sqlModelWrapper.js';

export const Property = createSqlModel('Properties', {
    propertyType: String,
    title: String,
    builder: String,
    propertyAddress: String,
    location: String,
    listingPrice: String,
    towerName: String,
    totalFloors: Number,
    floorNumber: Number,
    unitNumber: String,
    bedrooms: Number,
    carpetArea: Number,
    facing: String,
    status: String,
    reraId: String,
    propertyPhotos: Array,
    photoLivingRoom: String,
    photoKitchen: String,
    photoRoom1: String,
    photoRoom2: String,
    photoWashroom: String,
    photoBalcony: String,
    virtualToursOrVideos: Array,
    floorPlans: Array,
    propertyDocuments: Array,
    createBy: String,
    createdDate: Date,
    updatedDate: Date,
    deleted: { type: Boolean, default: false }
});

export const initializePropertySchema = async () => {};

export default Property;
