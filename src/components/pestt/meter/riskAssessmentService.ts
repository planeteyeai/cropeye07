import { pestsData } from './pestsData';
import { diseasesData } from './diseasesData';
import { getFarmerMyProfile } from '../../../api';

export interface WeatherData {
  temperature: number;
  humidity: number;
  month: string;
}

export interface PestDetectionData {
  fungi_affected_pixel_percentage: number;
}

export interface RiskAssessmentResult {
  stage: string;
  current_conditions: {
    month: string;
    temperature: string;
    humidity: string;
  };
  pests: {
    High: string[];
    Moderate: string[];
    Low: string[];
  };
  diseases: {
    High: string[];
    Moderate: string[];
    Low: string[];
  };
}

export interface SugarcaneStage {
  name: string;
  minDays: number;
  maxDays: number;
}

export const SUGARCANE_STAGES: SugarcaneStage[] = [
  {
    name: "Germination & Early Growth",
    minDays: 0,
    maxDays: 45
  },
  {
    name: "Tillering & Early Stem Elongation",
    minDays: 46,
    maxDays: 120
  },
  {
    name: "Grand Growth Phase",
    minDays: 121,
    maxDays: 210
  },
  {
    name: "Ripening & Maturity",
    minDays: 211,
    maxDays: 365
  }
];

/**
 * Calculate sugarcane stage based on plantation date
 */
export function calculateSugarcaneStage(plantationDate: string): string {
  const today = new Date();
  const plantation = new Date(plantationDate);
  
  const daysSincePlantation = Math.floor((today.getTime() - plantation.getTime()) / (1000 * 60 * 60 * 24));
  
  for (const stage of SUGARCANE_STAGES) {
    if (daysSincePlantation >= stage.minDays && daysSincePlantation <= stage.maxDays) {
      return stage.name;
    }
  }
  
  // If beyond 365 days, return the last stage
  return "Ripening & Maturity";
}

/**
 * Check if temperature and humidity fall within pest/disease ranges
 */
function checkTemperatureHumidityMatch(
  pestTemp: string,
  pestHumidity: string,
  currentTemp: number,
  currentHumidity: number
): { tempMatch: boolean; humidityMatch: boolean } {
  // Parse temperature range (e.g., "28-32" -> min: 28, max: 32)
  const tempRange = pestTemp.split('-').map(t => parseFloat(t.trim()));
  const tempMin = tempRange[0];
  const tempMax = tempRange[1];
  
  // Parse humidity range (e.g., "70-80" -> min: 70, max: 80)
  const humidityRange = pestHumidity.split('-').map(h => parseFloat(h.trim()));
  const humidityMin = humidityRange[0];
  const humidityMax = humidityRange[1];
  
  const tempMatch = currentTemp >= tempMin && currentTemp <= tempMax;
  const humidityMatch = currentHumidity >= humidityMin && currentHumidity <= humidityMax;
  
  return { tempMatch, humidityMatch };
}

/**
 * Assess pest risk based on stage, month, temperature, and humidity
 */
function assessPestRisk(
  pest: any,
  currentStage: string,
  currentMonth: string,
  currentTemp: number,
  currentHumidity: number
): 'High' | 'Moderate' | 'Low' | null {
  // Check if stage matches (for now, we'll skip stage matching since we don't have stage data in pests)
  // const stageMatch = pest.stage === currentStage || pest.stage === "(any stage)";
  
  // Check if month matches
  const monthMatch = pest.months.includes(currentMonth);
  
  // Check temperature and humidity
  const { tempMatch, humidityMatch } = checkTemperatureHumidityMatch(
    pest.temperature,
    pest.humidity,
    currentTemp,
    currentHumidity
  );
  
  // Risk assessment logic
  if (monthMatch && tempMatch && humidityMatch) {
    return 'High';
  } else if (monthMatch && (tempMatch || humidityMatch)) {
    return 'Moderate';
  } else if (!monthMatch && tempMatch && humidityMatch) {
    return 'Low';
  }
  
  return null;
}

/**
 * Assess disease risk based on stage, month, temperature, and humidity
 */
function assessDiseaseRisk(
  disease: any,
  currentStage: string,
  currentMonth: string,
  currentTemp: number,
  currentHumidity: number
): 'High' | 'Moderate' | 'Low' | null {
  // Check if month matches
  const monthMatch = disease.months.includes(currentMonth);
  
  // Check temperature and humidity from conditions
  let tempMatch = false;
  let humidityMatch = false;
  
  if (disease.conditions && disease.conditions.length > 0) {
    for (const condition of disease.conditions) {
      const tempRange = condition.temperatureRange.replace('°C', '').split('–').map((t: string) => parseFloat(t.trim()));
      const humidityRange = condition.humidityRange.replace('%', '').split('–').map((h: string) => parseFloat(h.trim()));
      
      const tempMin = tempRange[0];
      const tempMax = tempRange[1];
      const humidityMin = humidityRange[0];
      const humidityMax = humidityRange[1];
      
      if (currentTemp >= tempMin && currentTemp <= tempMax) {
        tempMatch = true;
      }
      if (currentHumidity >= humidityMin && currentHumidity <= humidityMax) {
        humidityMatch = true;
      }
    }
  }
  
  // Risk assessment logic
  if (monthMatch && tempMatch && humidityMatch) {
    return 'High';
  } else if (monthMatch && (tempMatch || humidityMatch)) {
    return 'Moderate';
  } else if (!monthMatch && tempMatch && humidityMatch) {
    return 'Low';
  }
  
  return null;
}

/**
 * Fetch pest detection data from API
 */
export async function fetchPestDetectionData(plotId?: string): Promise<PestDetectionData> {
  try {
    // Check if token exists before making API call
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found for pest detection');
      return {
        fungi_affected_pixel_percentage: 0
      };
    }

    const response = await getFarmerMyProfile();
    const profileData = response.data;
    
    if (!profileData.plots || profileData.plots.length === 0) {
      console.warn('No plots found in user profile for pest detection');
      return {
        fungi_affected_pixel_percentage: 0
      };
    }

    // Find selected plot or use first plot
    let selectedPlot = null;
    if (plotId) {
      selectedPlot = profileData.plots.find((p: any) => 
        p.fastapi_plot_id === plotId ||
        `${p.gat_number}_${p.plot_number}` === plotId ||
        p.plot_name === plotId
      );
    }
    
    if (!selectedPlot) {
      selectedPlot = profileData.plots[0];
    }

    const plotName = selectedPlot.plot_name || selectedPlot.fastapi_plot_id || `${selectedPlot.gat_number}_${selectedPlot.plot_number}`;
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Try POST with body first (as per Map.tsx implementation)
    const postUrl = `https://dev-plot.cropeye.ai/pest-detection`;
    const postResponse = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plot_name: plotName,
        end_date: currentDate,
        days_back: 7
      }),
    });
    
    if (postResponse.ok) {
      const pestData = await postResponse.json();
      return {
        fungi_affected_pixel_percentage: pestData.fungi_affected_pixel_percentage || 0
      };
    }
    
    // Fallback: try with query params
    const queryUrl = `https://dev-plot.cropeye.ai/pest-detection?plot_name=${encodeURIComponent(plotName)}&end_date=${currentDate}&days_back=7`;
    const queryResponse = await fetch(queryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (queryResponse.ok) {
      const pestData = await queryResponse.json();
      return {
        fungi_affected_pixel_percentage: pestData.fungi_affected_pixel_percentage || 0
      };
    }
    
    // If both fail, return default
    console.warn(`Pest detection API error: ${postResponse.status} / ${queryResponse.status}`);
    return {
      fungi_affected_pixel_percentage: 0
    };
    
  } catch (error: any) {
    console.warn('Error fetching pest detection data:', error?.message || error);
    return {
      fungi_affected_pixel_percentage: 0
    };
  }
}

/**
 * Main function to generate pest and disease risk assessment
 */
export async function generateRiskAssessment(
  plantationDate: string,
  weatherData: WeatherData
): Promise<RiskAssessmentResult> {
  try {
  // Calculate current sugarcane stage
  const currentStage = calculateSugarcaneStage(plantationDate);
    
    // Extract current conditions
    const currentMonth = weatherData.month;
    const currentTemp = weatherData.temperature;
    const currentHumidity = weatherData.humidity;
    
    // Initialize result
    const result: RiskAssessmentResult = {
      stage: currentStage,
      current_conditions: {
        month: currentMonth,
        temperature: `${currentTemp}°C`,
        humidity: `${currentHumidity}%`
      },
      pests: {
        High: [],
        Moderate: [],
        Low: []
      },
      diseases: {
        High: [],
        Moderate: [],
        Low: []
      }
    };
    
    // Assess pest risks
    for (const pest of pestsData) {
      const riskLevel = assessPestRisk(
        pest,
        currentStage,
        currentMonth,
        currentTemp,
        currentHumidity
      );
      
      if (riskLevel) {
        result.pests[riskLevel].push(pest.name);
      }
    }
    
    // Assess disease risks (exclude Red Rot from normal assessment)
    for (const disease of diseasesData) {
      if (disease.name === 'Red Rot') continue; // Skip Red Rot from normal assessment
      
      const riskLevel = assessDiseaseRisk(
        disease,
        currentStage,
        currentMonth,
        currentTemp,
        currentHumidity
      );
      
      if (riskLevel) {
        result.diseases[riskLevel].push(disease.name);
      }
    }
    
    // Check for Red Rot based on fungi detection only
    try {
      const pestDetectionData = await fetchPestDetectionData();
      console.log('Pest detection data:', pestDetectionData);
      if (pestDetectionData.fungi_affected_pixel_percentage > 0) {
        console.log('Adding Red Rot to High risk');
        result.diseases.High.push('Red Rot');
      }
    } catch (error) {
      console.error('Error checking fungi detection:', error);
    }
    
    // Temporary: Force add Red Rot for testing
    result.diseases.High.push('Red Rot');
    
    return result;
    
  } catch (error) {
    console.error('Error generating risk assessment:', error);
    throw new Error('Failed to generate risk assessment');
  }
}

/**
 * Fetch plantation date from farmer profile API
 */
export async function fetchPlantationDate(plotId?: string): Promise<string> {
  try {
    // Check if token exists before making API call
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found, using fallback date');
      return new Date().toISOString().split('T')[0];
    }

    const response = await getFarmerMyProfile();
    const profileData = response.data;
    
    if (!profileData.plots || profileData.plots.length === 0) {
      return new Date().toISOString().split('T')[0];
    }

    // Find selected plot or use first plot
    let selectedPlot = null;
    if (plotId) {
      selectedPlot = profileData.plots.find((p: any) => 
        p.fastapi_plot_id === plotId ||
        `${p.gat_number}_${p.plot_number}` === plotId
      );
    }
    
    if (!selectedPlot) {
      selectedPlot = profileData.plots[0];
    }

    // Get plantation date from plot's farms
    if (selectedPlot.farms && selectedPlot.farms.length > 0) {
      const firstFarm = selectedPlot.farms[0];
      if (firstFarm.plantation_date) {
        return firstFarm.plantation_date;
      }
    }
    
    // Fallback to current date if no plantation date found
    return new Date().toISOString().split('T')[0];
    
  } catch (error: any) {
    console.warn('Error fetching plantation date, using fallback:', error?.message || error);
    // Return today's date as fallback - don't throw error, just use fallback
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Fetch current weather data using user's location from farmer profile
 */
export async function fetchCurrentWeather(plotId?: string): Promise<WeatherData> {
  try {
    // Check if token exists before making API call
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found, using default weather data');
      // Return default weather data instead of throwing error
      const currentDate = new Date();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const currentMonth = monthNames[currentDate.getMonth()];
      
      return {
        temperature: 25, // Default temperature
        humidity: 60, // Default humidity
        month: currentMonth
      };
    }

    const response = await getFarmerMyProfile();
    const profileData = response.data;
    
    if (!profileData.plots || profileData.plots.length === 0) {
      throw new Error('No plots found in user profile');
    }

    // Find selected plot or use first plot
    let selectedPlot = null;
    if (plotId) {
      selectedPlot = profileData.plots.find((p: any) => 
        p.fastapi_plot_id === plotId ||
        `${p.gat_number}_${p.plot_number}` === plotId
      );
    }
    
    if (!selectedPlot) {
      selectedPlot = profileData.plots[0];
    }

    if (!selectedPlot.coordinates?.location?.latitude || !selectedPlot.coordinates?.location?.longitude) {
      throw new Error('No coordinates found in user plot data');
    }

    const lat = selectedPlot.coordinates.location.latitude;
    const lon = selectedPlot.coordinates.location.longitude;

    const weatherResponse = await fetch(`https://dev-weather.cropeye.ai/current-weather?lat=${lat}&lon=${lon}`);
    
    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }
    
    const weatherData = await weatherResponse.json();
    
    const currentDate = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonth = monthNames[currentDate.getMonth()];
    
    return {
      temperature: weatherData.temperature || 25,
      humidity: weatherData.humidity || 60,
      month: currentMonth
    };
  } catch (error: any) {
    console.warn('Error fetching weather data, using defaults:', error?.message || error);
    // Return default weather data instead of throwing error
    const currentDate = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonth = monthNames[currentDate.getMonth()];
    
    return {
      temperature: 25, // Default temperature
      humidity: 60, // Default humidity
      month: currentMonth
    };
  }
}
