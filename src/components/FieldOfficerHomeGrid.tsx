// src/FieldOfficerHomeGrid.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, CalendarDays, Book, Users, LandPlot, Truck, CheckCircle, Clock } from 'lucide-react';
import { getFarmersByFieldOfficer, getTasksForUser, getCurrentUser, getFarmsWithFarmerDetails, getRecentFarmers } from '../api';
import { jwtDecode } from 'jwt-decode';
import { getAuthToken } from '../utils/auth';

interface FieldOfficerHomeGridProps {
  onMenuClick: (menuTitle: string) => void;
  onOpenSidebarWithMenu: (menuTitle: string) => void;
}

interface DashboardStats {
  totalFarmers: number;
  totalPlots: number;
  approvedTasks: number;
  pendingTasks: number;
  completedTasks: number;
}

const FieldOfficerHomeGrid: React.FC<FieldOfficerHomeGridProps> = ({ onMenuClick, onOpenSidebarWithMenu }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalFarmers: 0,
    totalPlots: 0,
    approvedTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        
        // Get current user ID
        let currentUserId: number | null = null;
        try {
          const token = getAuthToken();
          if (token) {
            const decoded: any = jwtDecode(token);
            currentUserId = decoded.user_id || decoded.id;
          }
        } catch (error) {
          console.error('Error decoding token:', error);
        }

        if (!currentUserId) {
          try {
            const userResponse = await getCurrentUser();
            currentUserId = userResponse.data.id;
          } catch (error) {
            console.error('Error fetching current user:', error);
            setLoading(false);
            return;
          }
        }

        console.log('🔍 Fetching dashboard stats for Field Officer ID:', currentUserId);
        
        // Fetch all data in parallel
        const [farmersResponse, tasksResponse, farmsResponse, recentFarmersResponse] = await Promise.allSettled([
          currentUserId ? getFarmersByFieldOfficer(currentUserId) : Promise.reject(new Error('No user ID')),
          currentUserId ? getTasksForUser(currentUserId) : Promise.reject(new Error('No user ID')),
          getFarmsWithFarmerDetails(),
          getRecentFarmers(), // Fallback: get recent farmers
        ]);

        // Process farmers data - Count farmers under this field officer
        let totalFarmers = 0;
        if (farmersResponse.status === 'fulfilled') {
          const responseValue = farmersResponse.value;
          const responseData = responseValue?.data;
          
          console.log('🔍 Farmers API Response:', {
            status: farmersResponse.status,
            responseValue,
            responseData,
            dataType: typeof responseData,
            isArray: Array.isArray(responseData),
            keys: responseData ? Object.keys(responseData) : [],
          });
          
          let farmersArray: any[] = [];
          
          // Handle different response formats
          if (Array.isArray(responseData)) {
            farmersArray = responseData;
            console.log('✅ Found direct array with', farmersArray.length, 'items');
          } else if (responseData && Array.isArray(responseData.results)) {
            farmersArray = responseData.results;
            console.log('✅ Found results array with', farmersArray.length, 'items');
          } else if (responseData && Array.isArray(responseData.farmers)) {
            farmersArray = responseData.farmers;
            console.log('✅ Found farmers array with', farmersArray.length, 'items');
          } else if (responseData && Array.isArray(responseData.data)) {
            farmersArray = responseData.data;
            console.log('✅ Found data array with', farmersArray.length, 'items');
          } else {
            console.warn('⚠️ Unexpected response format:', responseData);
            // Try to extract any array from the response
            if (responseData) {
              for (const key in responseData) {
                if (Array.isArray(responseData[key])) {
                  farmersArray = responseData[key];
                  console.log(`✅ Found array in key "${key}" with`, farmersArray.length, 'items');
                  break;
                }
              }
            }
          }
          
          // Count unique farmers (in case of duplicates)
          const uniqueFarmers = new Set();
          farmersArray.forEach((farmer: any, index: number) => {
            if (farmer?.id) {
              uniqueFarmers.add(farmer.id);
            } else {
              console.warn(`⚠️ Farmer at index ${index} has no ID:`, farmer);
            }
          });
          
          totalFarmers = uniqueFarmers.size;
          
          console.log(`📊 Field Officer ${currentUserId}: Found ${totalFarmers} unique farmers from ${farmersArray.length} total items`);
          
          // If still 0, try fallback: getRecentFarmers
          if (totalFarmers === 0) {
            console.log('⚠️ No farmers found from getFarmersByFieldOfficer, trying getRecentFarmers as fallback...');
            if (recentFarmersResponse.status === 'fulfilled') {
              const recentData = recentFarmersResponse.value.data;
              let recentFarmersArray: any[] = [];
              
              if (Array.isArray(recentData)) {
                recentFarmersArray = recentData;
              } else if (Array.isArray(recentData?.farmers)) {
                recentFarmersArray = recentData.farmers;
              } else if (Array.isArray(recentData?.results)) {
                recentFarmersArray = recentData.results;
              }
              
              // Count farmers (assuming recent farmers are under this field officer)
              const recentUniqueFarmers = new Set();
              recentFarmersArray.forEach((farmer: any) => {
                if (farmer?.id) {
                  recentUniqueFarmers.add(farmer.id);
                }
              });
              
              if (recentUniqueFarmers.size > 0) {
                totalFarmers = recentUniqueFarmers.size;
                console.log(`✅ Fallback: Found ${totalFarmers} farmers from getRecentFarmers`);
              } else {
                console.log('⚠️ Fallback also returned 0 farmers');
                if (recentFarmersArray.length > 0) {
                  console.log('🔍 Sample recent farmer data:', recentFarmersArray.slice(0, 3));
                }
              }
            }
            
            // If still 0, log the first few items for debugging
            if (totalFarmers === 0 && farmersArray.length > 0) {
              console.log('🔍 Sample farmer data from getFarmersByFieldOfficer:', farmersArray.slice(0, 3));
            }
          }
        } else {
          const error = farmersResponse.reason;
          console.error('❌ Error fetching farmers:', {
            error,
            message: error?.message,
            response: error?.response?.data,
            status: error?.response?.status,
          });
          
          // Try fallback on error
          if (recentFarmersResponse.status === 'fulfilled') {
            console.log('🔄 Trying fallback: getRecentFarmers...');
            const recentData = recentFarmersResponse.value.data;
            let recentFarmersArray: any[] = [];
            
            if (Array.isArray(recentData)) {
              recentFarmersArray = recentData;
            } else if (Array.isArray(recentData?.farmers)) {
              recentFarmersArray = recentData.farmers;
            } else if (Array.isArray(recentData?.results)) {
              recentFarmersArray = recentData.results;
            }
            
            const recentUniqueFarmers = new Set();
            recentFarmersArray.forEach((farmer: any) => {
              if (farmer?.id) {
                recentUniqueFarmers.add(farmer.id);
              }
            });
            
            totalFarmers = recentUniqueFarmers.size;
            console.log(`✅ Fallback: Found ${totalFarmers} farmers from getRecentFarmers`);
          }
        }

        // Process plots data - Count plots from farmers under this field officer
        let totalPlots = 0;
        const plotSet = new Set();
        
        // Primary: Count plots from farmers data (farmers under field officer)
        if (farmersResponse.status === 'fulfilled') {
          const responseData = farmersResponse.value.data;
          let farmersArray: any[] = [];
          
          // Handle different response formats
          if (Array.isArray(responseData)) {
            farmersArray = responseData;
          } else if (Array.isArray(responseData?.results)) {
            farmersArray = responseData.results;
          } else if (Array.isArray(responseData?.farmers)) {
            farmersArray = responseData.farmers;
          } else if (Array.isArray(responseData?.data)) {
            farmersArray = responseData.data;
          }
          
          console.log('🔍 Counting plots from', farmersArray.length, 'farmers');
          
          // Count plots from each farmer
          farmersArray.forEach((farmer: any) => {
            // Count plots from farmer.plots array
            if (farmer.plots && Array.isArray(farmer.plots)) {
              farmer.plots.forEach((plot: any) => {
                if (plot.id) {
                  plotSet.add(plot.id);
                } else if (plot.fastapi_plot_id) {
                  plotSet.add(plot.fastapi_plot_id);
                }
              });
            }
            
            // Also count farms as plots (since each farm is typically on a plot)
            if (farmer.farms && Array.isArray(farmer.farms)) {
              farmer.farms.forEach((farm: any) => {
                // Use farm_uid or id as plot identifier
                if (farm.farm_uid) {
                  plotSet.add(farm.farm_uid);
                } else if (farm.id) {
                  plotSet.add(`farm_${farm.id}`);
                }
              });
            }
          });
          
          totalPlots = plotSet.size;
          console.log(`📊 Found ${totalPlots} unique plots from farmers data`);
        }
        
        // Fallback: If no plots found from farmers, try from recent farmers
        if (totalPlots === 0 && recentFarmersResponse.status === 'fulfilled') {
          console.log('⚠️ No plots found from getFarmersByFieldOfficer, trying getRecentFarmers...');
          const recentData = recentFarmersResponse.value.data;
          let recentFarmersArray: any[] = [];
          
          if (Array.isArray(recentData)) {
            recentFarmersArray = recentData;
          } else if (Array.isArray(recentData?.farmers)) {
            recentFarmersArray = recentData.farmers;
          } else if (Array.isArray(recentData?.results)) {
            recentFarmersArray = recentData.results;
          }
          
          const fallbackPlotSet = new Set();
          recentFarmersArray.forEach((farmer: any) => {
            if (farmer.plots && Array.isArray(farmer.plots)) {
              farmer.plots.forEach((plot: any) => {
                if (plot.id) {
                  fallbackPlotSet.add(plot.id);
                } else if (plot.fastapi_plot_id) {
                  fallbackPlotSet.add(plot.fastapi_plot_id);
                }
              });
            }
            if (farmer.farms && Array.isArray(farmer.farms)) {
              farmer.farms.forEach((farm: any) => {
                if (farm.farm_uid) {
                  fallbackPlotSet.add(farm.farm_uid);
                } else if (farm.id) {
                  fallbackPlotSet.add(`farm_${farm.id}`);
                }
              });
            }
          });
          
          if (fallbackPlotSet.size > 0) {
            totalPlots = fallbackPlotSet.size;
            console.log(`✅ Fallback: Found ${totalPlots} plots from getRecentFarmers`);
          }
        }
        
        // Additional fallback: Count from farms API if still 0
        if (totalPlots === 0 && farmsResponse.status === 'fulfilled') {
          console.log('⚠️ No plots found from farmers, trying farms API...');
          const farmsData = farmsResponse.value.data.results || farmsResponse.value.data || [];
          
          // Get farmer IDs from farmers response to filter farms
          let farmerIds = new Set<number>();
          if (farmersResponse.status === 'fulfilled') {
            const responseData = farmersResponse.value.data;
            let farmersArray: any[] = [];
            
            if (Array.isArray(responseData)) {
              farmersArray = responseData;
            } else if (Array.isArray(responseData?.results)) {
              farmersArray = responseData.results;
            } else if (Array.isArray(responseData?.farmers)) {
              farmersArray = responseData.farmers;
            }
            
            farmersArray.forEach((farmer: any) => {
              if (farmer.id) farmerIds.add(farmer.id);
            });
          }
          
          // Count farms that belong to farmers under this field officer
          const farmsPlotSet = new Set();
          farmsData.forEach((farm: any) => {
            const farmFarmerId = farm.farmer_id || farm.farmer?.id;
            if (farmFarmerId && farmerIds.has(farmFarmerId)) {
              if (farm.farm_uid) {
                farmsPlotSet.add(farm.farm_uid);
              } else if (farm.id) {
                farmsPlotSet.add(`farm_${farm.id}`);
              }
            }
          });
          
          if (farmsPlotSet.size > 0) {
            totalPlots = farmsPlotSet.size;
            console.log(`✅ Fallback: Found ${totalPlots} plots from farms API`);
          }
        }

        // Process tasks data
        let approvedTasks = 0;
        let pendingTasks = 0;
        let completedTasks = 0;

        if (tasksResponse.status === 'fulfilled') {
          const tasksData = tasksResponse.value.data;
          const tasksArray = Array.isArray(tasksData) ? tasksData :
                            Array.isArray(tasksData?.results) ? tasksData.results : [];

          tasksArray.forEach((task: any) => {
            const status = (task.status || '').toLowerCase();
            if (status === 'approved' || status === 'approve') {
              approvedTasks++;
            } else if (status === 'pending' || status === 'in-progress' || status === 'in progress') {
              pendingTasks++;
            } else if (status === 'completed' || status === 'complete' || status === 'done') {
              completedTasks++;
            }
          });
        }

        setStats({
          totalFarmers,
          totalPlots,
          approvedTasks,
          pendingTasks,
          completedTasks,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const items = [
    {
      title: 'ViewFarmerPlot',
      icon: <LandPlot size={32} className="text-green-600" />,
      bgColor: 'bg-green-300',
      hoverColor: 'hover:bg-green-300'
    },
    {
      title: 'User Desk',
      icon:<Users size={32} className="text-purple-600" /> ,
      bgColor: 'bg-blue-300',
      hoverColor: 'hover:bg-blue-300'
    },
    {
      title: 'MyTask',
      icon: <Calendar size={32} className="text-blue-600" />,
      bgColor: 'bg-purple-300',
      hoverColor: 'hover:bg-purple-300'
    },
    {
      title: "Resources Planning",
      icon: <Truck size={32} className="text-orange-600" />,
      bgColor: "bg-orange-300",
      hoverColor: "hover:bg-orange-300",
    },
    {
      title: 'Plan & Book',
      icon: <Book size={32} className="text-yellow-600" />,
      bgColor: 'bg-yellow-300',
      hoverColor: 'hover:bg-yellow-300'
    },
    {
      title: 'Calendar / Schedule',
      icon: <CalendarDays size={32} className="text-teal-600" />,
      bgColor: 'bg-teal-300',
      hoverColor: 'hover:bg-teal-400'
    }
  ];

  const statCards = [
    {
      title: 'Total Farmers',
      value: stats.totalFarmers,
      icon: <Users size={24} className="text-blue-600" />,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
    },
    {
      title: 'Total Plots',
      value: stats.totalPlots,
      icon: <LandPlot size={24} className="text-green-600" />,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
    },
    {
      title: 'Approved Tasks',
      value: stats.approvedTasks,
      icon: <CheckCircle size={24} className="text-emerald-600" />,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
    },
    {
      title: 'Pending Tasks',
      value: stats.pendingTasks,
      icon: <Clock size={24} className="text-amber-600" />,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
    },
    {
      title: 'Completed Tasks',
      value: stats.completedTasks,
      icon: <CheckCircle size={24} className="text-indigo-600" />,
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      textColor: 'text-indigo-700',
    },
  ];
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 mt-4 mx-4">
      {/* Dashboard Statistics: 5 rows, 1 column (left) */}
      <div className="lg:min-w-[280px] xl:min-w-[320px]">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 px-2">Dashboard Statistics</h2>
        <div className="flex flex-col gap-3 sm:gap-4">
          {statCards.map((card) => (
            <div
              key={card.title}
              className={`${card.bgColor} border-2 ${card.borderColor} rounded-lg p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`${card.textColor} font-semibold text-sm sm:text-base`}>
                  {card.title}
                </div>
                <div className={`${card.textColor} opacity-80`}>
                  {card.icon}
                </div>
              </div>
              {loading ? (
                <div className="text-2xl sm:text-3xl font-bold text-gray-400 animate-pulse">
                  ...
                </div>
              ) : (
                <div className={`${card.textColor} text-2xl sm:text-3xl font-bold`}>
                  {card.value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Cards: 3 rows, 2 columns (right) */}
      <div className="flex-1">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 px-2">Quick Actions</h2>
        <div className="grid grid-cols-2 grid-rows-3 gap-3 sm:gap-4 lg:gap-6">
          {items.map((item) => (
            <button
              key={item.title}
              onClick={() => {
                if (item.title === 'User Desk') {
                  onOpenSidebarWithMenu('User Desk');
                } else if (item.title === 'MyTask') {
                  onOpenSidebarWithMenu('MyTask');
                } else if (item.title === 'Plan & Book') {
                  onOpenSidebarWithMenu('Plan & Book');
                } else if (item.title === 'Resources Planning') {
                  onOpenSidebarWithMenu('Resoucres Planning');
                } else if (item.title === 'Calendar / Schedule') {
                  onMenuClick('CalendarView');
                } else {
                  onMenuClick(item.title);
                }
              }}
              className={`${item.bgColor} ${item.hoverColor} p-4 sm:p-6 rounded-xl shadow-sm transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]`}
            >
              <div className="flex flex-col items-center justify-center space-y-2 sm:space-y-3 h-full">
                <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center">
                  {React.cloneElement(item.icon, {
                    size: undefined,
                    className: item.icon.props.className + " w-full h-full",
                  })}
                </div>
                <span className="text-sm sm:text-base font-semibold text-gray-800 text-center leading-tight break-words px-1">
                  {item.title === 'ViewFarmerPlot'
                    ? 'View Farmer Plot'
                    : item.title}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FieldOfficerHomeGrid;
