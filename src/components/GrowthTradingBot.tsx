import React, { useState, useEffect, useRef } from 'react';
import { Portfolio, Asset, SimulatedOrder, BotState, BotStrategyType, BotExecutionMode, MyInvestorTicket, BotBacktestValidation } from '../types';
import { ALL_AVAILABLE_ASSETS, HIGH_GROWTH_MOMENTUM_ASSETS } from '../data/marketData';
import { LiveSimulationEngine } from '../services/liveSimulationEngine';
import { MyInvestorAssistedSignatureModal } from './MyInvestorAssistedSignatureModal';
import {
  Zap,
  Play,
  Pause,
  Flame,
  Activity,
  Award,
  Terminal,
  Sliders,
  DollarSign,
  AlertTriangle,
  Clock,
  Radio,
  Timer,
  CheckCircle,
  ArrowRight,
  Shield,
  Sparkles,
  RefreshCw,
  Send,
  Building2,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  BellRing,
  TrendingUp,
  BarChart3,
  XCircle,
  Compass
} from 'lucide-react';

interface GrowthTradingBotProps {
  portfolio: Portfolio;
  onExecuteOrder: (order: SimulatedOrder, asset: Asset) => void;
  onExtractCapitalToVault: () => void;
  onResetPortfolio: () => void;
}

export const GrowthTradingBot: React.FC<GrowthTradingBotProps> = ({
  portfolio,
  onExecuteOrder,
  onExtractCapitalToVault,
  onResetPortfolio
}) => {
  const [assets, setAssets] = useState<Asset[]>(ALL_AVAILABLE_ASSETS);
  const [botState, setBotState] = useState<BotState>({
    isRunning: true,
    executionMode: 'MYINVESTOR_ASSISTED', // Default to MyInvestor Assisted Mode
    strategy: 'MOMENTUM_BREAKOUT',
    trailingStopPct: 3.0,
    takeProfitTargetPct: 100.0,
    initialCapitalRecovered: (portfolio.vaultWithdrawnAmount || 0) >= 100,
    totalTradesExecuted: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalProfitRealized: portfolio.totalPnlAmount,
    lastActionNote: 'Escaneando mercado y ejecutando backtests pre-trade en tiempo real 1:1...',
    averageLatencyMs: 460,
    networkStatus: 'ONLINE_CONNECTED',
    lastBacktestValidation: {
      assetId: 'vaneck-semiconductors',
      assetTicker: 'SMH',
      assetName: 'VanEck Semiconductor ETF',
      evaluatedAt: new Date().toLocaleTimeString('es-ES', { hour12: false }),
      strategyId: 'momentum_breakout',
      strategyName: 'Momentum Breakout Cuantitativo',
      sharpeRatio: 1.84,
      sortinoRatio: 2.31,
      winRatePct: 64,
      maxDrawdownPct: -4.2,
      expectedReturnPct: 32.5,
      passed: true,
      testedStrategiesCount: 4
    }
  });

  // Pending Assisted Tickets awaiting user 2FA confirmation
  const [pendingAssistedTickets, setPendingAssistedTickets] = useState<MyInvestorTicket[]>([]);
  const [activeSigningTicket, setActiveSigningTicket] = useState<MyInvestorTicket | null>(null);

  // Real-time order logs (Starts clean with genuinely executed live orders)
  const [orderLogs, setOrderLogs] = useState<SimulatedOrder[]>([]);

  // In-flight orders queue simulating real-world broker execution lag
  const [inFlightOrders, setInFlightOrders] = useState<SimulatedOrder[]>([]);

  const [recentTicks, setRecentTicks] = useState<{ [assetId: string]: { change: number; flash: 'up' | 'down' | null } }>({});
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString('es-ES', { hour12: false }));
  
  const tickIntervalRef = useRef<number | null>(null);
  const clockIntervalRef = useRef<number | null>(null);
  const inFlightAssetIdsRef = useRef<Set<string>>(new Set());

  // Effective wealth = current portfolio value + vault capital extracted
  const effectiveWealth = portfolio.totalValuation + (portfolio.vaultWithdrawnAmount || 0);
  const targetWealth = 200.0;
  const progressPct = Math.min(100, Math.max(0, (effectiveWealth / targetWealth) * 100));

  // Update clock every second
  useEffect(() => {
    clockIntervalRef.current = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-ES', { hour12: false }));
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  /**
   * Dispatches an order into the real-world latency pipeline
   */
  const routeOrderWithLatency = (
    targetAsset: Asset,
    orderType: 'BUY' | 'SELL',
    amountEur: number,
    triggerReason: 'MOMENTUM_ENTRY' | 'TRAILING_STOP' | 'TAKE_PROFIT_2X' | 'MANUAL' | 'CAPITAL_EXTRACTION',
    note: string,
    isMyInvestorAssisted: boolean = false
  ) => {
    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const quotedPrice = targetAsset.currentPrice;
    const { latencyMs, slippagePct, finalExecutionPrice } = LiveSimulationEngine.calculateOrderExecutionLag(targetAsset, orderType, quotedPrice);
    const shares = amountEur / finalExecutionPrice;

    // 1. Create order in SUBMITTING status
    const newOrder: SimulatedOrder = {
      id: orderId,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
      assetId: targetAsset.id,
      assetName: targetAsset.name,
      orderType,
      amountEur,
      shares,
      quotedPrice,
      executionPrice: finalExecutionPrice,
      slippagePct,
      latencyMs,
      status: 'SUBMITTING',
      riskValidationPassed: true,
      validationErrors: [],
      userConfirmed: true,
      triggerReason,
      notes: isMyInvestorAssisted ? `🏦 [MyInvestor Asistido · Firmado 2FA] ${note}` : note,
      submittedAtMs: Date.now()
    };

    inFlightAssetIdsRef.current.add(targetAsset.id);
    setInFlightOrders(prev => [newOrder, ...prev]);

    setBotState(prev => ({
      ...prev,
      lastActionNote: `📡 Transmitiendo orden ${orderType} ${targetAsset.ticker} (${amountEur.toFixed(2)} €) a MyInvestor/Broker...`
    }));

    // Stage 2: Routing to Order Book (~40% of latency)
    setTimeout(() => {
      setInFlightOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: 'ROUTING' } : o))
      );
    }, Math.floor(latencyMs * 0.4));

    // Stage 3: Matching & Liquidity Slippage (~75% of latency)
    setTimeout(() => {
      setInFlightOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: 'MATCHING' } : o))
      );
    }, Math.floor(latencyMs * 0.75));

    // Stage 4: Final Execution (100% of latency reached)
    setTimeout(() => {
      const executedOrder: SimulatedOrder = {
        ...newOrder,
        status: 'EXECUTED',
        executedAtMs: Date.now()
      };

      // Remove from in-flight
      setInFlightOrders(prev => prev.filter(o => o.id !== orderId));
      inFlightAssetIdsRef.current.delete(targetAsset.id);

      // Execute in portfolio state
      onExecuteOrder(executedOrder, targetAsset);

      // Add to verified order log
      setOrderLogs(prev => [executedOrder, ...prev.slice(0, 50)]);

      setBotState(prev => ({
        ...prev,
        totalTradesExecuted: prev.totalTradesExecuted + 1,
        winningTrades: triggerReason === 'TAKE_PROFIT_2X' || triggerReason === 'TRAILING_STOP' ? prev.winningTrades + 1 : prev.winningTrades,
        losingTrades: triggerReason === 'TRAILING_STOP' ? prev.losingTrades + 1 : prev.losingTrades,
        averageLatencyMs: Math.round((prev.averageLatencyMs * 4 + latencyMs) / 5),
        lastActionNote: `✅ Orden ${orderType} ejecutada en ${targetAsset.ticker} (${amountEur.toFixed(2)} €) tras ${latencyMs}ms de latencia.`
      }));
    }, latencyMs);
  };

  /**
   * Generates a MyInvestor Assisted Ticket awaiting 2FA signature
   */
  const generateAssistedTicket = (
    targetAsset: Asset,
    operationType: 'SUSCRIPCION' | 'REEMBOLSO',
    amountEur: number,
    triggerReason: 'MOMENTUM_ENTRY' | 'TRAILING_STOP' | 'TAKE_PROFIT_2X' | 'MANUAL' | 'CAPITAL_EXTRACTION',
    botNote: string
  ) => {
    // Avoid duplicate pending tickets for same asset
    if (pendingAssistedTickets.some(t => t.assetId === targetAsset.id && t.status === 'PENDING_SIGNATURE')) {
      return;
    }

    const randomOtp = `MYINV-${Math.floor(1000 + Math.random() * 9000)}`;
    const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
    const estimatedShares = amountEur / targetAsset.currentPrice;

    const newTicket: MyInvestorTicket = {
      id: ticketId,
      orderId: `ord-pending-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
      assetId: targetAsset.id,
      assetName: targetAsset.name,
      isin: targetAsset.isin,
      ticker: targetAsset.ticker,
      operationType,
      amountEur,
      estimatedShares,
      quotedPrice: targetAsset.currentPrice,
      triggerReason,
      botNote,
      otpCode: randomOtp,
      status: 'PENDING_SIGNATURE',
      ter: targetAsset.ter,
      isIndexFund: targetAsset.isIndexFund
    };

    setPendingAssistedTickets(prev => [newTicket, ...prev]);
    setBotState(prev => ({
      ...prev,
      lastActionNote: `🔔 Nueva señal MyInvestor (${operationType} ${targetAsset.ticker} - ${amountEur.toFixed(2)} €). Pendiente de tu firma 2FA.`
    }));
  };

  const handleConfirmSignature = (ticket: MyInvestorTicket, otpEntered: string) => {
    const targetAsset = assets.find(a => a.id === ticket.assetId);
    if (!targetAsset) return;

    // Remove from pending
    setPendingAssistedTickets(prev => prev.filter(t => t.id !== ticket.id));
    setActiveSigningTicket(null);

    // Route order with simulated bank lag & slippage
    routeOrderWithLatency(
      targetAsset,
      ticket.operationType === 'SUSCRIPCION' ? 'BUY' : 'SELL',
      ticket.amountEur,
      ticket.triggerReason,
      ticket.botNote,
      true
    );
  };

  const handleRejectSignature = (ticket: MyInvestorTicket) => {
    setPendingAssistedTickets(prev => prev.filter(t => t.id !== ticket.id));
    setActiveSigningTicket(null);
    setBotState(prev => ({
      ...prev,
      lastActionNote: `❌ Señal MyInvestor descartada por el usuario (${ticket.assetName}).`
    }));
  };

  // Main 1:1 Real-Time Scanning & Market Tick Engine
  useEffect(() => {
    if (!botState.isRunning) {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      return;
    }

    // Natural 1x real-time tempo: ticks occur every 1.8 seconds
    const intervalMs = 1800;

    tickIntervalRef.current = window.setInterval(() => {
      // 1. Tick all assets in 1:1 real-time
      const updatedAssetsList: Asset[] = [];
      const tickFlashing: { [assetId: string]: { change: number; flash: 'up' | 'down' | null } } = {};

      assets.forEach(asset => {
        const { updatedAsset, event } = LiveSimulationEngine.simulateNextTick(asset);
        updatedAssetsList.push(updatedAsset);
        tickFlashing[asset.id] = {
          change: event.deltaPct,
          flash: event.deltaPct > 0 ? 'up' : event.deltaPct < 0 ? 'down' : null
        };
      });

      setAssets(updatedAssetsList);
      setRecentTicks(tickFlashing);

      // 2. Evaluate Bot Decision in real-time
      const decision = LiveSimulationEngine.evaluateBotDecision(
        portfolio,
        updatedAssetsList,
        botState,
        inFlightAssetIdsRef.current
      );

      if (decision) {
        if (decision.backtestValidation) {
          setBotState(prev => ({
            ...prev,
            lastBacktestValidation: decision.backtestValidation,
            ...(decision.action === 'HOLD' ? { lastActionNote: decision.reason } : {})
          }));
        }

        if (decision.action === 'WITHDRAW_INITIAL_CAPITAL') {
          onExtractCapitalToVault();
          setBotState(prev => ({
            ...prev,
            initialCapitalRecovered: true,
            lastActionNote: '🎯 100€ de capital inicial transferidos a la Bóveda con éxito.'
          }));

          const vaultOrder: SimulatedOrder = {
            id: `vault-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
            assetId: 'vault',
            assetName: 'Caja Fuerte / Capital Inicial Asegurado',
            orderType: 'SELL',
            amountEur: 100.0,
            shares: 1,
            quotedPrice: 100.0,
            executionPrice: 100.0,
            latencyMs: 120,
            status: 'EXECUTED',
            riskValidationPassed: true,
            validationErrors: [],
            userConfirmed: true,
            triggerReason: 'CAPITAL_EXTRACTION',
            notes: '🎯 ¡100,00 € Asegurados! Jugando exclusivamente con beneficios.'
          };
          setOrderLogs(prev => [vaultOrder, ...prev.slice(0, 50)]);

        } else if ((decision.action === 'BUY' || decision.action === 'SELL') && decision.assetId && decision.amountEur) {
          const targetAsset = updatedAssetsList.find(a => a.id === decision.assetId);
          if (targetAsset && decision.triggerReason) {
            
            if (botState.executionMode === 'MYINVESTOR_ASSISTED') {
              // Modo Asistido: Produce una ficha de orden MyInvestor que requiere firma
              generateAssistedTicket(
                targetAsset,
                decision.orderType === 'BUY' ? 'SUSCRIPCION' : 'REEMBOLSO',
                decision.amountEur,
                decision.triggerReason,
                decision.reason
              );
            } else {
              // Modo Directo: Ejecuta automáticamente
              routeOrderWithLatency(
                targetAsset,
                decision.orderType || 'BUY',
                decision.amountEur,
                decision.triggerReason,
                decision.reason,
                false
              );
            }
          }
        }
      }
    }, intervalMs);

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [botState.isRunning, botState.executionMode, botState.strategy, botState.trailingStopPct, assets, portfolio, pendingAssistedTickets]);

  const handleToggleBot = () => {
    setBotState(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
      lastActionNote: !prev.isRunning ? 'Bot reanudado en tiempo real 1:1...' : 'Bot pausado por el usuario.'
    }));
  };

  const handleToggleExecutionMode = (mode: BotExecutionMode) => {
    setBotState(prev => ({
      ...prev,
      executionMode: mode,
      lastActionNote: mode === 'MYINVESTOR_ASSISTED' 
        ? 'Modo Asistido MyInvestor Activado: Las señales generarán una ficha con ISIN y requerirán firma 2FA.'
        : 'Modo Directo Automático Activado: El bot ejecutará de forma desatendida tras latencia de red.'
    }));
  };

  const handleStrategyChange = (strategy: BotStrategyType) => {
    setBotState(prev => ({
      ...prev,
      strategy,
      lastActionNote: `Estrategia cambiada a ${strategy}. Reconfigurando parámetros de entrada.`
    }));
  };

  const handleTriggerTestOrder = (orderType: 'BUY' | 'SELL') => {
    const testAsset = assets.find(a => a.id === 'vaneck-semiconductors') || assets[0];
    const amount = orderType === 'BUY' ? Math.min(20.0, portfolio.cashBalance) : 15.0;
    
    if (orderType === 'BUY' && amount < 5.0) {
      alert('No hay suficiente saldo de efectivo para la orden de prueba.');
      return;
    }

    if (botState.executionMode === 'MYINVESTOR_ASSISTED') {
      generateAssistedTicket(
        testAsset,
        orderType === 'BUY' ? 'SUSCRIPCION' : 'REEMBOLSO',
        amount > 0 ? amount : 15.0,
        'MANUAL',
        `⚡ Orden manual asistida para verificar la firma 2FA y la integración con MyInvestor en ${testAsset.name}`
      );
    } else {
      routeOrderWithLatency(
        testAsset,
        orderType,
        amount > 0 ? amount : 15.0,
        'MANUAL',
        `⚡ Orden manual de prueba directa para verificar lag y confirmación en ${testAsset.name}`,
        false
      );
    }
  };

  const handleRunInstantBacktestScan = () => {
    const decision = LiveSimulationEngine.evaluateBotDecision(
      portfolio,
      assets,
      botState,
      inFlightAssetIdsRef.current
    );
    if (decision?.backtestValidation) {
      setBotState(prev => ({
        ...prev,
        lastBacktestValidation: decision.backtestValidation,
        lastActionNote: decision.reason
      }));
    }
  };

  const monteCarlo = LiveSimulationEngine.runMonteCarloDoublingSimulation(
    botState.strategy,
    botState.trailingStopPct
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Real-time Bot Master Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1836] via-[#091124] to-[#070b16] border border-cyan-500/30 p-4 sm:p-6 shadow-2xl">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Zap className="w-64 h-64 text-cyan-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                Tiempo Real 1:1 (Sin Aceleración)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 text-slate-300 border border-slate-700 text-[11px] font-mono">
                <Clock className="w-3 h-3 text-cyan-400" />
                Hora Servidor: {currentTime}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 text-sky-300 border border-slate-700 text-[11px] font-mono">
                <Timer className="w-3 h-3 text-sky-400" />
                Lag Medio: ~{botState.averageLatencyMs}ms
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Bot Autónomo 2X · Modo Asistido MyInvestor</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              El algoritmo opera en <strong>tiempo real 1:1</strong> calculando puntos de entrada, trailing stops (-{botState.trailingStopPct}%) y generando las <strong>fichas oficiales con código ISIN</strong> listas para que las firmes con clave 2FA/SMS simulada.
            </p>
          </div>

          {/* Quick Engine Status & Master Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3 rounded-2xl shrink-0">
            <button
              onClick={handleToggleBot}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                botState.isRunning
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
              }`}
            >
              {botState.isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Bot Activo (Pausar)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Reanudar Bot</span>
                </>
              )}
            </button>

            {/* Test Order Trigger Button */}
            <button
              onClick={() => handleTriggerTestOrder('BUY')}
              disabled={portfolio.cashBalance < 5.0}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              title="Genera una señal asistida de prueba para MyInvestor"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{botState.executionMode === 'MYINVESTOR_ASSISTED' ? 'Generar Señal MyInvestor' : 'Verificar Lag Directo'}</span>
            </button>
          </div>
        </div>

        {/* Execution Mode Selector Bar */}
        <div className="mt-4 pt-3.5 border-t border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Modo de Ejecución:</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleToggleExecutionMode('MYINVESTOR_ASSISTED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                botState.executionMode === 'MYINVESTOR_ASSISTED'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Modo Asistido MyInvestor (Simulado con 2FA)</span>
            </button>

            <button
              onClick={() => handleToggleExecutionMode('AUTOMATIC')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                botState.executionMode === 'AUTOMATIC'
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-Ejecución Directa</span>
            </button>
          </div>
        </div>

        {/* Milestone Progress towards 200€ */}
        <div className="mt-4 pt-4 border-t border-cyan-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold">Progreso hacia 200,00 €:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {effectiveWealth.toFixed(2)} € / 200,00 €
              </span>
              <span className="text-slate-400">({progressPct.toFixed(1)}%)</span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-slate-400">
                En Juego: <strong className="text-white">{portfolio.totalValuation.toFixed(2)} €</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-300 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                Caja Fuerte (Asegurados): <strong>{(portfolio.vaultWithdrawnAmount || 0).toFixed(2)} €</strong>
              </span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700 relative">
            <div
              className="bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 h-full rounded-full transition-all duration-500 relative"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>

          {/* If 100€ extracted to vault banner */}
          {(portfolio.vaultWithdrawnAmount || 0) >= 100.0 && (
            <div className="mt-3 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>¡Misión cumplida!</strong> Capital inicial de 100,00 € protegido en Bóveda. A partir de ahora operas 100% con dinero ganado a la casa (House Money).
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AUTONOMOUS REAL-TIME BACKTEST & QUANT SCANNER (PRE-FLIGHT VALIDATION) */}
      <div id="bot-autonomous-backtest-card" className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#0c1322] via-[#090e1a] to-[#060a12] border border-indigo-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <TrendingUp className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-xs sm:text-sm tracking-tight">
                  Escáner Cuantitativo & Backtest Autónomo del Bot (Pre-Trade)
                </h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.2 rounded-full font-mono font-bold">
                  4 Estrategias Activas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                El bot ejecuta simulaciones de backtesting en tiempo real antes de arriesgar capital. Si una estrategia no tiene ventaja estadística (Sharpe &lt; 0.70 o Win-Rate &lt; 45%), la orden se bloquea.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunInstantBacktestScan}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0"
            title="Forzar un escaneo de backtest ahora mismo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Escanear Ahora</span>
          </button>
        </div>

        {botState.lastBacktestValidation ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              
              {/* Asset & Strategy */}
              <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Activo Evaluado</div>
                <div className="font-bold text-white text-xs mt-0.5 flex items-center justify-between">
                  <span>{botState.lastBacktestValidation.assetName}</span>
                  <span className="font-mono text-cyan-400 bg-cyan-950/50 px-1.5 py-0.2 rounded text-[10px]">
                    {botState.lastBacktestValidation.assetTicker}
                  </span>
                </div>
                <div className="text-[10px] text-indigo-300 truncate mt-1">
                  Estrategia: <strong>{botState.lastBacktestValidation.strategyName}</strong>
                </div>
              </div>

              {/* Sharpe & Sortino */}
              <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Ratio Sharpe / Sortino</div>
                <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5 flex items-baseline gap-2">
                  <span>{botState.lastBacktestValidation.sharpeRatio.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Sortino: {botState.lastBacktestValidation.sortinoRatio.toFixed(2)})
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Umbral mínimo exigido: &ge; 0.70
                </div>
              </div>

              {/* Win-Rate & Expected Return */}
              <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Win-Rate / Retorno Estimado</div>
                <div className="font-mono font-bold text-sky-400 text-sm mt-0.5 flex items-baseline gap-2">
                  <span>{botState.lastBacktestValidation.winRatePct.toFixed(0)}%</span>
                  <span className="text-[10px] text-emerald-300 font-normal">
                    (+{botState.lastBacktestValidation.expectedReturnPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Tasa de acierto histórica verificada
                </div>
              </div>

              {/* Max Drawdown */}
              <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Max Drawdown (Caída Máx.)</div>
                <div className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                  -{Math.abs(botState.lastBacktestValidation.maxDrawdownPct).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Límite de riesgo máximo: &le; 12.0%
                </div>
              </div>
            </div>

            {/* Verdict Box */}
            <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
              botState.lastBacktestValidation.passed
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center gap-2">
                {botState.lastBacktestValidation.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  <strong>Dictamen Cuantitativo del Bot:</strong>{' '}
                  {botState.lastBacktestValidation.passed
                    ? `✅ ORDEN AUTORIZADA POR BACKTEST: El bot evaluó ${botState.lastBacktestValidation.testedStrategiesCount} estrategias sobre datos históricos y determinó que "${botState.lastBacktestValidation.strategyName}" ofrece ventaja matemática (Sharpe ${botState.lastBacktestValidation.sharpeRatio.toFixed(2)}).`
                    : `🛡️ COMPRA BLOQUEADA POR RIESGO: ${botState.lastBacktestValidation.rejectReason}. El bot retiene el efectivo en liquidez para proteger los 100€.`}
                </span>
              </div>

              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                Última auditoría: {botState.lastBacktestValidation.evaluatedAt}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-2">
            Escaneando datos y ejecutando matrices de backtest en segundo plano...
          </div>
        )}
      </div>

      {/* PENDING ASSISTED MYINVESTOR ORDERS WAITING FOR 2FA SIGNATURE */}
      {pendingAssistedTickets.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#0d204a] via-[#091533] to-[#071026] border-2 border-cyan-400/60 shadow-xl shadow-cyan-950/40 space-y-3 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 animate-pulse">
                <BellRing className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">
                  Órdenes Asistidas MyInvestor Pendientes de Firma 2FA ({pendingAssistedTickets.length})
                </h3>
                <p className="text-[11px] text-cyan-200">
                  El algoritmo ha generado una señal de mercado. Requiere tu confirmación con clave SMS simulada para ejecutarse.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {pendingAssistedTickets.map(ticket => {
              const isBuy = ticket.operationType === 'SUSCRIPCION';

              return (
                <div
                  key={ticket.id}
                  className="p-3.5 bg-slate-950/90 border border-cyan-500/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                        isBuy ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-slate-950'
                      }`}>
                        {ticket.operationType}
                      </span>
                      <span className="font-bold text-white text-sm">{ticket.assetName}</span>
                      <span className="font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800 text-[11px]">
                        ISIN: {ticket.isin}
                      </span>
                      <span className="font-mono text-amber-300 font-bold text-sm">
                        {ticket.amountEur.toFixed(2)} €
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      {ticket.botNote}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRejectSignature(ticket)}
                      className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Descartar
                    </button>

                    <button
                      onClick={() => setActiveSigningTicket(ticket)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-950" />
                      <span>Firmar en MyInvestor (2FA)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In-Flight Orders with Real Execution Lag Pipeline */}
      {inFlightOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 space-y-2.5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-200 uppercase tracking-wider">
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Cola de Ejecución en Tránsito (Simulación de Lag Real de Red & Broker)</span>
            </div>
            <span className="text-[11px] font-mono text-indigo-300">
              {inFlightOrders.length} orden(es) procesándose
            </span>
          </div>

          <div className="space-y-2">
            {inFlightOrders.map(ord => (
              <div
                key={ord.id}
                className="p-3 bg-slate-900/90 border border-indigo-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    ord.orderType === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-slate-950'
                  }`}>
                    {ord.orderType}
                  </span>
                  <span className="font-bold text-white">{ord.assetName}</span>
                  <span className="text-slate-400">· {ord.amountEur.toFixed(2)} €</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Estado:</span>
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      {ord.status === 'SUBMITTING' && '1/3 Enrutando API...'}
                      {ord.status === 'ROUTING' && '2/3 Libro de Órdenes...'}
                      {ord.status === 'MATCHING' && '3/3 Calculando Slippage...'}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700">
                    Lag: ~{ord.latencyMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Market Oscillations & High Growth Assets Ticker (1:1 Tempo) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>Mercado en Tiempo Real (Tick-by-Tick Feed 1:1)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Cadencia natural: ~1.8s
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HIGH_GROWTH_MOMENTUM_ASSETS.map(asset => {
            const liveAsset = assets.find(a => a.id === asset.id) || asset;
            const tickInfo = recentTicks[asset.id];
            const isFlashingUp = tickInfo?.flash === 'up';
            const isFlashingDown = tickInfo?.flash === 'down';

            return (
              <div
                key={asset.id}
                className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                  isFlashingUp
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : isFlashingDown
                    ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-white font-mono">{liveAsset.ticker}</span>
                  <span className={`text-xs font-mono font-bold ${liveAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {liveAsset.change24h >= 0 ? '+' : ''}{liveAsset.change24h.toFixed(2)}%
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 truncate mb-2">{liveAsset.name}</div>

                <div className="flex items-baseline justify-between pt-2 border-t border-slate-800">
                  <span className="text-base font-black font-mono text-white">
                    {liveAsset.currentPrice.toFixed(2)} €
                  </span>
                  <span className="text-[10px] text-cyan-300 uppercase tracking-wider font-semibold">
                    ISIN: {liveAsset.isin.slice(0, 7)}...
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Bot Strategy Settings vs Live Execution Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left: Strategy Configuration & Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider mb-3">
              <Sliders className="w-4 h-4" />
              <span>Estrategia del Bot Autónomo</span>
            </div>

            {/* Strategy Options */}
            <div className="space-y-2">
              {[
                {
                  id: 'MOMENTUM_BREAKOUT' as BotStrategyType,
                  name: 'Momentum Breakout (Recomendado)',
                  desc: 'Entra en aceleraciones de chips IA y Nasdaq, saliendo en trailing stop rápido.'
                },
                {
                  id: 'VOLATILITY_SCALPER' as BotStrategyType,
                  name: 'Scalper de Volatilidad Rápido',
                  desc: 'Captura micro-impulsos de +2% a +4% con salidas relámpago.'
                },
                {
                  id: 'TREND_FOLLOWING' as BotStrategyType,
                  name: 'Seguidor de Tendencia Agresivo',
                  desc: 'Mantiene posiciones ganadoras hasta cambio estructural de tendencia.'
                }
              ].map(strat => (
                <button
                  key={strat.id}
                  onClick={() => handleStrategyChange(strat.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    botState.strategy === strat.id
                      ? 'bg-cyan-950/60 border-cyan-500/60 text-white ring-1 ring-cyan-500/40'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs sm:text-sm text-white flex items-center justify-between">
                    <span>{strat.name}</span>
                    {botState.strategy === strat.id && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">{strat.desc}</p>
                </button>
              ))}
            </div>

            {/* Trailing Stop Slider */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Trailing Stop de Protección:</span>
                <span className="font-mono font-bold text-rose-400">-{botState.trailingStopPct}%</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="6.0"
                step="0.5"
                value={botState.trailingStopPct}
                onChange={e => setBotState(prev => ({ ...prev, trailingStopPct: Number(e.target.value) }))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 leading-tight">
                Si un activo cae un -{botState.trailingStopPct}% desde su precio máximo alcanzado, el bot genera automáticamente una señal de venta para no acumular pérdidas.
              </p>
            </div>

            {/* Manual Action Triggers */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                Acciones Manuales de Control
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleTriggerTestOrder('SELL')}
                  className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Probar Venta Asistida
                </button>
                <button
                  onClick={onExtractCapitalToVault}
                  className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Extraer 100€ a Bóveda
                </button>
              </div>
            </div>
          </div>

          {/* Monte Carlo Statistical Reality Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
              <DollarSign className="w-4 h-4" />
              <span>Matemáticas de Duplicar Capital (Monte Carlo 1.000 simulaciones)</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono my-3">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px]">Probabilidad de 2X (200€)</div>
                <div className="text-emerald-400 font-bold text-base mt-0.5">
                  {monteCarlo.probabilityDoublingPct}%
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px]">Trades promedio</div>
                <div className="text-sky-300 font-bold text-base mt-0.5">
                  ~{monteCarlo.avgTradesToDouble} órdenes
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {monteCarlo.keyTakeaway}
            </p>
          </div>
        </div>

        {/* Right: Live Execution Order Stream / Terminal (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col h-[540px]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-slate-200">Terminal de Órdenes Reales en Vivo</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                Ejecutadas en sesión: <strong>{orderLogs.length}</strong>
              </span>
              {orderLogs.length > 0 && (
                <button
                  onClick={() => setOrderLogs([])}
                  className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Status ticker */}
          <div className="bg-slate-900/80 px-3 py-2 rounded-xl text-xs font-mono text-slate-300 mb-3 border border-slate-800/80 flex items-center gap-2">
            <span className="text-cyan-400 font-bold shrink-0">Estado:</span>
            <span className="truncate">{botState.lastActionNote}</span>
          </div>

          {/* Orders stream list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {orderLogs.length === 0 && inFlightOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center px-4">
                <Terminal className="w-10 h-10 mb-2 opacity-30 text-cyan-400" />
                <span className="font-bold text-slate-400 text-sm">Escaneando mercado en tiempo real 1:1...</span>
                <span className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Las órdenes se generan cuando se cumplen las condiciones de momentum o trailing stop en vivo. Pulsa <strong>"Generar Señal MyInvestor"</strong> para probar la confirmación por 2FA.
                </span>
              </div>
            ) : (
              orderLogs.map(ord => {
                const isBuy = ord.orderType === 'BUY';
                const isExtraction = ord.triggerReason === 'CAPITAL_EXTRACTION';
                const isTakeProfit = ord.triggerReason === 'TAKE_PROFIT_2X';

                return (
                  <div
                    key={ord.id}
                    className={`p-3 rounded-2xl border text-xs font-mono transition-all animate-in fade-in duration-300 ${
                      isExtraction
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : isBuy
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : isTakeProfit
                        ? 'bg-sky-950/30 border-sky-500/30 text-sky-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400">{ord.timestamp}</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] uppercase ${
                          isExtraction
                            ? 'bg-amber-500 text-slate-950'
                            : isBuy
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-slate-950'
                        }`}>
                          {isExtraction ? 'BÓVEDA' : ord.orderType}
                        </span>
                        <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                          {ord.assetName}
                        </span>
                        {ord.latencyMs && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                            ⚡ {ord.latencyMs}ms lag
                          </span>
                        )}
                        {ord.slippagePct !== undefined && ord.slippagePct !== 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Slip: {ord.slippagePct > 0 ? '+' : ''}{ord.slippagePct}%
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-white text-xs shrink-0">
                        {isBuy ? '-' : '+'}{ord.amountEur.toFixed(2)} €
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300 mt-1 pl-1 border-l-2 border-slate-700">
                      {ord.notes}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Safety & Educational Disclaimer */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-3xl flex items-start gap-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-white">Modo Asistido Seguro (Directiva PSD2 & CNMV)</div>
          <p className="mt-0.5 leading-relaxed text-slate-400">
            En el <strong>Modo Asistido MyInvestor</strong>, ninguna orden se ejecuta a ciegas. El bot genera la señal cuantitativa precisa con su código ISIN e importe, y tú validas la orden en un clic mediante la clave de firma digital simulada.
          </p>
        </div>
      </div>

      {/* MYINVESTOR ASSISTED 2FA SIGNATURE MODAL */}
      {activeSigningTicket && (
        <MyInvestorAssistedSignatureModal
          ticket={activeSigningTicket}
          asset={assets.find(a => a.id === activeSigningTicket.assetId)}
          onConfirmSignature={handleConfirmSignature}
          onRejectSignature={handleRejectSignature}
          onClose={() => setActiveSigningTicket(null)}
        />
      )}

    </div>
  );
};
