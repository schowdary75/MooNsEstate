const prisma = require('./prisma');
const crypto = require('crypto');

function generateObjectId() {
    return crypto.randomBytes(12).toString('hex');
}

function parseWhere(query = {}) {
    if (!query || typeof query !== 'object') return {};
    const where = {};
    for (const key of Object.keys(query)) {
        const val = query[key];
        const prismaKey = key === '_id' ? 'id' : key;

        if (key === '$in' || (val && typeof val === 'object' && '$in' in val)) {
            const inVals = (key === '$in') ? val : val['$in'];
            const targetKey = (key === '$in') ? 'id' : (key === '_id' ? 'id' : key);
            where[targetKey] = { in: Array.isArray(inVals) ? inVals.map(String) : [] };
        } else if (key === '$ne' || (val && typeof val === 'object' && '$ne' in val)) {
            const neVal = (key === '$ne') ? val : val['$ne'];
            const targetKey = (key === '$ne') ? 'id' : (key === '_id' ? 'id' : key);
            where[targetKey] = { not: String(neVal) };
        } else if (val && typeof val === 'object') {
            if (val.$regex || val instanceof RegExp) {
                const searchStr = val.$regex ? String(val.$regex.source || val.$regex) : String(val.source || val);
                where[prismaKey] = { contains: searchStr.replace(/[\^\$\\\/]/g, '') };
            }
        } else if (val !== undefined && typeof val !== 'function') {
            where[prismaKey] = val;
        }
    }
    return where;
}

function parsePayload(payload = {}) {
    if (!payload || typeof payload !== 'object') return {};
    let target = payload;
    if (payload.$set) target = payload.$set;
    else if (payload.$push) target = payload.$push;
    else if (payload.$pull) target = payload.$pull;

    const clean = {};
    for (const key of Object.keys(target)) {
        if (key.startsWith('$')) continue;
        if (key === '_id') {
            clean.id = target._id;
        } else {
            clean[key] = target[key];
        }
    }
    return clean;
}

function createSqlModel(modelName, schemaFields) {
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const mapper = {
        'user': 'user',
        'roleAccess': 'roleAccess',
        'leads': 'lead',
        'lead': 'lead',
        'contacts': 'contact',
        'contact': 'contact',
        'properties': 'property',
        'property': 'property',
        'customField': 'customField',
        'accounts': 'account',
        'account': 'account',
        'opprtunities': 'opportunity',
        'opportunity': 'opportunity',
        'opportunityProjects': 'opportunityProject',
        'invoices': 'invoice',
        'quotes': 'quote',
        'tasks': 'task',
        'meetings': 'meeting',
        'phoneCalls': 'phoneCall',
        'emails': 'email',
        'textMsgs': 'textMsg',
        'documents': 'document',
        'validations': 'validation',
        'emailTemplates': 'emailTemplate',
        'moduleActiveDeactives': 'moduleActiveDeactive',
        'bankDetails': 'bankDetails',
        'imagesSchemas': 'imagesSchema'
    };

    const prismaDelegateName = mapper[delegateName] || delegateName;
    const delegate = prisma[prismaDelegateName];

    class ModelWrapper {
        constructor(data = {}) {
            this._data = { ...data };
            if (!this._data.id && !this._data._id) {
                this._data.id = generateObjectId();
            }
            this._id = this._data.id || this._data._id;
            this.id = this._id;
            Object.assign(this, this._data);
            this._id = this.id;
        }

        static get prismaDelegate() {
            return delegate;
        }

        static findOne(query = {}) {
            const where = parseWhere(query);
            const chain = {
                populate: function () { return chain; },
                exec: async function () {
                    if (!delegate) return null;
                    const record = await delegate.findFirst({ where });
                    if (!record) return null;
                    record._id = record.id;
                    return new ModelWrapper(record);
                },
                then: function (resolve, reject) {
                    return this.exec().then(resolve, reject);
                }
            };
            return chain;
        }

        static find(query = {}) {
            const where = parseWhere(query);
            let limitVal = undefined;
            let skipVal = undefined;

            const chain = {
                populate: function () { return chain; },
                sort: function () { return chain; },
                limit: function (l) { limitVal = l; return chain; },
                skip: function (sk) { skipVal = sk; return chain; },
                exec: async function () {
                    if (!delegate) return [];
                    const options = { where };
                    if (limitVal) options.take = limitVal;
                    if (skipVal) options.skip = skipVal;
                    const records = await delegate.findMany(options);
                    return records.map(r => {
                        r._id = r.id;
                        return new ModelWrapper(r);
                    });
                },
                then: function (resolve, reject) {
                    return this.exec().then(resolve, reject);
                }
            };
            return chain;
        }

        static async findById(id) {
            if (!id || !delegate) return null;
            const record = await delegate.findUnique({ where: { id: String(id) } });
            if (!record) return null;
            record._id = record.id;
            return new ModelWrapper(record);
        }

        static async findByIdAndUpdate(id, updateData, options = {}) {
            if (!id || !delegate) return null;
            const data = parsePayload(updateData);
            if (Object.keys(data).length === 0) return await ModelWrapper.findById(id);
            const updated = await delegate.update({
                where: { id: String(id) },
                data
            });
            if (updated) {
                updated._id = updated.id;
                return new ModelWrapper(updated);
            }
            return null;
        }

        static async findByIdAndDelete(id) {
            if (!id || !delegate) return null;
            const deleted = await delegate.delete({ where: { id: String(id) } });
            if (deleted) {
                deleted._id = deleted.id;
                return new ModelWrapper(deleted);
            }
            return null;
        }

        static async updateOne(query, updateData) {
            if (!delegate) return { modifiedCount: 0 };
            const where = parseWhere(query);
            const data = parsePayload(updateData);
            if (Object.keys(data).length === 0) return { modifiedCount: 0, acknowledged: true };
            const res = await delegate.updateMany({ where, data });
            return { modifiedCount: res.count, acknowledged: true };
        }

        static async updateMany(query, updateData) {
            if (!delegate) return { modifiedCount: 0 };
            const where = parseWhere(query);
            const data = parsePayload(updateData);
            if (Object.keys(data).length === 0) return { modifiedCount: 0, acknowledged: true };
            const res = await delegate.updateMany({ where, data });
            return { modifiedCount: res.count, acknowledged: true };
        }

        static async deleteMany(query) {
            if (!delegate) return { deletedCount: 0 };
            const where = parseWhere(query);
            const res = await delegate.deleteMany({ where });
            return { deletedCount: res.count, acknowledged: true };
        }

        static async deleteOne(query) {
            if (!delegate) return { deletedCount: 0 };
            const where = parseWhere(query);
            const first = await delegate.findFirst({ where });
            if (first) {
                await delegate.delete({ where: { id: first.id } });
                return { deletedCount: 1, acknowledged: true };
            }
            return { deletedCount: 0, acknowledged: true };
        }

        static async create(data) {
            const instance = new ModelWrapper(data);
            await instance.save();
            return instance;
        }

        static async countDocuments(query = {}) {
            if (!delegate) return 0;
            const where = parseWhere(query);
            return await delegate.count({ where });
        }

        static async aggregate() {
            if (!delegate) return [];
            const records = await delegate.findMany({ where: { deleted: false } });
            return records.map(r => {
                r._id = r.id;
                return r;
            });
        }

        async save() {
            if (!delegate) return this;
            const plain = {};
            for (const key of Object.keys(this)) {
                if (key.startsWith('_') && key !== '_id') continue;
                plain[key] = this[key];
            }
            if (plain._id) {
                plain.id = plain._id;
                delete plain._id;
            }
            if (!plain.id) {
                plain.id = generateObjectId();
            }

            const upserted = await delegate.upsert({
                where: { id: plain.id },
                create: plain,
                update: plain
            });

            upserted._id = upserted.id;
            Object.assign(this, upserted);
            return this;
        }
    }

    return ModelWrapper;
}

module.exports = {
    createSqlModel,
    prisma,
    generateObjectId
};
