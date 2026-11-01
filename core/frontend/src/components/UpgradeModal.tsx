import React, { useState } from 'react';
import {
  X,
  Zap,
  Check,
  QrCode,
  KeyRound,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  PhoneCall,
  Clock,
} from 'lucide-react';
import { useProLicense } from '../contexts/ProLicenseContext';

export function UpgradeModal() {
  const {
    isUpgradeModalOpen,
    closeUpgradeModal,
    selectedFeature,
    planName,
    activateKey,
    isActivating,
  } = useProLicense();

  const [activeTab, setActiveTab] = useState<'plans' | 'qr' | 'key'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<'hobby' | 'farm_pro' | 'farm_max'>('hobby');
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  if (!isUpgradeModalOpen) return null;

  const plans = [
    {
      id: 'beginner',
      name: 'Beginner',
      printers: '1 máy',
      price: '0 đ',
      period: 'trọn đời',
      features: [
        'Giám sát camera WebRTC độ trễ thấp',
        'Quản lý cuộn nhựa Spoolman',
        'Hàng đợi in cơ bản (Basic Queue)',
      ],
      current: planName.includes('Beginner'),
      highlight: false,
    },
    {
      id: 'hobby',
      name: 'Hobby',
      printers: '2 – 5 máy',
      priceMonth: '69.000 đ',
      priceYear: '690.000 đ',
      periodMonth: '/ tháng',
      periodYear: '/ năm',
      badge: 'Phổ biến nhất',
      features: [
        'Auto Swap PEI gạt bàn in liên tục 24/7',
        'Smart Power tự tắt nguồn sau khi in',
        'Skip Objects bỏ qua chi tiết lỗi trên bàn',
        'XiaoZhi AI Voice thông báo giọng nói',
      ],
      current: planName.includes('Hobby'),
      highlight: true,
    },
    {
      id: 'farm_pro',
      name: 'Farm Pro',
      printers: '6 – 15 máy',
      priceMonth: '169.000 đ',
      priceYear: '1.690.000 đ',
      periodMonth: '/ tháng',
      periodYear: '/ năm',
      features: [
        'Toàn bộ tính năng gói Hobby',
        'Hàng đợi thông minh tự chia việc sang máy rảnh',
        'Thống kê chi phí điện & tiêu hao nhựa chi tiết',
        'Ưu tiên hỗ trợ kỹ thuật qua Zalo',
      ],
      current: planName.includes('Farm Pro'),
      highlight: false,
    },
    {
      id: 'farm_max',
      name: 'Farm Max',
      printers: '16 – 30 máy',
      priceMonth: '349.000 đ',
      priceYear: '3.490.000 đ',
      periodMonth: '/ tháng',
      periodYear: '/ năm',
      features: [
        'Toàn bộ tính năng gói Farm Pro',
        'Tối ưu hóa tối đa trên 1 máy chủ Pi / Mini PC',
        'Giám sát cụm máy lớn mượt mà',
        'Hỗ trợ kỹ thuật 1-1 chuyên sâu',
      ],
      current: planName.includes('Farm Max'),
      highlight: false,
    },
  ];

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    const ok = await activateKey(licenseKeyInput.trim());
    if (ok) {
      setLicenseKeyInput('');
    }
  };

  const getPriceAmount = () => {
    if (selectedPlan === 'hobby') return billingCycle === 'month' ? '69000' : '690000';
    if (selectedPlan === 'farm_pro') return billingCycle === 'month' ? '169000' : '1690000';
    return billingCycle === 'month' ? '349000' : '3490000';
  };

  const getOrderDescription = () => {
    const phone = customerPhone.trim() || 'KHACH';
    return `BEE ${selectedPlan.toUpperCase()} ${phone}`;
  };

  // VietQR QuickLink format (Mã ngân hàng MBBank: 970422 / MB)
  const qrUrl = `https://img.vietqr.io/image/MB-0355444983-compact2.png?amount=${getPriceAmount()}&addInfo=${encodeURIComponent(
    getOrderDescription()
  )}&accountName=LE%20QUANG%20DUNG`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={closeUpgradeModal}
    >
      <div
        className="relative w-full max-w-4xl bg-gradient-to-br from-bambu-card to-bambu-dark-secondary border border-bambu-dark-tertiary rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-white my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 p-2 text-bambu-gray hover:text-white rounded-lg hover:bg-bambu-dark-tertiary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>NÂNG TẦM TRẢI NGHIỆM IN 3D TỰ ĐỘNG</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Nâng Cấp Gói Bản Quyền <span className="text-bambu-green-light">3D Printer Platform PRO</span>
          </h2>
          <p className="text-sm text-bambu-gray max-w-2xl mx-auto">
            Biến máy in của bạn thành dây chuyền sản xuất 24/7: Tự động gạt bàn PEI xuyên đêm, ngắt điện thông minh và giám sát mượt mà không lo gián đoạn.
          </p>

          {selectedFeature && (
            <div className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-bambu-green/10 border border-bambu-green/30 text-bambu-green-light text-xs font-medium">
              ⚡ Tính năng <span className="font-bold underline">{selectedFeature}</span> yêu cầu gói trả phí Pro.
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center border-b border-bambu-dark-tertiary pb-4">
          <div className="flex bg-bambu-dark-secondary rounded-xl p-1 border border-bambu-dark-tertiary">
            <button
              onClick={() => setActiveTab('plans')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'plans'
                  ? 'bg-bambu-green text-white shadow-md'
                  : 'text-bambu-gray hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Bảng Giá & Các Gói</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'qr'
                  ? 'bg-bambu-green text-white shadow-md'
                  : 'text-bambu-gray hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Thanh Toán VietQR</span>
            </button>
            <button
              onClick={() => setActiveTab('key')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'key'
                  ? 'bg-bambu-green text-white shadow-md'
                  : 'text-bambu-gray hover:text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Nhập Mã Kích Hoạt</span>
            </button>
          </div>
        </div>

        {/* TAB 1: BẢNG GIÁ */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className={billingCycle === 'month' ? 'text-white font-bold' : 'text-bambu-gray'}>
                Thanh toán theo tháng
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'month' ? 'year' : 'month')}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-bambu-dark-tertiary transition-colors"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-bambu-green transition-transform ${
                    billingCycle === 'year' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={billingCycle === 'year' ? 'text-white font-bold' : 'text-bambu-gray'}>
                Thanh toán theo năm{' '}
                <span className="text-xs px-2 py-0.5 rounded bg-bambu-green/20 text-bambu-green font-bold">
                  Tiết kiệm 2 tháng
                </span>
              </span>
            </div>

            {/* Grid 4 Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all ${
                    p.highlight
                      ? 'bg-gradient-to-b from-bambu-green/10 to-bambu-dark-secondary border-bambu-green shadow-lg shadow-bambu-green/10'
                      : 'bg-bambu-dark-secondary/70 border-bambu-dark-tertiary hover:border-bambu-gray/50'
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider shadow">
                      {p.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-white">{p.name}</h3>
                      <span className="text-xs text-bambu-gray bg-bambu-dark px-2 py-0.5 rounded">
                        {p.printers}
                      </span>
                    </div>

                    <div className="mt-3 mb-4">
                      {p.id === 'beginner' ? (
                        <div className="text-2xl font-black text-white">0 đ</div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white">
                            {billingCycle === 'month' ? p.priceMonth : p.priceYear}
                          </span>
                          <span className="text-xs text-bambu-gray">
                            {billingCycle === 'month' ? p.periodMonth : p.periodYear}
                          </span>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2 text-xs text-bambu-gray border-t border-bambu-dark-tertiary pt-3 mb-4">
                      {p.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-left">
                          <Check className="w-3.5 h-3.5 text-bambu-green shrink-0 mt-0.5" />
                          <span className="text-white/90">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    {p.id === 'beginner' ? (
                      <button
                        disabled
                        className="w-full py-2 px-3 rounded-lg bg-bambu-dark-tertiary/50 text-bambu-gray text-xs font-semibold cursor-default"
                      >
                        Gói Mặc Định (1 Máy)
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedPlan(p.id as 'hobby' | 'farm_pro' | 'farm_max');
                          setActiveTab('qr');
                        }}
                        className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-all shadow-md ${
                          p.highlight
                            ? 'bg-bambu-green hover:bg-bambu-green-light text-white shadow-bambu-green/20'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        Nâng Cấp Gói {p.name}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Enterprise Row */}
            <div className="flex flex-col md:flex-row items-center justify-between p-4 rounded-xl bg-bambu-dark border border-bambu-dark-tertiary gap-3 text-left">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-bambu-green" />
                  Xưởng Lớn / Doanh Nghiệp (Trên 30 máy in)
                </h4>
                <p className="text-xs text-bambu-gray mt-0.5">
                  Tư vấn kiến trúc cụm máy phân tán (Multi-node), cài đặt tận nơi, hỗ trợ SLA 1-1 riêng và xuất hóa đơn VAT.
                </p>
              </div>
              <a
                href="https://beestemsolutions.com.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5 text-bambu-green" />
                <span>Liên Hệ Doanh Nghiệp</span>
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: THANH TOÁN VIETQR */}
        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: QR Image */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl">
              <img
                src={qrUrl}
                alt="VietQR Chuyển Khoản Nhanh"
                className="w-64 h-64 object-contain rounded-lg"
              />
              <p className="text-black text-xs font-bold mt-2 text-center">
                Quét bằng mọi ứng dụng Ngân hàng (MB, VCB, Tech, MoMo...)
              </p>
            </div>

            {/* Right: Order details */}
            <div className="space-y-4 text-left">
              <div>
                <span className="text-xs font-semibold text-bambu-green uppercase tracking-wider">
                  Thông Tin Thanh Toán Tự Động
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1">
                  Gói{' '}
                  {selectedPlan === 'hobby'
                    ? 'Hobby (2–5 máy)'
                    : selectedPlan === 'farm_pro'
                    ? 'Farm Pro (6–15 máy)'
                    : 'Farm Max (16–30 máy)'}
                </h3>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {Number(getPriceAmount()).toLocaleString('vi-VN')} VNĐ
                  <span className="text-xs text-bambu-gray font-normal ml-1">
                    {billingCycle === 'month' ? '/ 1 tháng' : '/ 1 năm'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-bambu-gray mb-1">
                    Số điện thoại nhận key (Zalo / SMS):
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray focus:outline-none focus:border-bambu-green"
                  />
                </div>

                <div className="p-3 bg-bambu-dark rounded-lg border border-bambu-dark-tertiary space-y-1">
                  <div className="flex justify-between">
                    <span className="text-bambu-gray">Nội dung chuyển khoản:</span>
                    <span className="font-mono font-bold text-white select-all">
                      {getOrderDescription()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bambu-gray">Chủ tài khoản:</span>
                    <span className="font-bold text-white">LE QUANG DUNG</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bambu-gray">Ngân hàng:</span>
                    <span className="font-bold text-white">MB Bank (Quân Đội)</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-bambu-gray space-y-1">
                <p className="flex items-center gap-1.5 text-bambu-green-light">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Sau khi chuyển khoản, hệ thống sẽ kích hoạt hoặc gửi key qua Zalo trong vài phút.
                </p>
                <p>
                  Đã có file key?{' '}
                  <button
                    onClick={() => setActiveTab('key')}
                    className="text-amber-400 font-semibold underline hover:text-amber-300"
                  >
                    Bấm vào đây để dán mã kích hoạt
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NHẬP KEY */}
        {activeTab === 'key' && (
          <form onSubmit={handleActivate} className="space-y-4 max-w-lg mx-auto text-left">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Dán mã bản quyền License Key của bạn:
              </label>
              <textarea
                rows={5}
                required
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                placeholder="Dán toàn bộ nội dung file bee_license.key vào đây..."
                className="w-full p-3 bg-bambu-dark border border-bambu-dark-tertiary rounded-xl font-mono text-xs text-white placeholder-bambu-gray focus:outline-none focus:ring-2 focus:ring-bambu-green"
              />
            </div>

            <button
              type="submit"
              disabled={isActivating || !licenseKeyInput.trim()}
              className="w-full py-3 px-4 bg-bambu-green hover:bg-bambu-green-light text-white font-bold rounded-xl shadow-lg shadow-bambu-green/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isActivating ? 'Đang xác thực bản quyền...' : 'Kích Hoạt Ngay'}
            </button>

            <div className="text-center pt-2">
              <a
                href="https://beestemsolutions.com.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-bambu-gray hover:text-bambu-green transition-colors"
              >
                <span>Hỗ trợ kỹ thuật: BeE STEM Solutions</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

