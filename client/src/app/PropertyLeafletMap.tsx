import { useEffect, useRef, useState } from "react"
import { Building2, MapPin, Navigation, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "./api"

interface PropertyMapProps {
  address: string
  title?: string
  price?: string | number
  bhk?: string | number
  carpetArea?: string | number
  builder?: string
  photoUrl?: string
  latitude?: number
  longitude?: number
  className?: string
}

// Micro-market geocoding map for Indian real estate hubs
const MICRO_MARKET_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "bandra west": { lat: 19.0596, lng: 72.8295 },
  "worli": { lat: 19.0176, lng: 72.8172 },
  "bandra kurla complex": { lat: 19.0674, lng: 72.8686 },
  "powai": { lat: 19.1176, lng: 72.9060 },
  "alibaug": { lat: 18.6414, lng: 72.8722 },
  "lower parel": { lat: 18.9986, lng: 72.8312 },
  "juhu": { lat: 19.1075, lng: 72.8263 },
  "thane west": { lat: 19.2183, lng: 72.9781 },
  "gurgaon": { lat: 28.4595, lng: 77.0266 },
  "whitefield": { lat: 12.9698, lng: 77.7499 },
}

function resolveCoordinates(addressStr: string): { lat: number; lng: number } {
  const lower = (addressStr || "").toLowerCase()
  for (const key of Object.keys(MICRO_MARKET_COORDINATES)) {
    if (lower.includes(key)) {
      return MICRO_MARKET_COORDINATES[key]
    }
  }
  // Default to Mumbai Central if unknown
  return { lat: 19.076, lng: 72.8777 }
}

async function geocodeAddress(address: string, signal: AbortSignal): Promise<{ lat: number; lng: number } | null> {
  const response = await api.get(`/v1/geocode?q=${encodeURIComponent(address)}`, { signal })
  const matches = response.data.data as Array<{ latitude?: number; longitude?: number }>
  if (!matches[0]) return null

  return { lat: Number(matches[0].latitude), lng: Number(matches[0].longitude) }
}

const formatINR = (val: string | number | undefined) => {
  const num = Number(val) || 0
  if (num >= 10000007) return `₹${(num / 10000000).toFixed(2)} Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakh`
  return `₹${num.toLocaleString("en-IN")}`
}

export function PropertyLeafletMap({
  address,
  title = "Luxury Real Estate Property",
  price,
  bhk,
  carpetArea,
  builder = "Onboarded Developer",
  photoUrl = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
  latitude,
  longitude,
  className = "h-64 w-full rounded-xl overflow-hidden border shadow-sm",
}: PropertyMapProps) {
  const suppliedCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { lat: Number(latitude), lng: Number(longitude) }
    : null
  const fallbackCoords = suppliedCoordinates || resolveCoordinates(address)
  const [coords, setCoords] = useState(fallbackCoords)
  const [showPopup, setShowPopup] = useState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()
    if (suppliedCoordinates) {
      setCoords(suppliedCoordinates)
      return () => controller.abort()
    }
    setCoords(resolveCoordinates(address))

    geocodeAddress(address, controller.signal)
      .then((result) => {
        if (result) setCoords(result)
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setCoords(resolveCoordinates(address))
      })

    return () => controller.abort()
  }, [address, latitude, longitude])

  // Map Tile iframe using OpenStreetMap + Leaflet styling
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.015}%2C${coords.lat - 0.015}%2C${coords.lng + 0.015}%2C${coords.lat + 0.015}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`

  return (
    <div className={`relative bg-slate-900 ${className}`}>
      {/* OpenStreetMap Interactive Tile Viewport */}
      <iframe
        title={`Map location for ${address}`}
        width="100%"
        height="100%"
        src={mapUrl}
        className="h-full w-full border-0 filter saturate-[1.1]"
        loading="lazy"
      />

      {/* Floating Custom Property Pointer Card Overlay */}
      {showPopup && (
        <div className="absolute left-4 top-4 z-10 max-w-xs rounded-xl bg-white/95 p-3 shadow-xl backdrop-blur-md border border-black/10 transition-all text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-black text-xs">
              <MapPin className="size-4 text-rose-600 shrink-0 animate-bounce" />
              <span className="truncate">{title}</span>
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="text-zinc-400 hover:text-black font-mono font-bold text-xs"
            >
              ✕
            </button>
          </div>

          {/* Property Image & Quick Info */}
          <div className="flex gap-2">
            <div className="h-16 w-20 shrink-0 rounded-md overflow-hidden bg-black border">
              <img src={photoUrl} alt={title} className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="font-display font-bold text-emerald-700 text-sm">
                {formatINR(price)}
              </div>
              <div className="text-[11px] text-zinc-600 font-medium truncate">
                {builder}
              </div>
              <div className="text-[10px] text-zinc-500 truncate">
                {bhk ? `${bhk} BHK • ` : ""}{carpetArea ? `${carpetArea} sq.ft.` : address}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Navigation className="size-3 text-blue-600" />
              {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
            </span>
            <a
              href={`https://www.openstreetmap.org/directions?from=&to=${coords.lat}%2C${coords.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold"
            >
              Directions <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>
      )}

      {!showPopup && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute left-3 top-3 z-10 text-xs gap-1 shadow-md bg-white text-black"
          onClick={() => setShowPopup(true)}
        >
          <MapPin className="size-3 text-rose-600" /> Show Pointer Popup
        </Button>
      )}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-1 right-1 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-slate-700 shadow"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  )
}
