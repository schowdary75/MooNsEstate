export const leadFields: any[] = [
    {
        name: "leadName",
        label: "Lead Name",
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
        name: "leadEmail",
        label: "Lead Email",
        type: "email",
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
        name: "leadPhoneNumber",
        label: "Lead Phone Number",
        type: "tel",
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

export default leadFields;
