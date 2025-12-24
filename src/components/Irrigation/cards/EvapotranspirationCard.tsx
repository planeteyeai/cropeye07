import React, { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import "../Irrigation.css";
import { useAppContext } from "../../../context/AppContext";
import { useFarmerProfile } from "../../../hooks/useFarmerProfile";

interface ETResponse {
  plot_name: string;
  start_date: string;
  end_date: string;
  area_hectares: number;
  ET_mean_mm_per_day: number;
  ET_total_liters_per_day: number;
}

const EvapotranspirationCard: React.FC = () => {
  const { appState, setAppState, getCached, setCached, selectedPlotName } = useAppContext();
  const { profile, loading: profileLoading } = useFarmerProfile();
  
  const [plotName, setPlotName] = useState<string>("");
  const etValue = appState?.etValue ?? 0;
  const trendData = Array.isArray(appState?.etTrendData) ? appState.etTrendData : [];
  const [loading, setLoading] = useState<boolean>(!etValue);
  const [error, setError] = useState<string | null>(null);
  const [average] = useState<number>(2.5);

  // Set plot name from global selectedPlotName or fallback to first plot
  useEffect(() => {
    if (profile && !profileLoading) {
      let plotToUse = "";
      
      // Use global selectedPlotName if available
      if (selectedPlotName) {
        // Find the plot by fastapi_plot_id or constructed ID
        const foundPlot = profile.plots?.find((plot: any) => 
          plot.fastapi_plot_id === selectedPlotName ||
          `${plot.gat_number}_${plot.plot_number}` === selectedPlotName
        );
        
        if (foundPlot && foundPlot.fastapi_plot_id) {
          plotToUse = foundPlot.fastapi_plot_id;
        } else {
          plotToUse = selectedPlotName || ""; // Use as-is if not found (might be a different format)
        }
      } else {
        // Fallback to first plot
        const plotNames = profile.plots?.map((plot: any) => plot.fastapi_plot_id) || [];
        plotToUse = plotNames.length > 0 ? plotNames[0] : "";
      }
      
      if (plotToUse && plotToUse !== plotName) {
        setPlotName(plotToUse);
        console.log('EvapotranspirationCard: Setting plot name to:', plotToUse);
      }
    }
  }, [profile, profileLoading, selectedPlotName]);

  // Fetch ET data when plot name is available
  useEffect(() => {
    if (!plotName) return;

    const cacheKey = `etData_${plotName}`;
    const cached = getCached(cacheKey);

    if (cached && cached.etValue && cached.trendData) {
      setAppState((prev: any) => ({
        ...prev,
        etValue: cached.etValue,
        etTrendData: cached.trendData,
      }));
      setLoading(false);
      return;
    }

    fetchETData();
  }, [plotName]);

  const fetchETData = async () => {
    if (!plotName) {
      setError("No plot selected");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use POST request with empty body as per API specification
      const url = `https://dev-field.cropeye.ai
 /plots/${plotName}/compute-et/`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "accept": "application/json",
        },
        // Empty body as per curl command (-d '')
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: ETResponse = await response.json();

      // Extract ET value from ET_mean_mm_per_day (primary field from API response)
      const etValueExtracted = data.ET_mean_mm_per_day ?? 2.5;

      // Generate trend data based on ET_mean_mm_per_day (API doesn't provide hourly data)
      const base = etValueExtracted;
      const trendDataExtracted = Array.from({ length: 24 }, (_, i) => {
        const fluctuation = (Math.sin(i / 3) + 1) * 0.1 * base;
        return Math.round((base + fluctuation) * 10) / 10;
      });


      // Update AppContext
      setAppState((prev: any) => ({
        ...prev,
        etValue: etValueExtracted,
        etTrendData: trendDataExtracted,
      }));

      // Cache the data
      const cacheKey = `etData_${plotName}`;
      setCached(cacheKey, {
        etValue: etValueExtracted,
        trendData: trendDataExtracted,
      });

    } catch (err: any) {
      setError(`Failed to fetch ET data: ${err.message}`);
      setAppState((prev: any) => ({
        ...prev,
        etValue: 0,
        etTrendData: [],
      }));
    } finally {
      setLoading(false);
    }
  };

  const comparison =
    etValue > average
      ? { status: "Above average", className: "text-orange-500" }
      : { status: "Below average", className: "text-green-500" };


  const maxTrendValue =
    Array.isArray(trendData) && trendData.length > 0
      ? Math.max(...trendData.map((v: any) => Number(v) || 0))
      : 1;

  return (
    <div className="irrigation-card">
      <div className="card-header">
        <Waves className="card-icon" size={20} />
        <h3>Evapotranspiration</h3>
      </div>

      <div className="card-content evapotranspiration">
        <div className="evap-icon">
          <Waves size={40} color="#4287f5" />
        </div>

        <div className="metric-value">
          {loading ? (
            <div className="loading-spinner-small"></div>
          ) : (
            <>
              <span className="value">{etValue.toFixed(2)}</span>
              <span className="unit">mm</span>
            </>
          )}
        </div>

        {error && <div className="error-message-small">{error}</div>}

        <div className={`evap-comparison ${comparison.className}`}>
          {comparison.status} ({average.toFixed(1)}mm)
        </div>

        <div className="evap-trend">
          <div className="trend-label">24h Trend</div>
          <div className="trend-chart">
            {Array.isArray(trendData) && trendData.length > 0 ? (
              trendData.map((val: number, i: number) => {
                const numVal = Number(val) || 0;
                return (
                  <div
                    key={i}
                    className="trend-bar"
                    title={`${i}:00 - ${numVal.toFixed(2)} mm`}
                    style={{
                      height: `${(numVal / maxTrendValue) * 100}%`,
                      minHeight: "2px",
                    }}
                  />
                );
              })
            ) : (
              <div style={{ width: "100%", textAlign: "center", color: "#999" }}>
                No trend data available
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
        </div>
      </div>
    </div>
  );
};

export default EvapotranspirationCard;