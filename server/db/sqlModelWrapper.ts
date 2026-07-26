import prisma from './prisma';
import crypto from 'crypto';

export function generateObjectId(): string {
    return crypto.randomBytes(12).toString('hex');
}

export const mongoose: any = {
    Types: {
        ObjectId: class ObjectId {
            public idStr: string;
            constructor(id?: any) {
                this.idStr = id ? String(id) : generateObjectId();
            }
            toString() { return this.idStr; }
            valueOf() { return this.idStr; }
            static isValid(id: any) { return Boolean(id); }
        }
    },
    model: (name: string) => createSqlModel(name),
    connection: {
        db: {
            listCollections: () => ({ hasNext: async () => false })
        }
    }
};

export function parseWhere(query: any = {}): Record<string, any> {
    if (!query || typeof query !== 'object') return {};
    const where: Record<string, any> = {};
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
            } else if (val instanceof mongoose.Types.ObjectId) {
                where[prismaKey] = val.toString();
            }
        } else if (val !== undefined && typeof val !== 'function') {
            where[prismaKey] = val;
        }
    }
    return where;
}

export function parsePayload(payload: any = {}): Record<string, any> {
    if (!payload || typeof payload !== 'object') return {};
    let target = payload;
    if (payload.$set) target = payload.$set;
    else if (payload.$push) target = payload.$push;
    else if (payload.$pull) target = payload.$pull;

    const clean: Record<string, any> = {};
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

export function createSqlModel(modelName: string, schemaFields?: any) {
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const mapper: Record<string, string> = {
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
    const delegate: any = (prisma as any)[prismaDelegateName];

    class ModelWrapper {
        public _data: any;
        public _id: string;
        public id: string;
        [key: string]: any;

        constructor(data: any = {}) {
            this._data = { ...data };
            if (!this._data.id && !this._data._id) {
                this._data.id = generateObjectId();
            }
            this._id = this._data.id || this._data._id;
            this.id = this._id;
            Object.assign(this, this._data);
            this._id = this.id;
        }

        toObject() {
            return { ...this._data, _id: this._id, id: this.id };
        }

        toJSON() {
            return this.toObject();
        }

        static get prismaDelegate() {
            return delegate;
        }

        static async insertMany(records: any[]) {
            if (!delegate || !Array.isArray(records)) return [];
            const results = [];
            for (const item of records) {
                const created = await ModelWrapper.create(item);
                results.push(created);
            }
            return results;
        }

        static findOne(query: any = {}) {
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
                then: function (resolve: any, reject: any) {
                    return this.exec().then(resolve, reject);
                }
            };
            return chain;
        }

        static find(query: any = {}) {
            const where = parseWhere(query);
            let limitVal: number | undefined = undefined;
            let skipVal: number | undefined = undefined;

            const chain = {
                populate: function () { return chain; },
                sort: function () { return chain; },
                limit: function (l: number) { limitVal = l; return chain; },
                skip: function (sk: number) { skipVal = sk; return chain; },
                exec: async function () {
                    if (!delegate) return [];
                    const options: any = { where };
                    if (limitVal) options.take = limitVal;
                    if (skipVal) options.skip = skipVal;
                    const records = await delegate.findMany(options);
                    return records.map((r: any) => {
                        r._id = r.id;
                        return new ModelWrapper(r);
                    });
                },
                then: function (resolve: any, reject: any) {
                    return this.exec().then(resolve, reject);
                }
            };
            return chain;
        }

        static async findById(id: string) {
            if (!id || !delegate) return null;
            const record = await delegate.findUnique({ where: { id: String(id) } });
            if (!record) return null;
            record._id = record.id;
            return new ModelWrapper(record);
        }

        static async findByIdAndUpdate(id: string, updateData: any, options: any = {}) {
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

        static async findByIdAndDelete(id: string) {
            if (!id || !delegate) return null;
            const deleted = await delegate.delete({ where: { id: String(id) } });
            if (deleted) {
                deleted._id = deleted.id;
                return new ModelWrapper(deleted);
            }
            return null;
        }

        static async updateOne(query: any, updateData: any) {
            if (!delegate) return { modifiedCount: 0 };
            const where = parseWhere(query);
            const data = parsePayload(updateData);
            if (Object.keys(data).length === 0) return { modifiedCount: 0, acknowledged: true };
            const res = await delegate.updateMany({ where, data });
            return { modifiedCount: res.count, acknowledged: true };
        }

        static async updateMany(query: any, updateData: any) {
            if (!delegate) return { modifiedCount: 0 };
            const where = parseWhere(query);
            const data = parsePayload(updateData);
            if (Object.keys(data).length === 0) return { modifiedCount: 0, acknowledged: true };
            const res = await delegate.updateMany({ where, data });
            return { modifiedCount: res.count, acknowledged: true };
        }

        static async deleteMany(query: any) {
            if (!delegate) return { deletedCount: 0 };
            const where = parseWhere(query);
            const res = await delegate.deleteMany({ where });
            return { deletedCount: res.count, acknowledged: true };
        }

        static async deleteOne(query: any) {
            if (!delegate) return { deletedCount: 0 };
            const where = parseWhere(query);
            const first = await delegate.findFirst({ where });
            if (first) {
                await delegate.delete({ where: { id: first.id } });
                return { deletedCount: 1, acknowledged: true };
            }
            return { deletedCount: 0, acknowledged: true };
        }

        static async create(data: any) {
            const instance = new ModelWrapper(data);
            await instance.save();
            return instance;
        }

        static async countDocuments(query: any = {}) {
            if (!delegate) return 0;
            const where = parseWhere(query);
            return await delegate.count({ where });
        }

        static async aggregate() {
            if (!delegate) return [];
            const records = await delegate.findMany({ where: { deleted: false } });
            return records.map((r: any) => {
                r._id = r.id;
                return r;
            });
        }

        async save() {
            if (!delegate) return this;
            const plain: any = {};
            for (const key of Object.keys(this)) {
                if (key.startsWith('_') && key !== '_id') continue;
                plain[key] = (this as any)[key];
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

    (ModelWrapper as any).default = ModelWrapper;
    return ModelWrapper;
}

export default mongoose;
export { prisma };
