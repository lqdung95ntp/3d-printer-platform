import { useState, useEffect } from "react";
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
	Globe,
	Copy,
	CheckCircle,
	ArrowUpRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useProLicense } from "../contexts/ProLicenseContext";

const BANK_DISPLAY_NAMES: Record<string, string> = {
	ICB: "VietinBank",
	VCB: "Vietcombank",
	BIDV: "BIDV",
	VBA: "Agribank",
	OCB: "OCB",
	MB: "MBBank",
	TCB: "Techcombank",
	ACB: "ACB",
	VPB: "VPBank",
	TPB: "TPBank",
	SHB: "SHB",
	HDB: "HDBank",
	SCB: "SCB",
	VIB: "VIB",
};

export function UpgradeModal() {
	const {
		isUpgradeModalOpen,
		closeUpgradeModal,
		selectedFeature,
		activateKey,
		isActivating,
		planName,
		proStatus,
		isPro,
	} = useProLicense();

	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: api.getSettings,
		staleTime: 60 * 1000,
	});

	const { data: paymentConfig } = useQuery({
		queryKey: ["paymentConfig"],
		queryFn: async () => {
			try {
				const res = await fetch("/api/v1/pro/payments/config");
				if (res.ok) return await res.json();
			} catch (e) {
				console.warn(
					"Could not fetch payment config, falling back to defaults:",
					e,
				);
			}
			return {
				bank_code: "MB",
				account_no: "0355444983",
				account_name: "LE QUANG DUNG",
			};
		},
		staleTime: 5 * 60 * 1000,
	});

	const { data: deviceData } = useQuery({
		queryKey: ["proDeviceId"],
		queryFn: async () => {
			try {
				const res = await fetch("/api/v1/pro/device-id");
				if (res.ok) {
					const json = await res.json();
					return json.device_id || "";
				}
			} catch (e) {
				console.warn("Could not fetch device id:", e);
			}
			return "";
		},
		staleTime: 60 * 60 * 1000,
	});

	const deviceId =
		deviceData ||
		(proStatus as any)?.device_id ||
		(proStatus?.license as any)?.device_id ||
		"";

	// Derive current & next plan
	const rawPlan = (proStatus?.license?.plan || "").toLowerCase();
	let currentPlanId:
		| "beginner"
		| "hobby"
		| "farm_pro"
		| "farm_max"
		| "enterprise" = "beginner";
	if (isPro) {
		if (rawPlan === "hobby" || planName.includes("Hobby")) {
			currentPlanId = "hobby";
		} else if (
			rawPlan === "farm_pro" ||
			rawPlan === "farm" ||
			planName.includes("Farm Pro")
		) {
			currentPlanId = "farm_pro";
		} else if (rawPlan === "farm_max" || planName.includes("Farm Max")) {
			currentPlanId = "farm_max";
		} else if (
			rawPlan === "enterprise" ||
			planName.includes("Enterprise")
		) {
			currentPlanId = "enterprise";
		} else {
			currentPlanId = "hobby";
		}
	}

	// Determine next plan for upgrade
	let nextPlanId: "hobby" | "farm_pro" | "farm_max" | "enterprise" = "hobby";
	if (currentPlanId === "beginner") {
		nextPlanId = "hobby";
	} else if (currentPlanId === "hobby") {
		nextPlanId = "farm_pro";
	} else if (currentPlanId === "farm_pro") {
		nextPlanId = "farm_max";
	} else if (currentPlanId === "farm_max") {
		nextPlanId = "enterprise";
	}

	const [activeTab, setActiveTab] = useState<"plans" | "qr" | "key">("plans");
	const [selectedPlan, setSelectedPlan] = useState<
		"hobby" | "farm_pro" | "farm_max"
	>("hobby");
	const [billingCycle, setBillingCycle] = useState<"month" | "year">("month");
	const [currency, setCurrency] = useState<"USD" | "VND">("USD");
	const [licenseKeyInput, setLicenseKeyInput] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");

	// Automatically select the next recommended plan when modal opens
	useEffect(() => {
		if (isUpgradeModalOpen) {
			setIsPaymentSuccess(false);
			setActivatedKeyResult("");
			if (nextPlanId === "farm_max") setSelectedPlan("farm_max");
			else if (nextPlanId === "farm_pro") setSelectedPlan("farm_pro");
			else setSelectedPlan("hobby");
		}
	}, [isUpgradeModalOpen, nextPlanId]);

	// Reset payment status on plan change
	useEffect(() => {
		setIsPaymentSuccess(false);
		setActivatedKeyResult("");
	}, [selectedPlan]);

	// Persistent unique farm identifier (FARM_XXXXXX)
	const [farmId] = useState<string>(() => {
		let saved = localStorage.getItem("bee_farm_id");
		if (!saved) {
			const rand = Math.random()
				.toString(36)
				.substring(2, 8)
				.toUpperCase();
			saved = `FARM_${rand}`;
			localStorage.setItem("bee_farm_id", saved);
		}
		return saved;
	});

	const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
	const [activatedKeyResult, setActivatedKeyResult] = useState<string>("");
	const [copiedMemo, setCopiedMemo] = useState(false);
	const [copiedAccount, setCopiedAccount] = useState(false);
	const [copiedSuccessKey, setCopiedSuccessKey] = useState(false);

	// Auto-detect currency from settings
	useEffect(() => {
		if (settings?.currency) {
			setCurrency(
				settings.currency.toUpperCase() === "VND" ? "VND" : "USD",
			);
		}
	}, [settings?.currency]);

	const isVnd = currency === "VND";

	const PLAN_RANKS: Record<string, number> = {
		beginner: 1,
		hobby: 2,
		farm_pro: 3,
		farm_max: 4,
		enterprise: 5,
	};
	const currentRank = PLAN_RANKS[currentPlanId] || 1;

	const plans = [
		{
			id: "beginner",
			name: "Beginner",
			printers: "1 printer",
			price: isVnd ? "0 ₫" : "$0",
			period: "lifetime",
			badge: "",
			features: [
				"Manage & monitor 1 printer",
				"Full core printing features",
				"Spoolman filament management",
				"Basic print queue",
			],
		},
		{
			id: "hobby",
			name: "Hobby",
			printers: "1 – 5 printers",
			priceMonth: isVnd ? "69,000 ₫" : "$4.99",
			priceYear: isVnd ? "690,000 ₫" : "$49",
			periodMonth: "/ month",
			periodYear: "/ year",
			badge: "Most Popular",
			features: [
				"Manage 1 to 5 printers",
				"Full BeE Pro: Continuous 24/7 Auto Swap PEI",
				"Full BeE Pro: Smart Power auto shutoff",
				"Technical support via Zalo",
			],
		},
		{
			id: "farm_pro",
			name: "Farm Pro",
			printers: "6 – 15 printers",
			priceMonth: isVnd ? "169,000 ₫" : "$12.99",
			priceYear: isVnd ? "1,690,000 ₫" : "$129",
			periodMonth: "/ month",
			periodYear: "/ year",
			badge: "Best for Small Farms",
			features: [
				"Manage 6 to 15 printers",
				"Full BeE Pro for all farm printers",
				"Optimized performance for medium farms",
				"Priority technical support via Zalo",
			],
		},
		{
			id: "farm_max",
			name: "Farm Max",
			printers: "16 – 30 printers",
			priceMonth: isVnd ? "349,000 ₫" : "$29.99",
			priceYear: isVnd ? "3,490,000 ₫" : "$299",
			periodMonth: "/ month",
			periodYear: "/ year",
			badge: "Maximum Power",
			features: [
				"Manage 16 to 30 printers",
				"Full BeE Pro maxed out on single Pi / Mini PC",
				"Optimized MQTT & camera streaming",
				"Dedicated 1-on-1 technical support",
			],
		},
	];

	const handleActivate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!licenseKeyInput.trim()) return;
		const success = await activateKey(licenseKeyInput.trim());
		if (success) {
			setLicenseKeyInput("");
		}
	};

	const PLAN_BASE_PRICES_VND: Record<
		string,
		{ month: number; year: number }
	> = {
		beginner: { month: 0, year: 0 },
		hobby: { month: 69000, year: 690000 },
		farm_pro: { month: 169000, year: 1690000 },
		farm_max: { month: 349000, year: 3490000 },
	};

	const PLAN_BASE_PRICES_USD: Record<
		string,
		{ month: number; year: number }
	> = {
		beginner: { month: 0, year: 0 },
		hobby: { month: 4.99, year: 49 },
		farm_pro: { month: 12.99, year: 129 },
		farm_max: { month: 29.99, year: 299 },
	};

	const getFullVndAmount = (plan = selectedPlan) => {
		return PLAN_BASE_PRICES_VND[plan]?.[billingCycle] || 0;
	};

	const getCurrentCreditVnd = () => {
		if (currentPlanId === "beginner") return 0;
		return PLAN_BASE_PRICES_VND[currentPlanId]?.[billingCycle] || 0;
	};

	const getVndAmount = (plan = selectedPlan) => {
		const full = getFullVndAmount(plan);
		const credit = getCurrentCreditVnd();
		return Math.max(0, full - credit);
	};

	const getFullUsdAmount = (plan = selectedPlan) => {
		return PLAN_BASE_PRICES_USD[plan]?.[billingCycle] || 0;
	};

	const getCurrentCreditUsd = () => {
		if (currentPlanId === "beginner") return 0;
		return PLAN_BASE_PRICES_USD[currentPlanId]?.[billingCycle] || 0;
	};

	const getUsdAmount = (plan = selectedPlan) => {
		const full = getFullUsdAmount(plan);
		const credit = getCurrentCreditUsd();
		const diff = Math.max(0, full - credit);
		return diff % 1 === 0 ? `$${diff}` : `$${diff.toFixed(2)}`;
	};

	const isProratedUpgrade =
		PLAN_RANKS[selectedPlan] > PLAN_RANKS[currentPlanId] &&
		currentPlanId !== "beginner";

	const bankCode = paymentConfig?.bank_code || "MB";
	const isVietinBank =
		bankCode.toUpperCase() === "ICB" ||
		bankCode.toUpperCase().includes("VIETIN") ||
		(paymentConfig?.account_name || "").toUpperCase().includes("VIETIN");

	const getOrderDescription = () => {
		const baseMemo = `BEE ${selectedPlan.toUpperCase()} ${farmId}`;
		return isVietinBank ? `SEVQR ${baseMemo}` : baseMemo;
	};

	const accountNo = paymentConfig?.account_no || "0355444983";
	const accountName = paymentConfig?.account_name || "LE QUANG DUNG";
	const orderMemo = getOrderDescription();

	// VietQR format served via local proxy to comply with SPA Content Security Policy
	const qrUrl = `/api/v1/pro/payments/qr-code?bank_code=${encodeURIComponent(
		bankCode,
	)}&account_no=${encodeURIComponent(
		accountNo,
	)}&account_name=${encodeURIComponent(
		accountName,
	)}&amount=${getVndAmount()}&memo=${encodeURIComponent(orderMemo)}`;

	// Polling payment status via local proxy to comply with SPA Content Security Policy
	useEffect(() => {
		if (activeTab !== "qr" || !isUpgradeModalOpen || isPaymentSuccess)
			return;

		const checkOrder = async () => {
			try {
				const memo = getOrderDescription();
				const devParam = deviceId
					? `&device_id=${encodeURIComponent(deviceId)}`
					: "";
				const res = await fetch(
					`/api/v1/pro/payments/check-order?code=${encodeURIComponent(
						memo,
					)}&farm_id=${encodeURIComponent(farmId)}${devParam}`,
				);
				if (res.ok) {
					const data = await res.json();
					const tokenToUse = data.license_token || data.license_key;
					if (data.paid && tokenToUse) {
						setIsPaymentSuccess(true);
						setActivatedKeyResult(tokenToUse);
						await activateKey(tokenToUse);
					}
				}
			} catch {
				// Silently ignore polling errors
			}
		};

		const interval = setInterval(checkOrder, 3500);
		return () => clearInterval(interval);
	}, [
		activeTab,
		isUpgradeModalOpen,
		isPaymentSuccess,
		selectedPlan,
		farmId,
		deviceId,
		activateKey,
		isVietinBank,
	]);

	if (!isUpgradeModalOpen) return null;

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
						Upgrade to{" "}
						<span className="text-bambu-green-light">
							3D Printer Platform PRO
						</span>
					</h2>
					<p className="text-sm text-bambu-gray max-w-2xl mx-auto">
						Transform your printers into a 24/7 automated production
						line: Continuous overnight Auto Swap PEI, smart power
						shutoff, and smooth uninterrupted monitoring.
					</p>

					{selectedFeature && (
						<div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium max-w-2xl mx-auto">
							<Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
							<span>
								{selectedFeature.includes("Add printer") ? (
									<>
										<strong className="text-white font-bold">
											{selectedFeature}
										</strong>
										. Upgrade to{" "}
										<strong className="underline text-amber-300 font-extrabold">
											{nextPlanId === "farm_pro"
												? "Farm Pro (6–15 printers)"
												: nextPlanId === "farm_max"
													? "Farm Max (16–30 printers)"
													: "Next Plan"}
										</strong>{" "}
										to unlock more printer slots.
									</>
								) : (
									<>
										The{" "}
										<strong className="underline text-white font-bold">
											{selectedFeature}
										</strong>{" "}
										feature requires an active PRO
										subscription.
									</>
								)}
							</span>
						</div>
					)}
				</div>

				{/* Tab Switcher */}
				<div className="flex flex-col items-center border-b border-bambu-dark-tertiary pb-4 gap-2.5">
					<div className="flex bg-bambu-dark-secondary rounded-xl p-1 border border-bambu-dark-tertiary">
						<button
							onClick={() => setActiveTab("plans")}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
								activeTab === "plans"
									? "bg-bambu-green text-white shadow-md"
									: "text-bambu-gray hover:text-white"
							}`}
						>
							<Zap className="w-4 h-4" />
							<span>Pricing & Plans</span>
						</button>
						<button
							onClick={() => setActiveTab("qr")}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
								activeTab === "qr"
									? "bg-bambu-green text-white shadow-md"
									: "text-bambu-gray hover:text-white"
							}`}
						>
							<QrCode className="w-4 h-4" />
							<span>VietQR Payment</span>
						</button>
						<button
							onClick={() => setActiveTab("key")}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
								activeTab === "key"
									? "bg-bambu-green text-white shadow-md"
									: "text-bambu-gray hover:text-white"
							}`}
						>
							<KeyRound className="w-4 h-4" />
							<span>Activate License Key</span>
						</button>
					</div>
					{deviceId && (
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bambu-dark/80 border border-bambu-dark-tertiary text-xs font-mono text-bambu-gray">
							<ShieldCheck className="w-3.5 h-3.5 text-bambu-green" />
							<span>
								Mã máy (Device ID):{" "}
								<strong className="text-white">{deviceId}</strong>
							</span>
							<span className="text-[10px] px-1.5 py-0.2 rounded bg-bambu-green/15 text-bambu-green font-semibold">
								1 Machine Lock
							</span>
						</div>
					)}
				</div>

				{/* TAB 1: PRICING PLANS */}
				{activeTab === "plans" && (
					<div className="space-y-6">
						{/* Controls: Billing Toggle & Currency Switcher */}
						<div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
							{/* Monthly / Annual Toggle */}
							<div className="flex items-center gap-3">
								<span
									className={
										billingCycle === "month"
											? "text-white font-bold"
											: "text-bambu-gray"
									}
								>
									Monthly
								</span>
								<button
									type="button"
									onClick={() =>
										setBillingCycle(
											billingCycle === "month"
												? "year"
												: "month",
										)
									}
									className="relative inline-flex h-6 w-11 items-center rounded-full bg-bambu-dark-tertiary transition-colors"
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-bambu-green transition-transform ${
											billingCycle === "year"
												? "translate-x-6"
												: "translate-x-1"
										}`}
									/>
								</button>
								<span
									className={
										billingCycle === "year"
											? "text-white font-bold"
											: "text-bambu-gray"
									}
								>
									Annual{" "}
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
									onClick={() => setCurrency("USD")}
									className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
										currency === "USD"
											? "bg-bambu-green text-white shadow-sm"
											: "text-bambu-gray hover:text-white"
									}`}
								>
									USD ($)
								</button>
								<button
									type="button"
									onClick={() => setCurrency("VND")}
									className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
										currency === "VND"
											? "bg-bambu-green text-white shadow-sm"
											: "text-bambu-gray hover:text-white"
									}`}
								>
									VND (₫)
								</button>
							</div>
						</div>

						{/* Grid 4 Plans */}
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
							{plans.map((p) => {
								const planRank = PLAN_RANKS[p.id] || 1;
								const isCurrent = p.id === currentPlanId;
								const isNext = p.id === nextPlanId;
								const isLower = planRank < currentRank;

								return (
									<div
										key={p.id}
										className={`relative flex flex-col justify-between p-5 xl:p-6 rounded-xl border transition-all ${
											isNext
												? "bg-gradient-to-b from-amber-500/15 via-bambu-dark-secondary to-bambu-dark-secondary border-amber-400 ring-2 ring-amber-400/40 shadow-xl shadow-amber-500/20 scale-[1.02] z-10"
												: isCurrent
													? "bg-gradient-to-b from-emerald-500/10 via-bambu-dark-secondary to-bambu-dark-secondary border-emerald-500/60 shadow-lg shadow-emerald-500/10"
													: "bg-bambu-dark-secondary/70 border-bambu-dark-tertiary hover:border-bambu-gray/50 opacity-90"
										}`}
									>
										{/* Badges: YOU ARE HERE vs NEXT PLAN vs Standard Badge */}
										{isCurrent && (
											<span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider shadow flex items-center gap-1 whitespace-nowrap">
												<Check className="w-3 h-3 stroke-[3]" />
												YOU ARE HERE
											</span>
										)}
										{isNext && (
											<span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider shadow flex items-center gap-1 whitespace-nowrap animate-pulse">
												<Sparkles className="w-3 h-3" />
												NEXT PLAN (RECOMMENDED)
											</span>
										)}
										{!isCurrent &&
											!isNext &&
											p.badge &&
											!isLower && (
												<span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-bambu-dark-tertiary border border-bambu-gray/40 text-bambu-gray text-[10px] font-bold uppercase tracking-wider shadow whitespace-nowrap">
													{p.badge}
												</span>
											)}

										<div>
											<div className="flex items-center justify-between gap-2">
												<h3 className="font-bold text-lg text-white whitespace-nowrap flex items-center gap-1.5">
													<span>{p.name}</span>
													{isCurrent && (
														<span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
															Current
														</span>
													)}
												</h3>
												<span
													className={`text-xs px-2.5 py-1 rounded whitespace-nowrap shrink-0 font-medium ${
														isNext
															? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40"
															: "text-bambu-gray bg-bambu-dark"
													}`}
												>
													{p.printers}
												</span>
											</div>

											<div className="mt-3 mb-4">
												{p.id === "beginner" ? (
													<div className="text-2xl font-black text-white whitespace-nowrap">
														{p.price}
													</div>
												) : (
													<div>
														<div className="flex items-baseline gap-1.5 flex-wrap">
															<span
																className={`text-2xl font-black whitespace-nowrap ${
																	isNext
																		? "text-amber-400"
																		: "text-white"
																}`}
															>
																{isVnd
																	? `${getVndAmount(p.id as any).toLocaleString("vi-VN")} ₫`
																	: getUsdAmount(
																			p.id as any,
																		)}
															</span>
															<span className="text-xs text-bambu-gray whitespace-nowrap">
																{billingCycle ===
																"month"
																	? p.periodMonth
																	: p.periodYear}
															</span>
														</div>
														{planRank >
															currentRank &&
															currentPlanId !==
																"beginner" && (
																<div className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
																	<span className="line-through text-bambu-gray">
																		{billingCycle ===
																		"month"
																			? p.priceMonth
																			: p.priceYear}
																	</span>
																	<span>
																		(Prorated
																		-
																		{isVnd
																			? `${getCurrentCreditVnd().toLocaleString("vi-VN")} ₫`
																			: `$${getCurrentCreditUsd()}`}
																		)
																	</span>
																</div>
															)}
													</div>
												)}
											</div>

											<ul className="space-y-2 text-xs text-bambu-gray border-t border-bambu-dark-tertiary pt-3 mb-4">
												{p.features.map((feat, i) => (
													<li
														key={i}
														className="flex items-start gap-1.5 text-left"
													>
														<Check
															className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
																isCurrent
																	? "text-emerald-400"
																	: isNext
																		? "text-amber-400"
																		: "text-bambu-green"
															}`}
														/>
														<span className="text-white/90">
															{feat}
														</span>
													</li>
												))}
											</ul>
										</div>

										<div>
											{isCurrent ? (
												<button
													disabled
													className="w-full py-2.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-default"
												>
													<Check className="w-3.5 h-3.5 stroke-[3]" />
													Current Plan (Active)
												</button>
											) : isLower ? (
												<button
													disabled
													className="w-full py-2.5 px-3 rounded-lg bg-bambu-dark-tertiary/40 text-bambu-gray text-xs font-medium cursor-default"
												>
													Included in current plan
												</button>
											) : isNext ? (
												<button
													onClick={() => {
														setSelectedPlan(
															p.id as
																| "hobby"
																| "farm_pro"
																| "farm_max",
														);
														setActiveTab("qr");
													}}
													className="w-full py-2.5 px-3 rounded-lg text-xs font-black transition-all shadow-md bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
												>
													<ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
													Upgrade to {p.name}
												</button>
											) : (
												<button
													onClick={() => {
														setSelectedPlan(
															p.id as
																| "hobby"
																| "farm_pro"
																| "farm_max",
														);
														setActiveTab("qr");
													}}
													className="w-full py-2.5 px-3 rounded-lg text-xs font-bold transition-all shadow-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-1.5 cursor-pointer"
												>
													<ArrowUpRight className="w-4 h-4" />
													Upgrade to {p.name}
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>

						{/* Enterprise Row */}
						<div
							className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-xl border gap-3 text-left ${
								nextPlanId === "enterprise"
									? "bg-gradient-to-r from-amber-500/15 to-bambu-dark border-amber-400 ring-2 ring-amber-400/30"
									: "bg-bambu-dark border-bambu-dark-tertiary"
							}`}
						>
							<div>
								<div className="flex items-center gap-2">
									<h4 className="font-bold text-sm text-white flex items-center gap-2">
										<ShieldCheck className="w-4 h-4 text-bambu-green" />
										Large Farm / Enterprise (30+ printers)
									</h4>
									{nextPlanId === "enterprise" && (
										<span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider">
											NEXT PLAN (RECOMMENDED)
										</span>
									)}
								</div>
								<p className="text-xs text-bambu-gray mt-0.5">
									Distributed multi-node architecture
									consulting, on-site setup, dedicated SLA
									support & VAT invoicing.
								</p>
							</div>
							<a
								href="https://beestemsolutions.com.vn"
								target="_blank"
								rel="noopener noreferrer"
								className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
									nextPlanId === "enterprise"
										? "bg-amber-500 hover:bg-amber-400 text-black shadow-md"
										: "bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-white"
								}`}
							>
								<PhoneCall className="w-3.5 h-3.5" />
								<span>Contact Enterprise</span>
							</a>
						</div>
					</div>
				)}

				{/* TAB 2: VIETQR PAYMENT */}
				{activeTab === "qr" && isPaymentSuccess && (
					<div className="py-8 px-6 text-center space-y-5 max-w-lg mx-auto bg-gradient-to-b from-bambu-green/10 to-transparent border border-bambu-green/30 rounded-2xl shadow-xl">
						<div className="w-16 h-16 rounded-full bg-bambu-green/20 border-2 border-bambu-green flex items-center justify-center mx-auto text-bambu-green animate-bounce">
							<CheckCircle className="w-10 h-10" />
						</div>
						<div>
							<h3 className="text-2xl font-black text-white">
								Payment Confirmed!
							</h3>
							<p className="text-sm text-bambu-green-light mt-1 font-semibold">
								BeE Pro is now fully activated for this farm.
							</p>
							<p className="text-xs text-bambu-gray mt-2">
								Your farm is unlocked for 24/7 Auto Swap PEI,
								Smart Power auto-shutoff, and continuous
								multi-printer automation.
							</p>
						</div>

						<div className="p-3 bg-bambu-dark rounded-xl border border-bambu-dark-tertiary text-left text-xs space-y-1.5 font-mono">
							<div className="flex justify-between">
								<span className="text-bambu-gray">
									Farm ID:
								</span>
								<span className="text-white font-bold">
									{farmId}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-bambu-gray">Plan:</span>
								<span className="text-amber-400 font-bold uppercase">
									{selectedPlan}
								</span>
							</div>
							<div className="flex justify-between items-center pt-1 border-t border-bambu-dark-tertiary">
								<span className="text-bambu-gray">
									License Key:
								</span>
								<div className="flex items-center gap-1">
									<span className="text-white font-bold truncate max-w-[200px]">
										{activatedKeyResult}
									</span>
									<button
										type="button"
										onClick={() => {
											navigator.clipboard.writeText(
												activatedKeyResult,
											);
											setCopiedSuccessKey(true);
											setTimeout(
												() =>
													setCopiedSuccessKey(false),
												2000,
											);
										}}
										className="p-1 text-bambu-gray hover:text-white rounded"
									>
										{copiedSuccessKey ? (
											<Check className="w-3.5 h-3.5 text-bambu-green" />
										) : (
											<Copy className="w-3.5 h-3.5" />
										)}
									</button>
								</div>
							</div>
						</div>

						<button
							type="button"
							onClick={closeUpgradeModal}
							className="w-full py-3 px-4 bg-bambu-green hover:bg-bambu-green-light text-white font-bold rounded-xl shadow-lg shadow-bambu-green/20 transition-all cursor-pointer"
						>
							Start Using BeE Pro Now
						</button>
					</div>
				)}

				{activeTab === "qr" && !isPaymentSuccess && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
						{/* Left: QR Image */}
						<div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl">
							<img
								src={qrUrl}
								alt="VietQR Instant Transfer"
								className="w-64 h-64 object-contain rounded-lg"
							/>
							<p className="text-black text-xs font-bold mt-2 text-center">
								Scan with any banking app (MB, VCB, ACB,
								Techcombank, MoMo...)
							</p>
						</div>

						{/* Right: Order details */}
						<div className="space-y-4 text-left">
							<div>
								<span className="text-xs font-semibold text-bambu-green uppercase tracking-wider">
									Automated Payment Details
								</span>

								{/* Quick Plan Switcher */}
								<div className="flex items-center gap-2 mt-2 mb-2 flex-wrap">
									{(
										[
											{ id: "hobby", label: "Hobby (5)" },
											{
												id: "farm_pro",
												label: "Farm Pro (15)",
											},
											{
												id: "farm_max",
												label: "Farm Max (30)",
											},
										] as const
									).map((p) => {
										const isSelected =
											selectedPlan === p.id;
										const isNext = nextPlanId === p.id;
										return (
											<button
												key={p.id}
												type="button"
												onClick={() =>
													setSelectedPlan(p.id)
												}
												className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
													isSelected
														? "bg-amber-500 border-amber-400 text-black shadow-md"
														: "bg-bambu-dark border-bambu-dark-tertiary text-bambu-gray hover:text-white hover:border-bambu-gray/40"
												}`}
											>
												<span>{p.label}</span>
												{isNext && (
													<span
														className={`text-[9px] px-1 py-0.2 rounded font-black uppercase ${
															isSelected
																? "bg-black text-amber-400"
																: "bg-amber-500/20 text-amber-300"
														}`}
													>
														Next
													</span>
												)}
											</button>
										);
									})}
								</div>

								<h3 className="text-xl font-extrabold text-white mt-1">
									Plan:{" "}
									{selectedPlan === "hobby"
										? "Hobby (1–5 printers)"
										: selectedPlan === "farm_pro"
											? "Farm Pro (6–15 printers)"
											: "Farm Max (16–30 printers)"}
								</h3>
								<div className="flex items-baseline gap-2 mt-1 flex-wrap">
									<div className="text-2xl font-black text-amber-400">
										{getVndAmount().toLocaleString("vi-VN")}{" "}
										VNĐ
									</div>
									{isProratedUpgrade && (
										<span className="text-sm text-bambu-gray line-through">
											{getFullVndAmount().toLocaleString(
												"vi-VN",
											)}{" "}
											VNĐ
										</span>
									)}
									<span className="text-xs text-bambu-gray font-normal">
										(~{getUsdAmount()} USD{" "}
										{billingCycle === "month"
											? "/ mo"
											: "/ yr"}
										)
									</span>
								</div>

								{isProratedUpgrade && (
									<div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
										<Check className="w-3.5 h-3.5 shrink-0" />
										<span>
											Prorated upgrade: Credited{" "}
											{getCurrentCreditVnd().toLocaleString(
												"vi-VN",
											)}{" "}
											VNĐ from your current{" "}
											{currentPlanId.toUpperCase()} plan
										</span>
									</div>
								)}
							</div>

							<div className="space-y-2 text-xs">
								<div className="p-3 bg-bambu-dark rounded-lg border border-bambu-dark-tertiary space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-bambu-gray">
											Transfer Memo:
										</span>
										<div className="flex items-center gap-1.5">
											<span className="font-mono font-bold text-amber-400 select-all">
												{orderMemo}
											</span>
											<button
												type="button"
												onClick={() => {
													navigator.clipboard.writeText(
														orderMemo,
													);
													setCopiedMemo(true);
													setTimeout(
														() =>
															setCopiedMemo(
																false,
															),
														2000,
													);
												}}
												className="p-1 rounded bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-bambu-gray hover:text-white transition-colors"
												title="Copy Memo"
											>
												{copiedMemo ? (
													<Check className="w-3 h-3 text-bambu-green" />
												) : (
													<Copy className="w-3 h-3" />
												)}
											</button>
										</div>
									</div>

									<div className="flex items-center justify-between">
										<span className="text-bambu-gray">
											Account No:
										</span>
										<div className="flex items-center gap-1.5">
											<span className="font-bold text-white font-mono select-all">
												{accountNo}
											</span>
											<button
												type="button"
												onClick={() => {
													navigator.clipboard.writeText(
														accountNo,
													);
													setCopiedAccount(true);
													setTimeout(
														() =>
															setCopiedAccount(
																false,
															),
														2000,
													);
												}}
												className="p-1 rounded bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-bambu-gray hover:text-white transition-colors"
												title="Copy Account No"
											>
												{copiedAccount ? (
													<Check className="w-3 h-3 text-bambu-green" />
												) : (
													<Copy className="w-3 h-3" />
												)}
											</button>
										</div>
									</div>

									<div className="flex justify-between">
										<span className="text-bambu-gray">
											Account Holder:
										</span>
										<span className="font-bold text-white">
											{accountName}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-bambu-gray">
											Bank:
										</span>
										<span className="font-bold text-white">
											{BANK_DISPLAY_NAMES[
												bankCode.toUpperCase()
											] || bankCode}{" "}
											({bankCode})
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-bambu-gray">
											Farm ID:
										</span>
										<span className="font-mono font-semibold text-bambu-gray">
											{farmId}
										</span>
									</div>
									{deviceId && (
										<div className="flex justify-between">
											<span className="text-bambu-gray">
												Device ID:
											</span>
											<span className="font-mono font-semibold text-bambu-green text-xs">
												{deviceId}
											</span>
										</div>
									)}
								</div>

								<div>
									<label className="block text-bambu-gray mb-1">
										Phone number for receipt & technical
										support (optional):
									</label>
									<input
										type="tel"
										value={customerPhone}
										onChange={(e) =>
											setCustomerPhone(e.target.value)
										}
										placeholder="e.g. 0912345678 or +84..."
										className="w-full px-3 py-1.5 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray focus:outline-none focus:border-bambu-green text-xs"
									/>
								</div>
							</div>

							<div className="text-xs text-bambu-gray space-y-1">
								<p className="text-[11px] text-amber-400/90">
									🌐 For international payments (PayPal,
									Stripe, Card), contact
									support@beestemsolutions.com.vn.
								</p>
								<p>
									Already have a key?{" "}
									<button
										onClick={() => setActiveTab("key")}
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
				{activeTab === "key" && (
					<form
						onSubmit={handleActivate}
						className="space-y-4 max-w-lg mx-auto text-left"
					>
						<div>
							<label className="block text-sm font-semibold text-white mb-2">
								Paste your License Key:
							</label>
							<textarea
								rows={5}
								required
								value={licenseKeyInput}
								onChange={(e) =>
									setLicenseKeyInput(e.target.value)
								}
								placeholder="Paste the full content of bee_license.key here..."
								className="w-full p-3 bg-bambu-dark border border-bambu-dark-tertiary rounded-xl font-mono text-xs text-white placeholder-bambu-gray focus:outline-none focus:ring-2 focus:ring-bambu-green"
							/>
						</div>

						{deviceId && (
							<div className="p-3 rounded-xl bg-bambu-dark/70 border border-bambu-dark-tertiary text-xs text-bambu-gray space-y-1.5">
								<div className="flex items-center gap-1.5 font-semibold text-white">
									<ShieldCheck className="w-4 h-4 text-bambu-green" />
									<span>Chữ ký số & Khóa thiết bị (Device Binding)</span>
								</div>
								<p>
									Bản quyền sẽ được ký số và gắn kết độc quyền với máy này (
									<strong className="text-white font-mono">{deviceId}</strong>
									). Một license chỉ dùng cho 1 máy duy nhất.
								</p>
								<p className="text-bambu-green font-medium">
									✅ Sau khi kích hoạt thành công, hệ thống hoạt động hoàn toàn Offline không cần Internet mỗi khi khởi động.
								</p>
							</div>
						)}

						<button
							type="submit"
							disabled={isActivating || !licenseKeyInput.trim()}
							className="w-full py-3 px-4 bg-bambu-green hover:bg-bambu-green-light text-white font-bold rounded-xl shadow-lg shadow-bambu-green/20 disabled:opacity-50 transition-all cursor-pointer"
						>
							{isActivating
								? "Verifying license..."
								: "Activate Now"}
						</button>

						<div className="text-center pt-2">
							<a
								href="https://beestemsolutions.com.vn"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-xs text-bambu-gray hover:text-bambu-green transition-colors"
							>
								<span>
									Technical Support: BeE STEM Solutions
								</span>
								<ExternalLink className="w-3 h-3" />
							</a>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
