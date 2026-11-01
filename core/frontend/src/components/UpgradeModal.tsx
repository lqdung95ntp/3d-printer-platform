import { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  ShieldCheck,
  Sparkles,
  QrCode,
  KeyRound,
  ExternalLink,
  PhoneCall,
  Clock,
  Globe,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useProLicense } from '../contexts/ProLicenseContext';

export function UpgradeModal() {
  const {
    isUpgradeModalOpen,
    closeUpgradeModal,
    selectedFeature,
    activateKey,
    isActivating,
    planName,
  } = useProLicense();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60 * 1000,
  });

  const [activeTab, setActiveTab] = useState<'plans' | 'qr' | 'key'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<'hobby' | 'farm_pro' | 'farm_max'>('hobby');
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [currency, setCurrency] = useState<'USD' | 'VND'>('USD');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Auto-detect currency from settings
  useEffect(() => {
    if (settings?.currency) {
      setCurrency(settings.currency.toUpperCase() === 'VND' ? 'VND' : 'USD');
    }
  }, [settings?.currency]);

  if (!isUpgradeModalOpen) return null;

  const isVnd = currency === 'VND';

  const plans = [
    {
      id: 'beginner',
      name: 'Beginner',
      printers: '1 printer',
      price: isVnd ? '0 ₫' : '$0',
      period: 'lifetime',
      features: [
        'Manage & monitor 1 printer',
        'Full core printing features',
        'Spoolman filament management',
        'Basic print queue',
      ],
      current: planName.includes('Beginner'),
      highlight: false,
    },
    {
      id: 'hobby',
      name: 'Hobby',
      printers: '1 – 5 printers',
      priceMonth: isVnd ? '69,000 ₫' : '$4.99',
      priceYear: isVnd ? '690,000 ₫' : '$49',
      periodMonth: '/ month',
      periodYear: '/ year',
      badge: 'Most Popular',
      features: [
        'Manage 1 to 5 printers',
        'Full BeE Pro: Continuous 24/7 Auto Swap PEI',
        'Full BeE Pro: Smart Power auto shutoff',
        'Technical support via Zalo',
      ],
      current: planName.includes('Hobby'),
      highlight: true,
    },
    {
      id: 'farm_pro',
      name: 'Farm Pro',
      printers: '6 – 15 printers',
      priceMonth: isVnd ? '169,000 ₫' : '$12.99',
      priceYear: isVnd ? '1,690,000 ₫' : '$129',
      periodMonth: '/ month',
      periodYear: '/ year',
      features: [
        'Manage 6 to 15 printers',
        'Full BeE Pro for all farm printers',
        'Optimized performance for medium farms',
        'Priority technical support via Zalo',
      ],
      current: planName.includes('Farm Pro'),
      highlight: false,
    },
    {
      id: 'farm_max',
      name: 'Farm Max',
      printers: '16 – 30 printers',
      priceMonth: isVnd ? '349,000 ₫' : '$29.99',
      priceYear: isVnd ? '3,490,000 ₫' : '$299',
      periodMonth: '/ month',
      periodYear: '/ year',
      features: [
        'Manage 16 to 30 printers',
        'Full BeE Pro maxed out on single Pi / Mini PC',
        'Optimized MQTT & camera streaming',
        'Dedicated 1-on-1 technical support',
      ],
      current: planName.includes('Farm Max'),
      highlight: false,
    },
  ];

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    const success = await activateKey(licenseKeyInput.trim());
    if (success) {
      setLicenseKeyInput('');
    }
  };

  const getVndAmount = () => {
    if (selectedPlan === 'hobby') return billingCycle === 'month' ? 69000 : 690000;
    if (selectedPlan === 'farm_pro') return billingCycle === 'month' ? 169000 : 1690000;
    return billingCycle === 'month' ? 349000 : 3490000;
  };

  const getUsdAmount = () => {
    if (selectedPlan === 'hobby') return billingCycle === 'month' ? '$4.99' : '$49';
    if (selectedPlan === 'farm_pro') return billingCycle === 'month' ? '$12.99' : '$129';
    return billingCycle === 'month' ? '$29.99' : '$299';
  };

  const getOrderDescription = () => {
    const phone = customerPhone.trim() || 'GUEST';
    return `BEE ${selectedPlan.toUpperCase()} ${phone}`;
  };

  // VietQR QuickLink format (MBBank: 970422 / MB)
  const qrUrl = `https://img.vietqr.io/image/MB-0355444983-compact2.png?amount=${getVndAmount()}&addInfo=${encodeURIComponent(
    getOrderDescription()
  )}&accountName=LE%20QUANG%20DUNG`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={closeUpgradeModal}
    >
      <div
        className="relative w-full max-w-6xl xl:max-w-7xl bg-gradient-to-br from-bambu-card to-bambu-dark-secondary border border-bambu-dark-tertiary rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-white my-8 max-h-[92vh] overflow-y-auto"
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
            <span>ELEVATE YOUR 3D PRINTING AUTOMATION</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Upgrade to <span className="text-bambu-green-light">3D Printer Platform PRO</span>
          </h2>
          <p className="text-sm text-bambu-gray max-w-2xl mx-auto">
            Transform your printers into a 24/7 automated production line: Continuous overnight Auto Swap PEI, smart power shutoff, and smooth uninterrupted monitoring.
          </p>

          {selectedFeature && (
            <div className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-bambu-green/10 border border-bambu-green/30 text-bambu-green-light text-xs font-medium">
              ⚡ The <span className="font-bold underline">{selectedFeature}</span> feature requires a PRO subscription.
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
              <span>Pricing & Plans</span>
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
              <span>VietQR Payment</span>
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
              <span>Activate License Key</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PRICING PLANS */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            {/* Controls: Billing Toggle & Currency Switcher */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
              {/* Monthly / Annual Toggle */}
              <div className="flex items-center gap-3">
                <span className={billingCycle === 'month' ? 'text-white font-bold' : 'text-bambu-gray'}>
                  Monthly
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
                  Annual{' '}
                  <span className="text-xs px-2 py-0.5 rounded bg-bambu-green/20 text-bambu-green font-bold">
                    Save 2 months
                  </span>
                </span>
              </div>

              {/* Currency Toggle */}
              <div className="flex items-center gap-1 bg-bambu-dark p-1 rounded-lg border border-bambu-dark-tertiary">
                <Globe className="w-3.5 h-3.5 text-bambu-gray ml-1" />
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                    currency === 'USD'
                      ? 'bg-bambu-green text-white shadow-sm'
                      : 'text-bambu-gray hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('VND')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                    currency === 'VND'
                      ? 'bg-bambu-green text-white shadow-sm'
                      : 'text-bambu-gray hover:text-white'
                  }`}
                >
                  VND (₫)
                </button>
              </div>
            </div>

            {/* Grid 4 Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`relative flex flex-col justify-between p-5 xl:p-6 rounded-xl border transition-all ${
                    p.highlight
                      ? 'bg-gradient-to-b from-bambu-green/10 to-bambu-dark-secondary border-bambu-green shadow-lg shadow-bambu-green/10'
                      : 'bg-bambu-dark-secondary/70 border-bambu-dark-tertiary hover:border-bambu-gray/50'
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider shadow whitespace-nowrap">
                      {p.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-lg text-white whitespace-nowrap">{p.name}</h3>
                      <span className="text-xs text-bambu-gray bg-bambu-dark px-2.5 py-1 rounded whitespace-nowrap shrink-0">
                        {p.printers}
                      </span>
                    </div>

                    <div className="mt-3 mb-4">
                      {p.id === 'beginner' ? (
                        <div className="text-2xl font-black text-white whitespace-nowrap">{p.price}</div>
                      ) : (
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-2xl font-black text-white whitespace-nowrap">
                            {billingCycle === 'month' ? p.priceMonth : p.priceYear}
                          </span>
                          <span className="text-xs text-bambu-gray whitespace-nowrap">
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
                        Default (1 Printer)
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
                        Upgrade to {p.name}
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
                  Large Farm / Enterprise (30+ printers)
                </h4>
                <p className="text-xs text-bambu-gray mt-0.5">
                  Distributed multi-node architecture consulting, on-site setup, dedicated SLA support & VAT invoicing.
                </p>
              </div>
              <a
                href="https://beestemsolutions.com.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5 text-bambu-green" />
                <span>Contact Enterprise</span>
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: VIETQR PAYMENT */}
        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: QR Image */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl">
              <img
                src={qrUrl}
                alt="VietQR Instant Transfer"
                className="w-64 h-64 object-contain rounded-lg"
              />
              <p className="text-black text-xs font-bold mt-2 text-center">
                Scan with any mobile banking app (MB, VCB, Tech, MoMo...)
              </p>
            </div>

            {/* Right: Order details */}
            <div className="space-y-4 text-left">
              <div>
                <span className="text-xs font-semibold text-bambu-green uppercase tracking-wider">
                  Automated Payment Details
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1">
                  Plan:{' '}
                  {selectedPlan === 'hobby'
                    ? 'Hobby (1–5 printers)'
                    : selectedPlan === 'farm_pro'
                    ? 'Farm Pro (6–15 printers)'
                    : 'Farm Max (16–30 printers)'}
                </h3>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {getVndAmount().toLocaleString('vi-VN')} VNĐ
                  <span className="text-xs text-bambu-gray font-normal ml-2">
                    (~{getUsdAmount()} USD {billingCycle === 'month' ? '/ mo' : '/ yr'})
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-bambu-gray mb-1">
                    Phone number to receive key (Zalo / SMS / WhatsApp):
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 0912345678 or +84..."
                    className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray focus:outline-none focus:border-bambu-green"
                  />
                </div>

                <div className="p-3 bg-bambu-dark rounded-lg border border-bambu-dark-tertiary space-y-1">
                  <div className="flex justify-between">
                    <span className="text-bambu-gray">Transfer Memo:</span>
                    <span className="font-mono font-bold text-white select-all">
                      {getOrderDescription()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bambu-gray">Account Holder:</span>
                    <span className="font-bold text-white">LE QUANG DUNG</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bambu-gray">Bank:</span>
                    <span className="font-bold text-white">MB Bank (Vietnam)</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-bambu-gray space-y-1">
                <p className="flex items-center gap-1.5 text-bambu-green-light">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  After transferring, your license key will be activated or sent within minutes.
                </p>
                <p className="text-[11px] text-amber-400/90">
                  🌐 For international payments (PayPal, Stripe, Card), please contact us via support@beestemsolutions.com.vn.
                </p>
                <p>
                  Already have a key file?{' '}
                  <button
                    onClick={() => setActiveTab('key')}
                    className="text-amber-400 font-semibold underline hover:text-amber-300"
                  >
                    Click here to paste activation key
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVATE KEY */}
        {activeTab === 'key' && (
          <form onSubmit={handleActivate} className="space-y-4 max-w-lg mx-auto text-left">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Paste your License Key:
              </label>
              <textarea
                rows={5}
                required
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                placeholder="Paste the full content of bee_license.key here..."
                className="w-full p-3 bg-bambu-dark border border-bambu-dark-tertiary rounded-xl font-mono text-xs text-white placeholder-bambu-gray focus:outline-none focus:ring-2 focus:ring-bambu-green"
              />
            </div>

            <button
              type="submit"
              disabled={isActivating || !licenseKeyInput.trim()}
              className="w-full py-3 px-4 bg-bambu-green hover:bg-bambu-green-light text-white font-bold rounded-xl shadow-lg shadow-bambu-green/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isActivating ? 'Verifying license...' : 'Activate Now'}
            </button>

            <div className="text-center pt-2">
              <a
                href="https://beestemsolutions.com.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-bambu-gray hover:text-bambu-green transition-colors"
              >
                <span>Technical Support: BeE STEM Solutions</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
