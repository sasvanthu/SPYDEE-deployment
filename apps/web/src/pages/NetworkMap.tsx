import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import {
  MapPin,
  Layers,
  Radio,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  X,
  Crosshair,
  Sliders,
  ChevronRight,
  Eye,
  Activity,
  Video,
  User,
  Truck,
  AlertTriangle,
  Wifi,
  Zap,
  Target,
  Settings,
  Minus,
  Plus,
  Download,
  Filter,
  Search,
  Map,
  Layers as LayersIcon,
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const ENTITY_MARKER_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  person: { color: '#06b6d4', icon: <User className="w-3.5 h-3.5" />, label: 'PERSON' },
  phone_sim: { color: '#3b82f6', icon: <Wifi className="w-3.5 h-3.5" />, label: 'PHONE' },
  sim: { color: '#6366f1', icon: <Wifi className="w-3.5 h-3.5" />, label: 'SIM' },
  device: { color: '#a855f7', icon: <Zap className="w-3.5 h-3.5" />, label: 'DEVICE' },
  account: { color: '#eab308', icon: <Target className="w-3.5 h-3.5" />, label: 'ACCOUNT' },
  location: { color: '#22c55e', icon: <MapPin className="w-3.5 h-3.5" />, label: 'LOCATION' },
  tower: { color: '#22c55e', icon: <Wifi className="w-3.5 h-3.5" />, label: 'TOWER' },
  vehicle: { color: '#f97316', icon: <Truck className="w-3.5 h-3.5" />, label: 'VEHICLE' },
  cctv: { color: '#9ca3af', icon: <Video className="w-3.5 h-3.5" />, label: 'CCTV' },
  event: { color: '#ef4444', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'EVENT' },
};

function createCustomIcon(html: string, size: [number, number] = [28, 28], anchor: [number, number] = [14, 14]) {
  const L = (window as any).L;
  return L.divIcon({
    className: '',
    html,
    iconSize: size,
    iconAnchor: anchor,
  });
}

function getActivityColor(count: number): string {
  if (count >= 50) return '#ef4444';
  if (count >= 30) return '#f97316';
  if (count >= 15) return '#f59e0b';
  if (count >= 5) return '#22c55e';
  return '#06b6d4';
}

export default function NetworkMap() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Layer toggles
  const [showTowers, setShowTowers] = useState(true);
  const [showPersons, setShowPersons] = useState(true);
  const [showCCTV, setShowCCTV] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showColocations, setShowColocations] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);

  // Temporal Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [showSidePanel, setShowSidePanel] = useState(false);

  const { data: entities, isLoading, refetch } = useQuery({
    queryKey: ['entities', caseId],
    queryFn: () => api.getEntities(caseId!),
    enabled: !!caseId,
  });

  const { data: cctvData } = useQuery({
    queryKey: ['cctv-observations', caseId],
    queryFn: () => api.getCCTVObservations(caseId!),
    enabled: !!caseId,
  });

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  // CCTV observations from API (with fallback to mock)
  const cctvObservations = useMemo(() => {
    if (cctvData && cctvData.length > 0) {
      return cctvData.map((obs: any) => ({
        id: obs.id,
        label: obs.id,
        location: obs.location,
        lat: obs.lat,
        lon: obs.lon,
        timestamp: obs.timestamp,
        signals: obs.signals,
        confidence: obs.confidence,
      }));
    }
    // Fallback mock data
    return [
      { id: 'CCTV-118', label: 'CCTV-118', location: 'Tower X vicinity', lat: 18.5314, lon: 73.8446, timestamp: '2026-03-14T22:11:00Z', signals: { appearance: 0.72, telecom: 0.65, temporal: 0.91 }, confidence: 'MEDIUM' },
      { id: 'CCTV-119', label: 'CCTV-119', location: 'Deccan Gymkhana', lat: 18.5173, lon: 73.8418, timestamp: '2026-03-14T21:45:00Z', signals: { appearance: 0.85, telecom: 0.40, temporal: 0.88 }, confidence: 'HIGH' },
      { id: 'CCTV-120', label: 'CCTV-120', location: 'Swargate Hub', lat: 18.5018, lon: 73.8585, timestamp: '2026-03-14T23:02:00Z', signals: { appearance: 0.45, telecom: 0.72, temporal: 0.95 }, confidence: 'LOW' },
    ];
  }, [cctvData]);

  // Mock co-location events
  const colocationEvents = useMemo(() => [
    { id: 'COL-001', lat: 18.5173, lon: 73.8418, label: 'CO-LOCATED ×6', entities: ['P-1042', 'P-1097'], timestamp: '2026-03-14T21:40:00Z', count: 6 },
    { id: 'COL-002', lat: 18.5314, lon: 73.8446, label: 'CO-LOCATED ×3', entities: ['P-1042', 'D-021'], timestamp: '2026-03-14T22:10:00Z', count: 3 },
    { id: 'COL-003', lat: 18.5018, lon: 73.8585, label: 'CO-LOCATED ×2', entities: ['P-1097', 'D-044'], timestamp: '2026-03-15T00:15:00Z', count: 2 },
  ], []);

  // Mock trajectory data for entities
  const trajectories = useMemo(() => [
    { entityId: 'P-1042', label: 'RAVI KUMAR', color: '#06b6d4', path: [
      { lat: 18.5314, lon: 73.8446, time: 0, tower: 'TW-01' },
      { lat: 18.5173, lon: 73.8418, time: 1, tower: 'TW-02' },
      { lat: 18.5018, lon: 73.8585, time: 2, tower: 'TW-03' },
      { lat: 18.5132, lon: 73.8789, time: 3, tower: 'TW-04' },
      { lat: 18.5362, lon: 73.8938, time: 4, tower: 'TW-05' },
    ]},
    { entityId: 'P-1097', label: 'SURESH PATIL', color: '#06b6d4', path: [
      { lat: 18.5173, lon: 73.8418, time: 1, tower: 'TW-02' },
      { lat: 18.5018, lon: 73.8585, time: 2, tower: 'TW-03' },
      { lat: 18.5132, lon: 73.8789, time: 3, tower: 'TW-04' },
    ]},
    { entityId: 'D-021', label: 'DEVICE D-021', color: '#a855f7', path: [
      { lat: 18.5314, lon: 73.8446, time: 0, tower: 'TW-01' },
      { lat: 18.5173, lon: 73.8418, time: 1, tower: 'TW-02' },
    ]},
  ], []);

  const timeSteps = [0, 1, 2, 3, 4, 5];
  const timeLabels = ['T-30', 'T-7', 'T-1', 'INC', 'T+1', 'T+7'];

  useEffect(() => {
    if ((window as any).L) { setLeafletReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([18.5204, 73.8567], 13);
    
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);

    // Force map to recalculate size after container is ready
    setTimeout(() => { map.invalidateSize(); }, 100);
    
    mapInstance.current = map;
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [leafletReady]);

  // Render all markers and layers
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;
    const map = mapInstance.current;

    // Clear existing layers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle || layer instanceof L.Polygon) {
        map.removeLayer(layer);
      }
    });

    const bounds: number[][] = [];

    // 1. CELL TOWER MARKERS
    if (showTowers) {
      const towerEntities = (entities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'tower' || type === 'location';
      });

      const displayTowers = towerEntities.length > 0 ? towerEntities : [
        { id: 'TW-01', label: 'TOWER SHIVAJINAGAR 04', lat: 18.5314, lon: 73.8446, azimuth: 120, carrier: 'AIRTEL 4G', calls: 38, active_devices: 12 },
        { id: 'TW-02', label: 'TOWER DECCAN GYMKHANA 09', lat: 18.5173, lon: 73.8418, azimuth: 45, carrier: 'JIO 5G', calls: 24, active_devices: 8 },
        { id: 'TW-03', label: 'TOWER SWARGATE HUB 02', lat: 18.5018, lon: 73.8585, azimuth: 270, carrier: 'VODAFONE 4G', calls: 52, active_devices: 18 },
        { id: 'TW-04', label: 'TOWER CAMP CANTONMENT 07', lat: 18.5132, lon: 73.8789, azimuth: 180, carrier: 'AIRTEL 4G', calls: 19, active_devices: 5 },
        { id: 'TW-05', label: 'TOWER KOREGAON PARK 11', lat: 18.5362, lon: 73.8938, azimuth: 310, carrier: 'JIO 5G', calls: 64, active_devices: 22 },
      ];

      displayTowers.forEach((t: any) => {
        const lat = Number(t.lat ?? t.attributes?.lat ?? t.attributes?.latitude);
        const lon = Number(t.lon ?? t.attributes?.lon ?? t.attributes?.longitude);
        bounds.push([lat, lon]);

        const activityColor = getActivityColor(t.calls || t.active_devices || 0);
        
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:2px solid ${activityColor};background:#060a06;color:${activityColor};font-family:monospace;font-size:12px;font-weight:bold;box-shadow:0 0 12px ${activityColor}80;border-radius:2px;">▲</div>`,
          [28, 28],
          [14, 14]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);
        
        marker.on('click', () => {
          setSelectedMarker({
            type: 'tower',
            id: t.id || 'TW-UNKNOWN',
            label: t.label || 'UNKNOWN TOWER',
            lat, lon,
            azimuth: t.azimuth || 120,
            carrier: t.carrier || 'UNKNOWN',
            calls: t.calls || 0,
            active_devices: t.active_devices || 0,
            beamwidth: '65°',
            range: '2.4 KM',
            cdr_events: t.calls || 0,
            connected_entities: t.connected_entities || ['P-1042', 'P-1097', 'D-021'],
            timestamp_range: '2026-03-14 21:30 - 2026-03-14 23:00',
          });
        });

        // Sector coverage cone
        if (showTowers) {
          L.circle([lat, lon], {
            radius: 900,
            color: activityColor,
            weight: 1,
            fillColor: activityColor,
            fillOpacity: 0.08,
            dashArray: '3, 6',
          }).addTo(map);
        }
      });
    }

    // 2. CCTV OBSERVATION MARKERS
    if (showCCTV) {
      cctvObservations.forEach((cctv: any) => {
        bounds.push([cctv.lat, cctv.lon]);
        const confColor = cctv.confidence === 'HIGH' ? '#22c55e' : cctv.confidence === 'MEDIUM' ? '#f59e0b' : '#ef4444';
        
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:2px solid ${confColor};background:#060a06;color:${confColor};font-family:monospace;font-size:11px;font-weight:bold;box-shadow:0 0 10px ${confColor}80;border-radius:2px;">◈</div>`,
          [26, 26],
          [13, 13]
        );

        const marker = L.marker([cctv.lat, cctv.lon], { icon }).addTo(map);
        
        marker.on('click', () => {
          setSelectedMarker({
            type: 'cctv',
            ...cctv,
            status: 'inferred — not confirmed',
            contributing_signals: 3,
          });
        });

        // Pulsing ring for CCTV
        const circle = L.circle([cctv.lat, cctv.lon], {
          radius: 150,
          color: confColor,
          weight: 1.5,
          fillColor: confColor,
          fillOpacity: 0.1,
          dashArray: '5, 5',
          className: 'cctv-pulse',
        }).addTo(map);
      });
    }

    // 3. PERSON/SUSPECT LOCATION MARKERS
    if (showPersons) {
      const personEntities = (entities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'person' || type === 'alias';
      });

      personEntities.forEach((p: any) => {
        const lat = Number(p.attributes?.lat ?? p.attributes?.latitude);
        const lon = Number(p.attributes?.lon ?? p.attributes?.longitude);
        if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return;
        
        bounds.push([lat, lon]);
        const config = ENTITY_MARKER_CONFIG.person;
        
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid ${config.color};background:#060a06;color:${config.color};font-family:monospace;font-size:10px;font-weight:bold;box-shadow:0 0 10px ${config.color}80;border-radius:50%;">●</div>`,
          [24, 24],
          [12, 12]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);
        
        marker.on('click', () => {
          setSelectedMarker({
            type: 'person',
            id: p.id,
            label: p.label,
            lat, lon,
            entity_type: p.entity_type,
            review_state: p.review_state,
            confidence: p.confidence || 0.85,
            last_seen: p.attributes?.last_seen || '2026-03-14 22:11',
            evidence_type: 'CDR + Tower',
          });
          setSelectedEntityId(p.id);
          setShowSidePanel(true);
        });
      });
    }

    // 4. EVENT MARKERS
    if (showEvents) {
      const eventEntities = (entities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'event';
      });

      // Also add mock case events
      const mockEvents = [
        { id: 'EVT-001', label: 'INCIDENT: THEFT REPORTED', lat: 18.5173, lon: 73.8418, timestamp: '2026-03-14T22:00:00Z', details: 'FIR filed at Deccan Police Station', type: 'incident' },
        { id: 'EVT-002', label: 'TRANSACTION: ATM WITHDRAWAL', lat: 18.5314, lon: 73.8446, timestamp: '2026-03-14T21:30:00Z', details: 'INR 25,000 withdrawn', type: 'financial' },
        { id: 'EVT-003', label: 'MEETING: SUSPECT CONVERGENCE', lat: 18.5018, lon: 73.8585, timestamp: '2026-03-15T00:15:00Z', details: '3 targets in proximity', type: 'meeting' },
      ];

      [...eventEntities, ...mockEvents].forEach((evt: any) => {
        const lat = Number(evt.lat ?? evt.attributes?.lat ?? evt.attributes?.latitude);
        const lon = Number(evt.lon ?? evt.attributes?.lon ?? evt.attributes?.longitude);
        if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return;
        
        bounds.push([lat, lon]);
        const isIncident = evt.type === 'incident' || evt.label?.includes('INCIDENT');
        const color = isIncident ? '#ef4444' : '#f59e0b';
        const iconChar = isIncident ? '⚡' : '◆';
        
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid ${color};background:#060a06;color:${color};font-family:monospace;font-size:12px;font-weight:bold;box-shadow:0 0 10px ${color}80;border-radius:2px;">${iconChar}</div>`,
          [24, 24],
          [12, 12]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);
        
        marker.on('click', () => {
          setSelectedMarker({
            type: 'event',
            id: evt.id,
            label: evt.label,
            lat, lon,
            timestamp: evt.timestamp,
            details: evt.details,
            event_type: evt.type,
            connected_entities: evt.connected_entities || ['P-1042', 'P-1097'],
          });
        });
      });
    }

    // 5. TRAJECTORY VISUALIZATION
    if (showTrajectories) {
      trajectories.forEach((traj) => {
        const coords = traj.path.map((p) => [p.lat, p.lon]);
        if (coords.length < 2) return;

        // Draw full trajectory as dashed line
        const polyline = L.polyline(coords, {
          color: traj.color,
          weight: 2,
          opacity: 0.6,
          dashArray: '8, 8',
          className: 'trajectory-path',
        }).addTo(map);

        // Add animated arrow markers along the path
        coords.forEach((coord, i) => {
          if (i === coords.length - 1) return;
          const next = coords[i + 1];
          const angle = Math.atan2(next[1] - coord[1], next[0] - coord[0]) * 180 / Math.PI;
          
          L.marker(coord, {
            icon: createCustomIcon(
              `<div style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;color:${traj.color};font-family:monospace;font-size:10px;font-weight:bold;transform:rotate(${angle}deg);">▶</div>`,
              [16, 16],
              [8, 8]
            ),
          }).addTo(map);
        });

        // Add tower labels along trajectory
        traj.path.forEach((p, i) => {
          L.marker([p.lat, p.lon], {
            icon: createCustomIcon(
              `<div style="display:flex;align-items:center;justify-content:center;padding:2px 6px;background:#060a06;border:1px solid ${traj.color};color:${traj.color};font-family:monospace;font-size:8px;font-weight:bold;white-space:nowrap;border-radius:2px;">${p.tower}</div>`,
              [50, 18],
              [25, 9]
            ),
          }).addTo(map);
        });
      });
    }

    // 6. CO-LOCATION VISUALIZATION
    if (showColocations) {
      colocationEvents.forEach((col) => {
        bounds.push([col.lat, col.lon]);
        
        // Pulsing amber circle
        const circle = L.circle([col.lat, col.lon], {
          radius: 200,
          color: '#f59e0b',
          weight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.15,
          dashArray: '5, 5',
          className: 'colocation-pulse',
        }).addTo(map);

        // Label
        L.marker([col.lat, col.lon], {
          icon: createCustomIcon(
            `<div style="display:flex;align-items:center;justify-content:center;padding:2px 8px;background:#060a06;border:1px solid #f59e0b;color:#f59e0b;font-family:monospace;font-size:8px;font-weight:bold;white-space:nowrap;border-radius:2px;">${col.label}</div>`,
            [80, 20],
            [40, 10]
          ),
        }).addTo(map);

        circle.on('click', () => {
          setSelectedMarker({
            type: 'colocation',
            id: col.id,
            label: col.label,
            lat: col.lat,
            lon: col.lon,
            entities: col.entities,
            count: col.count,
            timestamp: col.timestamp,
          });
        });
      });
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
  }, [entities, leafletReady, showTowers, showPersons, showCCTV, showEvents, showTrajectories, showColocations, cctvObservations, colocationEvents, trajectories]);

  // Timeline animation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeIndex((prev) => (prev >= timeSteps.length - 1 ? 0 : prev + 1));
      }, 1500 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Filter entities for side panel based on time
  const activeEntities = useMemo(() => {
    if (!entities) return [];
    return (entities || []).filter((e: any) => {
      const type = (e.entity_type || '').toLowerCase();
      return ['person', 'phone_sim', 'sim', 'device', 'vehicle'].includes(type);
    }).slice(0, 10);
  }, [entities]);

  const toggleLayer = (layer: string) => {
    switch (layer) {
      case 'towers': setShowTowers(!showTowers); break;
      case 'persons': setShowPersons(!showPersons); break;
      case 'cctv': setShowCCTV(!showCCTV); break;
      case 'events': setShowEvents(!showEvents); break;
      case 'colocations': setShowColocations(!showColocations); break;
      case 'trajectories': setShowTrajectories(!showTrajectories); break;
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b] h-screen flex flex-col min-h-[100vh]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // GEOSPATIAL INTELLIGENCE
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            CELL TOWER, LOCATION & CDR MOVEMENT MAP
          </div>
          <div className="text-[10px] text-amber-500/80">
            TOWER MARKERS • CCTV OBSERVATIONS • PERSON LOCATIONS • EVENT MARKERS • TRAJECTORIES • CO-LOCATIONS
          </div>
        </div>

        {/* LAYER TOGGLE BUTTONS */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'towers', label: 'TOWERS', active: showTowers, activeClass: 'bg-amber-500 text-black font-bold border-amber-400', inactiveClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200' },
            { key: 'persons', label: 'PERSONS', active: showPersons, activeClass: 'bg-cyan-500 text-black font-bold border-cyan-400', inactiveClass: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 hover:text-cyan-200' },
            { key: 'cctv', label: 'CCTV', active: showCCTV, activeClass: 'bg-slate-500 text-black font-bold border-slate-400', inactiveClass: 'bg-slate-500/20 border-slate-500/40 text-slate-300 hover:bg-slate-500/30 hover:text-slate-200' },
            { key: 'events', label: 'EVENTS', active: showEvents, activeClass: 'bg-red-500 text-black font-bold border-red-400', inactiveClass: 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 hover:text-red-200' },
            { key: 'colocations', label: 'CO-LOCATIONS', active: showColocations, activeClass: 'bg-amber-500 text-black font-bold border-amber-400', inactiveClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200' },
            { key: 'trajectories', label: 'TRAJECTORIES', active: showTrajectories, activeClass: 'bg-violet-500 text-black font-bold border-violet-400', inactiveClass: 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30 hover:text-violet-200' },
          ].map(({ key, label, active, activeClass, inactiveClass }) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`px-2.5 py-1 text-[11px] border uppercase transition-colors ${active ? activeClass : inactiveClass}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER & TEMPORAL SCRUBBER BAR */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-500/70 uppercase">FILTER:</span>
          <select
            value={selectedEntityId || 'ALL'}
            onChange={(e) => { setSelectedEntityId(e.target.value === 'ALL' ? null : e.target.value); setShowSidePanel(true); }}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL ENTITIES</option>
            {activeEntities.map((e: any) => (
              <option key={e.id} value={e.id}>{e.label} ({ENTITY_MARKER_CONFIG[e.entity_type?.toLowerCase()]?.label || e.entity_type})</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-amber-500/30 text-[11px]">
            <span className="text-amber-500/70">DATE:</span>
            <input type="date" value={dateRange[0]} onChange={(e) => setDateRange([e.target.value, dateRange[1]])} className="bg-black border border-amber-500/40 text-amber-300 text-[10px] px-1 py-0.5 outline-none" />
            <span className="text-amber-500/70">TO</span>
            <input type="date" value={dateRange[1]} onChange={(e) => setDateRange([dateRange[0], e.target.value])} className="bg-black border border-amber-500/40 text-amber-300 text-[10px] px-1 py-0.5 outline-none" />
          </div>
        </div>

        {/* TEMPORAL SCRUBBER WITH PLAY/PAUSE */}
        <div className="flex items-center gap-2 bg-black/80 border border-amber-500/40 px-3 py-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 text-amber-400 hover:text-amber-200"
            title={isPlaying ? 'Pause' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[10px] text-amber-500/70">TIME:</span>
          <input
            type="range"
            min="0"
            max={timeSteps.length - 1}
            step="1"
            value={timeIndex}
            onChange={(e) => setTimeIndex(parseInt(e.target.value))}
            className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
          />

          <span className="text-[11px] font-bold text-amber-300 w-16 text-center">
            {timeLabels[timeIndex]}
          </span>

          <div className="flex gap-1 ml-2 border-l border-amber-500/30 pl-2">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.2 text-[9px] ${
                  playbackSpeed === spd
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-amber-500 hover:text-amber-300 bg-black/60 border border-amber-500/40'
                }`}
              >
                {spd}X
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN MAP WORKSPACE */}
      <div className="flex-1 min-h-[500px] grid grid-cols-1 lg:grid-cols-12 gap-3 relative">
        {/* MAP SIDE PANEL - Active Entities */}
        <div className="lg:col-span-3 xl:col-span-2 space-y-3 overflow-y-auto">
          <TerminalPanel title="ACTIVE ENTITIES ON MAP" subtitle={`TIME: ${timeLabels[timeIndex]}`}>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-amber-500/70 font-bold uppercase border-b border-amber-500/20 pb-1 mb-1">
                <span className="w-20">ENTITY</span>
                <span className="w-24">LAST LOCATION</span>
                <span className="w-16">TIME</span>
                <span>TYPE</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {activeEntities.map((e: any) => {
                    const lat = Number(e.attributes?.lat ?? e.attributes?.latitude);
                    const lon = Number(e.attributes?.lon ?? e.attributes?.longitude);
                    const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon) && lat != null && lon != null;
                    return (
                      <div
                        key={e.id}
                        onClick={() => {
                          setSelectedEntityId(e.id);
                          setShowSidePanel(true);
                          if (mapInstance.current && hasCoords) {
                            mapInstance.current.setView([lat, lon], 15);
                          }
                          // Also set selectedMarker so the detail drawer opens
                          setSelectedMarker({
                            type: 'person',
                            id: e.id,
                            label: e.label,
                            lat: hasCoords ? lat : 18.5204,
                            lon: hasCoords ? lon : 73.8567,
                            entity_type: e.entity_type,
                            review_state: e.review_state,
                            confidence: e.confidence || 0.85,
                            last_seen: e.attributes?.last_seen || '2026-03-14 22:11',
                            evidence_type: 'CDR + Tower',
                          });
                        }}
                        className={`p-1.5 cursor-pointer flex items-center gap-1.5 text-[10px] ${selectedEntityId === e.id ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-black/60 border border-amber-500/20 hover:border-amber-400'}`}
                      >
                        <span className="w-20 text-amber-300 font-bold truncate">{e.label}</span>
                        <span className="w-24 text-amber-500/80 truncate">{e.attributes?.last_location || 'Tower X vicinity'}</span>
                        <span className="w-16 text-amber-500/70">{e.attributes?.last_seen || '22:11'}</span>
                        <span className="flex items-center gap-1" style={{ color: ENTITY_MARKER_CONFIG[e.entity_type?.toLowerCase()]?.color || '#f59e0b' }}>
                          {ENTITY_MARKER_CONFIG[e.entity_type?.toLowerCase()]?.icon}
                          <span className="uppercase">{ENTITY_MARKER_CONFIG[e.entity_type?.toLowerCase()]?.label || e.entity_type}</span>
                        </span>
                      </div>
                    );
                  })}
                {activeEntities.length === 0 && (
                  <div className="p-2 text-amber-500/60 text-center text-[10px]">No active entities in current time window</div>
                )}
              </div>
            </div>
          </TerminalPanel>

          {/* FILTER CONTROLS PANEL */}
          <TerminalPanel title="MAP FILTERS" subtitle="VISIBILITY CONTROLS">
            <div className="space-y-2 text-xs">
              {[
                { key: 'towers', label: 'CELL TOWERS', active: showTowers, color: '#22c55e' },
                { key: 'persons', label: 'PERSONS/SUSPECTS', active: showPersons, color: '#06b6d4' },
                { key: 'cctv', label: 'CCTV OBSERVATIONS', active: showCCTV, color: '#9ca3af' },
                { key: 'events', label: 'CASE EVENTS', active: showEvents, color: '#ef4444' },
                { key: 'colocations', label: 'CO-LOCATIONS', active: showColocations, color: '#f59e0b' },
                { key: 'trajectories', label: 'TRAJECTORIES', active: showTrajectories, color: '#a855f7' },
              ].map(({ key, label, active, color }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-amber-500/10">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleLayer(key)}
                    className="accent-amber-500 w-3 h-3"
                  />
                  <span className="flex items-center gap-1.5" style={{ color }}>
                    <span className="w-2 h-2 rounded-none" style={{ backgroundColor: color }} />
                    <span className="text-amber-300">{label}</span>
                  </span>
                </label>
              ))}
              <div className="border-t border-amber-500/20 pt-2">
                <div className="text-[10px] text-amber-500/70 font-bold uppercase mb-1">DATE RANGE</div>
                <div className="space-y-1">
                  <input type="date" value={dateRange[0]} onChange={(e) => setDateRange([e.target.value, dateRange[1]])} className="w-full bg-black border border-amber-500/40 text-amber-300 text-[10px] px-1 py-0.5 outline-none" placeholder="From" />
                  <input type="date" value={dateRange[1]} onChange={(e) => setDateRange([dateRange[0], e.target.value])} className="w-full bg-black border border-amber-500/40 text-amber-300 text-[10px] px-1 py-0.5 outline-none" placeholder="To" />
                </div>
              </div>
            </div>
          </TerminalPanel>
        </div>

        {/* LEAFLET MAP CANVAS */}
        <div className={`${showSidePanel ? 'lg:col-span-7 xl:col-span-6' : 'lg:col-span-9 xl:col-span-8'} relative bg-[#060a06] border border-amber-500/35 overflow-hidden h-full min-h-[500px]`}>
          {!leafletReady && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20 text-xs text-amber-400">
              [ INITIALIZING SATELLITE TILES & TOPOGRAPHIC OVERLAYS... ]
            </div>
          )}

          <div ref={mapRef} className="w-full h-full min-h-[500px] select-none relative" />

          {/* FLOATING TOP-LEFT TELEMETRY HUD */}
          <div className="absolute top-3 left-3 z-[1000] p-2.5 bg-black/90 border border-amber-500/40 text-[10px] space-y-1 shadow-lg pointer-events-none">
            <div className="font-bold text-amber-300 uppercase flex items-center gap-1.5 border-b border-amber-500/30 pb-1">
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>ACTIVE CASE: {caseData?.case_code || caseId?.slice(0, 12)}</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>CENTER:</span>
              <span className="font-mono text-amber-300">18.5204° N, 73.8567° E</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>TIME WINDOW:</span>
              <span className="text-amber-300">{timeLabels[timeIndex]}</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>VISIBLE:</span>
              <span className="text-amber-300">{showTowers ? 'TWR' : '---'} | {showPersons ? 'PER' : '---'} | {showCCTV ? 'CCTV' : '---'} | {showEvents ? 'EVT' : '---'} | {showColocations ? 'COL' : '---'} | {showTrajectories ? 'TRAJ' : '---'}</span>
            </div>
          </div>

          {/* FLOATING CO-LOCATION WARNING ALERT */}
          {showColocations && (
            <div className="absolute bottom-3 left-3 right-3 z-[1000] p-2 bg-red-950/80 border border-red-500 text-xs text-red-300 flex items-center justify-between gap-2 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="font-bold">CO-LOCATION ALERT:</span>
                <span>{colocationEvents.length} co-location cluster(s) active in current time window</span>
              </div>
              <button
                onClick={() => {
                  const col = colocationEvents[0];
                  if (mapInstance.current) mapInstance.current.setView([col.lat, col.lon], 16);
                }}
                className="px-2 py-0.5 bg-red-500 text-black font-bold text-[10px] uppercase hover:bg-red-400"
              >
                INSPECT
              </button>
            </div>
          )}
        </div>

        {/* RIGHT DETAIL DRAWER */}
        {selectedMarker && (
          <div className="lg:col-span-5 xl:col-span-4 space-y-3 overflow-y-auto min-w-0">
            {selectedMarker.type === 'tower' && (
              <TerminalPanel
                title={`TOWER INTEL // ${selectedMarker.id}`}
                subtitle={selectedMarker.label}
                headerRight={<button onClick={() => setSelectedMarker(null)} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>}
              >
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 bg-black/60 border border-amber-500/20 space-y-1.5 text-[11px]">
                    <div className="flex justify-between"><span className="text-amber-500/70">CELL ID:</span><span className="font-mono text-amber-300">404-45-1029-{selectedMarker.id.slice(-5)}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">CARRIER:</span><span className="text-amber-300 font-bold">{selectedMarker.carrier}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">AZIMUTH / BEAM:</span><span className="text-amber-300">{selectedMarker.azimuth}° / {selectedMarker.beamwidth}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">EST. RADIUS:</span><span className="text-amber-300">{selectedMarker.range}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">CDR HITS:</span><span className="text-amber-300 font-bold">{selectedMarker.cdr_events} records</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">ACTIVE DEVICES:</span><span className="text-amber-300 font-bold">{selectedMarker.active_devices}</span></div>
                  </div>

                  <div className="p-2 bg-black/40 border border-amber-500/20 text-[10px] text-amber-500/80 leading-relaxed">
                    Notice: Tower dumps authenticated via Section 91 CrPC / Section 94 BNSS. Admissible in judicial proceedings.
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">CONNECTED ENTITIES:</div>
                    <div className="p-2 bg-black/60 border border-amber-500/20 text-[11px] space-y-1 max-h-40 overflow-y-auto">
                      {selectedMarker.connected_entities.map((ent: string) => (
                        <div key={ent} className="flex justify-between text-amber-300">
                          <span>{ent}</span>
                          <span className="text-amber-500">{selectedMarker.timestamp_range}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TerminalPanel>
            )}

            {selectedMarker.type === 'cctv' && (
              <TerminalPanel
                title={`CCTV OBSERVATION // ${selectedMarker.id}`}
                subtitle="Physical Observation — Synthetic Evidence Package"
                headerRight={<button onClick={() => setSelectedMarker(null)} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>}
              >
                <div className="space-y-3 text-xs">
                  <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-amber-500/70">LOCATION:</span><span className="text-amber-300">{selectedMarker.location}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">TIMESTAMP:</span><span className="text-amber-300 font-mono">{new Date(selectedMarker.timestamp).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">COORDINATES:</span><span className="text-amber-300 font-mono">{selectedMarker.lat.toFixed(4)}, {selectedMarker.lon.toFixed(4)}</span></div>
                  </div>

                  <div className="p-2 bg-black/40 border border-amber-500/20 text-[10px] text-amber-500/70">
                    [▶ OBSERVATION PREVIEW] Grayscale placeholder frame with bounding box overlay on candidate region — do NOT claim live video
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">SIGNALS:</div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-amber-500/70">Appearance similarity:</span><span className="text-amber-300 font-bold">{selectedMarker.signals.appearance}</span></div>
                      <div className="flex justify-between"><span className="text-amber-500/70">Telecom device presence:</span><span className="text-amber-300 font-bold">{selectedMarker.signals.telecom}</span></div>
                      <div className="flex justify-between"><span className="text-amber-500/70">Temporal overlap:</span><span className="text-amber-300 font-bold">{selectedMarker.signals.temporal}</span></div>
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] pt-1 border-t border-amber-500/20">
                    <span className="text-amber-500/70">Identity confidence:</span>
                    <span className="font-bold text-amber-300">{selectedMarker.confidence}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-amber-500/70">Contributing signals:</span>
                    <span className="text-amber-300">{selectedMarker.contributing_signals}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-amber-500/70">Status:</span>
                    <span className="text-amber-400">{selectedMarker.status}</span>
                  </div>

                  <div className="p-1.5 bg-black/80 border border-amber-500/40 text-[9px] text-amber-400 leading-tight">
                    CLASSIFICATION: <span className="font-bold text-amber-200">SYNTHETIC EVIDENCE PACKAGE</span> — NOT LIVE SURVEILLANCE. Inferred — not confirmed. Requires investigator verification.
                  </div>

                  <div className="flex gap-1">
                    <button className="flex-1 py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1"><Target className="w-3 h-3" /><span>VIEW IN GRAPH</span></button>
                    <button className="flex-1 py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1"><Search className="w-3 h-3" /><span>VIEW EVIDENCE</span></button>
                  </div>
                </div>
              </TerminalPanel>
            )}

            {selectedMarker.type === 'person' && (
              <TerminalPanel
                title={`ENTITY PROFILE // ${selectedMarker.id?.slice(0, 10)}`}
                subtitle={selectedMarker.entity_type}
                headerRight={<button onClick={() => { setSelectedMarker(null); setSelectedEntityId(null); setShowSidePanel(false); }} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>}
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-amber-500/20">
                    <div>
                      <div className="font-bold text-amber-300 text-sm truncate max-w-[180px]">{selectedMarker.label}</div>
                      <div className="text-[10px] text-amber-500/80">Type: {selectedMarker.entity_type}</div>
                    </div>
                    <StatusBadge status={selectedMarker.review_state || 'ACTIVE'} size="sm" />
                  </div>

                  <ConfidenceMeter value={selectedMarker.confidence || 0.85} label="INTELLIGENCE CONFIDENCE" />

                  <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-amber-500/70">IDENTIFIER:</span><span className="text-amber-300 font-mono">{selectedMarker.id}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">LAST SEEN:</span><span className="text-amber-300">{selectedMarker.last_seen}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">EVIDENCE TYPE:</span><span className="text-amber-300">{selectedMarker.evidence_type}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">COORDINATES:</span><span className="text-amber-300 font-mono">{selectedMarker.lat.toFixed(4)}, {selectedMarker.lon.toFixed(4)}</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => navigate(`/cases/${caseId}/entities`)} className="py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1"><span>OPEN DOSSIER</span><ChevronRight className="w-3 h-3" /></button>
                    <button onClick={() => navigate(`/cases/${caseId}/timeline?entity=${selectedMarker.id}`)} className="py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1"><span>VIEW TIMELINE</span><Clock className="w-3 h-3" /></button>
                  </div>
                </div>
              </TerminalPanel>
            )}

            {selectedMarker.type === 'event' && (
              <TerminalPanel
                title={`EVENT DETAIL // ${selectedMarker.id}`}
                subtitle={selectedMarker.event_type?.toUpperCase() || 'INCIDENT'}
                headerRight={<button onClick={() => setSelectedMarker(null)} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>}
              >
                <div className="space-y-3 text-xs">
                  <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-amber-500/70">EVENT:</span><span className="text-amber-300 font-bold">{selectedMarker.label}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">TIMESTAMP:</span><span className="text-amber-300 font-mono">{new Date(selectedMarker.timestamp).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">COORDINATES:</span><span className="text-amber-300 font-mono">{selectedMarker.lat.toFixed(4)}, {selectedMarker.lon.toFixed(4)}</span></div>
                  </div>

                  <div className="p-2 bg-black/60 border border-amber-500/20 text-[11px]">
                    <div className="text-amber-500/70 font-bold mb-1">DETAILS:</div>
                    <div className="text-amber-300">{selectedMarker.details}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">CONNECTED ENTITIES:</div>
                    <div className="p-2 bg-black/60 border border-amber-500/20 text-[11px] space-y-1">
                      {selectedMarker.connected_entities.map((ent: string) => (
                        <div key={ent} className="text-amber-300">{ent}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </TerminalPanel>
            )}

            {selectedMarker.type === 'colocation' && (
              <TerminalPanel
                title={`CO-LOCATION EVENT // ${selectedMarker.id}`}
                subtitle={`×${selectedMarker.count} ENTITIES`}
                headerRight={<button onClick={() => setSelectedMarker(null)} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>}
              >
                <div className="space-y-3 text-xs">
                  <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-amber-500/70">LOCATION:</span><span className="text-amber-300 font-mono">{selectedMarker.lat.toFixed(4)}, {selectedMarker.lon.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">TIMESTAMP:</span><span className="text-amber-300 font-mono">{new Date(selectedMarker.timestamp).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">CO-LOCATION COUNT:</span><span className="text-amber-300 font-bold">{selectedMarker.count}×</span></div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">CO-LOCATED ENTITIES:</div>
                    <div className="p-2 bg-black/60 border border-amber-500/20 text-[11px] space-y-1">
                      {selectedMarker.entities.map((ent: string) => (
                        <div key={ent} className="text-amber-300 font-bold">{ent}</div>
                      ))}
                    </div>
                  </div>

                  <div className="p-1.5 bg-black/80 border border-amber-500/40 text-[9px] text-amber-400 leading-tight">
                    This co-location indicates potential physical proximity. Cross-reference with CDR tower data and CCTV observations for verification.
                  </div>

                  <button className="w-full py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1"><span>VIEW HYPOTHESIS LINK</span><ChevronRight className="w-3 h-3" /></button>
                </div>
              </TerminalPanel>
            )}
          </div>
        )}

        </div>

      {/* TIME SLIDER OVERLAY - BELOW MAP */}
      <div className="p-2 bg-black/90 border border-amber-500/30 border-t-2 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-amber-500/70 font-bold">TIMELINE:</span>
          <div className="flex-1 flex items-center gap-2">
            {timeLabels.map((label, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                <div 
                  className={`w-3 h-3 rounded-none transition-all ${
                    i === timeIndex 
                      ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' 
                      : i < timeIndex 
                        ? 'bg-emerald-400' 
                        : 'bg-amber-500/30'
                  }`} 
                  style={{ borderRadius: '0' }}
                />
                <span className={`text-[8px] ${i === timeIndex ? 'text-amber-300 font-bold' : 'text-amber-500/60'}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}