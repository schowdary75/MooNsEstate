export type ProviderResult = {
  externalId: string
  status: string
  raw?: unknown
}

export interface MessagingProvider {
  send(input: {
    organizationId: string
    to: string
    text?: string
    templateName?: string
    templateLanguage?: string
    replyToExternalId?: string
  }): Promise<ProviderResult>
}

export interface EmailProvider {
  send(input: {
    organizationId: string
    to: string
    subject: string
    text?: string
    html?: string
    attachmentKeys?: string[]
  }): Promise<ProviderResult>
}

export interface VoiceProvider {
  connect(input: {
    organizationId: string
    agentNumber: string
    customerNumber: string
    callbackUrl: string
    record: boolean
    customField: string
  }): Promise<ProviderResult>
}

export interface TranscriptionProvider {
  transcribe(input: {
    organizationId: string
    recordingUrl: string
    languageCode?: string
  }): Promise<ProviderResult>
}

export interface BillingProvider {
  createCheckout(input: {
    organizationId: string
    planExternalId: string
    quantity: number
    interval: "monthly" | "annual"
  }): Promise<ProviderResult & { checkoutUrl?: string }>
  createPortal(input: {
    organizationId: string
    customerExternalId: string
  }): Promise<{ portalUrl: string }>
  verifyWebhook(payload: Buffer, signature?: string): Promise<boolean> | boolean
}

export interface StorageProvider {
  put(input: {
    organizationId: string
    key: string
    body: Uint8Array
    contentType: string
  }): Promise<{ key: string }>
  signedReadUrl(key: string, expiresInSeconds?: number): Promise<string>
}

export interface GeocodingProvider {
  autocomplete(input: {
    query: string
    countryCode?: string
    limit?: number
  }): Promise<Array<{
    id: string
    label: string
    latitude?: number
    longitude?: number
  }>>
}
