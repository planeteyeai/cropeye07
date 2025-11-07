import React, { useState, useEffect, useRef } from 'react';
import { useFarmerProfile } from '../hooks/useFarmerProfile';
import { useAppContext } from '../context/AppContext';
import budData from './bud.json';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface FertilizerEntry {
  date: string;
  stage: string;
  days: string;
  N_kg_acre: string;
  P_kg_acre: string;
  K_kg_acre: string;
  fertilizers?: {
    Urea_N_kg_per_acre: number;
    SuperPhosphate_P_kg_per_acre: number;
    Potash_K_kg_per_acre: number;
  };
  organic_inputs?: string[];
}


const FertilizerTable: React.FC = () => {
  const [data, setData] = useState<FertilizerEntry[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const { profile, loading: profileLoading, error: profileError } = useFarmerProfile();
  const { selectedPlotName } = useAppContext();

  // Helper function to calculate days since plantation
  const calculateDaysSincePlantation = (plantationDate: string): number => {
    // Try different date parsing methods
    let plantation: Date;
    
    // Method 1: Direct parsing
    plantation = new Date(plantationDate);
    
    // Method 2: Handle different date formats
    if (isNaN(plantation.getTime())) {
      // Try parsing as YYYY-MM-DD format
      const parts = plantationDate.split('-');
      if (parts.length === 3) {
        plantation = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        // Try parsing as DD/MM/YYYY format
        const parts2 = plantationDate.split('/');
        if (parts2.length === 3) {
          plantation = new Date(parseInt(parts2[2]), parseInt(parts2[1]) - 1, parseInt(parts2[0]));
        }
      }
    }
    
    const today = new Date();
    const diffTime = today.getTime() - plantation.getTime();
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return days;
  };

  // Helper function to get current stage based on days
  const getCurrentStage = (days: number, stages: any[]): any => {
    for (const stage of stages) {
      // Handle both en-dash (–) and regular hyphen (-) in the days range
      const daysRange = stage.days.replace(/[–-]/g, '-'); // Normalize to regular hyphen
      const [minDays, maxDays] = daysRange.split('-').map((d: string) => parseInt(d.trim()));
      
      if (days >= minDays && days <= maxDays) {
        return stage;
      }
    }
    
    // Return the last stage if no match found
    return stages[stages.length - 1];
  };

  // Helper function to generate 7 days of data
  const generateSevenDaysData = (plantationDate: string, plantingMethod: string): FertilizerEntry[] => {
    // Normalize the planting method to match bud.json format
    const normalizedMethod = plantingMethod
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Find the fertilizer schedule for this planting method
    const fertilizerSchedule = budData.fertilizer_schedule.find(schedule => {
      const scheduleMethod = schedule.method
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      return scheduleMethod === normalizedMethod;
    });
    
    if (!fertilizerSchedule) {
      // Use the first available schedule as fallback
      const fallbackSchedule = budData.fertilizer_schedule[0];
      if (fallbackSchedule) {
        return generateSevenDaysDataWithSchedule(plantationDate, fallbackSchedule);
      } else {
        throw new Error(`No fertilizer schedules available in bud.json`);
      }
    }
    
    return generateSevenDaysDataWithSchedule(plantationDate, fertilizerSchedule);
  };

  // Helper function to generate data with a specific schedule
  const generateSevenDaysDataWithSchedule = (plantationDate: string, fertilizerSchedule: any): FertilizerEntry[] => {
    const daysSincePlantation = calculateDaysSincePlantation(plantationDate);

    const sevenDaysData: FertilizerEntry[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(currentDate);
      targetDate.setDate(currentDate.getDate() + i);
      
      // Calculate days from plantation for this specific day
      const targetDays = daysSincePlantation + i;
      
      const currentStage = getCurrentStage(targetDays, fertilizerSchedule.stages);
      
      sevenDaysData.push({
        date: targetDate.toLocaleDateString('en-GB'),
        stage: currentStage.stage,
        days: `${targetDays}`,
        N_kg_acre: currentStage.N_kg_acre,
        P_kg_acre: currentStage.P_kg_acre,
        K_kg_acre: currentStage.K_kg_acre,
        fertilizers: currentStage.fertilizers,
        organic_inputs: currentStage.organic_inputs,
      });
    }

    return sevenDaysData;
  };

  useEffect(() => {
    // Wait for profile to load
    if (profileLoading) {
      return;
    }

    // Wait for plot selection
    if (!selectedPlotName) {
      setData([]);
      setLocalError(null);
      return;
    }

    try {
      setLocalError(null);

      // Check if profile exists and has plots
      if (!profile || !profile.plots || profile.plots.length === 0) {
        throw new Error('No plots found in farmer profile');
      }

      // Get the selected plot - try multiple matching strategies
      let selectedPlot = profile.plots.find(p => p.fastapi_plot_id === selectedPlotName);
      
      // If not found by fastapi_plot_id, try matching by constructed plot ID
      if (!selectedPlot) {
        selectedPlot = profile.plots.find(p => {
          const plotId = p.fastapi_plot_id || `${p.gat_number}_${p.plot_number}`;
          return plotId === selectedPlotName;
        });
      }
      
      // If still not found, try matching by gat_number and plot_number
      if (!selectedPlot) {
        const [gatNum, plotNum] = selectedPlotName.split('_');
        selectedPlot = profile.plots.find(p => 
          p.gat_number === gatNum && p.plot_number === plotNum
        );
      }
      
      if (!selectedPlot) {
        console.error('FertilizerTable: Selected plot not found', {
          selectedPlotName,
          availablePlots: profile.plots.map(p => ({
            fastapi_plot_id: p.fastapi_plot_id,
            gat_number: p.gat_number,
            plot_number: p.plot_number
          }))
        });
        throw new Error(`Selected plot "${selectedPlotName}" not found in farmer profile`);
      }
      
      console.log('FertilizerTable: Using plot', {
        selectedPlotName,
        foundPlot: {
          fastapi_plot_id: selectedPlot.fastapi_plot_id,
          gat_number: selectedPlot.gat_number,
          plot_number: selectedPlot.plot_number
        }
      });

      // Check if plot has farms
      if (!selectedPlot.farms || !Array.isArray(selectedPlot.farms) || selectedPlot.farms.length === 0) {
        throw new Error('No farms found for the current plot');
      }

      // Get the first farm from the selected plot
      const firstFarm = selectedPlot.farms?.[0];

      if (!firstFarm) {
        throw new Error('No farm data found for the selected plot');
      }

      // Extract plantation_date from farm data
      const plantationDate = firstFarm.plantation_date || 
                           firstFarm.created_at?.split('T')[0];

      // Extract planting_method from crop_type (as per bud.json structure)
      const plantingMethod = firstFarm.crop_type?.planting_method;

      if (!plantationDate) {
        throw new Error('Plantation date not found in farm data');
      }

      if (!plantingMethod) {
        throw new Error('Planting method not found in farm data');
      }

      console.log('FertilizerTable: Generating data for plot', {
        selectedPlotName,
        plantationDate,
        plantingMethod
      });

      // Generate fertilizer data using plantation_date and planting_method with bud.json
      const fertilizerData = generateSevenDaysData(plantationDate, plantingMethod);
      setData(fertilizerData);
      console.log('FertilizerTable: Generated fertilizer data', fertilizerData.length, 'entries');
      
    } catch (error: any) {
      // Failed to fetch data - show error
      console.error('FertilizerTable: Error loading fertilizer data:', error?.message || error);
      setLocalError(`Failed to fetch data: ${error?.message || 'Unknown error occurred'}`);
      setData([]);
    }
  }, [profile, profileLoading, profileError, selectedPlotName]);

  const handleDownloadPDF = async () => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 10, width, height);
      pdf.save('fertilizer_table.pdf');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Fertilizer Schedule</h2>
        <button
          onClick={handleDownloadPDF}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          
        </button>
      </div>

      {/* {farmData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Farm Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Farm ID:</span>
              <span className="ml-2 text-gray-800">{farmData.farm_uid}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Plantation Date:</span>
              <span className="ml-2 text-gray-800">{new Date(farmData.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Planting Method:</span>
              <span className="ml-2 text-gray-800">{farmData.planting_method}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Plantation Type:</span>
              <span className="ml-2 text-gray-800">{farmData.plantation_type}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Crop Type:</span>
              <span className="ml-2 text-gray-800">{farmData.crop_type_name}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Area Size:</span>
              <span className="ml-2 text-gray-800">{farmData.area_size} acres</span>
            </div>
          </div>
        </div>
      )} */}

      {(localError || profileError) && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">{localError || profileError}</p>
            </div>
          </div>
        </div>
      )}

      {profileLoading ? (
        <div className="flex items-center justify-center py-8">
          {/* <Satellite className="w-8 h-8 animate-spin text-blue-500" /> */}
          <span className="ml-2 text-gray-600">Loading fertilizer data...</span>
        </div>
      ) : (localError || profileError || data.length === 0) ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-lg font-semibold text-gray-800 mb-2">Failed to Fetch Data</p>
            <p className="text-sm text-gray-600">{localError || profileError || 'No fertilizer data available'}</p>
          </div>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Next 7 Days Fertilizer Schedule</h3>
            {/* <p className="text-sm text-gray-600">Showing first and last day (same values for all 7 days)</p> */}
          </div>
          <table className="min-w-full bg-green-400 border border-gray-200">
            <thead className="bg-green-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-weight-bold text-black-500 border-b">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-weight-bold text-black-500 border-b">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-sm font-weight-bold text-black-500 border-b">
                  Nutrients(kg/acre)
                </th>
                <th className="px-6 py-3 text-left text-sm font-weight-bold text-black-500 border-b">
                  Chemical Inputs
                </th>
                <th className="px-6 py-3 text-left text-sm font-weight-bold text-black-500 border-b">
                  Organic Inputs
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* First row - show actual data */}
              {data.length > 0 && (
                <tr className="bg-white">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[0].date}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {/* {data[0].stage} */}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    N : {data[0].N_kg_acre}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[0].fertilizers && (
                      <div className="text-sm font-normal">
                        <div>Urea: {data[0].fertilizers?.Urea_N_kg_per_acre} kg</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[0].organic_inputs && (
                      <div className="text-sm font-normal">
                        {data[0].organic_inputs?.map((input, index) => (
                          <div key={index}>{index === 0 ? input : ''}</div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              
              {/* Middle rows - show dots if there are more than 2 days */}
              {data.length > 2 && (
                <tr className="bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    To
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[0].stage}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    P : {data[0].P_kg_acre}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    <div className="text-sm font-normal">
                      SuperPhosphate: {data[0].fertilizers?.SuperPhosphate_P_kg_per_acre} kg
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[0].organic_inputs && (
                      <div className="text-sm font-normal">
                        {data[0].organic_inputs?.map((input, index) => (
                          <div key={index}>{index === 1 ? input : ''}</div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              
              {/* Last row - show actual data if there are more than 1 day */}
              {data.length > 1 && (
                <tr className="bg-white">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[data.length - 1].date}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {/* {data[data.length - 1].stage} */}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    K : {data[0].K_kg_acre}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[data.length - 1].fertilizers && (
                      <div className="text-sm font-normal">
                        <div>Muriate of Potash: {data[data.length - 1].fertilizers?.Potash_K_kg_per_acre} kg</div>
                      </div>  
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-normal text-gray-900 border-b">
                    {data[0].organic_inputs && (
                      <div className="text-sm font-normal">
                        {data[0].organic_inputs?.map((input, index) => (
                          <div key={index}>{index === 2 ? input : ''}</div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FertilizerTable;