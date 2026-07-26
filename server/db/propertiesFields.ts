export const propertiesFields: any[] = [
    {
        name: "propertyType",
        label: "Property Type",
        type: "text",
        fixed: true,
        isDefault: true,
        delete: false,
        belongsTo: null,
        backendType: "String",
        isTableField: true,
        validation: [
            {
                require: true,
                message: ""
            }
        ]
    },
    {
        name: "propertyAddress",
        label: "Property Address",
        type: "text",
        fixed: true,
        isDefault: true,
        delete: false,
        belongsTo: null,
        backendType: "String",
        isTableField: true,
        validation: [
            {
                require: true,
                message: ""
            }
        ]
    },
    {
        name: "listingPrice",
        label: "Listing Price",
        type: "number",
        fixed: true,
        isDefault: true,
        delete: false,
        belongsTo: null,
        backendType: "String",
        isTableField: true,
        validation: [
            {
                require: true,
                message: ""
            }
        ]
    }
];

export default propertiesFields;
