import {
  getFarmerMyProfile,
  getCurrentUser,
  getFarmsWithFarmerDetails,
  getTasks,
} from '../api';

// Base URLs for external APIs
const BASE_URL = 'https://admin-cropeye.up.railway.app';
const EVENTS_BASE_URL = 'https://events-cropeye.up.railway.app';
const WEATHER_BASE_URL = 'https://weather-cropeye.up.railway.app';

interface PrefetchResult {
  success: boolean;
  errors?: string[];
  fetchedEndpoints: string[];
}

type UserRole = 'farmer' | 'manager' | 'admin' | 'fieldofficer' | 'owner';

/**
 * Pre-fetches all commonly used endpoints on login/app load to improve performance
 * Loads complete data at login and stores in cache for fast representation
 * Runs for ALL roles - farmer gets plot/map data, others get dashboard data
 */
export const prefetchAllData = async (
  setCached: (key: string, data: any) => void,
  selectedPlotName?: string | null,
  role?: UserRole | null
): Promise<PrefetchResult> => {
  const errors: string[] = [];
  const fetchedEndpoints: string[] = [];
  const today = new Date().toISOString().split('T')[0];
  const isFarmer = role === 'farmer' || !role;

  try {
    // 1. Fetch current user (used by all roles)
    const userPromise = getCurrentUser()
      .then((response) => {
        setCached('currentUser', response.data);
        fetchedEndpoints.push('currentUser');
        return response.data;
      })
      .catch((err) => {
        errors.push(`CurrentUser: ${err.message}`);
        return null;
      });

    // 2. For non-farmer roles: prefetch farms and tasks
    if (!isFarmer) {
      const commonPromises = [
        userPromise,
        getFarmsWithFarmerDetails()
          .then((response) => {
            const data = response.data?.results || response.data || [];
            setCached('farmsWithFarmerDetails', data);
            fetchedEndpoints.push('farmsWithFarmerDetails');
            return data;
          })
          .catch((err) => {
            errors.push(`Farms: ${err.message}`);
            return null;
          }),
        getTasks()
          .then((response) => {
            const data = response.data?.results || response.data || response.data?.data || [];
            setCached('tasks', Array.isArray(data) ? data : []);
            fetchedEndpoints.push('tasks');
            return data;
          })
          .catch((err) => {
            errors.push(`Tasks: ${err.message}`);
            return null;
          }),
      ];
      await Promise.allSettled(commonPromises);
      return {
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        fetchedEndpoints,
      };
    }

    // 3. Farmer-specific: fetch farmer profile (most important - used everywhere)
    const profilePromise = getFarmerMyProfile()
      .then((response) => {
        setCached('farmerProfile', response.data);
        fetchedEndpoints.push('farmerProfile');
        return response.data;
      })
      .catch((err) => {
        errors.push(`Profile: ${err.message}`);
        return null;
      });

    // Wait for profile first to get plot information
    const profile = await profilePromise;
    
    // Determine plot name from profile if not provided
    let plotName = selectedPlotName;
    if (!plotName && profile?.plots?.length > 0) {
      const firstPlot = profile.plots[0];
      plotName = firstPlot.fastapi_plot_id || 
                 `${firstPlot.gat_number}_${firstPlot.plot_number}` ||
                 firstPlot.plot_name;
    }

    if (!plotName) {
      // Still cache current user if we got it
      await userPromise;
      console.warn('⚠️ No plot name available for pre-fetching');
      return {
        success: errors.length === 0,
        errors,
        fetchedEndpoints,
      };
    }

    // 4. Fetch all map layer data in parallel (Growth, Water Uptake, Soil Moisture, Pest)
    const mapDataPromises = [
      // Growth data
      fetch(`${BASE_URL}/analyze_Growth?plot_name=${plotName}&end_date=${today}&days_back=7`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setCached(`growthData_${plotName}`, data);
            fetchedEndpoints.push('growthData');
            return data;
          }
          throw new Error(`Growth API: ${res.status}`);
        })
        .catch((err) => {
          errors.push(`Growth: ${err.message}`);
          return null;
        }),

      // Water Uptake data
      fetch(`${BASE_URL}/wateruptake?plot_name=${plotName}&end_date=${today}&days_back=7`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setCached(`waterUptakeData_${plotName}`, data);
            fetchedEndpoints.push('waterUptakeData');
            return data;
          }
          throw new Error(`Water Uptake API: ${res.status}`);
        })
        .catch((err) => {
          errors.push(`Water Uptake: ${err.message}`);
          return null;
        }),

      // Soil Moisture data
      fetch(`${BASE_URL}/SoilMoisture?plot_name=${plotName}&end_date=${today}&days_back=7`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setCached(`soilMoistureData_${plotName}`, data);
            fetchedEndpoints.push('soilMoistureData');
            return data;
          }
          throw new Error(`Soil Moisture API: ${res.status}`);
        })
        .catch((err) => {
          errors.push(`Soil Moisture: ${err.message}`);
          return null;
        }),

      // Pest detection data
      fetch(`${BASE_URL}/pest-detection?plot_name=${plotName}&end_date=${today}&days_back=7`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setCached(`pestData_${plotName}`, data);
            fetchedEndpoints.push('pestData');
            return data;
          }
          throw new Error(`Pest API: ${res.status}`);
        })
        .catch((err) => {
          errors.push(`Pest: ${err.message}`);
          return null;
        }),
    ];

    // 5. Fetch weather data if plot has coordinates
    let weatherPromise: Promise<any> | null = null;
    if (profile?.plots?.[0]?.coordinates?.location) {
      const plot = profile.plots[0];
      const lat = plot.coordinates.location.latitude;
      const lon = plot.coordinates.location.longitude;
      
      weatherPromise = fetch(`${WEATHER_BASE_URL}/current-weather?lat=${lat}&lon=${lon}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setCached(`weatherData_${plotName}`, data);
            fetchedEndpoints.push('weatherData');
            return data;
          }
          throw new Error(`Weather API: ${res.status}`);
        })
        .catch((err) => {
          errors.push(`Weather: ${err.message}`);
          return null;
        });
    }

    // 6. Fetch plot indices (for FarmerDashboard)
    const plotId = profile?.plots?.[0]?.id || profile?.plots?.[0]?.fastapi_plot_id;
    let indicesPromise: Promise<any> | null = null;
    if (plotId) {
      indicesPromise = fetch(`${EVENTS_BASE_URL}/plots/${plotId}/indices`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            const formattedData = data.map((item: any) => ({
              date: new Date(item.date).toISOString().split('T')[0],
              growth: item.NDVI,
              stress: item.NDMI,
              water: item.NDWI,
              moisture: item.NDRE,
            }));
            setCached(`indices_${plotId}`, formattedData);
            fetchedEndpoints.push('indices');
            return formattedData;
          }
          throw new Error(`Indices API: ${res.status}`);
        })
        .catch((err) => {
          errors.push(`Indices: ${err.message}`);
          return null;
        });
    }

    // Execute all promises in parallel (including user for farmer)
    const allPromises = [
      userPromise,
      ...mapDataPromises,
      weatherPromise,
      indicesPromise,
    ].filter(Boolean) as Promise<any>[];

    await Promise.allSettled(allPromises);

    console.log('✅ Pre-fetch completed:', {
      fetched: fetchedEndpoints.length,
      endpoints: fetchedEndpoints,
      errors: errors.length > 0 ? errors : undefined,
    });

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      fetchedEndpoints,
    };
  } catch (error: any) {
    console.error('❌ Pre-fetch error:', error);
    return {
      success: false,
      errors: [error.message || 'Unknown error'],
      fetchedEndpoints,
    };
  }
};
