import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DashboardGrid } from "./components/DashboardGrid";
import { jwtDecode } from "jwt-decode";

import OwnerFarmDash from "./components/OwnerFarmDash"; // Import for Owner
import OwnerHarvestDash from "./components/OwnerHarvestDash"; // Import for Owner
import ManagerHomeGrid from "./components/ManagerHomeGrid";
import OwnerHomeGrid from "./components/OwnerHomeGrid";
import { Addusers } from "./components/Addusers";
import { UserList } from "./components/userList";
import Contactuser from "./components/Contactuser";
import { Addvendor } from "./components/AddVendor";
import { VendorList } from "./components/Vendorlist";
import { Addorder } from "./components/Addorder";
import { OrderList } from "./components/orderlist";
import { AddStock } from "./components/AddStock";
import { StockList } from "./components/stocklist";
import { BookingList } from "./components/Bookinglist";
import AddBooking from "./components/AddBooking";
import { FarmList } from "./components/FarmList";
import CalendarView from "./components/CalendarView";
import MyList from "./components/MyList";
import TeamList from "./components/TeamList";
import FieldOfficerHomeGrid from "./components/FieldOfficerHomeGrid";
import FarmerHomeGrid from "./components/FarmerHomeGrid";
import Calendar from "./components/Calendar";
import AddFarm from "./components/Add Farm";
import TaskCalendar from "./components/TaskCalendar";
import ViewList from "./components/ViewList";
import { Tasklist } from "./components/Tasklist";
import { PestDisease } from "./components/pestt/Pest & Disease";
import Fertilizer from "./components/Fertilizer";
import Irrigation from "./components/Irrigation/Irrigation";
import BlogCard from "./components/BlogCard";
import AgricultureData from "./components/AgricultureData";
import Map from "./components/Map";
import FarmerDashboard from "./components/FarmerDashboard";
import OfficerDashboard from "./components/FarmCropStatus";
import AgroDashboard from "./components/AgroDash/AgroDashboard";
import ManagerFarmDash from "./components/ManagerFarmDash";
import HarvestDashboard from "./components/HarvestDashboard";
import Chatbot from "./components/Chatbot";
import { MessageCircle } from "lucide-react";

enum View {
  Home = "home",
  ManagerHomeGrid = "ManagerHomeGrid",
  HarvestDashboard = "HarvestDashboard",
  Dashboard = "dashboard",
  AgroDashboard = "AgroDashboard",
  ManagerFarmDash = "ManagerFarmDash",
  OwnerFarmDash = "OwnerFarmDash",
  OwnerHarvestDash = "OwnerHarvestDash",
  AddUsers = "addusers",
  userList = "userlist",
  Contactuser = "Contactuser",
  Addvendor = "AddVendor",
  VendorList = "Vendorlist",
  Addorder = "Addorder",
  orderlist = "orderlist",
  Addstock = "Addstock",
  stocklist = "stocklist",
  AddBooking = "AddBooking",
  Bookinglist = "Bookinglist",
  FarmList = "farmlist",
  CalendarView = "CalendarView",
  MyList = "MyList",
  TeamList = "TeamList",
  Calendar = "Calendar",
  AddFarm = "AddFarm",
  TaskCalendar = "TaskCalendar",
  ViewList = "ViewList",
  Tasklist = "Tasklist",
  Fertilizer = "Fertilizer",
  Irrigation = "Irrigation",
  BlogCard = "BlogCard",
  PestDisease = "Pest & Disease",
  AgricultureData = "AgricultureData",
  Map = "Map",
  FarmerDashboard = "FarmerDashboard",
  FarmCropStatus = "FarmCropStatus",
}

interface AppProps {
  userRole: "manager" | "admin" | "fieldofficer" | "farmer" | "owner";
  onLogout: () => void;
}

const App: React.FC<AppProps> = ({ userRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>(View.Home);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [expandedSidebarMenu, setExpandedSidebarMenu] = useState<string | null>(
    null
  );
  const [users, setUsers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedPlotName, setSelectedPlotName] = useState<string | null>(null);
  const [soilData, setSoilData] = useState({
    phValue: null as number | null,
    nitrogenValue: null as number | null,
    fertilityStatus: "Moderate",
  });
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // NEW: Add currentUser state
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    role: string;
    name: string;
  } | null>(null);

  // NEW: Get user from JWT token
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decoded: any = jwtDecode(token);

        setCurrentUser({
          id: decoded.user_id || decoded.id,
          role: decoded.role || userRole,
          name: decoded.username || decoded.first_name || "User",
        });
      } catch (error) {
        console.error("Error decoding token:", error);
        // Fallback for development/testing
        setCurrentUser({
          id: 3, // Default field officer ID for testing
          role: userRole,
          name: "Test User",
        });
      }
    } else {
      // No token - set default for testing
      setCurrentUser({
        id: 3,
        role: userRole,
        name: "Test User",
      });
    }
  }, [userRole]);

  // Handle URL-based routing on page load/refresh
  useEffect(() => {
    // Check for view parameter in URL search params or hash
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const hash = window.location.hash.replace('#', '').replace('#/', '');
    
    // Priority: URL param > hash > default to Home
    if (viewParam) {
      handleRouteFromURL(viewParam);
    } else if (hash) {
      handleRouteFromURL(hash);
    }
    
    // Listen for hash changes (for hash-based routing)
    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#/', '').replace('#', '');
      if (newHash) {
        handleRouteFromURL(newHash);
      }
    };
    
    // Listen for popstate (browser back/forward)
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      if (viewParam) {
        handleRouteFromURL(viewParam);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Map URL routes to View enum
  const handleRouteFromURL = (route: string) => {
    const routeMap: Record<string, View> = {
      'agroclimatic': View.AgroDashboard,
      'agro-dashboard': View.AgroDashboard,
      'agrodashboard': View.AgroDashboard,
      'farm-crop-status': View.FarmCropStatus,
      'farmcropstatus': View.FarmCropStatus,
      'harvest-dashboard': View.HarvestDashboard,
      'harvestdashboard': View.HarvestDashboard,
      'manager-farm-dash': View.ManagerFarmDash,
      'managerfarmdash': View.ManagerFarmDash,
      'owner-farm-dash': View.OwnerFarmDash,
      'ownerfarmdash': View.OwnerFarmDash,
      'owner-harvest-dash': View.OwnerHarvestDash,
      'ownerharvestdash': View.OwnerHarvestDash,
      'farmer-dashboard': View.FarmerDashboard,
      'farmerdashboard': View.FarmerDashboard,
      'map': View.Map,
      'fertilizer': View.Fertilizer,
      'irrigation': View.Irrigation,
      'pest-disease': View.PestDisease,
      'pestdisease': View.PestDisease,
      'add-farm': View.AddFarm,
      'addfarm': View.AddFarm,
      'calendar': View.Calendar,
      'task-calendar': View.TaskCalendar,
      'taskcalendar': View.TaskCalendar,
      'tasklist': View.Tasklist,
      'farmlist': View.FarmList,
      'userlist': View.userList,
      'addusers': View.AddUsers,
    };

    const view = routeMap[route.toLowerCase()];
    if (view) {
      setCurrentView(view);
    }
  };

  const handleMenuSelect = (menu: string) => {
    setActiveSubmenu(null);

    let nextView = View.Home;

    switch (menu) {
      case "Farm Crop Status":
      case "farm-crop-status":
        // Use ManagerFarmDash for manager/owner, FarmCropStatus for field officer
        if (userRole === "owner") {
          nextView = View.OwnerFarmDash;
        } else if (userRole === "manager") {
          nextView = View.ManagerFarmDash;
        } else {
          nextView = View.FarmCropStatus;
        }
        break;
      case "Harvesting Planning":
        if (userRole === "owner") {
          nextView = View.OwnerHarvestDash;
        } else {
          nextView = View.HarvestDashboard;
        }
        break;
      case "ViewFarmerPlot":
        nextView = View.FarmCropStatus;
        break;
      case "Agroclimatic":
        nextView = View.AgroDashboard;
        break;
      case "Plot View":
        nextView = View.Dashboard;
        setActiveSubmenu(menu);
        break;
      case "Add User":
        nextView = View.AddUsers;
        break;
      case "User List":
        nextView = View.userList;
        break;
      case "Contactuser":
        nextView = View.Contactuser;
        break;
      case "Add Vendor":
        nextView = View.Addvendor;
        break;
      case "Vendor list":
        nextView = View.VendorList;
        // Component handles its own data fetching via useEffect
        break;
      case "Add order":
        nextView = View.Addorder;
        break;
      case "order list":
        nextView = View.orderlist;
        // Component handles its own data fetching via useEffect
        break;
      case "Add Stock":
        nextView = View.Addstock;
        break;
      case "stock list":
        nextView = View.stocklist;
        // Component handles its own data fetching via useEffect
        break;
      case "Add Booking":
        nextView = View.AddBooking;
        break;
      case "Booking List":
        nextView = View.Bookinglist;
        break;
      case "Farmlist":
        nextView = View.FarmList;
        break;
      case "CalendarView":
        nextView = View.CalendarView;
        break;
      case "MyList":
        nextView = View.MyList;
        break;
      case "Team List":
      case "Team Connect":
      case "TeamConnect":
        nextView = View.TeamList;
        break;
      case "Calendar":
        nextView = View.Calendar;
        break;
      case "AddFarm":
        nextView = View.AddFarm;
        break;
      case "TaskCalendar":
        nextView = View.TaskCalendar;
        break;
      case "ViewList":
        nextView = View.ViewList;
        break;
      case "Tasklist":
        nextView = View.Tasklist;
        break;
      case "Pest & Disease":
        nextView = View.PestDisease;
        break;
      case "Fertilizer":
        nextView = View.Fertilizer;
        break;
      case "Irrigation":
        nextView = View.Irrigation;
        break;
      case "BlogCard":
        nextView = View.BlogCard;
        break;
      case "AgricultureData":
        nextView = View.AgricultureData;
        break;
      case "Map":
        nextView = View.Map;
        break;
      case "FarmerDashboard":
        nextView = View.FarmerDashboard;
        break;
      default:
        nextView = View.Home;
        break;
    }

    setCurrentView(nextView);
    setIsSidebarOpen(false);
    
    // Update URL for refresh support
    const viewMap: Partial<Record<View, string>> = {
      [View.Home]: 'home',
      [View.AgroDashboard]: 'agrodashboard',
      [View.FarmCropStatus]: 'farmcropstatus',
      [View.HarvestDashboard]: 'harvestdashboard',
      [View.ManagerFarmDash]: 'managerfarmdash',
      [View.OwnerFarmDash]: 'ownerfarmdash',
      [View.OwnerHarvestDash]: 'ownerharvestdash',
      [View.FarmerDashboard]: 'farmerdashboard',
      [View.Map]: 'map',
      [View.Fertilizer]: 'fertilizer',
      [View.Irrigation]: 'irrigation',
      [View.PestDisease]: 'pestdisease',
      [View.AddFarm]: 'addfarm',
      [View.Calendar]: 'calendar',
      [View.TaskCalendar]: 'taskcalendar',
      [View.Tasklist]: 'tasklist',
      [View.FarmList]: 'farmlist',
      [View.userList]: 'userlist',
      [View.AddUsers]: 'addusers',
      [View.Dashboard]: 'dashboard',
      [View.ManagerHomeGrid]: 'managerhomegrid',
      [View.Addvendor]: 'addvendor',
      [View.VendorList]: 'vendorlist',
      [View.Addorder]: 'addorder',
      [View.orderlist]: 'orderlist',
      [View.Addstock]: 'addstock',
      [View.stocklist]: 'stocklist',
      [View.AddBooking]: 'addbooking',
      [View.Bookinglist]: 'bookinglist',
      [View.CalendarView]: 'calendarview',
      [View.MyList]: 'mylist',
      [View.TeamList]: 'teamlist',
      [View.ViewList]: 'viewlist',
      [View.BlogCard]: 'blogcard',
      [View.AgricultureData]: 'agriculturedata',
      [View.Contactuser]: 'contactuser',
    };
    
    const urlName = viewMap[nextView] || 'home';
    const newURL = `${window.location.pathname}?view=${urlName}`;
    window.history.pushState({ view: urlName }, '', newURL);
  };

  const handleHomeClick = () => {
    setCurrentView(View.Home);
    setIsSidebarOpen(false);
    setActiveSubmenu(null);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const openSidebarWithMenu = (menuTitle: string) => {
    setIsSidebarOpen(true);
    setExpandedSidebarMenu(menuTitle);
    // Clear the expanded menu after a longer delay to allow the sidebar to open and expand
    setTimeout(() => {
      setExpandedSidebarMenu(null);
    }, 1000);
  };

  const handleSoilDataChange = (data: {
    plotName: string;
    phValue: number | null;
    nitrogenValue?: number | null;
    phStatistics?: { phh2o_0_5cm_mean_mean: number };
  }) => {
    setSoilData((prev) => ({
      ...prev,
      phValue: data.phValue,
      nitrogenValue:
        data.nitrogenValue !== undefined ? data.nitrogenValue : null,
    }));
    setSelectedPlotName(data.plotName || null);
  };

  const renderHomeGrid = () => {
    switch (userRole) {
      case "manager":
        return (
          <ManagerHomeGrid
            onMenuClick={handleMenuSelect}
            onOpenSidebarWithMenu={openSidebarWithMenu}
          />
        );
      case "owner":
        return <OwnerHomeGrid onMenuClick={handleMenuSelect} />;
      case "fieldofficer":
        return (
          <FieldOfficerHomeGrid
            onMenuClick={handleMenuSelect}
            onOpenSidebarWithMenu={openSidebarWithMenu}
          />
        );
      case "farmer":
        return <FarmerHomeGrid onMenuClick={handleMenuSelect} />;
      default:
        return <div>Invalid user role: {userRole}</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />

      <div className="flex flex-1">
        <div
          className={`fixed top-0 left-0 h-full z-40 transition-all duration-300 ease-in-out ${
            isSidebarOpen ? "w-64" : "w-0"
          } overflow-hidden`}
        >
          <Sidebar
            isOpen={isSidebarOpen}
            onMenuSelect={handleMenuSelect}
            onHomeClick={handleHomeClick}
            onLogout={onLogout}
            userRole={userRole}
            expandedMenu={expandedSidebarMenu}
          />
        </div>

        <main
          className={`flex-1 transition-all duration-300 ease-in-out ml-0 ${
            isSidebarOpen ? "ml-64" : "ml-0"
          } overflow-auto`}
        >
          <div className="w-full h-full">
            {currentView === View.Home && renderHomeGrid()}

            {currentView === View.Dashboard && activeSubmenu && (
              <DashboardGrid
                submenu={activeSubmenu}
                userRole={userRole}
                onClose={() => setActiveSubmenu(null)}
              />
            )}

            {currentView === View.AddUsers && (
              <Addusers setUsers={setUsers} users={users} />
            )}

            {currentView === View.userList && (
              // <UserList users={users} setUsers={setUsers} />
              <UserList
                users={users}
                setUsers={setUsers}
                currentUserId={currentUser.id}
                currentUserRole={
                  currentUser.role as
                    | "owner"
                    | "manager"
                    | "fieldofficer"
                    | "farmer"
                }
              />
            )}

            {currentView === View.Contactuser && (
              <Contactuser users={users} setUsers={setUsers} />
            )}

            {currentView === View.Addvendor && (
              <Addvendor setUsers={setUsers} users={users} />
            )}

            {currentView === View.VendorList && (
              <VendorList users={users} setUsers={setUsers} />
            )}

            {currentView === View.Addorder && (
              <Addorder setItems={setItems} items={items} />
            )}

            {currentView === View.orderlist && (
              <OrderList items={items} setItems={setItems} />
            )}

            {currentView === View.Addstock && (
              <AddStock setStocks={setStocks} />
            )}

            {currentView === View.stocklist && (
              <StockList stocks={stocks} setStocks={setStocks} />
            )}

            {currentView === View.AddBooking && (
              <AddBooking bookings={bookings} setBookings={setBookings} />
            )}

            {currentView === View.Bookinglist && (
              <BookingList bookings={bookings} setBookings={setBookings} />
            )}

            {currentView === View.FarmList && (
              <FarmList users={users} setUsers={setUsers} />
            )}

            {currentView === View.CalendarView && <CalendarView />}

            {currentView === View.MyList && <MyList />}

            {currentView === View.TeamList && (
              <TeamList setUsers={setUsers} users={users} />
            )}

            {/* {currentView === View.Calendar && <Calendar />} */}

            {currentView === View.Calendar && (
              <Calendar
                currentUserId={currentUser.id}
                currentUserRole={
                  currentUser.role as "manager" | "fieldofficer" | "farmer"
                }
              />
            )}

            {currentView === View.AddFarm && <AddFarm />}

            {/* {currentView === View.TaskCalendar && <TaskCalendar currentUserId={3} currentUserRole="fieldofficer" />} */}

            {currentView === View.TaskCalendar && currentUser && (
              <TaskCalendar
                currentUserId={currentUser.id}
                currentUserRole={
                  currentUser.role as "manager" | "fieldofficer" | "farmer"
                }
              />
            )}

            {/* {currentView === View.ViewList && <ViewList />}
            
            {currentView === View.Tasklist && <Tasklist  />} */}

            {currentView === View.ViewList && (
              <ViewList
                currentUserId={currentUser.id}
                currentUserRole={
                  currentUser.role as "manager" | "fieldofficer" | "farmer"
                }
                currentUserName={currentUser.name}
              />
            )}

            {/* UPDATED: Tasklist with currentUser */}
            {currentView === View.Tasklist && currentUser && (
              <Tasklist
                currentUserId={currentUser.id}
                currentUserRole={
                  currentUser.role as "manager" | "fieldofficer" | "farmer"
                }
                currentUserName={currentUser.name}
              />
            )}
            {currentView === View.PestDisease && <PestDisease />}

            {currentView === View.Fertilizer && <Fertilizer />}

            {currentView === View.Irrigation && (
              <Irrigation selectedPlotName={selectedPlotName} />
            )}

            {currentView === View.BlogCard && <BlogCard />}

            {currentView === View.AgricultureData && <AgricultureData />}

            {currentView === View.Map && (
              <Map onSoilDataChange={handleSoilDataChange} />
            )}

            {currentView === View.FarmerDashboard && <FarmerDashboard />}

            {currentView === View.FarmCropStatus && <OfficerDashboard />}

            {currentView === View.ManagerFarmDash && <ManagerFarmDash />}

            {currentView === View.AgroDashboard && <AgroDashboard />}
            {currentView === View.HarvestDashboard && <HarvestDashboard />}

            {currentView === View.OwnerFarmDash && <OwnerFarmDash />}

            {currentView === View.OwnerHarvestDash && <OwnerHarvestDash />}
          </div>
        </main>
      </div>

      {/* Global Chatbot Component - Single Frame Design */}
      <Chatbot 
        isOpen={isChatbotOpen} 
        onClose={() => setIsChatbotOpen(false)}
        userRole={userRole}
      />

      {/* Floating Button - Only show when chatbot is closed */}
      {!isChatbotOpen && (
        <button
          onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-6 right-6 z-[99998] bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-full shadow-2xl hover:shadow-green-500/50 transition-all duration-300 hover:scale-110 active:scale-95 animate-bounce"
          aria-label="Open Chatbot"
          title="Open CropEye Assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default App;
