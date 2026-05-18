import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import { formatMinutesToHours } from '../utils/helpers';
import { HiOutlineDownload } from 'react-icons/hi';

// We render a hidden container with a fixed width (A4 size approx 794px width)
// so the layout is consistent and perfect for printing.
const A4_WIDTH = 794;

const PDFReportGenerator = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const reportRef = useRef(null);
  
  const [reportData, setReportData] = useState(null);

  const generatePDF = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch live data
      const [dashRes, predictRes, analyticsRes, leaderboardRes, coinSummaryRes] = await Promise.all([
        api.get('/session/dashboard').catch(() => null),
        api.get('/insights/predict').catch(() => null),
        api.get('/insights/analytics', { params: { days: 7 } }).catch(() => null),
        api.get('/session/leaderboard').catch(() => null),
        api.get('/coins/summary').catch(() => null)
      ]);

      const data = {
        dashboard: dashRes?.data || {},
        prediction: predictRes?.data?.prediction || null,
        features: predictRes?.data?.features || null,
        recommendations: predictRes?.data?.recommendations || null,
        analytics: analyticsRes?.data?.analytics || {},
        leaderboard: leaderboardRes?.data || {},
        coins: coinSummaryRes?.data || {}
      };
      
      setReportData(data);
      
      // 2. Wait for state to render (small timeout)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 3. Generate PDF
      if (!reportRef.current) return;
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#0F1115'
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // A4 paper size in mm
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If the report is longer than 1 page, we might need multiple pages.
      // But for a continuous scroll report, we can just let it scale or add pages.
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`DistractFree_Report_Week_${new Date().getWeek()}.pdf`);
      
    } catch (err) {
      console.error('PDF Generation Failed:', err);
    } finally {
      setLoading(false);
      setReportData(null);
    }
  };

  // Helper prototype to get week number
  Date.prototype.getWeek = function() {
    var date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    var week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  return (
    <>
      <button 
        onClick={generatePDF} 
        disabled={loading}
        className="ml-4 text-xs text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <HiOutlineDownload className="w-3.5 h-3.5" />
        )}
        {loading ? 'Generating...' : 'Download PDF Report'}
      </button>

      {/* Hidden Render Container */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {reportData && (
          <div 
            ref={reportRef} 
            style={{ width: `${A4_WIDTH}px`, backgroundColor: '#0F1115', color: '#F0EEFF' }}
            className="p-10 font-sans"
          >
            {/* 1. Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
                  <span className="text-white font-bold text-xl">D</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">DistractFree Productivity Report</h1>
                  <p className="text-gray-400 text-sm">Generated for {user?.name || 'User'} • {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-indigo-400">
                  {reportData.features?.focusScore || reportData.dashboard?.aiFocusScore || 0}<span className="text-lg text-gray-500">/100</span>
                </div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Overall Productivity</p>
              </div>
            </div>

            {/* 2. Productivity Summary & 6. Goals */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-[#14171C] border border-white/[0.05] p-5 rounded-2xl">
                <p className="text-xs text-gray-400 uppercase mb-1">Focus Time</p>
                <p className="text-2xl font-bold">{formatMinutesToHours(reportData.dashboard?.todayFocusMinutes || 0)}</p>
              </div>
              <div className="bg-[#14171C] border border-white/[0.05] p-5 rounded-2xl">
                <p className="text-xs text-gray-400 uppercase mb-1">Current Streak</p>
                <p className="text-2xl font-bold text-orange-400">{reportData.dashboard?.currentStreak || user?.currentStreak || 0} days</p>
              </div>
              <div className="bg-[#14171C] border border-white/[0.05] p-5 rounded-2xl">
                <p className="text-xs text-gray-400 uppercase mb-1">Daily Goal</p>
                <p className="text-2xl font-bold text-indigo-400">{reportData.dashboard?.dailyGoal?.focusMinutes || 120}m</p>
              </div>
              <div className="bg-[#14171C] border border-white/[0.05] p-5 rounded-2xl">
                <p className="text-xs text-gray-400 uppercase mb-1">Coins Earned</p>
                <p className="text-2xl font-bold text-yellow-500">{reportData.coins?.balance || 0} 🪙</p>
              </div>
            </div>

            {/* 3. Analytics Chart */}
            {reportData.dashboard?.weeklyFocusData && (
              <div className="mb-8 bg-[#14171C] border border-white/[0.05] p-6 rounded-2xl">
                <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-400">Weekly Focus Time (Minutes)</h3>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.dashboard.weeklyFocusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" vertical={false} />
                      <XAxis dataKey="day" stroke="#718096" fontSize={10} tickLine={false} axisLine={false} />
                      <Bar dataKey="minutes" fill="#6366F1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 4 & 5. AI Insights & Distractions */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-[#14171C] border border-white/[0.05] p-6 rounded-2xl">
                <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-400">AI Distraction Analysis</h3>
                {reportData.prediction ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-white/[0.05] pb-3">
                      <span className="text-gray-400 text-sm">Risk Level</span>
                      <span className="font-bold uppercase text-red-400">{reportData.prediction.distractionRisk}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/[0.05] pb-3">
                      <span className="text-gray-400 text-sm">Distraction Score</span>
                      <span className="font-bold">{reportData.prediction.distractionScore}/100</span>
                    </div>
                    <div className="flex justify-between items-center pb-2">
                      <span className="text-gray-400 text-sm">Blocked Site Attempts</span>
                      <span className="font-bold">{reportData.analytics?.topSites?.reduce((acc, s) => acc + s.blockedVisits, 0) || 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not enough data for AI insights.</p>
                )}
              </div>
              
              <div className="bg-[#14171C] border border-white/[0.05] p-6 rounded-2xl">
                <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-400">Personalized Recommendations</h3>
                {reportData.recommendations ? (
                  <div className="space-y-3">
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl">
                      <p className="text-xs text-indigo-300 font-medium mb-1">Session Strategy</p>
                      <p className="text-sm text-indigo-100">Try {reportData.recommendations.recommendedSessionTime}m focus / {reportData.recommendations.suggestedBreakTime}m break.</p>
                    </div>
                    {reportData.recommendations.tips?.slice(0, 2).map((tip, i) => (
                      <div key={i} className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl">
                        <p className="text-sm text-gray-300 leading-snug">{tip}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Continue focusing to get AI recommendations.</p>
                )}
              </div>
            </div>

            {/* 8. Leaderboard & 9. Motivation */}
            <div className="bg-gradient-to-r from-[#1A1D24] to-[#14171C] border border-white/[0.05] p-6 rounded-2xl mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold mb-1 uppercase tracking-wider text-gray-400">Leaderboard Standing</h3>
                <p className="text-xl font-bold text-white">
                  {reportData.leaderboard?.currentUserRank ? `Rank #${reportData.leaderboard.currentUserRank}` : "Unranked"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">Performance Note</p>
                <p className="text-base text-indigo-300 font-medium italic">
                  {reportData.dashboard?.todayFocusMinutes > 60 
                    ? "Great job maintaining focus today! Consistency is key."
                    : "Every minute counts. Keep building your focus habits!"}
                </p>
              </div>
            </div>

            {/* 10. Footer */}
            <div className="text-center pt-6 border-t border-white/10">
              <p className="text-xs text-gray-500">
                Generated securely by DistractFree • {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PDFReportGenerator;
