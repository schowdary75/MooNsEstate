import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PropertyLeafletMap } from "./PropertyLeafletMap"
import {
  AlertTriangle,
  ArrowUp,
  BadgeIndianRupee,
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Grid,
  Home,
  Image,
  Info,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Video,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { listRecords, createRecord, updateRecord, deleteRecord, errorMessage, api } from "./api"
import type { CrmRecord } from "./types"
import { numericValue, recordId } from "./types"

const DEFAULT_PROPERTY_PHOTOS = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
]

const DEFAULT_FLOOR_PLANS = [
  "https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=1200&q=80",
]

interface AddressSuggestion {
  id: string
  label: string
  latitude?: number
  longitude?: number
}

const formatINR = (val: number | string | undefined | null) => {
  const num = numericValue(val)
  if (num >= 10000007) {
    return `₹${(num / 10000000).toFixed(2)} Cr`
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} Lakh`
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num)
}

// ─── Skyscraper Configuration (cloned from SkyscraperVisualizerPage) ───
interface SkyscraperUnit {
  unitId: string
  propertyId?: string
  floorNum: number
  unitIndex: number
  unitNumber: string
  title?: string
  builder?: string
  location?: string
  bedrooms?: number
  bathrooms?: number
  bhk: number
  carpetArea: number
  price: number
  facing: string
  status: "Available" | "Under Offer" | "Reserved" | "Sold"
  isPrimary?: boolean
  photos: string[]
}

interface PropertyInventoryUnit {
  id: string
  propertyId?: string | null
  floorNumber: number
  unitNumber: string
  bedrooms?: number | null
  bathrooms?: number | null
  carpetArea?: number | null
  facing?: string | null
  listingPrice?: number | string | null
  status: SkyscraperUnit["status"]
  isPrimary?: boolean
}

interface UnitEditorValues {
  floorNumber: string
  unitNumber: string
  bedrooms: string
  bathrooms: string
  carpetArea: string
  listingPrice: string
  facing: string
  status: SkyscraperUnit["status"]
}

const EMPTY_UNIT_EDITOR: UnitEditorValues = {
  floorNumber: "1",
  unitNumber: "",
  bedrooms: "",
  bathrooms: "",
  carpetArea: "",
  listingPrice: "",
  facing: "East",
  status: "Available",
}

export function PropertiesPage() {
  const queryClient = useQueryClient()

  // View state
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [builderFilter, setBuilderFilter] = useState("all")
  const [typologyFilter, setTypologyFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // ─── Skyscraper Visualizer State (always declared, only rendered when activePropertyDetail is set) ───
  const towerRef = useRef<HTMLDivElement>(null)
  const [skyFloor, setSkyFloor] = useState<number>(34)
  const [skyUnit, setSkyUnit] = useState<string>("3405")
  const [skySearch, setSkySearch] = useState<string>("")
  const [isElevatorMoving, setIsElevatorMoving] = useState<boolean>(false)
  const [currentElevatorFloor, setCurrentElevatorFloor] = useState<number>(1)

  // Modals & In-Page Studio State
  const [builderOpen, setBuilderOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activePropertyDetail, setActivePropertyDetail] = useState<CrmRecord | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<CrmRecord | null>(null)
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [unitEditorOpen, setUnitEditorOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<SkyscraperUnit | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<SkyscraperUnit | null>(null)
  const [unitEditor, setUnitEditor] = useState<UnitEditorValues>(EMPTY_UNIT_EDITOR)

  // Builder Form State
  const [title, setTitle] = useState("")
  const [builder, setBuilder] = useState("Oberoi Realty")
  const [location, setLocation] = useState("Bandra West, Mumbai")
  const [address, setAddress] = useState("")
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const skipNextAddressSearch = useRef(false)
  const [propertyType, setPropertyType] = useState("Apartment")
  const [price, setPrice] = useState("")
  const [carpetArea, setCarpetArea] = useState("")
  const [bedrooms, setBedrooms] = useState("3")
  const [bathrooms, setBathrooms] = useState("3")
  const [towerName, setTowerName] = useState("Tower A")
  const [floorNumber, setFloorNumber] = useState("14")
  const [totalFloors, setTotalFloors] = useState("1")
  const [unitNumber, setUnitNumber] = useState("1402")
  const [facing, setFacing] = useState("East")
  const [status, setStatus] = useState("Available")
  const [published, setPublished] = useState(false)
  const [reraId, setReraId] = useState("MAHARERA/PRM/2026/08941")
  const [description, setDescription] = useState("")
  const [photoUrls, setPhotoUrls] = useState<string[]>(DEFAULT_PROPERTY_PHOTOS)
  const [livingRoomPhoto, setLivingRoomPhoto] = useState("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80")
  const [kitchenPhoto, setKitchenPhoto] = useState("https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80")
  const [masterBedroomPhoto, setMasterBedroomPhoto] = useState("https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80")
  const [washroomPhoto, setWashroomPhoto] = useState("https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80")
  const [balconyPhoto, setBalconyPhoto] = useState("https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80")
  const [floorPlanUrls, setFloorPlanUrls] = useState<string[]>(DEFAULT_FLOOR_PLANS)
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

  useEffect(() => {
    const searchTerm = address.trim()

    if (skipNextAddressSearch.current) {
      skipNextAddressSearch.current = false
      return
    }

    if (searchTerm.length < 3) {
      setAddressSuggestions([])
      setIsSearchingAddress(false)
      return
    }

    const controller = new AbortController()
    const debounceTimer = window.setTimeout(async () => {
      setIsSearchingAddress(true)
      try {
        const response = await api.get(`/v1/geocode?q=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal,
        })
        setAddressSuggestions(response.data.data as AddressSuggestion[])
      } catch (error) {
        if ((error as Error).name !== "AbortError") setAddressSuggestions([])
      } finally {
        if (!controller.signal.aborted) setIsSearchingAddress(false)
      }
    }, 500)

    return () => {
      window.clearTimeout(debounceTimer)
      controller.abort()
    }
  }, [address])

  // Audit missing room photos for property record
  const getMissingRoomPhotos = (p: CrmRecord): string[] => {
    const missing: string[] = []

    if (!p.photoLivingRoom) missing.push("Living Room")
    if (!p.photoKitchen) missing.push("Kitchen")
    
    const bedCount = Number(p.bedrooms) || 0
    if (bedCount >= 1 && !p.photoRoom1) missing.push("Room 1")
    if (bedCount >= 2 && !p.photoRoom2) missing.push("Room 2")

    if (!p.photoWashroom) missing.push("Washroom")
    if (!p.photoBalcony) missing.push("Balcony")

    return missing
  }

  // ─── Skyscraper Data: Fetch DB properties and merge with 50-story matrix ───
  const activeTotalFloors = Math.max(1, Number(activePropertyDetail?.totalFloors) || 1)

  const { data: dbProperties = [] } = useQuery({
    queryKey: ["sky-properties"],
    queryFn: async () => {
      return listRecords("property")
    },
  })
  const activePropertyId = activePropertyDetail ? recordId(activePropertyDetail) : ""
  const { data: normalizedInventory, isFetching: isInventoryFetching } = useQuery({
    queryKey: ["property-inventory", activePropertyId],
    enabled: Boolean(activePropertyId),
    queryFn: async () => {
      const response = await api.get<{
        data: {
          units: PropertyInventoryUnit[]
          tower: { id: string; name: string; totalFloors: number } | null
        }
      }>(`/v1/properties/${activePropertyId}/inventory`)
      return response.data.data
    },
  })

  const allUnits = useMemo(() => {
    const mergedMap = new Map<string, SkyscraperUnit>()
    const activeTower = String(activePropertyDetail?.towerName || "").trim().toLowerCase()
    const activeBuilder = String(activePropertyDetail?.builder || "").trim().toLowerCase()
    const records = [...dbProperties]
    if (activePropertyDetail && !records.some((item) => recordId(item) === recordId(activePropertyDetail))) {
      records.push(activePropertyDetail)
    }
    records
      .filter((property) => {
        if (!activePropertyDetail) return false
        const tower = String(property.towerName || "").trim().toLowerCase()
        const builderName = String(property.builder || "").trim().toLowerCase()
        return (!activeTower || tower === activeTower) && (!activeBuilder || builderName === activeBuilder)
      })
      .forEach((p: any) => {
      const addUnit = (unit: any, index: number) => {
        const floor = Number(unit.floorNumber ?? p.floorNumber)
        const unitNumberValue = String(unit.unitNumber ?? p.unitNumber ?? "").trim()
        const unitTower = String(unit.towerName ?? p.towerName ?? "").trim().toLowerCase()
        const unitBuilder = String(unit.builder ?? p.builder ?? "").trim().toLowerCase()
        if ((activeTower && unitTower !== activeTower) || (activeBuilder && unitBuilder !== activeBuilder)) return
        if (!unitNumberValue || !Number.isInteger(floor) || floor < 1 || floor > activeTotalFloors) return
        const rawStatus = String(unit.status ?? p.status)
        const normalizedStatus: SkyscraperUnit["status"] =
          rawStatus === "Under Offer" || rawStatus === "Reserved" || rawStatus === "Sold" ? rawStatus : "Available"
        const bhk = Number(unit.bedrooms ?? p.bedrooms) || 0
        mergedMap.set(`${floor}-${unitNumberValue}`, {
          unitId: String(unit.id || unit.unitId || recordId(p) || `${floor}-${unitNumberValue}`),
          propertyId: String(unit.propertyId || recordId(p) || ""),
          floorNum: floor,
          unitIndex: index,
          unitNumber: unitNumberValue,
          title: unit.title || p.title,
          builder: unit.builder || p.builder,
          location: unit.location || p.location,
          bedrooms: bhk,
          bathrooms: Number(unit.bathrooms ?? p.bathrooms) || 0,
          bhk,
          carpetArea: Number(unit.carpetArea ?? p.carpetArea) || 0,
          price: Number(unit.listingPrice ?? unit.price ?? p.listingPrice) || 0,
          facing: String(unit.facing ?? p.facing ?? "Not specified"),
          status: normalizedStatus,
          isPrimary: Boolean(unit.isPrimary),
          photos: Array.isArray(p.propertyPhotos) ? p.propertyPhotos : [],
        })
      }
      addUnit(p, 0)
      const unitsArr = Array.isArray(p.units) ? p.units : []
      unitsArr.forEach(addUnit)
    })
    normalizedInventory?.units.forEach((unit, index) => {
      const linkedProperty = records.find((property) => recordId(property) === unit.propertyId) || activePropertyDetail
      if (linkedProperty) {
        const normalizedUnit = {
          ...unit,
          floorNumber: unit.floorNumber,
          towerName: linkedProperty.towerName,
          builder: linkedProperty.builder,
        }
        const floor = Number(unit.floorNumber)
        const key = `${floor}-${unit.unitNumber}`
        const linkedPhotos = Array.isArray(linkedProperty.propertyPhotos) ? linkedProperty.propertyPhotos as string[] : []
        mergedMap.set(key, {
          unitId: unit.id,
          propertyId: unit.propertyId || undefined,
          floorNum: floor,
          unitIndex: index,
          unitNumber: unit.unitNumber,
          title: String(linkedProperty.title || ""),
          builder: String(normalizedUnit.builder || ""),
          location: String(linkedProperty.location || linkedProperty.propertyAddress || ""),
          bedrooms: Number(unit.bedrooms) || 0,
          bathrooms: Number(unit.bathrooms) || 0,
          bhk: Number(unit.bedrooms) || 0,
          carpetArea: Number(unit.carpetArea) || 0,
          price: Number(unit.listingPrice) || 0,
          facing: String(unit.facing || "Not specified"),
          status: unit.status,
          isPrimary: unit.isPrimary,
          photos: linkedPhotos,
        })
      }
    })
    return Array.from(mergedMap.values()).sort((left, right) =>
      left.floorNum - right.floorNum || left.unitNumber.localeCompare(right.unitNumber),
    )
  }, [dbProperties, activePropertyDetail, activeTotalFloors, normalizedInventory])

  const skyActiveFloorUnits = useMemo(() => {
    return allUnits.filter((u) => u.floorNum === skyFloor)
  }, [allUnits, skyFloor])

  const skySelectedUnit = useMemo(() => {
    return skyActiveFloorUnits.find((u) => u.unitNumber === skyUnit) || skyActiveFloorUnits[0]
  }, [skyActiveFloorUnits, skyUnit])

  useEffect(() => {
    if (!skyActiveFloorUnits.length) {
      if (skyUnit) setSkyUnit("")
      return
    }
    if (!skyActiveFloorUnits.some((unit) => unit.unitNumber === skyUnit)) {
      setSkyUnit(skyActiveFloorUnits[0]!.unitNumber)
    }
  }, [skyActiveFloorUnits, skyUnit])

  const skyStats = useMemo(() => {
    const total = allUnits.length
    const available = allUnits.filter((u) => u.status === "Available").length
    const underOffer = allUnits.filter((u) => u.status === "Under Offer").length
    const sold = allUnits.filter((u) => u.status === "Sold").length
    return { total, available, underOffer, sold }
  }, [allUnits])

  const triggerElevatorFlyTo = (targetFloor: number, targetUnitNum?: string) => {
    if (targetFloor === skyFloor && (!targetUnitNum || targetUnitNum === skyUnit)) return
    setIsElevatorMoving(true)
    let current = currentElevatorFloor
    const step = targetFloor > current ? 1 : -1
    const speed = Math.max(15, Math.floor(600 / Math.abs(targetFloor - current)))
    const interval = setInterval(() => {
      current += step
      setCurrentElevatorFloor(current)
      if ((step > 0 && current >= targetFloor) || (step < 0 && current <= targetFloor)) {
        clearInterval(interval)
        setCurrentElevatorFloor(targetFloor)
        setSkyFloor(targetFloor)
        if (targetUnitNum) setSkyUnit(targetUnitNum)
        setIsElevatorMoving(false)
        const floorElement = document.getElementById(`floor-row-${targetFloor}`)
        if (floorElement && towerRef.current) {
          floorElement.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }
    }, speed)
  }

  const handleSearchUnit = (query: string) => {
    setSkySearch(query)
    const matched = allUnits.find((u) => u.unitNumber === query.trim())
    if (matched) {
      triggerElevatorFlyTo(matched.floorNum, matched.unitNumber)
      toast.success(`Elevator travelling to Floor ${matched.floorNum} — Unit #${matched.unitNumber}!`)
    }
  }

  useEffect(() => {
    if (activePropertyDetail) {
      const targetFloor = Number(activePropertyDetail.floorNumber)
      const targetUnit = String(activePropertyDetail.unitNumber)
      if (targetFloor && !isNaN(targetFloor)) {
        // slight delay to let DOM render
        setTimeout(() => triggerElevatorFlyTo(targetFloor, targetUnit || undefined), 300)
      }
    }
  }, [activePropertyDetail])

  const { data: properties = [], isLoading, refetch } = useQuery<CrmRecord[]>({
    queryKey: ["records", "property"],
    queryFn: async () => {
      const res = await listRecords("property")
      return Array.isArray(res) ? res : []
    },
  })

  // Extract unique locations and builders for dynamic filter dropdowns
  const { uniqueLocations, uniqueBuilders } = useMemo(() => {
    const locs = new Set<string>()
    const blds = new Set<string>()

    properties.forEach((p) => {
      const loc = (p.location as string) || (p.propertyAddress as string) || ""
      if (loc) {
        const microLoc = loc.split(",")[0].trim()
        if (microLoc) locs.add(microLoc)
      }
      const bld = (p.builder as string) || (p.accountName as string) || ""
      if (bld) blds.add(bld)
    })

    return {
      uniqueLocations: Array.from(locs),
      uniqueBuilders: Array.from(blds),
    }
  }, [properties])

  // KPIs
  const stats = useMemo(() => {
    let totalPortfolioVal = 0
    let availableCount = 0
    let underOfferCount = 0
    let soldCount = 0

    properties.forEach((p) => {
      const val = numericValue(p.listingPrice)
      totalPortfolioVal += val
      const st = String(p.status || p.propertyStatus || "Available").toLowerCase()
      if (st.includes("available")) availableCount++
      else if (st.includes("offer") || st.includes("reserved")) underOfferCount++
      else if (st.includes("sold")) soldCount++
    })

    return {
      totalCount: properties.length,
      totalPortfolioVal,
      availableCount,
      underOfferCount,
      soldCount,
    }
  }, [properties])

  // Filtered Properties
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return properties.filter((p) => {
      const loc = String(p.location || p.propertyAddress || "").toLowerCase()
      const bld = String(p.builder || "").toLowerCase()
      const type = String(p.propertyType || "").toLowerCase()
      const st = String(p.status || p.propertyStatus || "Available").toLowerCase()
      const t = String(p.title || p.propertyAddress || "").toLowerCase()

      if (locationFilter !== "all" && !loc.includes(locationFilter.toLowerCase())) return false
      if (builderFilter !== "all" && !bld.includes(builderFilter.toLowerCase())) return false
      if (typologyFilter !== "all" && !type.includes(typologyFilter.toLowerCase())) return false
      if (statusFilter !== "all" && !st.includes(statusFilter.toLowerCase())) return false

      if (q) {
        if (!t.includes(q) && !loc.includes(q) && !bld.includes(q) && !type.includes(q)) return false
      }
      return true
    })
  }, [properties, search, locationFilter, builderFilter, typologyFilter, statusFilter])

  // Reset Builder Form
  const handleOpenBuilder = (p?: CrmRecord) => {
    if (p) {
      setEditingId(recordId(p))
      setTitle((p.title as string) || (p.propertyAddress as string) || "")
      setBuilder((p.builder as string) || "Oberoi Realty")
      setLocation((p.location as string) || (p.propertyAddress as string) || "Bandra West, Mumbai")
      setAddress((p.propertyAddress as string) || "")
      setLatitude(p.latitude === null || p.latitude === undefined ? "" : String(p.latitude))
      setLongitude(p.longitude === null || p.longitude === undefined ? "" : String(p.longitude))
      setPropertyType((p.propertyType as string) || "Apartment")
      setPrice(String(p.listingPrice || "38500000"))
      setCarpetArea(String(p.carpetArea || "1850"))
      setBedrooms(String(p.bedrooms || "3"))
      setBathrooms(String(p.bathrooms || "3"))
      setTowerName((p.towerName as string) || "Tower A")
      setFloorNumber(String(p.floorNumber || "14"))
      setTotalFloors(String(p.totalFloors || "1"))
      setUnitNumber((p.unitNumber as string) || "1402")
      setFacing((p.facing as string) || "East")
      setStatus((p.status as string) || "Available")
      setPublished(Boolean(p.published))
      setReraId((p.reraId as string) || "MAHARERA/PRM/2026/08941")
      setDescription((p.description as string) || "")

      if (Array.isArray(p.propertyPhotos) && (p.propertyPhotos as string[]).length > 0) {
        setPhotoUrls(p.propertyPhotos as string[])
      } else {
        setPhotoUrls(DEFAULT_PROPERTY_PHOTOS)
      }

      if (Array.isArray(p.floorPlans) && (p.floorPlans as string[]).length > 0) {
        setFloorPlanUrls(p.floorPlans as string[])
      } else {
        setFloorPlanUrls(DEFAULT_FLOOR_PLANS)
      }
      setVideoUrl((p.virtualToursOrVideos as string) || "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    } else {
      setEditingId(null)
      setTitle("Palatial 3BHK Penthouse — Sea View Residences")
      setBuilder("Oberoi Realty")
      setLocation("Bandra West, Mumbai")
      setAddress("Sea View Residences, Hill Road, Bandra West, Mumbai")
      setLatitude("")
      setLongitude("")
      setPropertyType("Apartment")
      setPrice("38500000")
      setCarpetArea("2450")
      setBedrooms("3")
      setBathrooms("3")
      setTowerName("Tower B")
      setFloorNumber("18")
      setTotalFloors("32")
      setUnitNumber("1804")
      setFacing("East")
      setStatus("Available")
      setPublished(false)
      setReraId("MAHARERA/PRM/2026/08941")
      setDescription("Panoramic sea view penthouse with Italian marble flooring, wrap-around balcony, private elevator access, and 3 reserved basement parking slots.")
      setPhotoUrls(DEFAULT_PROPERTY_PHOTOS)
      setFloorPlanUrls(DEFAULT_FLOOR_PLANS)
      setVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    }
    setBuilderOpen(true)
  }

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !price.trim()) throw new Error("Title and Listing Price are required")
      const payload = {
        title,
        builder,
        location,
        propertyAddress: address || location,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        propertyType,
        listingPrice: String(price),
        carpetArea: Number(carpetArea),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        towerName,
        floorNumber: Number(floorNumber),
        totalFloors: Number(totalFloors),
        unitNumber,
        facing,
        status,
        published,
        reraId,
        description,
        propertyPhotos: photoUrls,
        floorPlans: floorPlanUrls,
        virtualToursOrVideos: videoUrl,
      }

      if (editingId) {
        return updateRecord("property", editingId, payload)
      } else {
        return createRecord("property", payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "property"] })
      queryClient.invalidateQueries({ queryKey: ["sky-properties"] })
      if (activePropertyDetail && recordId(activePropertyDetail) === editingId) {
        setActivePropertyDetail({
          ...activePropertyDetail,
          totalFloors: Number(totalFloors),
          floorNumber: Number(floorNumber),
          unitNumber,
          towerName,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
        })
        setSkyFloor(Math.min(Number(floorNumber) || 1, Math.max(1, Number(totalFloors) || 1)))
      }
      toast.success(editingId ? "Property listing updated" : "New property cataloged")
      setBuilderOpen(false)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteRecord("property", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "property"] })
      toast.success("Property removed from inventory")
    },
  })

  const openUnitEditor = (unit?: SkyscraperUnit) => {
    setEditingUnit(unit || null)
    if (unit) {
      setUnitEditor({
        floorNumber: String(unit.floorNum),
        unitNumber: unit.unitNumber,
        bedrooms: unit.bedrooms ? String(unit.bedrooms) : "",
        bathrooms: unit.bathrooms ? String(unit.bathrooms) : "",
        carpetArea: unit.carpetArea ? String(unit.carpetArea) : "",
        listingPrice: unit.price ? String(unit.price) : "",
        facing: unit.facing === "Not specified" ? "" : unit.facing,
        status: unit.status,
      })
    } else {
      let sequence = skyActiveFloorUnits.length + 1
      let suggestedUnit = `${skyFloor}${String(sequence).padStart(2, "0")}`
      while (allUnits.some((candidate) => candidate.floorNum === skyFloor && candidate.unitNumber === suggestedUnit)) {
        sequence += 1
        suggestedUnit = `${skyFloor}${String(sequence).padStart(2, "0")}`
      }
      setUnitEditor({
        floorNumber: String(skyFloor),
        unitNumber: suggestedUnit,
        bedrooms: activePropertyDetail?.bedrooms ? String(activePropertyDetail.bedrooms) : "",
        bathrooms: activePropertyDetail?.bathrooms ? String(activePropertyDetail.bathrooms) : "",
        carpetArea: activePropertyDetail?.carpetArea ? String(activePropertyDetail.carpetArea) : "",
        listingPrice: activePropertyDetail?.listingPrice ? String(activePropertyDetail.listingPrice) : "",
        facing: String(activePropertyDetail?.facing || "East"),
        status: "Available",
      })
    }
    setUnitEditorOpen(true)
  }

  const saveUnitMutation = useMutation({
    mutationFn: async () => {
      if (!activePropertyId) throw new Error("Open a property before managing units")
      const floor = Number(unitEditor.floorNumber)
      if (!Number.isInteger(floor) || floor < 1 || floor > activeTotalFloors) {
        throw new Error(`Floor must be between 1 and ${activeTotalFloors}`)
      }
      if (!unitEditor.unitNumber.trim()) throw new Error("Unit number is required")
      const optionalNumber = (value: string) => value.trim() ? Number(value) : null
      const payload = {
        floorNumber: floor,
        unitNumber: unitEditor.unitNumber.trim(),
        bedrooms: optionalNumber(unitEditor.bedrooms),
        bathrooms: optionalNumber(unitEditor.bathrooms),
        carpetArea: optionalNumber(unitEditor.carpetArea),
        listingPrice: optionalNumber(unitEditor.listingPrice),
        facing: unitEditor.facing.trim() || null,
        status: unitEditor.status,
      }
      return editingUnit
        ? api.patch(`/v1/properties/${activePropertyId}/units/${editingUnit.unitId}`, payload)
        : api.post(`/v1/properties/${activePropertyId}/units`, payload)
    },
    onSuccess: (response) => {
      const saved = response.data.data as PropertyInventoryUnit
      queryClient.invalidateQueries({ queryKey: ["property-inventory", activePropertyId] })
      queryClient.invalidateQueries({ queryKey: ["sky-properties"] })
      queryClient.invalidateQueries({ queryKey: ["records", "property"] })
      setSkyFloor(saved.floorNumber)
      setSkyUnit(saved.unitNumber)
      if (saved.isPrimary && activePropertyDetail) {
        setActivePropertyDetail({
          ...activePropertyDetail,
          floorNumber: saved.floorNumber,
          unitNumber: saved.unitNumber,
          bedrooms: saved.bedrooms,
          bathrooms: saved.bathrooms,
          carpetArea: saved.carpetArea,
          listingPrice: saved.listingPrice === null || saved.listingPrice === undefined
            ? activePropertyDetail.listingPrice
            : String(saved.listingPrice),
          facing: saved.facing,
          status: saved.status,
        })
      }
      toast.success(editingUnit ? `Unit ${saved.unitNumber} updated` : `Unit ${saved.unitNumber} added to floor ${saved.floorNumber}`)
      setUnitEditorOpen(false)
      setEditingUnit(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const deleteUnitMutation = useMutation({
    mutationFn: async (unit: SkyscraperUnit) => {
      if (!activePropertyId) throw new Error("Property inventory is unavailable")
      return api.delete(`/v1/properties/${activePropertyId}/units/${unit.unitId}`)
    },
    onSuccess: (_response, unit) => {
      queryClient.invalidateQueries({ queryKey: ["property-inventory", activePropertyId] })
      if (skyUnit === unit.unitNumber) setSkyUnit("")
      setDeletingUnit(null)
      toast.success(`Unit ${unit.unitNumber} removed from floor ${unit.floorNum}`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  // Render In-Page Studio & 3D Skyscraper View if a property card was clicked
  if (activePropertyDetail) {
    const p = activePropertyDetail
    const pTitle = String(p.title || p.propertyAddress || "Real Estate Property")
    const pBuilder = String(p.builder || "Oberoi Realty")
    const pLocation = String(p.location || p.propertyAddress || "Bandra West, Mumbai")
    const pPrice = p.listingPrice
    const pPhotos = Array.isArray(p.propertyPhotos) && p.propertyPhotos.length ? (p.propertyPhotos as string[]) : DEFAULT_PROPERTY_PHOTOS
    const missing = getMissingRoomPhotos(p)

    return (
      <div className="space-y-6">
        {/* Top Sticky Header Bar with Back Button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-4 shadow-lg border border-black/10">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="gap-2 bg-black text-white hover:bg-black/90 font-bold text-xs shadow-sm"
              onClick={() => setActivePropertyDetail(null)}
            >
              <ChevronLeft className="size-4" /> ← Back to Property Catalog
            </Button>
            <div className="h-6 w-px bg-zinc-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xl text-black">{pTitle}</h2>
                <Badge className="bg-blue-600 text-white font-medium text-[10px]">{pBuilder}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {pLocation} &bull; {p.bedrooms as string || "3"} BHK &bull; {p.carpetArea as string || "1850"} sq.ft. &bull; RERA: {p.reraId as string || "MAHARERA/2026"}
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="3dvisualizer" className="w-full space-y-4">
          <TabsList className="bg-zinc-100 p-1 rounded-xl">
            <TabsTrigger value="3dvisualizer" className="gap-2 text-xs font-bold"><Building className="size-4" /> 3D Tower Visualizer</TabsTrigger>
            <TabsTrigger value="map" className="gap-2 text-xs font-bold"><MapPin className="size-4" /> OpenStreetMap Pointer</TabsTrigger>
            <TabsTrigger value="photos" className="gap-2 text-xs font-bold"><Image className="size-4" /> Room-by-Room Tour</TabsTrigger>
          </TabsList>

          <TabsContent value="3dvisualizer" className="space-y-6">
            {/* Navigator & Search Controls */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Quick Flat Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder={`Type a persisted flat number from this ${activeTotalFloors}-floor tower…`}
                      value={skySearch}
                      onChange={(e) => handleSearchUnit(e.target.value)}
                      className="pl-9 font-mono"
                    />
                  </div>

                  {/* Quick Floor Slider Navigator */}
                  <div className="flex items-center gap-3">
                    <Label className="text-xs font-mono text-muted-foreground shrink-0">
                      Floor: <strong className="text-black text-sm">{skyFloor}</strong> / {activeTotalFloors}
                    </Label>
                    <div className="w-48">
                      <Slider
                        min={1}
                        max={activeTotalFloors}
                        step={1}
                        value={[skyFloor]}
                        onValueChange={(val) => triggerElevatorFlyTo(val[0])}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main 3D Tower & Unit Matrix Grid Layout */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: interactive persisted tower inventory */}
              <div className="lg:col-span-4 space-y-3">
                <Card className="overflow-hidden border-2 border-black/10 shadow-lg">
                  <CardHeader className="pb-2 bg-black text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold tracking-widest uppercase">Skyscraper 3D Tower Stack</CardTitle>
                        <CardDescription className="text-[11px] text-zinc-400">Click any floor slab (1 to {activeTotalFloors})</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-700 font-mono text-xs text-emerald-400">
                        <Zap className={`size-3.5 ${isElevatorMoving ? "animate-bounce text-amber-400" : ""}`} />
                        {isElevatorMoving ? `FLY-TO F${currentElevatorFloor}` : `ELEVATOR AT F${skyFloor}`}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div
                      ref={towerRef}
                      className="h-[580px] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-800 to-zinc-950 p-4 space-y-1.5 font-mono text-xs scrollbar-thin"
                    >
                      <div className="text-center py-2 text-zinc-400 text-[10px] tracking-widest border-b border-zinc-700/50">
                        ▲ {activePropertyDetail?.towerName ? (activePropertyDetail.towerName as string).toUpperCase() : "GRAND HORIZON TOWER"} SPIRE (FLOOR {activeTotalFloors}) ▲
                      </div>

                      {Array.from({ length: activeTotalFloors }, (_, idx) => activeTotalFloors - idx).map((floor) => {
                        const isSelected = skyFloor === floor
                        const floorUnits = allUnits.filter((u) => u.floorNum === floor)
                        const availCount = floorUnits.filter((u) => u.status === "Available").length

                        return (
                          <div
                            id={`floor-row-${floor}`}
                            key={floor}
                            onClick={() => triggerElevatorFlyTo(floor)}
                            className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 border ${
                              isSelected
                                ? "bg-amber-400 text-black border-amber-500 font-bold shadow-lg scale-[1.02] z-10"
                                : "bg-black/40 hover:bg-black/70 text-white border-zinc-800/80"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isSelected ? "bg-black text-white" : "bg-zinc-800 text-zinc-300"}`}>
                                F{floor < 10 ? `0${floor}` : floor}
                              </span>
                              <span className="text-xs">Floor {floor}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              {floorUnits.map((unit) => {
                                const isUnitSelected = skyUnit === unit.unitNumber
                                const isAvail = unit.status === "Available"
                                const isOffer = unit.status === "Under Offer" || unit.status === "Reserved"

                                return (
                                  <button
                                    key={unit.unitId}
                                    title={`Unit ${unit.unitNumber} (${unit.bhk}BHK) - ${unit.status}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      triggerElevatorFlyTo(floor, unit.unitNumber)
                                    }}
                                    className={`size-3.5 rounded-sm transition-all ${
                                      isUnitSelected
                                        ? "ring-2 ring-white scale-125 bg-amber-300 animate-pulse"
                                        : isAvail
                                        ? "bg-emerald-500 hover:bg-emerald-400"
                                        : isOffer
                                        ? "bg-amber-500 hover:bg-amber-400"
                                        : "bg-rose-500/60 hover:bg-rose-500"
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            <span className={`text-[10px] ${isSelected ? "text-black font-bold" : "text-zinc-400"}`}>
                              {availCount} Avail
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Selected Floor 360° Ring & Unit Details Drawer */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-l-4 border-l-black">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <Building2 className="size-5 text-black" />
                          Floor {skyFloor} Inventory ({skyActiveFloorUnits.length} Units)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {String(activePropertyDetail?.towerName || "Tower")} &bull; Level {skyFloor} floor layout and orientations
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {isInventoryFetching && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Syncing
                          </span>
                        )}
                        <Badge className="bg-black text-white font-mono">FLOOR {skyFloor}</Badge>
                        <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => openUnitEditor()}>
                          <Plus className="size-3.5" /> Add unit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {skyActiveFloorUnits.length === 0 ? (
                        <div className="col-span-full rounded-2xl border border-dashed border-black/15 bg-gradient-to-br from-white to-emerald-50/60 p-8 text-center">
                          <div className="mx-auto grid size-11 place-items-center rounded-full border border-emerald-900/10 bg-emerald-100 text-emerald-700">
                            <Home className="size-5" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-foreground">This floor has no units yet.</p>
                          <p className="mt-1 text-xs text-muted-foreground">Add the first flat to make it searchable and visible in the tower.</p>
                          <Button size="sm" className="mt-4 gap-1.5" onClick={() => openUnitEditor()}>
                            <Plus className="size-3.5" /> Add first unit to floor {skyFloor}
                          </Button>
                        </div>
                      ) : skyActiveFloorUnits.map((u) => {
                        const isSelected = skyUnit === u.unitNumber
                        const isAvail = u.status === "Available"
                        const isOffer = u.status === "Under Offer" || u.status === "Reserved"

                        return (
                          <div
                            key={u.unitId}
                            onClick={() => setSkyUnit(u.unitNumber)}
                            className={`cursor-pointer rounded-xl p-3 border transition-all text-xs space-y-2 ${
                              isSelected
                                ? "border-2 border-black bg-amber-50 shadow-md ring-2 ring-amber-400/50"
                                : "bg-white hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-sm text-black">Unit #{u.unitNumber}</span>
                              <div className="flex items-center gap-1">
                                {u.isPrimary && <Badge variant="outline" className="px-1.5 py-0 text-[8px]">Primary</Badge>}
                                <Badge
                                  variant={isAvail ? "default" : isOffer ? "secondary" : "destructive"}
                                  className={`text-[9px] px-1.5 py-0 ${isAvail ? "bg-emerald-600 text-white" : ""}`}
                                >
                                  {u.status}
                                </Badge>
                              </div>
                            </div>

                            <div className="text-muted-foreground font-medium">
                              {u.bhk} BHK &bull; {u.carpetArea} sq.ft.
                            </div>

                            <div className="font-display font-bold text-black text-sm">
                              {formatINR(u.price)}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t">
                              <span>Facing: {u.facing}</span>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  aria-label={`Edit unit ${u.unitNumber}`}
                                  size="icon"
                                  variant="ghost"
                                  className="size-6"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openUnitEditor(u)
                                  }}
                                >
                                  <Pencil className="size-3" />
                                </Button>
                                {!u.isPrimary && (
                                  <Button
                                    aria-label={`Delete unit ${u.unitNumber}`}
                                    size="icon"
                                    variant="ghost"
                                    className="size-6 text-rose-600 hover:text-rose-700"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setDeletingUnit(u)
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                )}
                                <Eye className="ml-0.5 size-3 text-black" />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {skySelectedUnit && (
                  <Card className="border-2 border-black/10 shadow-lg">
                    <CardHeader className="bg-black text-white rounded-t-xl pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-400 text-black font-mono text-xs font-bold">
                              UNIT #{skySelectedUnit.unitNumber}
                            </Badge>
                            <Badge variant="outline" className="text-white border-white/30 text-xs">
                              FLOOR {skySelectedUnit.floorNum} OF {activeTotalFloors}
                            </Badge>
                          </div>
                          <CardTitle className="text-2xl font-bold mt-2">
                            {skySelectedUnit.title || `${skySelectedUnit.bhk}BHK Luxury Skyscraper Residence`}
                          </CardTitle>
                          <CardDescription className="text-xs text-zinc-300">
                            {skySelectedUnit.builder ? `${skySelectedUnit.builder} • ` : ""}
                            {skySelectedUnit.location ? `${skySelectedUnit.location} • ` : "Grand Horizon Skyscraper • "}
                            Unit #{skySelectedUnit.unitNumber} • {skySelectedUnit.facing} Vastu Facing
                          </CardDescription>
                        </div>

                        <div className="text-right">
                          <div className="font-display text-3xl font-bold text-emerald-400">
                            {formatINR(skySelectedUnit.price)}
                          </div>
                          <p className="text-[11px] text-zinc-300">Incl. Floor-Rise Premium</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6 text-xs">
                      <div className="grid grid-cols-4 gap-3 rounded-xl bg-muted/40 p-4 border text-center font-medium">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block">Flat Typology</span>
                          <span className="font-bold text-base text-black">{skySelectedUnit.bhk} BHK</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block">Carpet Area</span>
                          <span className="font-bold text-base text-black">{skySelectedUnit.carpetArea} sq.ft.</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block">Floor Level</span>
                          <span className="font-bold text-base text-black">Floor {skySelectedUnit.floorNum}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase block">Vastu Facing</span>
                          <span className="font-bold text-base text-black">{skySelectedUnit.facing}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider">Unit Interior Gallery & Floor Plan</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {skySelectedUnit.photos.map((photo, i) => (
                            <div key={i} className="h-32 rounded-lg overflow-hidden border bg-black group relative">
                              <img src={photo} alt="Unit photo" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-all" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5 text-xs"
                            onClick={() => {
                              toast.info("Open a customer lead to send this unit through the official WhatsApp conversation.")
                            }}
                          >
                            <MessageSquare className="size-3.5" /> Direct WhatsApp Inquiry
                          </Button>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono">
                          STATUS: {skySelectedUnit.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* OpenStreetMap Pointer Tab */}
          <TabsContent value="map" className="space-y-4">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MapPin className="size-4 text-rose-600" />
                  OpenStreetMap Location Pointer
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time geocoded map pointer showing property location at {pLocation}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PropertyLeafletMap
                  address={pLocation}
                  title={pTitle}
                  price={pPrice}
                  bhk={p.bedrooms}
                  carpetArea={p.carpetArea}
                  builder={pBuilder}
                  photoUrl={pPhotos[0]}
                  latitude={Number(p.latitude) || undefined}
                  longitude={Number(p.longitude) || undefined}
                  className="h-[460px] w-full rounded-xl overflow-hidden border shadow-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Room-by-Room Photo Tour Tab */}
          <TabsContent value="photos" className="space-y-4">
            {missing.length > 0 ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                  <span>Photo Audit Warning: Listing is missing {missing.join(", ")} photos. Upload room photos to boost buyer inquiries.</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleOpenBuilder(p)} className="h-7 text-xs bg-white text-rose-700">
                  Upload Photos
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>Photo Audit Verified: All 5 room categories (Living Room, Kitchen, Bedrooms, Washroom, Balcony) are 100% complete!</span>
              </div>
            )}
            
            <Card className="p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: "🛋️ Living Room", url: p.photoLivingRoom as string },
                  { label: "🍳 Kitchen", url: p.photoKitchen as string },
                  { label: "🛏️ Bedroom 1", url: p.photoRoom1 as string },
                  { label: "🛏️ Bedroom 2", url: p.photoRoom2 as string },
                  { label: "🚿 Washroom", url: p.photoWashroom as string },
                  { label: "🌅 Balcony & View", url: p.photoBalcony as string }
                ].filter(room => room.url).map((room, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="h-44 rounded-xl overflow-hidden border bg-black group relative">
                      <img src={room.url} alt={room.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </div>
                    <p className="text-xs font-bold text-center text-zinc-700">
                      {room.label}
                    </p>
                  </div>
                ))}
                
                {/* Fallback to generic photos if specific rooms aren't uploaded yet but legacy photos exist */}
                {!p.photoLivingRoom && pPhotos.map((url, idx) => (
                  <div key={`legacy-${idx}`} className="space-y-1.5 opacity-70">
                    <div className="h-44 rounded-xl overflow-hidden border bg-black group relative">
                      <img src={url} alt={`Legacy Room ${idx + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </div>
                    <p className="text-xs font-bold text-center text-zinc-700">
                      Uncategorized Photo {idx + 1}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={unitEditorOpen}
          onOpenChange={(open) => {
            setUnitEditorOpen(open)
            if (!open) setEditingUnit(null)
          }}
        >
          <DialogContent className="overflow-hidden p-0 sm:max-w-[660px]">
            <div className="bg-black px-6 py-5 text-white">
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                  <Building2 className="size-3.5" />
                  {String(activePropertyDetail.towerName || "Tower")} inventory
                </div>
                <DialogTitle className="font-display text-3xl">
                  {editingUnit ? `Edit unit ${editingUnit.unitNumber}` : `Add a unit to floor ${skyFloor}`}
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  This unit will appear instantly in the floor inventory, tower availability, and unit search.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="inventory-floor" className="mb-1.5 block text-xs font-semibold">Floor number</Label>
                  <Input
                    id="inventory-floor"
                    type="number"
                    min={1}
                    max={activeTotalFloors}
                    value={unitEditor.floorNumber}
                    onChange={(event) => setUnitEditor((current) => ({ ...current, floorNumber: event.target.value }))}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Tower range: 1–{activeTotalFloors}</p>
                </div>
                <div>
                  <Label htmlFor="inventory-unit-number" className="mb-1.5 block text-xs font-semibold">Unit / flat number *</Label>
                  <Input
                    id="inventory-unit-number"
                    value={unitEditor.unitNumber}
                    onChange={(event) => setUnitEditor((current) => ({ ...current, unitNumber: event.target.value }))}
                    placeholder={`${skyFloor}01`}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="inventory-bhk" className="mb-1.5 block text-xs font-semibold">Bedrooms (BHK)</Label>
                  <Input
                    id="inventory-bhk"
                    type="number"
                    min={0}
                    value={unitEditor.bedrooms}
                    onChange={(event) => setUnitEditor((current) => ({ ...current, bedrooms: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="inventory-bathrooms" className="mb-1.5 block text-xs font-semibold">Bathrooms</Label>
                  <Input
                    id="inventory-bathrooms"
                    type="number"
                    min={0}
                    value={unitEditor.bathrooms}
                    onChange={(event) => setUnitEditor((current) => ({ ...current, bathrooms: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="inventory-area" className="mb-1.5 block text-xs font-semibold">Carpet area (sq.ft.)</Label>
                  <Input
                    id="inventory-area"
                    type="number"
                    min={1}
                    value={unitEditor.carpetArea}
                    onChange={(event) => setUnitEditor((current) => ({ ...current, carpetArea: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="inventory-price" className="mb-1.5 block text-xs font-semibold">Listing price (₹)</Label>
                  <Input
                    id="inventory-price"
                    type="number"
                    min={0}
                    value={unitEditor.listingPrice}
                    onChange={(event) => setUnitEditor((current) => ({ ...current, listingPrice: event.target.value }))}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold">Vastu facing</Label>
                  <Select
                    value={unitEditor.facing}
                    onValueChange={(value) => setUnitEditor((current) => ({ ...current, facing: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select facing" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="East">East</SelectItem>
                      <SelectItem value="North-East">North-East</SelectItem>
                      <SelectItem value="North">North</SelectItem>
                      <SelectItem value="North-West">North-West</SelectItem>
                      <SelectItem value="West">West</SelectItem>
                      <SelectItem value="South-West">South-West</SelectItem>
                      <SelectItem value="South">South</SelectItem>
                      <SelectItem value="South-East">South-East</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold">Availability</Label>
                  <Select
                    value={unitEditor.status}
                    onValueChange={(value) => setUnitEditor((current) => ({
                      ...current,
                      status: value as SkyscraperUnit["status"],
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Under Offer">Under Offer</SelectItem>
                      <SelectItem value="Reserved">Reserved</SelectItem>
                      <SelectItem value="Sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editingUnit?.isPrimary && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  This is the property listing’s primary unit. Changes here also update the property card.
                </div>
              )}
            </div>

            <DialogFooter className="border-t bg-muted/25 px-6 py-4">
              <Button variant="outline" onClick={() => setUnitEditorOpen(false)}>Cancel</Button>
              <Button
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={saveUnitMutation.isPending}
                onClick={() => saveUnitMutation.mutate()}
              >
                {saveUnitMutation.isPending ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                {editingUnit ? "Save unit changes" : "Add unit to floor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deletingUnit)} onOpenChange={(open) => !open && setDeletingUnit(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete unit {deletingUnit?.unitNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the unit from floor {deletingUnit?.floorNum}, tower search, and availability reporting. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep unit</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={deleteUnitMutation.isPending}
                onClick={() => deletingUnit && deleteUnitMutation.mutate(deletingUnit)}
              >
                {deleteUnitMutation.isPending ? "Deleting…" : "Delete unit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Property Inventory & Media Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Multi-location, multi-builder & floor level inventory catalog with HD photo galleries and floor plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={() => handleOpenBuilder()} className="gap-2 bg-black text-white hover:bg-black/90">
            <Plus className="size-4" /> Add Property
          </Button>
        </div>
      </div>

      {/* Inventory KPI Dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Listings</CardTitle>
            <Building2 className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount} Units</div>
            <p className="text-xs text-muted-foreground">Across all micro-markets</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700">Portfolio Listing Value</CardTitle>
            <BadgeIndianRupee className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatINR(stats.totalPortfolioVal)}</div>
            <p className="text-xs text-muted-foreground">Total inventory valuation</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-teal-700">Ready & Available</CardTitle>
            <CheckCircle2 className="size-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">{stats.availableCount} Units</div>
            <p className="text-xs text-muted-foreground">Available for immediate booking</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">Under Offer / Reserved</CardTitle>
            <Layers className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.underOfferCount} Units</div>
            <p className="text-xs text-muted-foreground">Token received & documentation</p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search property title, builder (e.g. Oberoi), location (e.g. Bandra), tower, or unit #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* View Mode Buttons */}
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
              <Button
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                className="h-7 text-xs gap-1.5"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="size-3.5" /> Visual Cards
              </Button>
              <Button
                size="sm"
                variant={viewMode === "table" ? "secondary" : "ghost"}
                className="h-7 text-xs gap-1.5"
                onClick={() => setViewMode("table")}
              >
                <List className="size-3.5" /> Matrix Data Grid
              </Button>
            </div>
          </div>

          {/* Multi-Filter Selects */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Location / Micro-market */}
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Micro-Market / Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="Bandra">Bandra West</SelectItem>
                <SelectItem value="Worli">Worli / Lower Parel</SelectItem>
                <SelectItem value="BKC">BKC / Kalina</SelectItem>
                <SelectItem value="Powai">Powai</SelectItem>
                <SelectItem value="Alibaug">Alibaug</SelectItem>
                {uniqueLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Builder / Developer */}
            <Select value={builderFilter} onValueChange={setBuilderFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Builder / Developer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Builders</SelectItem>
                <SelectItem value="Oberoi">Oberoi Realty</SelectItem>
                <SelectItem value="Prestige">Prestige Group</SelectItem>
                <SelectItem value="Godrej">Godrej Properties</SelectItem>
                <SelectItem value="Harbourline">Harbourline Holdings</SelectItem>
                {uniqueBuilders.map((bld) => (
                  <SelectItem key={bld} value={bld}>{bld}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Typology */}
            <Select value={typologyFilter} onValueChange={setTypologyFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Property Typology" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Typologies</SelectItem>
                <SelectItem value="Apartment">Apartment / Flat</SelectItem>
                <SelectItem value="Villa">Villa & Independent House</SelectItem>
                <SelectItem value="Penthouse">Penthouse</SelectItem>
                <SelectItem value="Commercial">Commercial Office / Shop</SelectItem>
                <SelectItem value="Plot">Land / Plot</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Availability Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="offer">Under Offer / Reserved</SelectItem>
                <SelectItem value="sold">Sold Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Properties Content Layout */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No properties match your micro-market, builder, or floor criteria.
        </Card>
      ) : viewMode === "grid" ? (
        /* Visual Cards Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const id = recordId(p)
            const photos = Array.isArray(p.propertyPhotos) && (p.propertyPhotos as string[]).length > 0
              ? (p.propertyPhotos as string[])
              : DEFAULT_PROPERTY_PHOTOS
            const type = (p.propertyType as string) || "Apartment"
            const st = String(p.status || p.propertyStatus || "Available")
            const isAvailable = st.toLowerCase().includes("available")
            const isUnderOffer = st.toLowerCase().includes("offer") || st.toLowerCase().includes("reserved")

            return (
              <Card
                key={id}
                onClick={() => setActivePropertyDetail(p)}
                className="overflow-hidden flex flex-col transition-all hover:shadow-xl border cursor-pointer group"
              >
                {/* Photo Header Carousel */}
                <div className="relative h-48 w-full bg-zinc-900 overflow-hidden">
                  <img
                    src={photos[0]}
                    alt={p.title as string || "Property"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <Badge className="bg-black/80 text-white backdrop-blur border-0 font-medium text-[10px]">
                      {type}
                    </Badge>
                    <Badge className="bg-blue-600/90 text-white backdrop-blur border-0 font-medium text-[10px]">
                      {p.builder as string || "Oberoi Realty"}
                    </Badge>
                  </div>

                  <div className="absolute top-3 right-3">
                    <Badge
                      variant={isAvailable ? "default" : isUnderOffer ? "secondary" : "destructive"}
                      className={isAvailable ? "bg-emerald-600 text-white" : ""}
                    >
                      {st.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Bottom Price & Location overlay */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="font-display text-2xl font-bold">{formatINR(p.listingPrice)}</div>
                    <div className="flex items-center gap-1 text-xs text-zinc-200 truncate">
                      <MapPin className="size-3 text-red-400 shrink-0" />
                      <span className="truncate">{p.location as string || p.propertyAddress as string || "Mumbai"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Content Body */}
                <CardContent className="p-4 flex-1 space-y-3 text-xs">
                  <div>
                    <h3 className="font-bold text-base text-black line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {p.title as string || p.propertyAddress as string || "Luxury Residence"}
                    </h3>
                    <p className="text-muted-foreground line-clamp-1 mt-0.5">
                      {p.towerName as string || "Tower not set"} &bull; Floor {p.floorNumber as string || "Not set"} of {p.totalFloors as string || "Not set"} &bull; Unit #{p.unitNumber as string || "Not set"}
                    </p>
                  </div>

                  {/* Missing Photo Health Audit Warning Badge */}
                  {(() => {
                    const missing = getMissingRoomPhotos(p)
                    if (missing.length > 0) {
                      return (
                        <div className="flex items-center gap-1.5 p-2 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                          <AlertTriangle className="size-3.5 shrink-0 text-rose-600" />
                          <span>Photo Warning: Missing {missing.join(", ")} photo</span>
                        </div>
                      )
                    }
                    return (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                        <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                        <span>All Room Photos Verified (100% Complete)</span>
                      </div>
                    )
                  })()}

                  {/* Key Architectural Specs Pills */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 border text-center font-medium">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Bedrooms</span>
                      <span className="font-bold text-sm text-black">{p.bedrooms as string || "3"} BHK</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Carpet Area</span>
                      <span className="font-bold text-sm text-black">{p.carpetArea as string || "1850"} sq.ft.</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Facing</span>
                      <span className="font-bold text-sm text-black">{p.facing as string || "East"}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs bg-black text-white hover:bg-black/90"
                        onClick={() => setActivePropertyDetail(p)}
                      >
                        <Eye className="size-3.5" /> Open In-Page 3D Studio
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>RERA: {p.reraId as string || "MAHARERA/2026"}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-emerald-600 hover:bg-emerald-50"
                          title="Share on WhatsApp"
                          onClick={() => {
                            const msg = `Check out this ${p.propertyType || "Property"} at ${p.location || p.propertyAddress}: ${formatINR(p.listingPrice)}`
                            toast.info("Select a lead in the CRM to share this property through official WhatsApp.")
                          }}
                        >
                          <MessageSquare className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Edit Property"
                          onClick={() => handleOpenBuilder(p)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-600 hover:bg-rose-50"
                          title="Delete Property"
                          onClick={() => deleteMutation.mutate(id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Matrix Data Grid Table View */
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs">
                <TableHead>Property / Project Title</TableHead>
                <TableHead>Builder / Developer</TableHead>
                <TableHead>Typology & Location</TableHead>
                <TableHead>Tower & Floor Level</TableHead>
                <TableHead>Specs (Carpet Area / Facing)</TableHead>
                <TableHead>Listing Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const id = recordId(p)
                const st = String(p.status || p.propertyStatus || "Available")
                const isAvailable = st.toLowerCase().includes("available")

                return (
                  <TableRow
                    key={id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => {
                      setSelectedProperty(p)
                      setActivePhotoIdx(0)
                      setDetailsOpen(true)
                    }}
                  >
                    <TableCell>
                      <div className="font-bold text-black">{p.title as string || p.propertyAddress as string}</div>
                      <div className="text-xs text-muted-foreground">RERA: {p.reraId as string || "MAHARERA/2026/08941"}</div>
                    </TableCell>
                    <TableCell className="font-medium text-xs text-blue-700">
                      {p.builder as string || "Oberoi Realty"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-black">{p.propertyType as string || "Apartment"}</div>
                      <div className="text-muted-foreground">{p.location as string || p.propertyAddress as string}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <div>{p.towerName as string || "Tower A"} &bull; Unit #{p.unitNumber as string || "1402"}</div>
                      <div className="text-muted-foreground">Floor {p.floorNumber as string || "Not set"} of {p.totalFloors as string || "Not set"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-bold">{p.bedrooms as string || "3"} BHK &bull; {p.carpetArea as string || "1850"} sq.ft.</div>
                      <div className="text-muted-foreground">Facing: {p.facing as string || "East"}</div>
                    </TableCell>
                    <TableCell className="font-display font-bold text-sm text-black">
                      {formatINR(p.listingPrice)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isAvailable ? "default" : "secondary"} className={isAvailable ? "bg-emerald-600 text-white" : ""}>
                        {st.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => {
                            setSelectedProperty(p)
                            setActivePhotoIdx(0)
                            setDetailsOpen(true)
                          }}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => handleOpenBuilder(p)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-600"
                          onClick={() => deleteMutation.mutate(id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Property & Unit Matrix Editor Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Property Inventory Listing" : "Add Property to Catalog"}</DialogTitle>
            <DialogDescription>Multi-location, builder, floor level, and photo gallery manager.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs font-semibold">Property Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold">Onboarded Developer / Builder *</Label>
                <Select value={builder} onValueChange={setBuilder}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select onboarded developer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Oberoi Realty">Oberoi Realty</SelectItem>
                    <SelectItem value="Prestige Group">Prestige Group</SelectItem>
                    <SelectItem value="Godrej Properties">Godrej Properties</SelectItem>
                    <SelectItem value="Harbourline Holdings">Harbourline Holdings</SelectItem>
                    <SelectItem value="Northstar Living">Northstar Living</SelectItem>
                    <SelectItem value="Crescent Family Office">Crescent Family Office</SelectItem>
                    <SelectItem value="DLF Limited">DLF Limited</SelectItem>
                    <SelectItem value="Sobha Limited">Sobha Limited</SelectItem>
                    <SelectItem value="Lodha Group">Lodha Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Label className="flex items-start gap-2 rounded-xl border p-3 text-xs">
              <Checkbox checked={published} onCheckedChange={(value) => setPublished(Boolean(value))} />
              <span>
                <strong className="block">Publish in buyer portal</strong>
                Only verified, customer-ready listings should be publicly discoverable.
              </span>
            </Label>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs font-semibold">Micro-Market / Location *</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select micro-market" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bandra West, Mumbai">Bandra West, Mumbai</SelectItem>
                    <SelectItem value="Worli, Mumbai">Worli, Mumbai</SelectItem>
                    <SelectItem value="Bandra Kurla Complex, Mumbai">Bandra Kurla Complex, Mumbai</SelectItem>
                    <SelectItem value="Powai, Mumbai">Powai, Mumbai</SelectItem>
                    <SelectItem value="Alibaug, Raigad">Alibaug, Raigad</SelectItem>
                    <SelectItem value="Lower Parel, Mumbai">Lower Parel, Mumbai</SelectItem>
                    <SelectItem value="Juhu, Mumbai">Juhu, Mumbai</SelectItem>
                    <SelectItem value="Thane West, MMR">Thane West, MMR</SelectItem>
                    <SelectItem value="DLF Phase 5, Gurgaon">DLF Phase 5, Gurgaon</SelectItem>
                    <SelectItem value="Whitefield, Bengaluru">Whitefield, Bengaluru</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold">Property Typology *</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apartment">Apartment / Flat</SelectItem>
                    <SelectItem value="Villa">Villa / Independent House</SelectItem>
                    <SelectItem value="Penthouse">Penthouse</SelectItem>
                    <SelectItem value="Commercial">Commercial Space</SelectItem>
                    <SelectItem value="Plot">Land / Plot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold">Listing Price (₹ INR) *</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="font-mono" />
              </div>
            </div>

            {/* Floor level & Tower matrix */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="mb-1 block text-xs font-semibold">Tower / Block</Label>
                <Select value={towerName} onValueChange={setTowerName}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select tower" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tower A">Tower A</SelectItem>
                    <SelectItem value="Tower B">Tower B</SelectItem>
                    <SelectItem value="Tower C">Tower C</SelectItem>
                    <SelectItem value="North Tower">North Tower</SelectItem>
                    <SelectItem value="South Tower">South Tower</SelectItem>
                    <SelectItem value="Grand Horizon">Grand Horizon</SelectItem>
                    <SelectItem value="Villa Suite">Villa Suite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold">Floor Number</Label>
                <Input value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold">Total Floors</Label>
                <Input value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold">Unit Number</Label>
                <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Bedrooms (BHK)</Label>
                <Input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Carpet Area (sq.ft.)</Label>
                <Input value={carpetArea} onChange={(e) => setCarpetArea(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Vastu Facing</Label>
                <Select value={facing} onValueChange={setFacing}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="East">East Facing</SelectItem>
                    <SelectItem value="North-East">North-East Facing</SelectItem>
                    <SelectItem value="North">North Facing</SelectItem>
                    <SelectItem value="West">West Facing</SelectItem>
                    <SelectItem value="South">South Facing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Under Offer">Under Offer</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative">
              <Label className="mb-1 block text-xs">Full Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => window.setTimeout(() => setAddressSuggestions([]), 150)}
                placeholder="Start typing an address to search OpenStreetMap"
                autoComplete="off"
              />
              {(isSearchingAddress || addressSuggestions.length > 0) && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                  {isSearchingAddress && addressSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Searching OpenStreetMap…</div>
                  ) : (
                    addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          skipNextAddressSearch.current = true
                          setAddress(suggestion.label)
                          setLocation(suggestion.label)
                          setLatitude(suggestion.latitude === undefined ? "" : String(suggestion.latitude))
                          setLongitude(suggestion.longitude === undefined ? "" : String(suggestion.longitude))
                          setAddressSuggestions([])
                        }}
                      >
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-600" />
                        <span>{suggestion.label}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">Address data © OpenStreetMap contributors via Geoapify.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Map Latitude</Label>
                <Input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" placeholder="19.0760" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Map Longitude</Label>
                <Input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" placeholder="72.8777" />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">RERA Registration Number</Label>
              <Input value={reraId} onChange={(e) => setReraId(e.target.value)} className="font-mono" />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Property Description & Highlights</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
            <Button
              className="bg-black text-white hover:bg-black/90"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property HD Gallery & Full Specs Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedProperty && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl font-bold">{selectedProperty.title as string || selectedProperty.propertyAddress as string}</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Developed by <strong className="text-black">{selectedProperty.builder as string || "Oberoi Realty"}</strong> &bull; {selectedProperty.location as string || selectedProperty.propertyAddress as string}
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold text-emerald-600">{formatINR(selectedProperty.listingPrice)}</div>
                    <Badge variant="outline" className="text-[10px] uppercase">{String(selectedProperty.status || "Available")}</Badge>
                  </div>
                </div>
              </DialogHeader>

              {/* Tabs: Photo Gallery, Floor Plan, Location Map, Unit Specs */}
              <Tabs defaultValue="gallery" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="gallery" className="gap-1.5 text-xs"><Image className="size-3.5" /> Photo Gallery</TabsTrigger>
                  <TabsTrigger value="location" className="gap-1.5 text-xs"><MapPin className="size-3.5" /> OpenStreetMap Pointer</TabsTrigger>
                  <TabsTrigger value="floorplan" className="gap-1.5 text-xs"><Ruler className="size-3.5" /> Floor Plan Blueprints</TabsTrigger>
                  <TabsTrigger value="specs" className="gap-1.5 text-xs"><Layers className="size-3.5" /> Floor Level & Unit Matrix</TabsTrigger>
                </TabsList>

                {/* OpenStreetMap Location Pointer Tab */}
                <TabsContent value="location" className="pt-3 space-y-3">
                  <PropertyLeafletMap
                    address={String(selectedProperty.location || selectedProperty.propertyAddress || "Bandra West, Mumbai")}
                    title={String(selectedProperty.title || selectedProperty.propertyAddress || "Real Estate Listing")}
                    price={selectedProperty.listingPrice}
                    bhk={selectedProperty.bedrooms}
                    carpetArea={selectedProperty.carpetArea}
                    builder={String(selectedProperty.builder || "Oberoi Realty")}
                    photoUrl={Array.isArray(selectedProperty.propertyPhotos) && selectedProperty.propertyPhotos.length ? selectedProperty.propertyPhotos[0] : DEFAULT_PROPERTY_PHOTOS[0]}
                    latitude={Number(selectedProperty.latitude) || undefined}
                    longitude={Number(selectedProperty.longitude) || undefined}
                    className="h-[420px] w-full rounded-xl overflow-hidden border shadow-sm"
                  />
                </TabsContent>

                {/* Photo Gallery Tab */}
                <TabsContent value="gallery" className="pt-3 space-y-3">
                  {(() => {
                    const photos = Array.isArray(selectedProperty.propertyPhotos) && (selectedProperty.propertyPhotos as string[]).length > 0
                      ? (selectedProperty.propertyPhotos as string[])
                      : DEFAULT_PROPERTY_PHOTOS

                    return (
                      <div className="space-y-3">
                        <div className="relative h-[420px] w-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
                          <img src={photos[activePhotoIdx] || photos[0]} alt="Property" className="h-full w-full object-cover" />

                          {photos.length > 1 && (
                            <>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="absolute left-3 size-8 rounded-full bg-black/60 text-white hover:bg-black/90"
                                onClick={() => setActivePhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1))}
                              >
                                <ChevronLeft className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="absolute right-3 size-8 rounded-full bg-black/60 text-white hover:bg-black/90"
                                onClick={() => setActivePhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1))}
                              >
                                <ChevronRight className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Photo Thumbnails Strip */}
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {photos.map((url, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActivePhotoIdx(idx)}
                              className={`relative h-16 w-24 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${idx === activePhotoIdx ? "border-black scale-95" : "border-transparent opacity-60"}`}
                            >
                              <img src={url} alt={`Thumb ${idx}`} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </TabsContent>

                {/* Floor Plan Tab */}
                <TabsContent value="floorplan" className="pt-3">
                  <div className="bg-zinc-100 p-4 rounded-lg flex flex-col items-center justify-center min-h-[350px]">
                    <img
                      src={DEFAULT_FLOOR_PLANS[0]}
                      alt="Floor Plan"
                      className="max-h-[380px] w-auto object-contain rounded border shadow-md bg-white"
                    />
                    <p className="text-xs text-muted-foreground mt-3 font-mono">
                      Architectural Floor Plan Blueprint &bull; Carpet Area: {selectedProperty.carpetArea as string || "1850"} sq.ft.
                    </p>
                  </div>
                </TabsContent>

                {/* Specs Tab */}
                <TabsContent value="specs" className="pt-3 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 border">
                    <div className="space-y-2">
                      <p><strong>Builder / Developer:</strong> {selectedProperty.builder as string || "Oberoi Realty"}</p>
                      <p><strong>Micro-Market:</strong> {selectedProperty.location as string || selectedProperty.propertyAddress as string}</p>
                      <p><strong>Property Typology:</strong> {selectedProperty.propertyType as string || "Apartment"}</p>
                      <p><strong>RERA Registration ID:</strong> <span className="font-mono">{selectedProperty.reraId as string || "MAHARERA/PRM/2026/08941"}</span></p>
                    </div>

                    <div className="space-y-2">
                      <p><strong>Tower / Block:</strong> {selectedProperty.towerName as string || "Tower A"}</p>
                      <p><strong>Floor Level:</strong> Floor {selectedProperty.floorNumber as string || "Not set"} of {selectedProperty.totalFloors as string || "Not set"}</p>
                      <p><strong>Unit Number:</strong> #{selectedProperty.unitNumber as string || "1402"}</p>
                      <p><strong>Vastu Facing:</strong> {selectedProperty.facing as string || "East"}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50 p-4 border text-zinc-800">
                    <p className="font-bold text-sm mb-1">Description & Key Highlights</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{selectedProperty.description as string || "Premium luxury residence equipped with modern amenities."}</p>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5 text-xs"
                  onClick={() => {
                    const msg = `Inquiry regarding ${selectedProperty.title || selectedProperty.propertyAddress}: ${formatINR(selectedProperty.listingPrice)}`
                    toast.info("Select a customer lead to send this property through the official WhatsApp thread.")
                  }}
                >
                  <MessageSquare className="size-3.5" /> Share via WhatsApp
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
