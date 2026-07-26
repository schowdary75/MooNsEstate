import prisma from "../db/prisma.js"

const seedOwner = "moonestate-demo-seed-2026"
const atMonth = (monthsAgo: number, day: number) => new Date(2026, 6 - monthsAgo, day, 10, 0, 0)

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "moon-estates" },
    update: {},
    create: { name: "MooN Estates", slug: "moon-estates" },
  })
  const organizationId = organization.id
  const tenantRecords = <RecordType extends object>(records: RecordType[]) =>
    records.map((record) => ({ ...record, organizationId }))

  await prisma.$transaction([
    prisma.lead.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.contact.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.property.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.opportunity.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.invoice.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.task.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.meeting.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.phoneCall.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.email.deleteMany({ where: { organizationId, createBy: seedOwner } }),
    prisma.account.deleteMany({ where: { organizationId, createBy: seedOwner } }),
  ])

  const leadNames = [
    ["Aarav Mehta", "aarav.mehta@example.com", "Referral", "Qualified"],
    ["Nisha Kapoor", "nisha.kapoor@example.com", "Website", "New"],
    ["Rohan Shah", "rohan.shah@example.com", "Meta Lead Ads", "Qualified"],
    ["Meera Iyer", "meera.iyer@example.com", "Instagram", "Contacted"],
    ["Vikram Malhotra", "vikram.malhotra@example.com", "Open house", "Converted"],
  ] as const
  await prisma.lead.createMany({
    data: leadNames.map(([leadName, leadEmail, leadSource, leadStatus], index) => ({
      organizationId,
      leadName,
      leadEmail,
      leadSource,
      leadStatus,
      leadPhoneNumber: `+91 98765 4321${index}`,
      phoneE164: `+91987654321${index}`,
      leadAddress: "Mumbai, Maharashtra",
      priority: index === 1 ? "High" : "Medium",
      consentStatus: "granted",
      createBy: seedOwner,
      createdDate: atMonth(Math.min(index, 4), index + 3),
    })),
  })

  await prisma.contact.createMany({
    data: tenantRecords(leadNames.slice(0, 4).map(([fullName, email], index) => ({
      fullName,
      email,
      phone: `+91 98765 4321${index}`,
      title: "Buyer",
      physicalAddress: "Mumbai, Maharashtra",
      createBy: seedOwner,
    }))),
  })

  await prisma.account.createMany({
    data: tenantRecords([
      { name: "Harbourline Holdings", type: "Investor", industry: "Real estate", emailAddress: "hello@harbourline.example", createBy: seedOwner },
      { name: "Northstar Living", type: "Developer", industry: "Residential", emailAddress: "team@northstar.example", createBy: seedOwner },
    ]),
  })

  await prisma.property.createMany({
    data: tenantRecords([
      {
        slug: "sea-view-residences-bandra-1804",
        propertyType: "Apartment",
        title: "Sea View Residences, Bandra West",
        builder: "Oberoi Realty",
        propertyAddress: "Hill Road, Bandra West, Mumbai, Maharashtra",
        location: "Bandra West, Mumbai",
        listingPrice: "38500000",
        towerName: "Tower B",
        totalFloors: 32,
        floorNumber: 18,
        unitNumber: "1804",
        bedrooms: 3,
        bathrooms: 3,
        carpetArea: 2450,
        facing: "West",
        status: "Available",
        reraId: "MAHARERA/PRM/2026/01001",
        latitude: 19.0596,
        longitude: 72.8295,
        published: true,
        priceUpdatedAt: new Date(),
        description: "Verified sea-view residence with persisted tower and unit inventory.",
        propertyPhotos: [
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
        ],
        createBy: seedOwner,
      },
      {
        slug: "one-bkc-office-1402",
        propertyType: "Commercial",
        title: "One BKC Grade-A Office",
        builder: "Northstar Living",
        propertyAddress: "Bandra Kurla Complex, Mumbai, Maharashtra",
        location: "Bandra Kurla Complex, Mumbai",
        listingPrice: "47500000",
        towerName: "G Block",
        totalFloors: 30,
        floorNumber: 14,
        unitNumber: "1402",
        bedrooms: 0,
        bathrooms: 2,
        carpetArea: 1850,
        facing: "East",
        status: "Available",
        reraId: "MAHARERA/PRM/2026/01002",
        latitude: 19.0674,
        longitude: 72.8686,
        published: true,
        priceUpdatedAt: new Date(),
        description: "Verified commercial inventory with current pricing and exact floor height.",
        propertyPhotos: [
          "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
        ],
        createBy: seedOwner,
      },
    ]),
  })

  await prisma.opportunity.createMany({
    data: tenantRecords([
      { opportunityName: "Mehta - Sea View Residence", accountName: "Harbourline Holdings", amount: "38500000", stage: "Negotiation", probability: "80", closeDate: "2026-08-05", leadSource: "Referral", createBy: seedOwner },
      { opportunityName: "Malhotra - Harbour Point", accountName: "Harbourline Holdings", amount: "31500000", stage: "Closed Won", probability: "100", closeDate: "2026-07-10", leadSource: "Open house", createBy: seedOwner },
    ]),
  })
  await prisma.invoice.createMany({
    data: tenantRecords([
      { title: "Commission - Harbour Point", invoiceNumber: "INV-2026-041", status: "Paid", grandTotal: "945000", account: "Harbourline Holdings", contact: "Vikram Malhotra", createBy: seedOwner },
    ]),
  })
  await prisma.task.createMany({
    data: tenantRecords([
      { title: "Prepare Sea View counter-offer", category: "Negotiation", status: "in-progress", end: "2026-07-29T16:00:00", assignTo: "MooN Estates", createBy: seedOwner },
      { title: "Book BKC viewing", category: "Viewing", status: "todo", end: "2026-07-30T11:00:00", assignTo: "MooN Estates", createBy: seedOwner },
    ]),
  })
  await prisma.meeting.create({
    data: {
      organizationId,
      agenda: "Sea View negotiation review",
      location: "Bandra office",
      related: "Mehta - Sea View Residence",
      dateTime: "2026-07-28T15:00:00",
      createBy: seedOwner,
    },
  })
  await prisma.phoneCall.create({
    data: {
      organizationId,
      sender: "MooN Estates",
      recipient: "Nisha Kapoor",
      callDuration: "20 min",
      startDate: "2026-07-27T12:30:00",
      createBy: seedOwner,
      callNotes: "Confirm viewing preferences and financing timeline.",
    },
  })
  await prisma.email.create({
    data: {
      organizationId,
      sender: "advisor@moonestates.example",
      recipient: "aarav.mehta@example.com",
      subject: "Sea View - revised offer",
      message: "Counter-offer prepared for review.",
      createBy: seedOwner,
    },
  })

  console.log("Tenant-scoped demo CRM workspace seeded.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
