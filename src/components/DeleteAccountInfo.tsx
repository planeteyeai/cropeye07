import React from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Trash2, 
  ShieldCheck, 
  LogIn, 
  ChevronRight, 
  Info,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DeleteAccountInfo: React.FC = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: <LogIn className="w-6 h-6 text-emerald-500" />,
      title: "Log in",
      description: "Open the CropEye.ai mobile app and log in to your account with your credentials."
    },
    {
      icon: <Settings className="w-6 h-6 text-emerald-500" />,
      title: "Navigate to Settings",
      description: "Go to the Settings section via the Sidebar menu or your Profile page."
    },
    {
      icon: <Trash2 className="w-6 h-6 text-rose-500" />,
      title: "Request Deletion",
      description: "Find and click on the 'Delete Account' option at the bottom of the settings."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
      title: "Confirm Identity",
      description: "For your security, you will be asked to re-enter your password to confirm the deletion."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Background blobs for aesthetics */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-100/50 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-3 rounded-2xl shadow-xl shadow-emerald-200/50">
              <img src="/src/logop.png" alt="CropEye Logo" className="h-12 w-auto" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            How to Delete Your <span className="text-emerald-600">CropEye</span> Account
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            We value your privacy and want to make sure you have full control over your data. 
            Follow the steps below to permanently delete your account from our mobile application.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 overflow-hidden border border-slate-100 mb-10">
          <div className="p-8 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              {steps.map((step, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex flex-col p-6 rounded-2xl hover:bg-slate-50 transition-colors duration-300 border border-transparent hover:border-slate-100 group"
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all duration-300">
                      {step.icon}
                    </div>
                    <span className="ml-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Step {index + 1}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Data Retention Banner */}
          <div className="bg-emerald-600 p-8 text-white">
            <div className="flex items-start">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="ml-5">
                <h3 className="text-xl font-bold mb-2">Our Data Policy</h3>
                <p className="text-emerald-50 text-lg leading-relaxed">
                  Upon account deletion, all your personal information, farm data, and preferences are permanently purged from our systems. 
                  <span className="font-bold"> We do not hold any personal data after the deletion of an account.</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center space-y-6"
        >
          <div className="flex items-center justify-center space-x-2 text-slate-500 bg-slate-100/50 py-3 px-6 rounded-full inline-flex mx-auto">
            <Info className="w-4 h-4" />
            <span className="text-sm">Account deletion is permanent and cannot be undone.</span>
          </div>
          
          <div>
            <button 
              onClick={() => navigate('/login')}
              className="group flex items-center justify-center space-x-2 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Login</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Small subtle footer */}
      <footer className="mt-20 text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} CropEye.ai. All rights reserved.
      </footer>
    </div>
  );
};

export default DeleteAccountInfo;
