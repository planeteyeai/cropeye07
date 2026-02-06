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
  chewing_affected_pixel_percentage: number;
  sucking_affected_pixel_percentage: number;
  SoilBorn_affected_pixel_percentage: number;
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
 * Calculate days since plantation
 */
export function calculateDaysSincePlantation(plantationDate: string): number {
  const today = new Date();
  const plantation = new Date(plantationDate);
  
  if (isNaN(plantation.getTime())) {
    // Try parsing different date formats
    const parts = plantationDate.split("-");
    if (parts.length === 3) {
      plantation.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  
  const daysSincePlantation = Math.floor((today.getTime() - plantation.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysSincePlantation);
}

/**
 * Assess pest risk based on API percentage, stage (days), and month
 * Only shows HIGH if: API percentage > 0 AND stage matches AND month matches
 * Otherwise returns null (no display)
 */
function assessPestRisk(
  pest: any,
  daysSincePlantation: number,
  currentMonth: string,
  currentTemp: number,
  currentHumidity: number,
  pestDetectionData?: PestDetectionData
): 'High' | 'Moderate' | 'Low' | null {
  // Check if API detected this pest category (legend circle shows percentage)
  let apiPercentage = 0;
  if (pestDetectionData) {
    if (pest.category === 'chewing') {
      apiPercentage = pestDetectionData.chewing_affected_pixel_percentage || 0;
    } else if (pest.category === 'sucking') {
      apiPercentage = pestDetectionData.sucking_affected_pixel_percentage || 0;
    } else if (pest.category === 'soil_borne') {
      apiPercentage = pestDetectionData.SoilBorn_affected_pixel_percentage || 0;
    }
  }
  
  // Log if pest category is missing (this could be why it's not showing)
  if (!pest.category) {
    console.warn(`⚠️ Pest "${pest.name}" is missing category field! This pest will not match any API data.`);
  }
  
  // If no API percentage detected, don't display
  if (apiPercentage === 0) {
    // Only log if this pest has a category but API shows 0 (helps debug category mismatches)
    if (pest.category && pestDetectionData) {
      const allPercentages = {
        chewing: pestDetectionData.chewing_affected_pixel_percentage || 0,
        sucking: pestDetectionData.sucking_affected_pixel_percentage || 0,
        soil_borne: pestDetectionData.SoilBorn_affected_pixel_percentage || 0
      };
      console.log(`ℹ️ Pest "${pest.name}" (category: ${pest.category}) has API percentage = 0. Available percentages:`, allPercentages);
    }
    return null;
  }
  
  // Check if stage matches (days since plantation)
  let stageMatch = true; // Default to true if no stage info
  if (pest.stage) {
    stageMatch = daysSincePlantation >= pest.stage.minDays && daysSincePlantation <= pest.stage.maxDays;
  }
  
  // Check if month matches (case-insensitive comparison)
  const currentMonthNormalized = currentMonth.trim().toLowerCase();
  const pestMonthsNormalized = pest.months.map((m: string) => m.trim().toLowerCase());
  const monthMatch = pestMonthsNormalized.includes(currentMonthNormalized);
  
  // Only show HIGH if: API percentage > 0 AND stage matches AND month matches
  // If month doesn't match, don't display at all
  const willDisplay = apiPercentage > 0 && stageMatch && monthMatch;
  
  // Debug logging for ALL pests with API percentage > 0
  // This helps identify why a pest isn't showing even when conditions seem to match
  if (apiPercentage > 0) {
    console.log(`🔍 Pest Assessment: ${pest.name}`, {
      'Category': pest.category,
      'API Percentage': apiPercentage,
      'Days Since Plantation': daysSincePlantation,
      'Stage Range': pest.stage ? `${pest.stage.minDays}-${pest.stage.maxDays} days` : 'Any',
      'Stage Match': stageMatch,
      'Current Month (original)': currentMonth,
      'Current Month (normalized)': currentMonthNormalized,
      'Active Months (original)': pest.months.join(', '),
      'Active Months (normalized)': pestMonthsNormalized.join(', '),
      'Month Match': monthMatch,
      '✅ Will Display': willDisplay ? 'YES (HIGH)' : 'NO',
      'Reason': !willDisplay ? (
        apiPercentage === 0 ? 'API percentage is 0' :
        !stageMatch ? `Stage does not match (need ${pest.stage?.minDays}-${pest.stage?.maxDays} days, got ${daysSincePlantation})` : 
        !monthMatch ? `Month does not match (need one of: ${pest.months.join(', ')}, got: ${currentMonth})` : 
        'Unknown reason'
      ) : 'All conditions match ✓'
    });
  }
  
  if (willDisplay) {
    return 'High';
  }
  
  // Don't display if any condition doesn't match
  return null;
}

/**
 * Assess disease risk based on API percentage (fungi), stage (days), and month
 * Only shows HIGH if: API fungi percentage > 0 AND stage matches AND month matches
 * Otherwise returns null (no display)
 */
function assessDiseaseRisk(
  disease: any,
  daysSincePlantation: number,
  currentMonth: string,
  currentTemp: number,
  currentHumidity: number,
  pestDetectionData?: PestDetectionData
): 'High' | 'Moderate' | 'Low' | null {
  // Check if API detected fungi (legend circle shows fungi percentage)
  const fungiPercentage = pestDetectionData?.fungi_affected_pixel_percentage || 0;
  
  // Only fungal diseases (Red Rot, Rust) are shown based on fungi percentage
  const isFungalDisease = disease.name === 'Red Rot' || disease.name === 'Rust';
  
  // If no fungi percentage detected, don't display
  if (fungiPercentage === 0 || !isFungalDisease) {
    return null;
  }
  
  // Check if stage matches (days since plantation)
  let stageMatch = true; // Default to true if no stage info
  if (disease.stage) {
    stageMatch = daysSincePlantation >= disease.stage.minDays && daysSincePlantation <= disease.stage.maxDays;
  }
  
  // Check if month matches (case-insensitive comparison)
  const currentMonthNormalized = currentMonth.trim().toLowerCase();
  const diseaseMonthsNormalized = disease.months.map((m: string) => m.trim().toLowerCase());
  const monthMatch = diseaseMonthsNormalized.includes(currentMonthNormalized);
  
  // Only show HIGH if: API fungi percentage > 0 AND stage matches AND month matches
  // If month doesn't match, don't display at all
  const willDisplay = fungiPercentage > 0 && stageMatch && monthMatch;
  
  // Debug logging for all diseases with fungi percentage > 0
  if (fungiPercentage > 0 && isFungalDisease) {
    console.log(`🔍 Disease Assessment: ${disease.name}`, {
      'Fungi Percentage': fungiPercentage,
      'Days Since Plantation': daysSincePlantation,
      'Stage Range': disease.stage ? `${disease.stage.minDays}-${disease.stage.maxDays} days` : 'Any',
      'Stage Match': stageMatch,
      'Current Month (original)': currentMonth,
      'Current Month (normalized)': currentMonthNormalized,
      'Active Months (original)': disease.months.join(', '),
      'Active Months (normalized)': diseaseMonthsNormalized.join(', '),
      'Month Match': monthMatch,
      '✅ Will Display': willDisplay ? 'YES (HIGH)' : 'NO',
      'Reason': !willDisplay ? (
        !stageMatch ? `Stage does not match (need ${disease.stage?.minDays}-${disease.stage?.maxDays} days, got ${daysSincePlantation})` : 
        !monthMatch ? `Month does not match (need one of: ${disease.months.join(', ')}, got: ${currentMonth})` : 
        'Fungi percentage is 0'
      ) : 'All conditions match ✓'
    });
  }
  
  if (willDisplay) {
    return 'High';
  }
  
  // Don't display if any condition doesn't match
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
        fungi_affected_pixel_percentage: 0,
        chewing_affected_pixel_percentage: 0,
        sucking_affected_pixel_percentage: 0,
        SoilBorn_affected_pixel_percentage: 0,
      };
    }

    const response = await getFarmerMyProfile();
    const profileData = response.data;
    
    if (!profileData.plots || profileData.plots.length === 0) {
      console.warn('No plots found in user profile for pest detection');
      return {
        fungi_affected_pixel_percentage: 0,
        chewing_affected_pixel_percentage: 0,
        sucking_affected_pixel_percentage: 0,
        SoilBorn_affected_pixel_percentage: 0,
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
    
    // Use proxy in development to avoid CORS issues, direct URL in production
    const baseUrl = import.meta.env.DEV 
      ? '/api/dev-plot' 
      : 'https://admin-cropeye.up.railway.app';
    const url = `${baseUrl}/pest-detection?plot_name=${plotName}&end_date=${currentDate}&days_back=7`;
    
    // Try fetch with explicit CORS mode and proper headers matching curl command
    const postResponse = await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "omit",
      headers: { 
        "Accept": "application/json"
      },
    });
    
    if (postResponse.ok) {
      const pestData = await postResponse.json();
      const pixelSummary = pestData.pixel_summary || {};
      return {
        fungi_affected_pixel_percentage: pixelSummary.fungi_affected_pixel_percentage || 0,
        chewing_affected_pixel_percentage: pixelSummary.chewing_affected_pixel_percentage || 0,
        sucking_affected_pixel_percentage: pixelSummary.sucking_affected_pixel_percentage || 0,
        SoilBorn_affected_pixel_percentage: pixelSummary.SoilBorn_affected_pixel_percentage || 0,
      };
    }
    
    // If request fails, return default
    console.warn(`Pest detection API error: ${postResponse.status}`);
    return {
      fungi_affected_pixel_percentage: 0,
      chewing_affected_pixel_percentage: 0,
      sucking_affected_pixel_percentage: 0,
      SoilBorn_affected_pixel_percentage: 0,
    };
    
  } catch (error: any) {
    console.warn('Error fetching pest detection data:', error?.message || error);
    return {
      fungi_affected_pixel_percentage: 0,
      chewing_affected_pixel_percentage: 0,
      sucking_affected_pixel_percentage: 0,
      SoilBorn_affected_pixel_percentage: 0,
    };
  }
}

/**
 * Main function to generate pest and disease risk assessment
 */
export async function generateRiskAssessment(
  plantationDate: string,
  weatherData: WeatherData,
  plotId?: string
): Promise<RiskAssessmentResult> {
  try {
    // Calculate days since plantation
    const daysSincePlantation = calculateDaysSincePlantation(plantationDate);
    
    // Calculate current sugarcane stage
    const currentStage = calculateSugarcaneStage(plantationDate);
    
    // Extract current conditions
    const currentMonth = weatherData.month;
    const currentTemp = weatherData.temperature;
    const currentHumidity = weatherData.humidity;
    
    console.log('🌱 Risk Assessment Input Data:', {
      'Plantation Date': plantationDate,
      'Days Since Plantation': daysSincePlantation,
      'Current Stage': currentStage,
      'Current Month': currentMonth,
      'Temperature': currentTemp,
      'Humidity': currentHumidity,
      'Plot ID': plotId
    });
    
    // Fetch API pest detection data
    let pestDetectionData: PestDetectionData | undefined;
    try {
      pestDetectionData = await fetchPestDetectionData(plotId);
      console.log('📊 Pest detection API data:', pestDetectionData);
    } catch (error) {
      console.warn('⚠️ Error fetching pest detection data:', error);
      pestDetectionData = {
        fungi_affected_pixel_percentage: 0,
        chewing_affected_pixel_percentage: 0,
        sucking_affected_pixel_percentage: 0,
        SoilBorn_affected_pixel_percentage: 0,
      };
    }
    
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
    
    // Determine which pest categories have percentage > 0 (legend circle shows percentage)
    const activeCategories: string[] = [];
    if (pestDetectionData) {
      if (pestDetectionData.chewing_affected_pixel_percentage > 0) {
        activeCategories.push('chewing');
      }
      if (pestDetectionData.sucking_affected_pixel_percentage > 0) {
        activeCategories.push('sucking');
      }
      if (pestDetectionData.SoilBorn_affected_pixel_percentage > 0) {
        activeCategories.push('soil_borne');
      }
    }
    
    console.log('📋 Active Pest Categories (with percentage > 0):', activeCategories.length > 0 ? activeCategories.join(', ') : 'NONE - No pests will be displayed');
    
    // Assess pest risks: Only show HIGH if API percentage > 0 AND stage matches AND month matches
    // Only process pests from categories that have percentage > 0
    for (const pest of pestsData) {
      // Skip pests that don't have a category or whose category has 0% in API
      if (!pest.category || !activeCategories.includes(pest.category)) {
        continue; // Skip this pest - its category has no percentage
      }
      
      const riskLevel = assessPestRisk(
        pest,
        daysSincePlantation,
        currentMonth,
        currentTemp,
        currentHumidity,
        pestDetectionData
      );
      
      // Only add to HIGH, no LOW or MODERATE
      if (riskLevel === 'High') {
        result.pests.High.push(pest.name);
      }
    }
    
    // Check if fungi percentage > 0 (legend circle shows fungi percentage)
    const hasFungi = pestDetectionData?.fungi_affected_pixel_percentage > 0;
    console.log('🍄 Fungal Diseases Active:', hasFungi ? `YES (${pestDetectionData?.fungi_affected_pixel_percentage}%)` : 'NO - No diseases will be displayed');
    
    // Assess disease risks: Only show HIGH if API fungi percentage > 0 AND stage matches AND month matches
    // Only process diseases if fungi percentage > 0
    if (hasFungi) {
      for (const disease of diseasesData) {
        const riskLevel = assessDiseaseRisk(
          disease,
          daysSincePlantation,
          currentMonth,
          currentTemp,
          currentHumidity,
          pestDetectionData
        );
        
        // Only add to HIGH, no LOW or MODERATE
        if (riskLevel === 'High') {
          result.diseases.High.push(disease.name);
        }
      }
    } else {
      console.log('ℹ️ Skipping all diseases - fungi_affected_pixel_percentage is 0');
    }
    
    console.log('📊 Risk assessment result:', {
      daysSincePlantation,
      currentStage,
      currentMonth,
      pestDetectionData,
      pestsCount: {
        high: result.pests.High.length,
        moderate: result.pests.Moderate.length,
        low: result.pests.Low.length
      },
      pestsHigh: result.pests.High, // Show which pests are in High
      diseasesCount: {
        high: result.diseases.High.length,
        moderate: result.diseases.Moderate.length,
        low: result.diseases.Low.length
      },
      diseasesHigh: result.diseases.High // Show which diseases are in High
    });
    
    // Log summary of API detection and results
    if (pestDetectionData) {
      const hasChewing = pestDetectionData.chewing_affected_pixel_percentage > 0;
      const hasSucking = pestDetectionData.sucking_affected_pixel_percentage > 0;
      const hasSoilBorn = pestDetectionData.SoilBorn_affected_pixel_percentage > 0;
      const hasFungi = pestDetectionData.fungi_affected_pixel_percentage > 0;
      
      console.log('📊 Final API Detection Summary:', {
        'Chewing percentage': pestDetectionData.chewing_affected_pixel_percentage,
        'Sucking percentage': pestDetectionData.sucking_affected_pixel_percentage,
        'Soil Born percentage': pestDetectionData.SoilBorn_affected_pixel_percentage,
        'Fungi percentage': pestDetectionData.fungi_affected_pixel_percentage,
        'Active Categories': activeCategories.length > 0 ? activeCategories.join(', ') : 'NONE',
        'High Risk Pests Found': result.pests.High.length,
        'High Risk Diseases Found': result.diseases.High.length,
        'Pests Displayed': result.pests.High,
        'Diseases Displayed': result.diseases.High
      });
      
      // If API shows percentage but no pests/diseases in High, log why
      if ((hasChewing || hasSucking || hasSoilBorn) && result.pests.High.length === 0) {
        console.warn('⚠️ API detected pests (legend circle shows percentage) but none matched stage/month criteria!');
        console.warn('   This means: API percentage > 0, but either stage or month does not match.');
        console.warn('   Check console logs above for each pest to see why they were filtered out.');
      }
      if (hasFungi && result.diseases.High.length === 0) {
        console.warn('⚠️ API detected fungi (legend circle shows percentage) but no diseases matched stage/month criteria!');
        console.warn('   This means: Fungi percentage > 0, but either stage or month does not match.');
        console.warn('   Check console logs above for each disease to see why they were filtered out.');
      }
      
      // If all percentages are 0, confirm nothing will show
      if (!hasChewing && !hasSucking && !hasSoilBorn && !hasFungi) {
        console.log('ℹ️ All API percentages are 0 - No pests or diseases will be displayed (as expected)');
      }
    }
    
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
      console.warn('⚠️ No authentication token found, using fallback date');
      return new Date().toISOString().split('T')[0];
    }

    console.log('📅 Fetching plantation date for plot:', plotId);
    const response = await getFarmerMyProfile();
    const profileData = response.data;
    
    if (!profileData.plots || profileData.plots.length === 0) {
      console.warn('⚠️ No plots found in profile, using fallback date');
      return new Date().toISOString().split('T')[0];
    }

    // Find selected plot or use first plot
    let selectedPlot = null;
    if (plotId) {
      selectedPlot = profileData.plots.find((p: any) => 
        p.fastapi_plot_id === plotId ||
        `${p.gat_number}_${p.plot_number}` === plotId
      );
      console.log('🔍 Looking for plot:', plotId, 'Found:', selectedPlot ? 'Yes' : 'No');
    }
    
    if (!selectedPlot) {
      selectedPlot = profileData.plots[0];
      console.log('📋 Using first plot from profile:', selectedPlot.fastapi_plot_id || `${selectedPlot.gat_number}_${selectedPlot.plot_number}`);
    }

    // Get plantation date from plot's farms
    if (selectedPlot.farms && selectedPlot.farms.length > 0) {
      const firstFarm = selectedPlot.farms[0];
      if (firstFarm.plantation_date) {
        console.log('✅ Plantation date found:', firstFarm.plantation_date);
        return firstFarm.plantation_date;
      } else {
        console.warn('⚠️ No plantation_date in farm data, using fallback');
      }
    } else {
      console.warn('⚠️ No farms found in selected plot, using fallback date');
    }
    
    // Fallback to current date if no plantation date found
    const fallbackDate = new Date().toISOString().split('T')[0];
    console.warn('⚠️ Using fallback plantation date:', fallbackDate);
    return fallbackDate;
    
  } catch (error: any) {
    console.warn('⚠️ Error fetching plantation date, using fallback:', error?.message || error);
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

    const weatherResponse = await fetch(`https://weather-cropeye.up.railway.app/current-weather?lat=${lat}&lon=${lon}`);
    
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
