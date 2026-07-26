import type { Server } from "socket.io"

let socketServer: Server | null = null

export function setSocketServer(server: Server) {
  socketServer = server
}

export function emitToOrganization(organizationId: string, event: string, payload: unknown) {
  socketServer?.to(`organization:${organizationId}`).emit(event, payload)
}
