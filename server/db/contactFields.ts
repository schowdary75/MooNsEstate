export const contactFields: any[] = [
    {
        name: "email",
        label: "Email",
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
        name: "phoneNumber",
        label: "Phone Number",
        type: "tel",
        fixed: true,
        isDefault: true,
        delete: false,
        belongsTo: null,
        backendType: "Number",
        isTableField: true,
        validation: [
            {
                require: true,
                message: ""
            }
        ]
    },
    {
        name: "fullName",
        label: "Full Name",
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
    }
];

export default contactFields;
