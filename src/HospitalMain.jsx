import React, { useState, useEffect } from 'react';

// API Mocking Pattern
export const mockApi = {
  publishSlots: (slots) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, publishedCount: slots.length });
      }, 800);
    });
  },
  
  fetchAppointments: () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 'appt-1',
            date: '2026-07-15',
            patientName: 'Sophia Loren',
            patientAge: 28,
            nationality: 'USA',
            time: '10:00 - 10:30',
            status: 'Confirmed',
            payment: '$99.99 완료',
            roomId: 'room-sophia-101',
            prerequisites: '콧대 높이기 및 코끝 성형. 자연스러운 콧대 라인(급격하게 꺾이지 않는 곡선)을 선호함. 인공 보형물 삽입으로 인한 부작용이나 이탈 위험성을 피하고 싶어 함.',
            aiReport: '비골 및 연골 구조 분석 결과, 비중격 연골 연장술을 병행한 콧대 2.3mm 거상이 권장됩니다. 예상 프로필 측면 대칭 개선률: +18%. 3D 시뮬레이션 결과 부드러운 실루엣과 매우 높은 매칭률을 보이며, 수술 구조적 위험도는 매우 낮음으로 평가됩니다.',
            transcript: [
              { sender: 'Patient', lang: 'English', text: 'Hello doctor, I want to make my nose bridge higher but keep it looking natural. Is that possible without using artificial implants?', time: '10:02 AM' },
              { sender: 'AI Interpreter', lang: 'Korean', text: '안녕하세요 원장님, 제 콧대를 높이고 싶지만 자연스러움을 유지하고 싶습니다. 인공 보형물을 사용하지 않고도 가능한가요?', time: '10:02 AM' },
              { sender: 'Doctor', lang: 'Korean', text: '네 가능합니다. 환자분의 귀연골이나 비중격 연골 같은 자가 조직을 사용하면 보형물 없이도 자연스럽고 안전하게 콧대와 코끝을 개선할 수 있습니다.', time: '10:03 AM' },
              { sender: 'AI Interpreter', lang: 'English', text: 'Yes, it is possible. By using your own autologous tissue like ear cartilage or septal cartilage, we can raise the bridge and shape the tip naturally and safely without artificial implants.', time: '10:03 AM' }
            ]
          },
          {
            id: 'appt-2',
            date: '2026-07-15',
            patientName: 'Yuki Tanaka',
            patientAge: 24,
            nationality: 'Japan',
            time: '11:00 - 11:30',
            status: 'Confirmed',
            payment: '$99.99 완료',
            roomId: 'room-yuki-202',
            prerequisites: '선명하고 또렷한 눈매를 얻기 위한 쌍꺼풀 수술(비절개 퀵 매몰법 선호) 및 몽고주름 해소를 위한 앞트임 상담.',
            aiReport: '수술 전 미간 눈 사이 거리: 34.5mm. AI 디자인 시뮬레이션 결과 쌍꺼풀 라인의 적정 깊이는 1.8mm로 산출됨. 눈머리 긴장 완화를 위해 미세 앞트임(1.2mm 절제)을 권장합니다.',
            transcript: [
              { sender: 'Patient', lang: 'Japanese', text: '自然な二重まぶたにしたいです。切開しない埋没法での手術は私に適していますか？', time: '11:01 AM' },
              { sender: 'AI Interpreter', lang: 'Korean', text: '자연스러운 쌍꺼풀을 원합니다. 절개하지 않는 매몰법 수술이 저에게 적합할까요?', time: '11:01 AM' }
            ]
          },
          {
            id: 'appt-3',
            date: '2026-07-15',
            patientName: 'Chloe Dupont',
            patientAge: 31,
            nationality: 'France',
            time: '14:00 - 14:30',
            status: 'Confirmed',
            payment: '$99.99 완료',
            roomId: 'room-chloe-303',
            prerequisites: 'V라인 안면윤곽 상담. 하악 각부 너비를 줄이기 위해 교근 축소술 및 턱끝 성형술(Genioplasty)을 희망함.',
            aiReport: '측면 턱뼈 각도: 124도. AI 시뮬레이션 분석에 따르면, 사각턱 교근 비대칭 치료를 위한 보톡스 시술과 턱끝 뼈 3mm 후방 이동술의 병행을 추천합니다. 예상 안면 폭 감소량: -8%.',
            transcript: [
              { sender: 'Patient', lang: 'French', text: 'Je trouve que le bas de mon visage est un peu trop large. Est-ce qu\'une réduction de la mâchoire est nécessaire ou des injections suffiraient ?', time: '14:02 PM' },
              { sender: 'AI Interpreter', lang: 'Korean', text: '제 하안부가 조금 넓어 보입니다. 턱뼈 축소 수술이 필요한가요, 아니면 보톡스 주사만으로 충분할까요?', time: '14:02 PM' }
            ]
          },
          {
            id: 'appt-4',
            date: '2026-07-16',
            patientName: 'Sarah Connor',
            patientAge: 28,
            nationality: 'USA',
            time: '10:00 - 10:30',
            status: 'Confirmed',
            payment: '$99.99 완료',
            roomId: 'room-sarah-404',
            prerequisites: '코끝 교정 및 콧대 높이기.',
            aiReport: '비골 격 격 구조 정밀 분석 완료. 자가 연골을 적용한 콧대 2.0mm 거상 시 최적의 각도가 도출될 것으로 예상됨.',
            transcript: [
              { sender: 'Patient', lang: 'English', text: 'I want a natural slope.', time: '10:02 AM' }
            ]
          }
        ]);
      }, 500);
    });
  }
};

// Mini Calendar Component (July 2026)
const MiniCalendar = ({ selectedDate, onSelectDate }) => {
  const year = 2026;
  const month = 6; // July (0-indexed)
  const daysInMonth = 31;
  const startDayOffset = 3; // July 2026 starts on Wed (Sun=0, Mon=1, Tue=2, Wed=3)
  
  const days = [];
  for (let i = 0; i < startDayOffset; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl w-[260px] shrink-0 shadow-inner">
      <div className="text-center font-bold text-xs text-[#e5c483] mb-3 uppercase tracking-widest">
        2026년 7월
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-white/40 mb-2 font-bold">
        {weekdays.map(w => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;
          const isSelected = selectedDate.getDate() === date.getDate() && selectedDate.getMonth() === date.getMonth();
          return (
            <button
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-gradient-to-tr from-[#e5c483] to-[#d4af37] text-slate-950 font-bold shadow-md shadow-[#e5c483]/20 scale-105' 
                  : 'hover:bg-white/10 text-white/80'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const HospitalMain = ({ onEnterRoom, onBackToSelector }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Top Section Calendar selected date
  const [topSelectedDate, setTopSelectedDate] = useState(new Date(2026, 6, 15)); // 2026. 07. 15 by default

  // Bottom Section Calendar selected date
  const [bottomSelectedDate, setBottomSelectedDate] = useState(new Date(2026, 6, 15));

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
  ];
  
  const [selectedSlots, setSelectedSlots] = useState(new Set(['Mon-10:00', 'Mon-10:30', 'Tue-11:00', 'Tue-11:30', 'Wed-14:00', 'Wed-14:30']));
  const [publishing, setPublishing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Load all appointments
  useEffect(() => {
    mockApi.fetchAppointments().then((data) => {
      setAllAppointments(data);
      setLoadingAppts(false);
    });
  }, []);

  // Filter appointments when top calendar date changes
  useEffect(() => {
    const formattedDate = `${topSelectedDate.getFullYear()}-${String(topSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(topSelectedDate.getDate()).padStart(2, '0')}`;
    const filtered = allAppointments.filter(appt => appt.date === formattedDate);
    setAppointments(filtered);
  }, [topSelectedDate, allAppointments]);

  // Compute Weekly list based on bottomSelectedDate (Mon ~ Sat)
  const getWeeklyDates = (baseDate) => {
    const currentDay = baseDate.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
    // Determine offset to get to Monday
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    
    const weekdays = [];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 6; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + mondayOffset + i);
      const mm = d.getMonth() + 1;
      const dd = d.getDate();
      weekdays.push({
        label: `${mm}/${dd} (${dayLabels[i]})`,
        key: dayLabels[i]
      });
    }
    return weekdays;
  };

  const daysOfWeek = getWeeklyDates(bottomSelectedDate);

  // EMR Print Handler
  const handlePrint = (appt) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert("팝업 차단을 해제해 주세요.");
      return;
    }
    
    const transcriptHTML = appt.transcript.map(line => `
      <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-bottom: 3px;">
          <strong>${line.sender} ${line.lang ? `(${line.lang})` : ''}</strong>
          <span>${line.time}</span>
        </div>
        <div style="font-size: 13px; color: #111; line-height: 1.4;">${line.text}</div>
      </div>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>K-Plastic Surgeon Live - EMR Print</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #333;
              line-height: 1.5;
              padding: 40px;
              margin: 0;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #d4af37;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 26px;
              color: #0f111a;
              letter-spacing: 2px;
            }
            .header p {
              margin: 5px 0 0 0;
              font-size: 12px;
              color: #666;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .profile-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .profile-table th, .profile-table td {
              border: 1px solid #ddd;
              padding: 10px 12px;
              text-align: left;
              font-size: 13px;
            }
            .profile-table th {
              background-color: #f7f7f7;
              font-weight: bold;
              width: 25%;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              color: #b8901c;
              border-left: 4px solid #d4af37;
              padding-left: 10px;
              margin-bottom: 12px;
              text-transform: uppercase;
            }
            .section-content {
              background-color: #fafafa;
              border: 1px solid #eaeaea;
              padding: 15px;
              border-radius: 8px;
              font-size: 13px;
              color: #444;
              line-height: 1.6;
            }
            .transcript-box {
              border: 1px solid #eaeaea;
              padding: 15px;
              border-radius: 8px;
              background-color: #fff;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>K-PLASTIC SURGEON LIVE</h1>
            <p>Medical Consultation & EMR Record</p>
          </div>
          
          <table class="profile-table">
            <tr>
              <th>환자명 (Name)</th>
              <td>${appt.patientName}</td>
              <th>국적 (Nationality)</th>
              <td>${appt.nationality}</td>
            </tr>
            <tr>
              <th>나이 (Age)</th>
              <td>${appt.patientAge}세</td>
              <th>상담 시간 (Time)</th>
              <td>${appt.time}</td>
            </tr>
            <tr>
              <th>인쇄 일시 (Print Date)</th>
              <td colspan="3">${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}</td>
            </tr>
          </table>
          
          <div class="section">
            <div class="section-title">환자 사전 요구사항 (Pre-requisites)</div>
            <div class="section-content">${appt.prerequisites}</div>
          </div>
          
          <div class="section">
            <div class="section-title">AI 가상 성형 리포트 요약 (AI Simulation Report)</div>
            <div class="section-content">${appt.aiReport}</div>
          </div>
          
          <div class="section">
            <div class="section-title">실시간 통역 스크립트 기록 (Transcript)</div>
            <div class="transcript-box">
              ${transcriptHTML}
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const toggleSlot = (dayKey, time) => {
    const slotKey = `${dayKey}-${time}`;
    const newSlots = new Set(selectedSlots);
    if (newSlots.has(slotKey)) {
      newSlots.delete(slotKey);
    } else {
      newSlots.add(slotKey);
    }
    setSelectedSlots(newSlots);
  };

  const handlePublishSlots = async () => {
    if (selectedSlots.size === 0) {
      showToast('⚠️ 오픈할 상담 슬롯을 최소 하나 이상 선택해 주세요.');
      return;
    }
    setPublishing(true);
    try {
      const slotsArray = Array.from(selectedSlots);
      const response = await mockApi.publishSlots(slotsArray);
      if (response.success) {
        showToast('✨ 환자용 앱에 일정이 동기화되었습니다.');
      }
    } catch (error) {
      showToast('❌ 일정 오픈에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setPublishing(false);
    }
  };

  // Date format string
  const formatDatePickerString = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const day = days[date.getDay()];
    return `${yyyy}. ${mm}. ${dd} (${day})`;
  };

  return (
    <div className="min-h-screen w-full bg-[#08090f] bg-premium-dark text-white flex flex-col font-sans relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center bg-[#131625] border-2 border-[#e5c483] text-[#e5c483] px-6 py-4 rounded-2xl shadow-[0_8px_32px_rgba(229,196,131,0.25)] animate-bounce font-medium">
          <span className="mr-2">📢</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <header className="w-full py-5 px-8 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          {onBackToSelector && (
            <button 
              onClick={onBackToSelector} 
              className="text-[#e5c483] hover:text-white transition bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm font-semibold border border-white/5 cursor-pointer"
            >
              ← 메인 메뉴
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gold-gradient tracking-wider uppercase">
              K-Plastic Surgeon Live
            </h1>
            <p className="text-xs text-white/40 tracking-wider">HOSPITAL PORTAL & DASHBOARD</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-medium text-white/80">원장님 진료실 (Online)</span>
          </div>
        </div>
      </header>

      {/* Main Content: Top-Bottom Stack Layout */}
      <main className="flex-1 p-6 md:p-8 flex flex-col gap-8 max-w-[1600px] w-full mx-auto">
        
        {/* TOP SECTION: 💻 실시간 예약 대시보드 */}
        <section className="glass-card rounded-3xl p-6 shadow-xl border border-white/5 flex flex-col">
          <div className="mb-5 border-b border-white/5 pb-4">
            <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>💻</span> 실시간 예약 대시보드
            </h2>
            <p className="text-xs text-white/50 mt-1">지정한 날짜의 실시간 비대면 성형상담 환자 카드 목록이 표시됩니다.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Mini Calendar */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-[#e5c483] font-bold tracking-wider mb-2 self-start">📅 조회 날짜 선택</span>
              <MiniCalendar selectedDate={topSelectedDate} onSelectDate={setTopSelectedDate} />
              <div className="mt-3 text-center">
                <span className="text-xs text-white/60">선택일: </span>
                <span className="text-xs font-bold text-white/90">{formatDatePickerString(topSelectedDate)}</span>
              </div>
            </div>

            {/* Right Column: Dynamic Patient List */}
            <div className="flex-1">
              <div className="text-xs text-[#e5c483] font-bold tracking-wider mb-3">
                👥 오늘의 화상 상담 리스트 ({appointments.length}건)
              </div>
              
              {loadingAppts ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/40">
                  <span className="text-3xl animate-spin">⏳</span>
                  <p className="mt-2 text-xs">로딩 중...</p>
                </div>
              ) : appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl text-white/30 text-xs">
                  <span>📭 선택한 날짜({formatDatePickerString(topSelectedDate)})에 예정된 상담이 없습니다.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {appointments.map((appt) => (
                    <div
                      key={appt.id}
                      onClick={() => {
                        setSelectedAppt(appt);
                        setIsRecordModalOpen(true);
                      }}
                      className="glass-card rounded-2xl p-4.5 cursor-pointer hover:border-[#e5c483]/50 hover:bg-white/[0.04] transition-all duration-300 border border-white/5 flex flex-col justify-between group shadow"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2.5">
                          <div>
                            <span className="text-[9px] text-[#e5c483] font-bold tracking-widest uppercase">
                              {appt.nationality} ({appt.patientAge}세)
                            </span>
                            <h3 className="text-base font-black text-white/95 mt-0.5 group-hover:text-[#e5c483] transition-colors">
                              {appt.patientName}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-white/60 mb-4">
                          <span>🕒 예약 시간:</span>
                          <span className="font-semibold text-white/90">{appt.time}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEnterRoom) {
                            onEnterRoom(appt.roomId);
                          }
                        }}
                        className="w-full py-2 rounded-xl font-bold text-xs bg-white/5 border border-white/10 hover:bg-[#e5c483] hover:text-slate-950 hover:border-transparent transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        📹 상담실 입장하기
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BOTTOM SECTION: 🗓️ 상담일정 오픈 */}
        <section className="glass-card rounded-3xl p-6 shadow-xl border border-white/5 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-white/5">
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                <span>🗓️</span> 상담일정 오픈
              </h2>
              <p className="text-xs text-white/50 mt-1">독립 미니 달력에서 날짜를 선택하면, 해당 날짜가 속한 주간 타임슬롯 표가 동적으로 로딩됩니다.</p>
            </div>
            <button
              onClick={handlePublishSlots}
              disabled={publishing}
              className="btn-gold text-slate-950 font-bold px-6 py-3 rounded-xl text-xs md:text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] cursor-pointer w-full sm:w-auto"
            >
              {publishing ? '동기화 중...' : '상담 슬롯 오픈하기 (Publish)'}
            </button>
          </div>

          <div className="flex flex-col xl:flex-row gap-6">
            {/* Left Column: Independent Mini Calendar */}
            <div className="flex flex-col items-center xl:self-start">
              <span className="text-xs text-[#e5c483] font-bold tracking-wider mb-2 self-start">📅 주간 기준일 선택</span>
              <MiniCalendar selectedDate={bottomSelectedDate} onSelectDate={setBottomSelectedDate} />
              <div className="mt-3 text-center">
                <span className="text-xs text-white/60">선택 주간 기준일: </span>
                <span className="text-xs font-bold text-white/90">{formatDatePickerString(bottomSelectedDate)}</span>
              </div>
            </div>

            {/* Right Column: Weekly Grid with dynamic date mapping */}
            <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
              <div className="min-w-[768px] grid grid-cols-6 gap-3">
                {daysOfWeek.map((day) => (
                  <div key={day.key} className="flex flex-col bg-white/[0.01] rounded-2xl border border-white/5 p-3.5">
                    <span className="text-center font-bold text-xs md:text-sm tracking-wider text-[#e5c483] mb-4 pb-2 border-b border-white/5 uppercase">
                      {day.label}
                    </span>
                    <div className="flex flex-col gap-2">
                      {timeSlots.map((time) => {
                        const isSelected = selectedSlots.has(`${day.key}-${time}`);
                        return (
                          <button
                            key={time}
                            onClick={() => toggleSlot(day.key, time)}
                            className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer text-center ${
                              isSelected
                                ? 'bg-[#e5c483]/20 border border-[#e5c483] text-[#e5c483] shadow-[0_0_12px_rgba(229,196,131,0.15)] font-bold'
                                : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10 text-white/60'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Consultation Record Viewer Modal Overlay */}
      {isRecordModalOpen && selectedAppt && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-[#0f111a] border border-[#e5c483]/20 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 relative shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button 
              onClick={() => setIsRecordModalOpen(false)}
              className="absolute top-5 right-5 text-white/50 hover:text-white transition text-lg bg-white/5 hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center border border-white/10 cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-3 border-b border-white/5 mb-4">
              <span>📝</span> 진료 기록 & 통역 뷰어 (Consultation Record)
            </h2>

            <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
              {/* Patient Profile */}
              <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-[#e5c483] tracking-wider font-bold">PATIENT PROFILE</span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{selectedAppt.patientName}</h3>
                <div className="flex gap-4 mt-2 text-xs text-white/60">
                  <p>국적: <strong className="text-white">{selectedAppt.nationality}</strong></p>
                  <p>나이: <strong className="text-white">{selectedAppt.patientAge}세</strong></p>
                  <p>시간: <strong className="text-white">{selectedAppt.time}</strong></p>
                </div>
              </div>

              {/* Pre-requisites */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-[#e5c483] uppercase tracking-wider">환자 사전 요구사항 (Pre-requisites)</h4>
                <div className="text-xs md:text-sm bg-white/[0.01] border border-white/5 p-3.5 rounded-xl text-white/80 leading-relaxed font-light">
                  {selectedAppt.prerequisites}
                </div>
              </div>

              {/* AI Report */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-[#e5c483] uppercase tracking-wider">AI 가상 성형 리포트 요약</h4>
                <div className="text-xs md:text-sm bg-white/[0.01] border border-white/5 p-3.5 rounded-xl text-white/80 leading-relaxed font-light">
                  {selectedAppt.aiReport}
                </div>
              </div>

              {/* Transcript */}
              <div className="space-y-2 flex-1 flex flex-col">
                <h4 className="text-xs font-bold text-[#e5c483] uppercase tracking-wider">실시간 통역 스크립트 기록 (Transcript)</h4>
                <div className="flex-1 min-h-[180px] bg-black/40 border border-white/5 p-3.5 rounded-xl overflow-y-auto custom-scrollbar space-y-3">
                  {selectedAppt.transcript.map((line, idx) => {
                    const isDoctor = line.sender === 'Doctor';
                    const isInterpreter = line.sender === 'AI Interpreter';
                    
                    let senderColor = 'text-sky-400';
                    if (isDoctor) senderColor = 'text-[#e5c483]';
                    if (isInterpreter) senderColor = 'text-emerald-400';

                    return (
                      <div key={idx} className="text-xs leading-relaxed border-b border-white/[0.02] pb-2 last:border-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-bold ${senderColor}`}>
                            {line.sender} {line.lang && `(${line.lang})`}
                          </span>
                          <span className="text-[10px] text-white/30">{line.time}</span>
                        </div>
                        <p className="text-white/80 font-light pl-1">{line.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-3 border-t border-white/5 flex gap-3">
              <button
                onClick={() => {
                  handlePrint(selectedAppt);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-[#e5c483] text-slate-950 transition-all hover:scale-[1.02] cursor-pointer text-center"
              >
                🖨️ 진료 기록 인쇄 (Print)
              </button>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer text-center"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalMain;
