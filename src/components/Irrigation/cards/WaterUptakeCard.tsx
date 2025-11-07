
import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import "../Irrigation.css";
import { useAppContext } from "../../../context/AppContext";
import { useFarmerProfile } from "../../../hooks/useFarmerProfile";

const WaterUptakeCard: React.FC = () => {
  const { appState } = useAppContext();

  const irrigationSchedule = appState.irrigationScheduleData || [];
  const todayData = irrigationSchedule.find((day: any) => day.isToday);
  const waterReqLiters = todayData?.waterRequired ?? 0;
  const { profile, loading: profileLoading } = useFarmerProfile();
  const storedPlot = typeof window !== 'undefined' ? localStorage.getItem('selectedPlot') : null;
  const plotName = (appState.plotName && appState.plotName.trim())
    || (storedPlot && storedPlot.trim())
    || (profile?.plots?.[0]?.fastapi_plot_id || "");

  // Get plants_in_field from current plot
  const currentPlot = profile?.plots?.find(plot => plot.fastapi_plot_id === plotName);
  const plantsInField = currentPlot?.farms?.[0]?.plants_in_field ?? 0;
  
  // Calculate water per plant per hour: (waterRequired / plants_in_field) / 24
  const waterPerPlantPerHour = plantsInField > 0 ? (waterReqLiters / plantsInField) / 24 : 0;

  const [efficiency, setEfficiency] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Dynamically calculate average from today's water requirement
  const average = ((waterReqLiters * 23) / 1000).toFixed(2);

  const currentDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchEfficiency = async () => {
      if (!plotName) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const url = `https://dev-plot.cropeye.ai/wateruptake?plot_name=${plotName}&end_date=${currentDate}&days_back=7`;
        const response = await fetch(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`API ${response.status}${errorText ? `: ${errorText}` : ''}`);
        }

        const data = await response.json();

        const pixelSummary = data.pixel_summary;

        if (!pixelSummary) {
          setEfficiency(0);
          setLoading(false);
          return;
        }

        const adequate = pixelSummary?.adequat_pixel_percentage ?? 0;
        const excellent = pixelSummary?.excellent_pixel_percentage ?? 0;

        const totalEfficiency = Math.round(adequate + excellent);

        setEfficiency(totalEfficiency);
        setError(null);
        setLoading(false);
      } catch (err: any) {
        setError("Failed to fetch efficiency data");
        setEfficiency(null);
        setLoading(false);
      }
    };

    fetchEfficiency();
  }, [plotName, currentDate]);

  // Circle visuals
  const minRadius = 70;
  const maxRadius = 100;
  const maxValue = 100; // Efficiency percentage scale (0-100%)
  const efficiencyValue = efficiency ?? 0;
  const radius = Math.min(
    maxRadius,
    minRadius + (efficiencyValue / maxValue) * (maxRadius - minRadius)
  );
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - efficiencyValue / maxValue);

  // If still no plot name and profile is loading, show loading
  if (!plotName && profileLoading) {
    return (
      <div className="irrigation-card">
        <div className="card-header">
          <Activity className="card-icon" size={28} />
          <h3 className="font-semibold">Plant Water Uptake</h3>
        </div>
        <div className="card-content card-content-water">
          <div className="text-gray-600 font-semibold">Loading farmer plots...</div>
        </div>
      </div>
    );
  }

  // If no plot name even after profile loaded, then show message
  if (!plotName) {
    return (
      <div className="irrigation-card">
        <div className="card-header">
          <Activity className="card-icon" size={28} />
          <h3 className="font-semibold">Plant Water Uptake</h3>
        </div>
        <div className="card-content card-content-water">
          <div className="text-red-600 font-semibold">WaterUptakeCard: No plot name available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="irrigation-card">
      <div className="card-header">
        <Activity className="card-icon" size={28} />
        <h3 className="font-semibold">Plant Water Uptake</h3>
      </div>

      <div className="card-content card-content-water">
        <div className="ring-wrapper">
          <svg
            className="progress-ring"
            width={radius * 2 + 20}
            height={radius * 2 + 20}
          >
            <circle
              className="progress-ring-circle-bg"
              stroke="#e2e8f0"
              strokeWidth="17"
              fill="transparent"
              r={radius}
              cx={(radius * 2 + 20) / 2}
              cy={(radius * 2 + 20) / 2}
            />
            <circle
              className="progress-ring-circle"
              stroke="#3b82f6"
              strokeWidth="17"
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx={(radius * 2 + 20) / 2}
              cy={(radius * 2 + 20) / 2}
              style={{
                strokeDasharray: `${circumference} ${circumference}`,
                strokeDashoffset,
                transform: "rotate(-90deg)",
                transformOrigin: "center",
              }}
            />
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              className="progress-text value"
            >
              {loading ? "..." : waterPerPlantPerHour.toFixed(2)}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              className="progress-text unit"
            >
              L/h
            </text>
          </svg>
        </div>

        {/* Efficiency Section */}
        <div className="uptake-efficiency" style={{ color: "#16a34a", paddingBottom: "10px" }}>
          Efficiency: {loading ? "..." : efficiency !== null ? `${efficiency}%` : "--"}
        </div>

        <div className="uptake-average">
          {/* Average: {average} L/Day */}
        </div>

        {error && <div className="text-red-500 mt-1">{error}</div>}
      </div>
    </div>
  );
};

export default WaterUptakeCard;

