export interface User {
  _id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  phoneNumber?: number;
  emailsent?: number;
  textsent?: number;
  outboundcall?: number;
  roles?: string[];
  createdDate?: string | Date;
  updatedDate?: string | Date;
  deleted?: boolean;
}

export interface Lead {
  _id: string;
  leadName?: string;
  leadEmail?: string;
  leadPhoneNumber?: string;
  leadAddress?: string;
  leadStatus?: string;
  leadSource?: string;
  createBy?: string;
  assignedTo?: string;
  createdDate?: string | Date;
  updatedDate?: string | Date;
  deleted?: boolean;
}

export interface Contact {
  _id: string;
  email?: string;
  phone?: string;
  title?: string;
  fullName?: string;
  physicalAddress?: string;
  interestProperty?: string[];
  quotes?: string[];
  createBy?: string;
  createdDate?: string | Date;
  updatedDate?: string | Date;
  deleted?: boolean;
}

export interface Property {
  _id: string;
  propertyType?: string;
  propertyAddress?: string;
  listingPrice?: string;
  propertyPhotos?: string[];
  virtualToursOrVideos?: string[];
  floorPlans?: string[];
  unitType?: any[];
  units?: any[];
  createBy?: string;
  createdDate?: string | Date;
  updatedDate?: string | Date;
  deleted?: boolean;
}

export interface RoleAccess {
  _id: string;
  roleName: string;
  access?: Array<{
    title: string;
    create: boolean;
    update: boolean;
    delete: boolean;
    view: boolean;
  }>;
  description?: string;
  createdDate?: string | Date;
  deleted?: boolean;
}

export interface CustomField {
  _id: string;
  moduleName: string;
  icon?: string;
  no?: number;
  headings?: any[];
  fields?: any[];
  createdDate?: string | Date;
  updatedDate?: string | Date;
  deleted?: boolean;
}
