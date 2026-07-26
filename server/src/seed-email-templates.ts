import prisma from "../db/prisma.js"

export const PROFESSIONAL_EMAIL_TEMPLATES = [
  {
    name: "Welcome & New Inquiry Acknowledgement",
    subject: "Welcome to MooN Estate Intelligence — Thank you for your inquiry!",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MooN Estate Intelligence</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:32px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Estate Intelligence & Advisory</p>
      </td>
    </tr>
    <!-- Hero Banner -->
    <tr>
      <td style="padding:32px 32px 16px 32px; background:linear-gradient(135deg, #fdfbf7 0%, #eef2f3 100%); border-bottom:1px solid #e4e4e7;">
        <h2 style="margin:0; font-size:20px; color:#18181b;">Welcome, {{customerName}}!</h2>
        <p style="margin:8px 0 0 0; font-size:14px; color:#52525b; line-height:1.6;">Thank you for contacting MooN Estate Intelligence. We have received your inquiry regarding <strong>{{propertyInterest}}</strong>.</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          Our senior property advisor, <strong>{{agentName}}</strong>, has been assigned to assist you. Whether you are looking for investment opportunities, premium residential estates, or commercial spaces, we are dedicated to helping you find the perfect match.
        </p>
        
        <!-- Summary Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5; border-radius:8px; padding:16px; margin:20px 0;">
          <tr>
            <td>
              <p style="margin:0 0 8px 0; font-size:12px; font-weight:700; color:#71717a; text-transform:uppercase;">Inquiry Details Summary</p>
              <p style="margin:0 0 4px 0; font-size:13px; color:#18181b;"><strong>Interested Property / Area:</strong> {{propertyInterest}}</p>
              <p style="margin:0 0 4px 0; font-size:13px; color:#18181b;"><strong>Contact Phone:</strong> {{customerPhone}}</p>
              <p style="margin:0; font-size:13px; color:#18181b;"><strong>Reference ID:</strong> {{leadId}}</p>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{scheduleLink}}" target="_blank" style="background-color:#09090b; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">Schedule Consultation Tour &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; High-Value Real Estate Services</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">If you have any questions, reply directly to this email or call +91 98765 43210.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    name: "Property Viewing & Site Visit Invitation",
    subject: "Exclusive Property Tour Invitation — {{propertyAddress}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property Tour Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:32px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Site Visit & Viewing Invitation</p>
      </td>
    </tr>
    <!-- Hero Banner -->
    <tr>
      <td style="padding:28px 32px; background-color:#eff6ff; border-bottom:1px solid #bfdbfe;">
        <h2 style="margin:0; font-size:18px; color:#1e40af;">Site Visit Scheduled for {{customerName}}</h2>
        <p style="margin:6px 0 0 0; font-size:14px; color:#1e3a8a;">We look forward to hosting your viewing of <strong>{{propertyAddress}}</strong>.</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:32px;">
        <!-- Appointment Details Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fafafa; border:1px solid #e4e4e7; border-left:4px solid #2563eb; border-radius:8px; padding:20px; margin-bottom:24px;">
          <tr>
            <td>
              <p style="margin:0 0 8px 0; font-size:11px; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:1px;">Appointment Confirmation</p>
              <p style="margin:0 0 6px 0; font-size:14px; color:#18181b;"><strong>Date & Time:</strong> {{viewingDate}}</p>
              <p style="margin:0 0 6px 0; font-size:14px; color:#18181b;"><strong>Location:</strong> {{propertyAddress}}</p>
              <p style="margin:0 0 6px 0; font-size:14px; color:#18181b;"><strong>Hosted By:</strong> {{agentName}} ({{agentPhone}})</p>
              <p style="margin:0; font-size:14px; color:#18181b;"><strong>Tour Format:</strong> {{tourType}} (Private In-Person Viewing)</p>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          During the visit, {{agentName}} will walk you through the architectural specifications, floor plans, neighborhood highlights, and custom layout configurations.
        </p>

        <!-- CTA Buttons -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{mapLink}}" target="_blank" style="background-color:#2563eb; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:600; font-size:13px; display:inline-block; margin-right:8px;">Open Google Maps Directions &rarr;</a>
              <a href="{{rescheduleLink}}" target="_blank" style="background-color:#f4f4f5; color:#3f3f46; border:1px solid #d4d4d8; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:600; font-size:13px; display:inline-block;">Reschedule</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; VIP Concierge Services</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">Need immediate help? Call your advisor directly at {{agentPhone}}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    name: "Property Proposal & Financial Overview",
    subject: "Property Proposal & Financial Overview — {{propertyAddress}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property Proposal</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:32px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Curated Property Proposal</p>
      </td>
    </tr>
    <!-- Body Header -->
    <tr>
      <td style="padding:32px 32px 16px 32px;">
        <h2 style="margin:0 0 8px 0; font-size:20px; color:#18181b;">Dear {{customerName}},</h2>
        <p style="margin:0; font-size:14px; color:#52525b; line-height:1.6;">Pursuant to our recent discussion, we are pleased to share the tailored proposal and financial structure for <strong>{{propertyAddress}}</strong>.</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:16px 32px 32px 32px;">
        <!-- Pricing Breakdown Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fafafa; border:1px solid #e4e4e7; border-radius:8px; padding:20px; margin-bottom:24px;">
          <tr>
            <td>
              <p style="margin:0 0 12px 0; font-size:12px; font-weight:700; color:#18181b; text-transform:uppercase; border-bottom:1px solid #e4e4e7; padding-bottom:8px;">Financial Overview & Terms</p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;">
                <tr>
                  <td style="padding:4px 0; color:#71717a;">Listing Price:</td>
                  <td style="padding:4px 0; text-align:right; font-weight:600; color:#18181b;">{{listingPrice}}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#71717a;">Proposed Value:</td>
                  <td style="padding:4px 0; text-align:right; font-weight:700; color:#059669;">{{proposedPrice}}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#71717a;">Built-up Area:</td>
                  <td style="padding:4px 0; text-align:right; font-weight:500; color:#18181b;">{{propertyArea}} sq.ft.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#71717a;">Estimated Booking Deposit:</td>
                  <td style="padding:4px 0; text-align:right; font-weight:500; color:#18181b;">{{bookingDeposit}}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          This property meets your preferences for floor area, valuation upside, and premium location amenities. Attached you will find the complete brochure and unit specifications.
        </p>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{proposalPdfLink}}" target="_blank" style="background-color:#09090b; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">Download Full Proposal PDF &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; Strategic Real Estate Advisory</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">Prepared by {{agentName}} &bull; Direct: {{agentPhone}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    name: "Lead Follow-Up & Re-Engagement Cadence",
    subject: "Following up on your property search — {{customerName}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Following Up on Your Property Search</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:32px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Personalized Property Advisory</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px 0; font-size:18px; color:#18181b;">Hi {{customerName}},</h2>
        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          I hope you are having a productive week! I am following up on your search for real estate listings in <strong>{{preferredLocation}}</strong>.
        </p>
        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          We recently listed several exclusive residential and commercial opportunities matching your target budget of <strong>{{budgetRange}}</strong>.
        </p>

        <!-- Highlight Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fdf4ff; border:1px solid #f5d0fe; border-radius:8px; padding:16px; margin:20px 0;">
          <tr>
            <td>
              <p style="margin:0 0 6px 0; font-size:12px; font-weight:700; color:#9333ea; text-transform:uppercase;">Featured Recommended Listing</p>
              <p style="margin:0 0 4px 0; font-size:14px; font-weight:600; color:#18181b;">{{featuredPropertyTitle}}</p>
              <p style="margin:0; font-size:13px; color:#52525b;">{{featuredPropertySpecs}} &bull; Valuation: {{featuredPropertyPrice}}</p>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          Would you have 5 minutes this week for a quick call or WhatsApp conversation to review these options?
        </p>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{whatsappLink}}" target="_blank" style="background-color:#16a34a; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">Chat on WhatsApp &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; High-Value Real Estate Services</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">Assigned Advisor: {{agentName}} &bull; {{agentPhone}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    name: "Formal Offer & Negotiation Terms",
    subject: "Offer Update & Terms Overview — {{opportunityName}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer & Negotiation Terms</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:32px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Formal Offer & Deal Terms</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px 0; font-size:18px; color:#18181b;">Dear {{customerName}},</h2>
        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          This email confirms the formal offer terms recorded for <strong>{{opportunityName}}</strong> ({{propertyAddress}}).
        </p>

        <!-- Terms Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fafafa; border:1px solid #e4e4e7; border-left:4px solid #09090b; border-radius:8px; padding:20px; margin-bottom:24px;">
          <tr>
            <td>
              <p style="margin:0 0 12px 0; font-size:12px; font-weight:700; color:#18181b; text-transform:uppercase; border-bottom:1px solid #e4e4e7; padding-bottom:8px;">Offer Terms Summary</p>
              <p style="margin:0 0 6px 0; font-size:13px; color:#18181b;"><strong>Offer Amount:</strong> {{offerAmount}}</p>
              <p style="margin:0 0 6px 0; font-size:13px; color:#18181b;"><strong>Earnest Money Deposit:</strong> {{earnestDeposit}}</p>
              <p style="margin:0 0 6px 0; font-size:13px; color:#18181b;"><strong>Closing Timeline:</strong> {{closingTimeline}}</p>
              <p style="margin:0; font-size:13px; color:#18181b;"><strong>Offer Expiry Date:</strong> {{offerExpiryDate}}</p>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          Please review the formal document attached. Upon your written concurrence, our legal team will initiate the sales agreement preparation.
        </p>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{reviewOfferLink}}" target="_blank" style="background-color:#09090b; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">Review & Sign Offer Document &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; Advisory & Legal Desk</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">Questions? Contact {{agentName}} at {{agentEmail}}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    name: "Invoice & Payment Receipt",
    subject: "Invoice {{invoiceNumber}} — MooN Estate Intelligence",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice Statement</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:32px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#a1a1aa; margin:4px 0 0 0; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Billing Statement & Invoice</p>
      </td>
    </tr>
    <!-- Header Summary -->
    <tr>
      <td style="padding:28px 32px; background-color:#f0fdf4; border-bottom:1px solid #bbf7d0;">
        <h2 style="margin:0; font-size:18px; color:#166534;">Invoice {{invoiceNumber}}</h2>
        <p style="margin:4px 0 0 0; font-size:13px; color:#15803d;">Status: <strong>{{invoiceStatus}}</strong> &bull; Billed to: {{customerName}}</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:32px;">
        <!-- Line Items Table -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px; border-collapse:collapse; margin-bottom:24px;">
          <thead>
            <tr style="border-bottom:2px solid #e4e4e7;">
              <th align="left" style="padding:8px 0; color:#71717a;">Description</th>
              <th align="right" style="padding:8px 0; color:#71717a;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #f4f4f5;">
              <td style="padding:12px 0; color:#18181b;">{{invoiceTitle}}</td>
              <td style="padding:12px 0; text-align:right; font-weight:600; color:#18181b;">{{invoiceAmount}}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td style="padding:16px 0 4px 0; font-weight:700; font-size:15px; color:#18181b;">Total Amount Due / Paid:</td>
              <td style="padding:16px 0 4px 0; text-align:right; font-weight:700; font-size:16px; color:#16a34a;">{{grandTotal}}</td>
            </tr>
          </tfoot>
        </table>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{downloadInvoicePdfLink}}" target="_blank" style="background-color:#09090b; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">Download Official PDF Statement &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; Finance & Accounts</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">GST / Tax Invoice &bull; For billing queries email finance@moonestates.example</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    name: "Closed Deal Congratulations & Handover",
    subject: "Congratulations on your new property! — MooN Estate",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Congratulations on Your Property</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#18181b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:30px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color:#09090b; padding:36px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:2px;">MOON ESTATE</h1>
        <p style="color:#e4e4e7; margin:6px 0 0 0; font-size:12px; letter-spacing:1.5px; text-transform:uppercase;">Congratulations & Welcome Home</p>
      </td>
    </tr>
    <!-- Hero Banner -->
    <tr>
      <td style="padding:32px 32px 16px 32px; text-align:center; background-color:#fdf4ff;">
        <h2 style="margin:0; font-size:22px; color:#701a75;">Deal Closed Successfully! 🎉</h2>
        <p style="margin:8px 0 0 0; font-size:14px; color:#86198f; line-height:1.6;">Congratulations <strong>{{customerName}}</strong> on securing <strong>{{propertyAddress}}</strong>!</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#3f3f46;">
          On behalf of the entire team at MooN Estate Intelligence, we extend our warmest congratulations. It has been an absolute privilege guiding you through this transaction.
        </p>

        <!-- Handover Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fafafa; border:1px solid #e4e4e7; border-radius:8px; padding:20px; margin:20px 0;">
          <tr>
            <td>
              <p style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:#18181b; text-transform:uppercase;">Handover & Post-Sale Package Checklist</p>
              <p style="margin:0 0 6px 0; font-size:13px; color:#18181b;">&bull; Registered Title Deed & Sales Deed Copy</p>
              <p style="margin:0 0 6px 0; font-size:13px; color:#18181b;">&bull; Property Access Keys & Smart Passcode</p>
              <p style="margin:0 0 6px 0; font-size:13px; color:#18181b;">&bull; Society / Maintenance Orientation Details</p>
              <p style="margin:0; font-size:13px; color:#18181b;">&bull; Post-Purchase Concierge & Interior Advisory</p>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 12px 0;">
          <tr>
            <td align="center">
              <a href="{{postSalePortalLink}}" target="_blank" style="background-color:#09090b; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">Access Owner Portal & Documents &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color:#fafafa; padding:24px 32px; border-top:1px solid #e4e4e7; text-align:center;">
        <p style="margin:0 0 4px 0; font-size:12px; color:#71717a;">MooN Estate Intelligence &bull; Post-Purchase Concierge</p>
        <p style="margin:0; font-size:11px; color:#a1a1aa;">Your Lead Advisor: {{agentName}} &bull; {{agentPhone}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
]

async function seedEmailTemplates() {
  console.log("Seeding professional customer email templates...")
  const organization = await prisma.organization.upsert({
    where: { slug: "moon-estates" },
    update: {},
    create: { name: "MooN Estates", slug: "moon-estates" },
  })

  for (const tpl of PROFESSIONAL_EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { organizationId: organization.id, name: tpl.name, deleted: false }
    })

    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: tpl.subject,
          html: tpl.html,
          updatedDate: new Date()
        }
      })
      console.log(`Updated template: ${tpl.name}`)
    } else {
      await prisma.emailTemplate.create({
        data: {
          organizationId: organization.id,
          name: tpl.name,
          subject: tpl.subject,
          html: tpl.html,
          createdDate: new Date(),
          updatedDate: new Date()
        }
      })
      console.log(`Created template: ${tpl.name}`)
    }
  }

  console.log(`Successfully seeded ${PROFESSIONAL_EMAIL_TEMPLATES.length} customer email templates!`)
}

seedEmailTemplates()
  .catch((err) => {
    console.error("Error seeding email templates:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
