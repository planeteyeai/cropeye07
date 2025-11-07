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

      const currentDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const startDateStr = startDate.toISOString().split("T")[0];

      const requestBody = {
        plot_name: plotName,
        start_date: startDateStr,
        end_date: currentDate,
      };

      const attempts: Array<{ url: string; init?: RequestInit; note: string }> = [
        {
          url: `https://dev-field.cropeye.ai/plots/${plotName}/compute-et/`,
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
          note: "7002 POST",
        },
        {
          url: `https://dev-field.cropeye.ai/plots/${plotName}/compute-et/`,
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
          note: "8009 POST",
        },
        {
          url: `https://dev-field.cropeye.ai/plots/${encodeURIComponent(
            plotName
          )}/compute-et/?start_date=${startDateStr}&end_date=${currentDate}`,
          init: { method: "GET" },
          note: "7002 GET",
        },
      ];

      let data: any = null;
      let lastError: any = null;

      for (const attempt of attempts) {
        try {
          const resp = await fetch(attempt.url, attempt.init);

          if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt}`);
          }

          data = await resp.json();
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (!data) {
        throw lastError || new Error("All ET attempts failed");
      }


      // Extract ET value
      let etValueExtracted = 0;
      let etSource = "fallback (2.5)";

      if (data.et_24hr !== undefined) {
        etValueExtracted = data.et_24hr;
        etSource = "data.et_24hr";
      } else if (data.ET_mean_mm_per_day !== undefined) {
        etValueExtracted = data.ET_mean_mm_per_day;
        etSource = "data.ET_mean_mm_per_day";
      } else if (data.et !== undefined) {
        etValueExtracted = data.et;
        etSource = "data.et";
      } else if (typeof data === "number") {
        etValueExtracted = data;
        etSource = "direct number";
      } else {
        etValueExtracted = 2.5;
      }


      // Extract 24-hour trend data if available
      let trendDataExtracted: number[] = [];

      if (Array.isArray(data.et_24hr_array)) {
        trendDataExtracted = data.et_24hr_array;
      } else if (Array.isArray(data.trend)) {
        trendDataExtracted = data.trend;
      } else if (Array.isArray(data.hourly_et)) {
        trendDataExtracted = data.hourly_et;
      } else if (Array.isArray(data.et_hourly)) {
        trendDataExtracted = data.et_hourly;
      } else {
        // Generate trend data if not available in response
        const base = etValueExtracted;
        trendDataExtracted = Array.from({ length: 24 }, (_, i) => {
          const fluctuation = (Math.sin(i / 3) + 1) * 0.1 * base;
          return Math.round((base + fluctuation) * 10) / 10;
        });
      }

      // Ensure exactly 24 data points
      if (trendDataExtracted.length !== 24) {
        const base = etValueExtracted;
        trendDataExtracted = Array.from({ length: 24 }, (_, i) => {
          const fluctuation = (Math.sin(i / 3) + 1) * 0.1 * base;
          return Math.round((base + fluctuation) * 10) / 10;
        });
      }

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

  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
          {/* Last updated: {today} */}
        </div>
      </div>
    </div>
  );
};

export default EvapotranspirationCard;