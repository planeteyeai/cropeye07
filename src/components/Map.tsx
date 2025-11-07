import React, { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polygon, useMap, Circle } from "react-leaflet";
import { LatLngTuple, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Map.css";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import { useAppContext } from "../context/AppContext";
import { FaExpand } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';

// Add custom styles for the enhanced tooltip
const tooltipStyles = `
  .hover-tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 1000;
    pointer-events: none;
    max-width: 200px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .enhanced-tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.95);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 1000;
    pointer-events: none;
    max-width: 220px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(5px);
  }

  .enhanced-tooltip-line {
    margin: 3px 0;
    padding: 2px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 16px;
  }

  .enhanced-tooltip-line:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    padding-bottom: 4px;
    margin-bottom: 4px;
  }

.layer-name {
  font-weight: bold;
  color: #4CAF50;
  margin-right: 6px;
  min-width: 60px;
  font-size: 10px;
}

.layer-description {
  color: #e0e0e0;
  flex: 1;
  text-align: right;
  font-size: 10px;
  }
  
  @media (max-width: 768px) {
    .hover-tooltip {
      padding: 6px 8px;
      font-size: 10px;
      max-width: 150px;
    }
    
    .enhanced-tooltip {
      padding: 6px 8px;
      font-size: 10px;
      max-width: 160px;
    }
    
    .layer-name {
      min-width: 40px;
      font-size: 9px;
    }
    
    .layer-description {
      font-size: 9px;
    }
  }
  
  @media (max-width: 320px) {
    .hover-tooltip {
      padding: 4px 6px;
      font-size: 9px;
      max-width: 120px;
    }
    
    .enhanced-tooltip {
      padding: 2px 15px;
      font-size: 9px;
      max-width: 100px;
    }
    
    .layer-name {
      min-width: 30px;
      font-size: 8px;
    }
    
    .layer-description {
      font-size: 8px;
    }
  }
`;

// Inject styles if not already injected
if (typeof document !== 'undefined' && !document.querySelector('#map-tooltip-styles')) {
  const styleSheet = document.createElement("style");
  styleSheet.id = 'map-tooltip-styles';
  styleSheet.innerText = tooltipStyles;
  document.head.appendChild(styleSheet);
}

// Unified legend circle color (orange)
const LEGEND_CIRCLE_COLOR = '#F57C00';

const LAYER_LABELS: Record<string, string> = {
  Growth: "Growth",
  "Water Uptake": "Water Uptake",
  "Soil Moisture": "Soil Moisture",
  PEST: "Pest",
};

// Set fixed zoom level component
const SetFixedZoom: React.FC<{ coordinates: number[][] }> = ({ coordinates }) => {
  const map = useMap();

  useEffect(() => {
    if (!coordinates.length) return;

    const latlngs = coordinates
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map(([lng, lat]) => [lat, lng] as LatLngTuple)
      .filter((tuple: LatLngTuple) => !isNaN(tuple[0]) && !isNaN(tuple[1]));

    if (latlngs.length) {
      const centerLat = latlngs.reduce((sum, coord) => sum + coord[0], 0) / latlngs.length;
      const centerLng = latlngs.reduce((sum, coord) => sum + coord[1], 0) / latlngs.length;
      map.setView([centerLat, centerLng], 18, { animate: true, duration: 1.5 });
    }
  }, [coordinates, map]);

  return null;
};

// Function to check if a point is inside polygon
const isPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
};

interface MapProps {
  onHealthDataChange?: (data: any) => void;
  onSoilDataChange?: (data: any) => void;
  onFieldAnalysisChange?: (data: any) => void;
  onMoistGroundChange?: (percent: number) => void;
  onPestDataChange?: (data: any) => void;
}

const CustomTileLayer: React.FC<{
  url: string;
  opacity?: number;
  key?: string;
}> = ({ url, opacity = 0.7, key }) => {
  // console.log('CustomTileLayer URL:', url);

  if (!url) {
    // console.log('No URL provided to CustomTileLayer');
    return null;
  }

  return (
    <TileLayer
      key={key}
      url={url}
      opacity={opacity}
      maxZoom={22}
      minZoom={10}
      tileSize={256}
      eventHandlers={{
        tileerror: (e: any) => console.error('Tile loading error:', e),
        tileload: (e: any) => console.log('Tile loaded successfully'),
      }}
    />
  );
};

const Map: React.FC<MapProps> = ({
  onHealthDataChange,
  onSoilDataChange,
  onFieldAnalysisChange,
  onMoistGroundChange,
  onPestDataChange,
}) => {
  const { profile, loading: profileLoading } = useFarmerProfile();
  const { selectedPlotName, setSelectedPlotName } = useAppContext();
  const mapWrapperRef = useRef<HTMLDivElement>(null);

  const [plotData, setPlotData] = useState<any>(null);
  const [plotBoundary, setPlotBoundary] = useState<any>(null); // Separate state for plot boundary that persists
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter] = useState<LatLngTuple>([17.842832246588202, 74.91558702408217]);
  const [activeLayer, setActiveLayer] = useState<"Growth" | "Water Uptake" | "Soil Moisture" | "PEST">("Growth");

  // New state for different layer data
  const [growthData, setGrowthData] = useState<any>(null);
  const [waterUptakeData, setWaterUptakeData] = useState<any>(null);
  const [soilMoistureData, setSoilMoistureData] = useState<any>(null);
  const [pestData, setPestData] = useState<any>(null);

  const [hoveredPlotInfo, setHoveredPlotInfo] = useState<any>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedLegendClass, setSelectedLegendClass] = useState<string | null>(null);
  const [layerChangeKey, setLayerChangeKey] = useState(0);
  const [pixelTooltip, setPixelTooltip] = useState<{layers: Array<{layer: string, label: string, description: string, percentage: number}>, x: number, y: number} | null>(null);
  
  // Date navigation state (similar to Streamlit logic)
  const [currentEndDate, setCurrentEndDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [popupSide, setPopupSide] = useState<'left' | 'right' | null>(null);
  const DAYS_STEP = 15;

  useEffect(() => {
    setLayerChangeKey(prev => prev + 1);
    // Reset to current date when switching layers (for Growth, Water Uptake, Soil Moisture, and PEST)
    if (activeLayer === "Growth" || activeLayer === "Water Uptake" || activeLayer === "Soil Moisture" || activeLayer === "PEST") {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      setCurrentEndDate(todayStr);
    }
    
    // Ensure plotBoundary is preserved when switching layers
    // Try to extract from current layer data if plotBoundary is missing
    if (!plotBoundary && selectedPlotName) {
      if (activeLayer === "Growth" && growthData?.features?.[0]) {
        setPlotBoundary(growthData.features[0]);
      } else if (activeLayer === "Water Uptake" && waterUptakeData?.features?.[0]) {
        setPlotBoundary(waterUptakeData.features[0]);
      } else if (activeLayer === "Soil Moisture" && soilMoistureData?.features?.[0]) {
        setPlotBoundary(soilMoistureData.features[0]);
      } else if (activeLayer === "PEST" && pestData?.features?.[0]) {
        setPlotBoundary(pestData.features[0]);
      } else if (plotData?.features?.[0]) {
        // Fallback to plotData if available
        setPlotBoundary(plotData.features[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer, selectedPlotName]);

  // Fetch data when currentEndDate changes for Growth, Water Uptake, Soil Moisture, and PEST layers
  useEffect(() => {
    if (selectedPlotName && (activeLayer === "Growth" || activeLayer === "Water Uptake" || activeLayer === "Soil Moisture" || activeLayer === "PEST")) {
      console.log("Fetching data for layer:", activeLayer, "plot:", selectedPlotName, "end_date:", currentEndDate);
      if (activeLayer === "Growth") {
        fetchGrowthData(selectedPlotName);
      } else if (activeLayer === "Water Uptake") {
        fetchWaterUptakeData(selectedPlotName);
      } else if (activeLayer === "Soil Moisture") {
        fetchSoilMoistureData(selectedPlotName);
      } else if (activeLayer === "PEST") {
        fetchPestData(selectedPlotName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEndDate, activeLayer, selectedPlotName]);

  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Auto-select first plot from farmer profile if no plot is selected
  useEffect(() => {
    if (profileLoading || !profile) {
      return;
    }

    // If there's already a selected plot (from localStorage or context), use it
    if (selectedPlotName) {
      return;
    }

    const plotNames = profile.plots?.map(plot => plot.fastapi_plot_id) || [];
    const defaultPlot = plotNames.length > 0 ? plotNames[0] : null;
    
    if (defaultPlot) {
      setSelectedPlotName(defaultPlot);
      // Clear previous plot boundary when selecting a new plot
      setPlotBoundary(null);
      // Only fetch non-date-dependent layers here
      // Date-dependent layers (Growth, Water Uptake, Soil Moisture) will be fetched by the useEffect that watches currentEndDate
      fetchPestData(defaultPlot);
      fetchPlotData(defaultPlot);
      fetchFieldAnalysis(defaultPlot);
    }
  }, [profile, profileLoading, selectedPlotName, setSelectedPlotName]);

  // Removed fetchAllLayerData - date-dependent layers are now fetched by useEffect

  // Adjust date by ±15 days
  const isAtOrAfterCurrentDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const adjustDate = (days: number) => {
    const current = new Date(currentEndDate);
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const newDate = `${year}-${month}-${day}`;
    setCurrentEndDate(newDate);
    // Keep popup visible and update the value on each click
    setShowDatePopup(true);
  };

  const onLeftArrowClick = () => {
    setPopupSide('left');
    adjustDate(-DAYS_STEP);
  };

  const onRightArrowClick = () => {
    // Only allow forward navigation if we're not at or past the current date
    const today = getCurrentDate();
    const currentDate = new Date(currentEndDate);
    const todayDate = new Date(today);
    
    // Set both to midnight for accurate comparison
    currentDate.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    
    // If current date is before today, allow forward navigation
    if (currentDate < todayDate) {
      const nextDate = new Date(currentEndDate);
      nextDate.setDate(nextDate.getDate() + DAYS_STEP);
      
      // Don't go beyond today
      if (nextDate <= todayDate) {
        setPopupSide('right');
        adjustDate(DAYS_STEP);
      } else {
        // If next date would be beyond today, go to today instead
        setPopupSide('right');
        setCurrentEndDate(today);
        setShowDatePopup(true);
      }
    } else {
      // Already at or past current date, do nothing
      return;
    }
  };

  const fetchGrowthData = async (plotName: string) => {
    if (!plotName) return;

    try {
      console.log("Fetching growth data for plot:", plotName, "end_date:", currentEndDate);
      const resp = await fetch(
        `https://dev-plot.cropeye.ai/analyze_Growth?plot_name=${plotName}&end_date=${currentEndDate}&days_back=7`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!resp.ok) throw new Error(`Growth API failed: ${resp.status}`);

      const data = await resp.json();
      console.log("Growth API response:", data);
      setGrowthData(data);
      
      // Preserve plot boundary from growth data if not already set
      if (!plotBoundary && data?.features?.[0]?.geometry) {
        setPlotBoundary(data.features[0]);
      }
    } catch (err) {
      console.error("Error fetching growth data:", err);
      setGrowthData(null);
    }
  };

  const fetchWaterUptakeData = async (plotName: string) => {
    if (!plotName) return;

    try {
      console.log("Fetching water uptake data for plot:", plotName, "end_date:", currentEndDate);
      const resp = await fetch(
        `https://dev-plot.cropeye.ai/wateruptake?plot_name=${plotName}&end_date=${currentEndDate}&days_back=7`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!resp.ok) throw new Error(`Water Uptake API failed: ${resp.status}`);

      const data = await resp.json();
      console.log("Water Uptake API response:", data);
      setWaterUptakeData(data);
      
      // Preserve plot boundary from water uptake data if not already set
      if (!plotBoundary && data?.features?.[0]?.geometry) {
        setPlotBoundary(data.features[0]);
      }
    } catch (err) {
      console.error("Error fetching water uptake data:", err);
      setWaterUptakeData(null);
    }
  };

  const fetchSoilMoistureData = async (plotName: string) => {
    if (!plotName) return;

    try {
      console.log("Fetching soil moisture data for plot:", plotName, "end_date:", currentEndDate);
      const resp = await fetch(
        `https://dev-plot.cropeye.ai/SoilMoisture?plot_name=${plotName}&end_date=${currentEndDate}&days_back=7`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!resp.ok) throw new Error(`Soil Moisture API failed: ${resp.status}`);

      const data = await resp.json();
      console.log("Soil Moisture API response:", data);
      setSoilMoistureData(data);
      
      // Preserve plot boundary from soil moisture data if not already set
      if (!plotBoundary && data?.features?.[0]?.geometry) {
        setPlotBoundary(data.features[0]);
      }
    } catch (err) {
      console.error("Error fetching soil moisture data:", err);
      setSoilMoistureData(null);
    }
  };

  const fetchPlotData = async (plotName: string) => {
    setLoading(true);
    setError(null);

    try {
      const currentDate = getCurrentDate();
      const resp = await fetch(
        `https://dev-plot.cropeye.ai/analyze_Growth?plot_name=${plotName}&end_date=${currentDate}&days_back=7`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

      const data = await resp.json();
      setPlotData(data);
      
      // Preserve plot boundary separately so it persists across layer changes
      if (data?.features?.[0]?.geometry) {
        setPlotBoundary(data.features[0]);
      }
    } catch (err: any) {
      // console.error(err);
      setError(err.message);
      // Don't clear plotData or plotBoundary on error - keep existing plot visible
      // Only clear if this is a new plot selection
      if (!plotBoundary || plotBoundary.properties?.plot_name !== plotName) {
        setPlotData(null);
        setPlotBoundary(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldAnalysis = async (plotName: string) => {
    if (!plotName) return;

    try {
      // console.log("Fetching field analysis for plot:", plotName);
      const currentDate = getCurrentDate();
      const resp = await fetch(
        `https://dev-field.cropeye.ai/analyze?plot_name=${plotName}&end_date=${currentDate}&days_back=7`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!resp.ok) throw new Error(`Field analysis API failed: ${resp.status}`);

      const data = await resp.json();
      // console.log("Field analysis API response:", data);

      let fieldData: any = null;

      if (Array.isArray(data)) {
        const plotData = data.filter((item: any) => {
          const itemPlotName = item.plot_name || item.plot || item.name || '';
          return itemPlotName === plotName;
        });

        if (plotData.length > 0) {
          plotData.sort((a: any, b: any) => {
            const dateA = a.date || a.analysis_date || '';
            const dateB = b.date || b.analysis_date || '';
            return dateB.localeCompare(dateA);
          });

          fieldData = plotData[0];
        }
      } else if (typeof data === "object" && data !== null) {
        fieldData = data;
      }

      if (fieldData && onFieldAnalysisChange) {
        const overallHealth = fieldData?.overall_health ?? fieldData?.health_score ?? 0;
        const healthStatus = fieldData?.health_status ?? fieldData?.status ?? "Unknown";
        const meanValue = fieldData?.statistics?.mean ?? fieldData?.mean ?? 0;

        onFieldAnalysisChange({
          plotName: fieldData.plot_name ?? plotName,
          overallHealth,
          healthStatus,
          statistics: {
            mean: meanValue,
          },
        });
      }
    } catch (err) {
      // console.error("Error in fetchFieldAnalysis:", err);
    }
  };

  const fetchPestData = async (plotName: string) => {
    if (!plotName) {
      setPestData(null);
      return;
    }

    try {
      console.log("Fetching pest detection for plot:", plotName, "end_date:", currentEndDate);
      const resp = await fetch(
        `https://dev-plot.cropeye.ai/pest-detection?plot_name=${plotName}&end_date=${currentEndDate}&days_back=7`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!resp.ok) throw new Error(`Pest detection API failed: ${resp.status}`);

      const data = await resp.json();
      console.log("Pest detection API response:", data);
      setPestData(data);
      
      // Preserve plot boundary from pest data if not already set
      if (!plotBoundary && data?.features?.[0]?.geometry) {
        setPlotBoundary(data.features[0]);
      }

      if (data?.pixel_summary && onPestDataChange) {
        const chewingPestPercentage = data.pixel_summary.chewing_affected_pixel_percentage || 0;
        const suckingPercentage = data.pixel_summary.sucking_affected_pixel_percentage || 0;
        const fungiPercentage = data.pixel_summary.fungi_affected_pixel_percentage || 0;
        const soilBornePercentage = data.pixel_summary.SoilBorn_affected_pixel_percentage || 0;

        const totalAffectedPercentage = chewingPestPercentage + suckingPercentage + fungiPercentage + soilBornePercentage;
        
        onPestDataChange({
          plotName,
          pestPercentage: totalAffectedPercentage,
          healthyPercentage: 100 - totalAffectedPercentage,
          totalPixels: data.pixel_summary.total_pixel_count || 0,
          pestAffectedPixels: (data.pixel_summary.chewing_affected_pixel_count || 0) + 
                             (data.pixel_summary.sucking_affected_pixel_count || 0) + 
                             (data.pixel_summary.fungi_affected_pixel_count || 0) +  
                             (data.pixel_summary.SoilBorn_pixel_count || 0),
          chewingPestPercentage,
          chewingPestPixels: data.pixel_summary.chewing_affected_pixel_count || 0,
          suckingPercentage,
          suckingPixels: data.pixel_summary.sucking_affected_pixel_count || 0,
        });
      }
    } catch (err) {
      // console.error("Error in fetchPestData:", err);
      setPestData(null);
    }
  };

  const getActiveLayerUrl = () => {
    // Flexible extractor for tile URL from various possible shapes
    const extractTileUrl = (data: any): string | null => {
      if (!data || typeof data !== 'object') return null;

      // Common paths
      const candidates = [
        data?.features?.[0]?.properties?.tile_url,
        data?.features?.[0]?.properties?.tileURL,
        data?.features?.[0]?.properties?.tileServerUrl,
        data?.features?.[0]?.properties?.tiles,
        data?.properties?.tile_url,
        data?.tile_url,
        data?.tileURL,
        data?.tileServerUrl,
      ].filter(Boolean);

      // If tiles is an array, pick first
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) {
          return typeof c[0] === 'string' ? c[0] : null;
        }
        if (typeof c === 'string') {
          return c;
        }
      }
      return null;
    };

    let rawUrl: string | null = null;
    if (activeLayer === "PEST") rawUrl = extractTileUrl(pestData);
    else if (activeLayer === "Growth") rawUrl = extractTileUrl(growthData);
    else if (activeLayer === "Water Uptake") rawUrl = extractTileUrl(waterUptakeData);
    else if (activeLayer === "Soil Moisture") rawUrl = extractTileUrl(soilMoistureData);

    if (!rawUrl) {
      // console.warn(`[Map] No tile_url found for layer ${activeLayer}`);
      return null;
    }

    // Validate tile template contains placeholders
    const hasTemplate = rawUrl.includes('{z}') && rawUrl.includes('{x}') && rawUrl.includes('{y}');
    if (!hasTemplate) {
      // console.warn(`[Map] tile_url missing template placeholders for layer ${activeLayer}:`, rawUrl);
      return null;
    }

    return rawUrl;
  };

  // Use plotBoundary if available (persists across layer changes), otherwise fall back to plotData
  const currentPlotFeature = plotBoundary || plotData?.features?.[0];

  const legendData = useMemo(() => {
    if (activeLayer === "PEST") {
      const chewingPestPercentage = pestData?.pixel_summary?.chewing_affected_pixel_percentage || 0;
      const suckingPercentage = pestData?.pixel_summary?.sucking_affected_pixel_percentage || 0;
      const fungiPercentage = pestData?.pixel_summary?.fungi_affected_pixel_percentage || 0;
      const soilBornePercentage = pestData?.pixel_summary?.SoilBorn_affected_pixel_percentage || 0;
      
      return [
        { label: "Chewing", color: "#DC2626", percentage: Math.round(chewingPestPercentage), description: "Areas affected by chewing pests" },
        { label: "Sucking", color: "#B91C1C", percentage: Math.round(suckingPercentage), description: "Areas affected by sucking disease" },
        { label: "fungi", color: "#991B1B", percentage: Math.round(fungiPercentage), description: "fungi infections affecting plants" },
        { label: "Soil Borne", color: "#7F1D1D", percentage: Math.round(soilBornePercentage), description: "Soil borne infections affecting plants" }
      ];
    }

    if (activeLayer === "Water Uptake") {
      const pixelSummary = waterUptakeData?.pixel_summary;
      if (!pixelSummary) return [];

      return [
        { label: "Deficient", color: "#E6F3FF", percentage: Math.round(pixelSummary.deficient_pixel_percentage || 0), description: "weak root" },
        { label: "Less", color: "#87CEEB", percentage: Math.round(pixelSummary.less_pixel_percentage || 0), description: "weak roots" },
        { label: "Adequate", color: "#4682B4", percentage: Math.round(pixelSummary.adequat_pixel_percentage || 0), description: "healthy roots" },
        { label: "Excellent", color: "#1E90FF", percentage: Math.round(pixelSummary.excellent_pixel_percentage || 0), description: "healthy roots" },
        { label: "Excess", color: "#000080", percentage: Math.round(pixelSummary.excess_pixel_percentage || 0), description: "root logging" }
      ];
    }

    if (activeLayer === "Soil Moisture") {
      const pixelSummary = soilMoistureData?.pixel_summary;
      if (!pixelSummary) return [];

      return [
        { label: "Less", color: "#9fd4d2", percentage: Math.round(pixelSummary.less_pixel_percentage || 0), description: "less soil moisture" },
        { label: "Adequate", color: "#8fc7c5", percentage: Math.round(pixelSummary.adequate_pixel_percentage || 0), description: "Irrigation need" },
        { label: "Excellent", color: "#8fe3e0", percentage: Math.round(pixelSummary.excellent_pixel_percentage || 0), description: "no irrigation require" },
        { label: "Excess", color: "#74dbd8", percentage: Math.round(pixelSummary.excess_pixel_percentage || 0), description: "water logging" },
        { label: "Shallow", color: "#50f2ec", percentage: Math.round(pixelSummary.shallow_water_pixel_percentage || 0), description: "water source" }
      ];
    }

    if (activeLayer === "Growth") {
      const pixelSummary = growthData?.pixel_summary;
      if (!pixelSummary) return [];

      return [
        { label: "Weak", color: "#90EE90", percentage: Math.round(pixelSummary.weak_pixel_percentage || 0), description: "damaged or weak crop" },
        { label: "Stress", color: "#32CD32", percentage: Math.round(pixelSummary.stress_pixel_percentage || 0), description: "crop under stress" },
        { label: "Moderate", color: "#228B22", percentage: Math.round(pixelSummary.moderate_pixel_percentage || 0), description: "Crop under normal growth" },
        { label: "Healthy", color: "#006400", percentage: Math.round(pixelSummary.healthy_pixel_percentage || 0), description: "proper growth" }
      ];
    }

    return [];
  }, [activeLayer, pestData, waterUptakeData, soilMoistureData, growthData]);

  const getFilteredPixels = useMemo(() => {
    // console.log('getFilteredPixels called with:', { selectedLegendClass, activeLayer });
    
    if (!selectedLegendClass) {
      // console.log('No selectedLegendClass, returning empty array');
      return [];
    }

    if (activeLayer === "PEST") {
      if (!pestData || !currentPlotFeature) {
        // console.log('Missing pestData or currentPlotFeature');
        return [];
      }

      // console.log('Processing PEST layer for selectedLegendClass:', selectedLegendClass);
      
      if (!["Chewing", "Sucking", "fungi", "Soil Borne"].includes(selectedLegendClass)) {
        // console.log('SelectedLegendClass not in allowed pest categories:', selectedLegendClass);
        return [];
      }
      
      let coordinates = [];
      let pestType = "";
      
      if (selectedLegendClass === "Chewing") {
        coordinates = pestData.pixel_summary?.chewing_affected_pixel_coordinates || [];
        pestType = "Chewing";
      } else if (selectedLegendClass === "Sucking") {
        coordinates = pestData.pixel_summary?.sucking_affected_pixel_coordinates || [];
        pestType = "Sucking";
      } else if (selectedLegendClass === "fungi") {
        coordinates = pestData.pixel_summary?.fungi_affected_pixel_coordinates || [];
        pestType = "fungi";
      } else if (selectedLegendClass === "Soil Borne") {
        coordinates = pestData.pixel_summary?.SoilBorne_affected_pixel_coordinates || [];
        pestType = "Soil Borne";
      }
      
      if (!coordinates || !Array.isArray(coordinates)) {
        // console.log('No valid coordinates found for', pestType);
        return [];
      }
      
      // console.log(`Found ${coordinates.length} coordinates for ${pestType}`);

      const actualPixels = coordinates.map((coord, index) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        
        return {
          geometry: {
            coordinates: [coord[0], coord[1]]
          },
          properties: {
            pixel_id: `${pestType.toLowerCase().replace(/\s+/g, '-')}-${index}`,
            pest_type: pestType,
            pest_category: pestType
          }
        };
      }).filter(Boolean);
      
      // console.log(`Generated ${actualPixels.length} pixel objects for ${pestType}`);
      return actualPixels;
    }
    
    if (activeLayer === "Water Uptake") {
      if (!waterUptakeData || !currentPlotFeature) {
        // console.log('Missing waterUptakeData or currentPlotFeature');
        return [];
      }

      //    console.log('Processing Water Uptake layer for selectedLegendClass:', selectedLegendClass);

      const pixelSummary = waterUptakeData.pixel_summary;
      if (!pixelSummary) return [];

      let coordinates = [];
      let categoryType = "";

      if (selectedLegendClass === "Deficient") {
        coordinates = pixelSummary.deficient_pixel_coordinates || [];
        categoryType = "Deficient";
      } else if (selectedLegendClass === "Less") {
        coordinates = pixelSummary.less_pixel_coordinates || [];
        categoryType = "Less";
      } else if (selectedLegendClass === "Adequate") {
        coordinates = pixelSummary.adequat_pixel_coordinates || [];
        categoryType = "Adequate";
      } else if (selectedLegendClass === "Excellent") {
        coordinates = pixelSummary.excellent_pixel_coordinates || [];
        categoryType = "Excellent";
      } else if (selectedLegendClass === "Excess") {
        coordinates = pixelSummary.excess_pixel_coordinates || [];
        categoryType = "Excess";
      }

      if (!coordinates || !Array.isArray(coordinates)) {
        // console.log('No valid coordinates found for', categoryType);
      return [];
    }
    
      // console.log(`Found ${coordinates.length} coordinates for ${categoryType}`);

      const actualPixels = coordinates.map((coord, index) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;

        return {
          geometry: {
            coordinates: [coord[0], coord[1]]
          },
          properties: {
            pixel_id: `${categoryType.toLowerCase().replace(/\s+/g, '-')}-${index}`,
            category_type: categoryType,
            water_uptake_category: categoryType
          }
        };
      }).filter(Boolean);

      // console.log(`Generated ${actualPixels.length} pixel objects for ${categoryType}`);
      return actualPixels;
    }

    if (activeLayer === "Soil Moisture") {
      if (!soilMoistureData || !currentPlotFeature) {
        // console.log('Missing soilMoistureData or currentPlotFeature');
        return [];
      }

      // console.log('Processing Soil Moisture layer for selectedLegendClass:', selectedLegendClass);

      const pixelSummary = soilMoistureData.pixel_summary;
      if (!pixelSummary) return [];

      let coordinates = [];
      let categoryType = "";

      if (selectedLegendClass === "Less") {
        coordinates = pixelSummary.less_pixel_coordinates || [];
        categoryType = "Less";
      } else if (selectedLegendClass === "Adequate") {
        coordinates = pixelSummary.adequate_pixel_coordinates || [];
        categoryType = "Adequate";
      } else if (selectedLegendClass === "Excellent") {
        coordinates = pixelSummary.excellent_pixel_coordinates || [];
        categoryType = "Excellent";
      } else if (selectedLegendClass === "Excess") {
        coordinates = pixelSummary.excess_pixel_coordinates || [];
        categoryType = "Excess";
      } else if (selectedLegendClass === "Shallow") {
        coordinates = pixelSummary.shallow_water_pixel_coordinates || [];
        categoryType = "Shallow";
      }

      if (!coordinates || !Array.isArray(coordinates)) {
        // console.log('No valid coordinates found for', categoryType);
        return [];
      }

      // console.log(`Found ${coordinates.length} coordinates for ${categoryType}`);

      const actualPixels = coordinates.map((coord, index) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;

        return {
          geometry: {
            coordinates: [coord[0], coord[1]]
          },
          properties: {
            pixel_id: `${categoryType.toLowerCase().replace(/\s+/g, '-')}-${index}`,
            category_type: categoryType,
            soil_moisture_category: categoryType
          }
        };
      }).filter(Boolean);

      // console.log(`Generated ${actualPixels.length} pixel objects for ${categoryType}`);
      return actualPixels;
    }

    if (activeLayer === "Growth") {
      if (!growthData || !currentPlotFeature) {
        // console.log('Missing growthData or currentPlotFeature');
        return [];
      }

      // console.log('Processing Growth layer for selectedLegendClass:', selectedLegendClass);

      const pixelSummary = growthData.pixel_summary;
      if (!pixelSummary) return [];

      let coordinates = [];
      let categoryType = "";

      if (selectedLegendClass === "Weak") {
        coordinates = pixelSummary.weak_pixel_coordinates || [];
        categoryType = "Weak";
      } else if (selectedLegendClass === "Stress") {
        coordinates = pixelSummary.stress_pixel_coordinates || [];
        categoryType = "Stress";
      } else if (selectedLegendClass === "Moderate") {
        coordinates = pixelSummary.moderate_pixel_coordinates || [];
        categoryType = "Moderate";
      } else if (selectedLegendClass === "Healthy") {
        coordinates = pixelSummary.healthy_pixel_coordinates || [];
        categoryType = "Healthy";
      }

      if (!coordinates || !Array.isArray(coordinates)) {
        // console.log('No valid coordinates found for', categoryType);
        return [];
      }

      // console.log(`Found ${coordinates.length} coordinates for ${categoryType}`);

      const actualPixels = coordinates.map((coord, index) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;

    return {
          geometry: {
            coordinates: [coord[0], coord[1]]
          },
          properties: {
            pixel_id: `${categoryType.toLowerCase().replace(/\s+/g, '-')}-${index}`,
            category_type: categoryType,
            growth_category: categoryType
          }
        };
      }).filter(Boolean);

      // console.log(`Generated ${actualPixels.length} pixel objects for ${categoryType}`);
      return actualPixels;
    }

    return [];
  }, [selectedLegendClass, activeLayer, pestData, waterUptakeData, soilMoistureData, growthData, currentPlotFeature]);

  const getMultiLayerDataForPosition = (coords: number[]) => {
    const allLayerData = [];
    const tolerance = 0.00001;
    
    // Helper function to find category for coordinates in a layer
    const findCategoryInLayer = (layerData: any, layerName: string, legendItems: any[]) => {
      if (!layerData?.pixel_summary) return null;
      
      for (const legendItem of legendItems) {
        const coordsKey = getCoordinatesKey(layerName, legendItem.label);
        const coordinates = layerData.pixel_summary[coordsKey] || [];
        
        const found = coordinates.find((coord: number[]) => 
          Math.abs(coord[0] - coords[0]) < tolerance && 
          Math.abs(coord[1] - coords[1]) < tolerance
        );
        
        if (found) {
          return {
            layer: layerName,
            label: legendItem.label,
            description: legendItem.description,
            percentage: legendItem.percentage
          };
        }
      }
      return null;
    };
    
    // Get coordinates key for each layer type
    const getCoordinatesKey = (layerName: string, label: string) => {
      if (layerName === 'Growth') {
        return `${label.toLowerCase()}_pixel_coordinates`;
      } else if (layerName === 'Water Uptake') {
        if (label === 'Adequate') return 'adequat_pixel_coordinates';
        return `${label.toLowerCase()}_pixel_coordinates`;
      } else if (layerName === 'Soil Moisture') {
        if (label === 'Shallow') return 'shallow_water_pixel_coordinates';
        return `${label.toLowerCase()}_pixel_coordinates`;
      } else if (layerName === 'PEST') {
        if (label === 'Chewing') return 'chewing_affected_pixel_coordinates';
        if (label === 'Sucking') return 'sucking_affected_pixel_coordinates';
        if (label === 'fungi') return 'fungi_affected_pixel_coordinates';
        if (label === 'Soil Borne') return 'SoilBorne_affected_pixel_coordinates';
      }
      return '';
    };
    
    // Check Growth layer
    if (growthData) {
      const growthLegend = [
        { label: "Weak", description: "damaged or weak crop", percentage: Math.round(growthData.pixel_summary?.weak_pixel_percentage || 0) },
        { label: "Stress", description: "crop under stress", percentage: Math.round(growthData.pixel_summary?.stress_pixel_percentage || 0) },
        { label: "Moderate", description: "Crop under normal growth", percentage: Math.round(growthData.pixel_summary?.moderate_pixel_percentage || 0) },
        { label: "Healthy", description: "proper growth", percentage: Math.round(growthData.pixel_summary?.healthy_pixel_percentage || 0) }
      ];
      const growthResult = findCategoryInLayer(growthData, 'Growth', growthLegend);
      if (growthResult) allLayerData.push(growthResult);
    }
    
    // Check Water Uptake layer
    if (waterUptakeData) {
      const waterLegend = [
        { label: "Deficient", description: "weak root", percentage: Math.round(waterUptakeData.pixel_summary?.deficient_pixel_percentage || 0) },
        { label: "Less", description: "weak roots", percentage: Math.round(waterUptakeData.pixel_summary?.less_pixel_percentage || 0) },
        { label: "Adequate", description: "healthy roots", percentage: Math.round(waterUptakeData.pixel_summary?.adequat_pixel_percentage || 0) },
        { label: "Excellent", description: "healthy roots", percentage: Math.round(waterUptakeData.pixel_summary?.excellent_pixel_percentage || 0) },
        { label: "Excess", description: "root logging", percentage: Math.round(waterUptakeData.pixel_summary?.excess_pixel_percentage || 0) }
      ];
      const waterResult = findCategoryInLayer(waterUptakeData, 'Water Uptake', waterLegend);
      if (waterResult) allLayerData.push(waterResult);
    }
    
    // Check Soil Moisture layer
    if (soilMoistureData) {
      const soilLegend = [
        { label: "Less", description: "less soil moisture", percentage: Math.round(soilMoistureData.pixel_summary?.less_pixel_percentage || 0) },
        { label: "Adequate", description: "Irrigation need", percentage: Math.round(soilMoistureData.pixel_summary?.adequate_pixel_percentage || 0) },
        { label: "Excellent", description: "no irrigation require", percentage: Math.round(soilMoistureData.pixel_summary?.excellent_pixel_percentage || 0) },
        { label: "Excess", description: "water logging", percentage: Math.round(soilMoistureData.pixel_summary?.excess_pixel_percentage || 0) },
        { label: "Shallow", description: "water source", percentage: Math.round(soilMoistureData.pixel_summary?.shallow_water_pixel_percentage || 0) }
      ];
      const soilResult = findCategoryInLayer(soilMoistureData, 'Soil Moisture', soilLegend);
      if (soilResult) allLayerData.push(soilResult);
    }
    
    // Check PEST layer
    if (pestData) {
      const pestLegend = [
        { label: "Chewing", description: "Areas affected by chewing pests", percentage: Math.round(pestData.pixel_summary?.chewing_affected_pixel_percentage || 0) },
        { label: "Sucking", description: "Areas affected by sucking disease", percentage: Math.round(pestData.pixel_summary?.sucking_affected_pixel_percentage || 0) },
        { label: "fungi", description: "fungi infections affecting plants", percentage: Math.round(pestData.pixel_summary?.fungi_affected_pixel_percentage || 0) },
        { label: "Soil Borne", description: "Soil borne infections affecting plants", percentage: Math.round(pestData.pixel_summary?.SoilBorn_affected_pixel_percentage || 0) }
      ];
      const pestResult = findCategoryInLayer(pestData, 'PEST', pestLegend);
      if (pestResult) allLayerData.push(pestResult);
    }
    
    return allLayerData;
  };

  const handleLegendClick = (label: string, percentage: number) => {
    if (percentage === 0) return;

    if (percentage >= 99) {
      setSelectedLegendClass(null);
      return;
    }

    setSelectedLegendClass((prev) => (prev === label ? null : label));
  };

  const renderPlotBorder = () => {
    // Always prioritize plotBoundary (persists across layer changes)
    let featureToUse = plotBoundary || currentPlotFeature;
    
    // If still no feature, try to get from active layer data as fallback (read-only)
    if (!featureToUse) {
      if (activeLayer === "Growth" && growthData?.features?.[0]) {
        featureToUse = growthData.features[0];
      } else if (activeLayer === "Water Uptake" && waterUptakeData?.features?.[0]) {
        featureToUse = waterUptakeData.features[0];
      } else if (activeLayer === "Soil Moisture" && soilMoistureData?.features?.[0]) {
        featureToUse = soilMoistureData.features[0];
      } else if (activeLayer === "PEST" && pestData?.features?.[0]) {
        featureToUse = pestData.features[0];
      }
    }
    
    const geom = featureToUse?.geometry;
    if (!geom || geom.type !== "Polygon" || !geom.coordinates?.[0]) {
      // If no geometry available, return null but don't clear anything
      return null;
    }

    const coords = geom.coordinates[0]
      .map((c: any) => [c[1], c[0]] as LatLngTuple)
      .filter((tuple: LatLngTuple) => !isNaN(tuple[0]) && !isNaN(tuple[1]));

    if (coords.length === 0) return null;

    return (
      <Polygon
        key={`plot-border-${selectedPlotName}-${plotBoundary ? 'persistent' : 'temp'}`}
        positions={coords}
        pathOptions={{
          fillOpacity: 0,
          color: "#FFD700",
          weight: 3,
          interactive: false,
        }}
      />
    );
  };

  const renderFilteredPixels = () => {
    if (!selectedLegendClass || getFilteredPixels.length === 0) return null;

    return getFilteredPixels.map((pixel: any, index: number) => {
      const coords = pixel?.geometry?.coordinates;

      if (!coords || !Array.isArray(coords) || coords.length < 2) {
        return null;
      }
      
      const circleRadius = 0.000025;

      return (
        <Circle
          key={`filtered-pixel-${pixel?.properties?.pixel_id || index}`}
          center={[coords[1], coords[0]]}
          radius={circleRadius}
          pathOptions={{
            fillColor: "#FFFFFF",
            fillOpacity: 1.8,
            color: "#FFFFFF",
            weight: 6,
            opacity: 1.8,
          }}
          eventHandlers={{
            mouseover: (e: any) => {
              const allLayerData = getMultiLayerDataForPosition(coords);
              if (allLayerData.length > 0) {
                setPixelTooltip({
                  layers: allLayerData,
                  x: e.originalEvent.clientX,
                  y: e.originalEvent.clientY
                });
              }
            },
            mouseout: () => {
              setPixelTooltip(null);
            },
            mousemove: (e: any) => {
              if (pixelTooltip) {
                setPixelTooltip(prev => prev ? {
                  ...prev,
                  x: e.originalEvent.clientX,
                  y: e.originalEvent.clientY - 10
                } : null);
              }
            }
          }}
        />
      );
    });
  };

  return (
    <div className="map-wrapper">
      <div className="layer-controls">
        <div className="layer-buttons">
          {(["Growth", "Water Uptake", "Soil Moisture", "PEST"] as const).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={activeLayer === layer ? "active" : ""}
              disabled={loading}
            >
              {LAYER_LABELS[layer]}
            </button>
          ))}
        </div>

        {profile && !profileLoading && (
          <div className="plot-selector">
            <label>Select Plot:</label>
            <select
              value={selectedPlotName || ""}
              onChange={(e) => {
                const newPlot = e.target.value;
                setSelectedPlotName(newPlot);
                // Clear previous plot boundary when selecting a new plot
                setPlotBoundary(null);
                // Only fetch non-date-dependent layers here
                // Date-dependent layers (Growth, Water Uptake, Soil Moisture) will be fetched by the useEffect that watches currentEndDate
                fetchPestData(newPlot);
                fetchPlotData(newPlot);
                fetchFieldAnalysis(newPlot);
              }}
              disabled={loading}
            >
              {profile.plots?.map(plot => {
                let displayName = '';
                
                if (plot.gat_number && plot.plot_number && 
                    plot.gat_number.trim() !== "" && plot.plot_number.trim() !== "" &&
                    !plot.gat_number.startsWith('GAT_') && !plot.plot_number.startsWith('PLOT_')) {
                  displayName = `${plot.gat_number}_${plot.plot_number}`;
                } else if (plot.gat_number && plot.gat_number.trim() !== "" && !plot.gat_number.startsWith('GAT_')) {
                  displayName = plot.gat_number;
                } else if (plot.plot_number && plot.plot_number.trim() !== "" && !plot.plot_number.startsWith('PLOT_')) {
                  displayName = plot.plot_number;
                } else {
                  const village = plot.address?.village;
                  const taluka = plot.address?.taluka;
                  
                  if (village) {
                    displayName = `Plot in ${village}`;
                    if (taluka) displayName += `, ${taluka}`;
                  } else {
                    displayName = 'Plot (No GAT/Plot Number)';
                  }
                }
                
                return (
                  <option key={plot.fastapi_plot_id} value={plot.fastapi_plot_id}>
                    {displayName}
                  </option>
                );
              }) || []}
            </select>
          </div>
        )}

        {profileLoading && <div className="loading-indicator">Loading farmer profile...</div>}
        {!profileLoading && !selectedPlotName && <div className="error-message">No plot data available for this farmer</div>}
        {loading && <div className="loading-indicator">Loading plot data...</div>}
        {error && <div className="error-message">{error}</div>}
      </div>

      {/* Enhanced Multi-Layer Tooltip */}
      {pixelTooltip && pixelTooltip.layers.length > 0 && (
        <div 
          className="enhanced-tooltip"
          style={{
            left: `${pixelTooltip.x + 10}px`,
            top: `${pixelTooltip.y - 10}px`,
          }}
        >
          {pixelTooltip.layers.map((layerData, index) => (
            <div key={index} className="enhanced-tooltip-line">
              <span className="layer-name">{layerData.layer}:</span>
              <span className="layer-description">
                {layerData.label} - {layerData.description} - {layerData.percentage}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="map-container" ref={mapWrapperRef}>
        {/* Back Button */}
        <button
          className="back-btn"
          title="Go Back"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            }
            window.history.back();
          }}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Fullscreen Button */}
        <button
          className="fullscreen-btn"
          title="Enter Fullscreen"
          onClick={() => {
            if (!document.fullscreenElement) mapWrapperRef.current?.requestFullscreen();
            else document.exitFullscreen();
          }}
        >
          <FaExpand />
        </button>

        {(plotBoundary || currentPlotFeature) && (
          <>
            <div className="plot-info">
              <div className="plot-area">
                <span className="plot-area-value">
                  {(plotBoundary || currentPlotFeature).properties?.area_acres 
                    ? (plotBoundary || currentPlotFeature).properties.area_acres.toFixed(2) 
                    : '0.00'} acre
                </span>
              </div>
            </div>
          </>
        )}

        {/* Date Navigation Arrows - Show for Growth, Water Uptake, Soil Moisture, and PEST */}
        {(activeLayer === "Growth" || activeLayer === "Water Uptake" || activeLayer === "Soil Moisture" || activeLayer === "PEST") && (
          <>
            <button
              className="timeseries-nav-arrow-left"
              onClick={onLeftArrowClick}
              aria-label="Previous date (-15 days)"
              title="Previous (-15 days)"
            >
              <span className="timeseries-arrow-icon timeseries-arrow-left-icon"></span>
            </button>
            <button
              className="timeseries-nav-arrow-right"
              onClick={onRightArrowClick}
              aria-label="Next date (+15 days)"
              title="Next (+15 days)"
              disabled={isAtOrAfterCurrentDate(currentEndDate)}
              style={{
                opacity: isAtOrAfterCurrentDate(currentEndDate) ? 0.5 : 1,
                cursor: isAtOrAfterCurrentDate(currentEndDate) ? 'not-allowed' : 'pointer'
              }}
            >
              <span className="timeseries-arrow-icon timeseries-arrow-right-icon"></span>
            </button>
            
            {/* Date Popup */}
            {showDatePopup && (
              <div className={`timeseries-date-popup ${popupSide === 'left' ? 'timeseries-date-popup-left' : ''} ${popupSide === 'right' ? 'timeseries-date-popup-right' : ''}`}>
                <div className="timeseries-date-popup-content">
                  <div className="timeseries-date-popup-value">{currentEndDate}</div>
                  <div className="timeseries-date-popup-range">
                    {/* Start: {(() => {
                      const endDate = new Date(currentEndDate);
                      const startDate = new Date(endDate);
                      startDate.setDate(startDate.getDate() - DAYS_STEP);
                      return startDate.toISOString().split('T')[0];
                    })()} */}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <MapContainer
          center={mapCenter}
          zoom={18}
          style={{ height: "90%", width: "100%" }}
          zoomControl={true}
          maxZoom={22}
          minZoom={10}
        >
          <TileLayer
            url="http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            attribution="© Google"
            maxZoom={22}
          />

          {(plotBoundary || currentPlotFeature)?.geometry?.coordinates?.[0] &&
            Array.isArray((plotBoundary || currentPlotFeature).geometry.coordinates[0]) && (
            <SetFixedZoom coordinates={(plotBoundary || currentPlotFeature).geometry.coordinates[0]} />
          )}

          {(() => {
            const activeUrl = getActiveLayerUrl();
            console.log('Rendering active layer with URL:', activeUrl);
            if (!activeUrl) {
              console.warn(`[Map] Skipping TileLayer render for ${activeLayer} due to missing/invalid tile_url`);
              return null;
            }
            return (
              <CustomTileLayer
                url={activeUrl}
                opacity={0.7}
                key={`${activeLayer}-layer-${layerChangeKey}`}
              />
            );
          })()}

          {selectedLegendClass && renderFilteredPixels()}
          {renderPlotBorder()}
        </MapContainer>

        {legendData.length > 0 && (
          <div className="map-legend-bottom">
            <div className="legend-items-bottom">
              {legendData.map((item: any, index: number) => (
                <div
                  key={index}
                  className={`legend-item-bottom ${
                    selectedLegendClass === item.label ? "active" : ""
                  } ${item.percentage === 0 ? "zero-percent" : ""} ${
                    item.percentage >= 99 ? "full-coverage" : ""
                  }`}
                  onClick={() => handleLegendClick(item.label, item.percentage)}
                  style={{
                    pointerEvents: item.percentage === 0 ? 'none' : 'auto',
                    cursor: item.percentage >= 99 ? 'not-allowed' : 'pointer'
                  }}
                  title={item.percentage >= 99 ? 'High coverage (99%+) - no individual pixels to show' : ''}
                >
                  <div
                    className="legend-circle-bottom cursor-pointer transition-all duration-150"
                    style={{
                      background: LEGEND_CIRCLE_COLOR,
                      boxShadow: `0 5px 8px ${LEGEND_CIRCLE_COLOR}40`
                    }}
                  >
                    <div className="legend-percentage-bottom font-bold text-xlg text-white-900">
                      {item.percentage}
                    </div>
                  </div>
                  <div className="legend-label-bottom text-white-500">{item.label}</div>
                </div>
              ))}
            </div>

          </div>
        )}
              </div>
    </div>
  );
};

export default Map;