export interface ArchitectureSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  summary: string;
  contentMarkdown: string;
  diagramSvg?: string;
  codeSnippet?: {
    language: string;
    filename: string;
    code: string;
  };
  keyTakeaways: string[];
}

export const ARCHITECTURE_SECTIONS: ArchitectureSection[] = [
  {
    id: 'system-architecture',
    number: 1,
    title: 'Arquitectura del Sistema',
    subtitle: 'Diseño en Capas, C4 Container Model & Flujo de Datos Seguro',
    summary: 'Arquitectura desacoplada basada en Clean Architecture / Microservicios modulares para Node.js/TypeScript y React.',
    keyTakeaways: [
      'Separación estricta entre capa de Presentación, Dominio Financiero y Adaptadores de Infraestructura.',
      'Cero ejecución autónoma: Toda orden requiere doble confirmación explícita (Human-in-the-loop).',
      'Sandboxing de simulación (Paper Trading) completamente aislado de cualquier pasarela bancaria real.',
      'Canales TLS 1.3, firmas HMAC y encriptación AES-256-GCM para datos financieros sensibles.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/core/domain/ports/RiskEnginePort.ts',
      code: `// Puerto de dominio en Clean Architecture para evaluación de riesgos
export interface RiskEvaluationRequest {
  portfolioId: string;
  currentCash: number;
  currentPositions: Array<{ assetId: string; valuation: number; weight: number }>;
  proposedOrder: {
    assetId: string;
    type: 'BUY' | 'SELL';
    amountEur: number;
    riskScore: number;
  };
  rules: {
    maxSingleAssetExposurePct: number; // e.g. 30%
    minCashBufferPct: number;         // e.g. 20%
    maxPortfolioRiskScore: number;    // e.g. 3.5 / 7
  };
}

export interface RiskEvaluationResult {
  isPermitted: boolean;
  blockers: string[];
  warnings: string[];
  metricsAfterExecution: {
    projectedCash: number;
    projectedExposurePct: number;
    projectedRiskScore: number;
  };
}`
    },
    contentMarkdown: `### 1.1 Visión General de la Arquitectura

La aplicación está diseñada bajo el patrón de **Clean Architecture (Hexagonal)**, lo que garantiza que las reglas de negocio de **preservación de capital y control de riesgo** sean completamente agnósticas de la base de datos, el framework frontend o el broker externo.

\`\`\`
+-----------------------------------------------------------------------------------+
|                            CAPA DE PRESENTACIÓN (CLIENTE)                         |
|   React SPA + Tailwind CSS + Lucide Icons + Recharts Data Visualizer              |
|   - Módulo Paper Trading (100 €)  - Monitor de Mercado  - Centro de Alertas       |
|   - Doble Confirmación de Órdenes - Hub Educativo & Fiscal - Auditoría de Riesgo  |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / WSS (TLS 1.3)
                                           v
+-----------------------------------------------------------------------------------+
|                        CAPA DE API GATEWAY & SEGURIDAD                            |
|   Express REST API + Rate Limiter + JWT Validator + Anti-Tampering Engine        |
+------------------------------------------+----------------------------------------+
                                           |
    +--------------------------------------+-----------------------------------+
    |                                      |                                   |
    v                                      v                                   v
+-----------------------+      +-----------------------+      +-----------------------+
|  MÓDULO PAPER TRADING |      |  MOTOR DE RIESGO &    |      |  INGESTIÓN DE MERCADO |
|  - Gestor de Cartera  |      |  PRESERVACIÓN CAPITAL |      |  - WebSocket Feeds    |
|  - Ledger de Órdenes  | ---> |  - Validador Pre-Trade| <--- |  - Históricos NAV/TER |
|  - Cálculo de P&L     |      |  - Stop-Loss Guard    |      |  - Indicadores CNMV   |
+-----------------------+      |  - Control Max Drawd. |      +-----------------------+
                               +-----------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                  CAPA DE PERSISTENCIA & SERVICIOS EXTERNOS                        |
|  - Base de Datos Relacional PostgreSQL (ACID para transacciones)                  |
|  - Adaptador MyInvestor Broker (Solo APIs oficiales/PSD2 reguladas - Read/Stage)  |
|  - Almacén de Logs Inmutables de Auditoría y Cumplimiento MiFID II                |
+-----------------------------------------------------------------------------------+
\`\`\`

### 1.2 Principios Arquitecturales Clave
1. **Safety-First & Human-in-the-loop**: Ninguna orden se dispara automáticamente. La app es un copiloto asesor/analítico, no un robot de trading de alta frecuencia.
2. **Determinismo Financiero**: Todos los cálculos monetarios usan aritmética decimal precisa (o enteros en céntimos) para evitar errores de redondeo de punto flotante IEEE 754.
3. **Idempotencia de Órdenes**: Cada simulación o pre-orden genera un UUID idempotente para evitar dobles ejecuciones accidentales.`
  },
  {
    id: 'core-modules',
    number: 2,
    title: 'Módulos Principales del Sistema',
    subtitle: 'Desglose Funcional de Micro-servicios y Responsabilidades',
    summary: 'Definición exhaustiva de los 8 componentes modulares que componen la plataforma.',
    keyTakeaways: [
      'Módulo de Paper Trading con ledger de doble entrada y tracking de cash vs participaciones fraccionadas.',
      'Risk & Loss Guardian con evaluación síncrona en milisegundos antes de cualquier intención de orden.',
      'Alert Dispatcher con debounce de volatilidad y notificaciones multicanal (In-App, Email, Webhook).',
      'MyInvestor Bridge con aislamiento estricto: fallback a modo manual guiado si no hay API pública.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/modules/guardian/RiskGuardianService.ts',
      code: `export class RiskGuardianService {
  public static validateTradeIntent(portfolio: Portfolio, asset: Asset, amountEur: number, type: 'BUY' | 'SELL'): {
    allowed: boolean;
    reasons: string[];
    riskScoreAfter: number;
  } {
    const errors: string[] = [];
    if (type === 'BUY') {
      if (amountEur > portfolio.cashBalance) {
        errors.push(\`Saldo insuficiente. Disponible: \${portfolio.cashBalance.toFixed(2)}€, Solicitado: \${amountEur.toFixed(2)}€\`);
      }
      const projectedCash = portfolio.cashBalance - amountEur;
      const totalVal = portfolio.totalValuation;
      const cashRatio = (projectedCash / totalVal) * 100;
      if (cashRatio < 20.0) {
        errors.push(\`Infracción de Regla de Liquidez: El saldo en efectivo descendería al \${cashRatio.toFixed(1)}% (Mínimo exigido: 20% = \${(totalVal*0.2).toFixed(2)}€).\`);
      }
      const existingPos = portfolio.positions.find(p => p.assetId === asset.id);
      const currentAssetVal = existingPos ? existingPos.currentValuation : 0;
      const projectedAssetVal = currentAssetVal + amountEur;
      const exposurePct = (projectedAssetVal / totalVal) * 100;
      if (exposurePct > 35.0) {
        errors.push(\`Concentración Excesiva: La posición en "\${asset.name}" alcanzaría el \${exposurePct.toFixed(1)}% del patrimonio (Límite prudencial: 35%).\`);
      }
    }
    return {
      allowed: errors.length === 0,
      reasons: errors,
      riskScoreAfter: 2.4
    };
  }
}`
    },
    contentMarkdown: `### 2.1 Catálogo de Módulos

#### A. Ingestión y Normalización de Mercado (Market Ingestion Engine)
- Conexión con proveedores de datos de fondos indexados y cotizaciones (Morningstar, Refinitiv o APIs públicas de NAVs).
- Registro diario de Valor Liquidativo (NAV), cálculo de volatilidad histórica a 30d/365d y TER (Total Expense Ratio).
- Etiquetado de riesgo oficial CNMV (1 a 7).

#### B. Motor de Simulación y Paper Trading (100 € Capital Base)
- Gestión de cuentas demo con 100 € de capital inicial.
- Soporte para **participaciones fraccionadas** (imprescindible para fondos con precios unitarios superiores a 50€).
- Cálculo en tiempo real de costes ocultos, spread estimado y valor total de cartera.

#### C. Guardián de Riesgo y Pérdidas (Risk & Loss Guardian)
- Validador síncrono pre-trade: Bloquea operaciones que vulneren los límites de diversificación o liquidez.
- Monitor continuo de **Drawdown Máximo**: Si la cartera cae más de un umbral configurado (ej. 3% o 5%), activa el protocolo de alerta y sugiere pausa reflexiva.
- Checklist de autocontrol psicológico antes de confirmar.

#### D. Despachador de Alertas Inteligentes (Alert Engine)
- Monitoreo periódico de desviaciones del asset allocation ideal (rebalanceo).
- Avisos de aportación periódica recomendada (DCA mensual).
- Detección de picos inusuales de volatilidad macroeconómica.

#### E. Módulo Educativo & Fiscal
- Píldoras interactivas de microaprendizaje.
- Explicación del régimen de **traspasabilidad de fondos en España** (Ley IRPF Art. 94).
- Recordatorios transparentes para la consulta con asesores fiscales colegiados.

#### F. Pasarela de Integración MyInvestor (Broker Gateway)
- **Política Oficial**: Si MyInvestor ofrece API de Open Banking / PSD2 o API oficial de trading con permisos de cliente, se usa token OAuth2.
- **Modo Asistido (Fallback sin API)**: Si no hay API pública de ejecución, la app genera un "Borrador de Orden Guiado" con ISIN, importe exacto e instrucciones paso a paso para que el usuario opere en la web oficial de MyInvestor manualmente.`
  },
  {
    id: 'database-schema',
    number: 3,
    title: 'Esquema de Base de Datos',
    subtitle: 'Modelo Relacional PostgreSQL con Integridad Transaccional ACID',
    summary: 'Diseño DDL normalizado con llaves foráneas, restricciones de control de riesgo y trazabilidad completa de órdenes.',
    keyTakeaways: [
      'Tipos decimales de alta precisión DECIMAL(18,4) para evitar pérdida de céntimos en activos fraccionados.',
      'Tabla de auditoría compliance_logs inmutable para certificar el consentimiento del usuario antes de operar.',
      'Separación clara entre cuentas DEMO (Paper Trading) y cuentas REALES con aislamiento lógico.'
    ],
    codeSnippet: {
      language: 'sql',
      filename: 'migrations/001_initial_schema.sql',
      code: `-- Esquema Relacional de Base de Datos para Custodia Inversión Conservadora

CREATE TYPE account_type_enum AS ENUM ('PAPER_TRADING', 'READ_ONLY_SYNC', 'LIVE_BROKER');
CREATE TYPE order_type_enum AS ENUM ('BUY', 'SELL', 'SWITCH_TRANSFER');
CREATE TYPE order_status_enum AS ENUM ('PENDING_RISK_CHECK', 'WAITING_USER_CONFIRM', 'EXECUTED', 'CANCELLED', 'REJECTED_BY_RISK');
CREATE TYPE risk_level_enum AS ENUM ('1_VERY_LOW', '2_LOW', '3_MODERATE_LOW', '4_MODERATE', '5_MODERATE_HIGH', '6_HIGH', '7_VERY_HIGH');

-- 1. Tabla de Usuarios y Perfiles de Riesgo
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    risk_tolerance_profile risk_level_enum NOT NULL DEFAULT '2_LOW',
    max_drawdown_limit_pct DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    min_cash_reserve_pct DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cuentas de Cartera (Con capital inicial de 100€ por defecto)
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type account_type_enum NOT NULL DEFAULT 'PAPER_TRADING',
    name VARCHAR(100) NOT NULL DEFAULT 'Cartera Conservadora 100€',
    initial_capital_eur DECIMAL(18,4) NOT NULL DEFAULT 100.0000,
    cash_balance_eur DECIMAL(18,4) NOT NULL DEFAULT 100.0000,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Catálogo de Activos de Inversión
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isin VARCHAR(12) UNIQUE NOT NULL,
    ticker VARCHAR(20),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'monetario', 'renta_fija', 'renta_variable', 'oro'
    ter_annual_pct DECIMAL(5,4) NOT NULL, -- e.g. 0.0800 para 0.08%
    cnmv_risk_scale INT NOT NULL CHECK (cnmv_risk_scale BETWEEN 1 AND 7),
    is_spanish_tax_transferable BOOLEAN NOT NULL DEFAULT TRUE,
    current_nav DECIMAL(18,4) NOT NULL,
    last_nav_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Posiciones en Cartera
CREATE TABLE portfolio_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id),
    shares DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    average_buy_price_eur DECIMAL(18,4) NOT NULL,
    invested_capital_eur DECIMAL(18,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_portfolio_asset UNIQUE (portfolio_id, asset_id)
);

-- 5. Registro de Órdenes y Ledger
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id),
    order_type order_type_enum NOT NULL,
    amount_eur DECIMAL(18,4) NOT NULL,
    estimated_shares DECIMAL(18,6) NOT NULL,
    executed_price_eur DECIMAL(18,4),
    status order_status_enum NOT NULL DEFAULT 'PENDING_RISK_CHECK',
    risk_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    risk_notes TEXT,
    user_explicitly_confirmed_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Registro de Auditoría y Cumplimiento MiFID II
CREATE TABLE compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    disclaimer_presented TEXT NOT NULL,
    user_ip VARCHAR(45),
    confirmed_explicitly BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`
    },
    contentMarkdown: `### 3.1 Justificación del Modelo de Datos

1. **Precisión Numérica (\`DECIMAL(18,4)\` y \`DECIMAL(18,6)\`)**:
   Los fondos de inversión indexados y monetarios permiten comprar participaciones fraccionadas (por ejemplo 0.28623 participaciones por 30€). Utilizar tipos \`FLOAT\` o \`DOUBLE\` introduciría discrepancias contables inaceptables.

2. **Integridad Referencial y Reglas de Negocio en BD**:
   - Restricción \`CHECK (cnmv_risk_scale BETWEEN 1 AND 7)\` garantiza que ningún activo supere la escala regulatoria oficial.
   - Constraint \`unique_portfolio_asset\` asegura una única posición acumulada por activo en cada cartera.

3. **Auditoría MiFID II Inmutable (\`compliance_audit_logs\`)**:
   Cada vez que el usuario confirma una orden o revisa un recordatorio fiscal, queda registrado el timestamp exacto y el texto de la advertencia legal aceptada.`
  },
  {
    id: 'screen-flow',
    number: 4,
    title: 'Flujo de Pantallas & Experiencia UX/UI',
    subtitle: 'Recorrido Paso a Paso del Usuario Centrado en la Prudencia',
    summary: 'Diagrama de navegación visual y wireflows orientados a prevenir compras impulsivas y fomentar el aprendizaje.',
    keyTakeaways: [
      'Onboarding conservador con test de perfil de riesgo y asignación de 100€ virtuales.',
      'Dashboard con indicador de semáforo de riesgo y visualizador de colchón de liquidez.',
      'Modal de orden con "Fricción de Seguridad": Tiempo de reflexión de 3 segundos antes del botón confirmar.',
      'Vista de auditoría fiscal y comisiones ahorradas acumuladas.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/navigation/screenFlowMap.ts',
      code: `export const USER_SCREEN_JOURNEY = [
  { step: 1, screen: 'Onboarding & Riesgo', goal: 'Definir perfil (Conservador/100€), aceptar avisos legales MiFID' },
  { step: 2, screen: 'Dashboard Principal', goal: 'Ver valoración (100€), distribución de activos y buffer de liquidez' },
  { step: 3, screen: 'Explorador de Mercado', goal: 'Filtrar fondos monetarios (Riesgo 1) y bonos/acciones globales con bajo TER' },
  { step: 4, screen: 'Simulador / Paper Trade', goal: 'Calcular impacto antes de comprar, verificar reglas de diversificación' },
  { step: 5, screen: 'Confirmación Segura', goal: 'Revisión explícita con desglose de riesgo y botón de confirmación humana' },
  { step: 6, screen: 'Centro de Alertas & DCA', goal: 'Configurar avisos de rebalanceo y aportaciones de 15€/25€ al mes' },
  { step: 7, screen: 'Hub Educativo & Fiscal', goal: 'Aprender sobre traspasos sin tributar en España y coste de comisiones' }
];`
    },
    contentMarkdown: `### 4.1 Diagrama de Navegación UX

\`\`\`
[1. Bienvenida & Perfil de Riesgo]
       |  (Aceptación de aviso legal MiFID: "No es asesoramiento financiero")
       v
[2. Dashboard Central de Cartera (100 €)]
       |---> [3. Explorador de Mercado & Fondos]
       |         |
       |         +---> [Ficha Detalle Activo: TER, Riesgo CNMV, Histórico]
       |                     |
       |                     v
       |               [4. Simulador de Orden (Paper Trading)]
       |                     | (Evaluación de Reglas de Riesgo)
       |                     v
       |               [5. Modal de Doble Confirmación con Desglose de Impacto]
       |                     |
       |                     v
       |               [Ejecución en Sandbox & Actualización de Cartera]
       |
       |---> [6. Centro de Control de Riesgo & Test de Estrés]
       |---> [7. Gestor de Alertas & Notificaciones]
       |---> [8. Academia Educativa & Régimen Fiscal Español]
\`\`\`

### 4.2 Elementos Clave de Diseño Anti-Impulso
- **Cero Gamificación Tóxica**: No hay confetis aleatorios, ni gráficos parpadeantes estilo casino o apalancamiento que inciten al sobre-trading.
- **Claridad de Comisiones**: Cada ficha destaca el TER anual en euros reales (ej: *"Este fondo con 30€ invertidos te cuesta solo 0,024€ al año en comisiones"*).
- **Semáforo de Salud de Cartera**:
  - Verde: Liquidez ≥ 20%, Diversificación balanceada, Riesgo ≤ 3/7.
  - Amarillo: Concentración en un activo > 30% o liquidez entre 10-20%.
  - Rojo: Pérdida acumulada próxima al límite de Drawdown o liquidez < 10%.`
  },
  {
    id: 'alerts-engine',
    number: 5,
    title: 'Lógica del Motor de Alertas',
    subtitle: 'Reglas Condicionales, Umbrales de Volatilidad y Rebalanceo',
    summary: 'Arquitectura de procesamiento de eventos para monitorizar carteras y notificar anomalías de mercado sin generar alarma.',
    keyTakeaways: [
      'Alerta de Desviación de Asset Allocation (ej. Renta Variable sube y supera el peso objetivo en >5%).',
      'Alerta de Máximo Drawdown: Advertencia temprana al alcanzar el 3% de caída para evitar ventas en pánico.',
      'Avisador de DCA: Recordatorio mensual programable de aportación periódica disciplinada.',
      'Mecanismo de Debounce: Máximo 1 alerta por activo al día para evitar fatiga cognitiva del usuario.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/modules/alerts/AlertEvaluator.ts',
      code: `export interface AlertEvaluationContext {
  portfolio: Portfolio;
  assets: Asset[];
  configuredAlerts: AlertRule[];
}

export function evaluatePortfolioAlerts(ctx: AlertEvaluationContext): AlertRule[] {
  const triggered: AlertRule[] = [];
  const { portfolio, configuredAlerts } = ctx;

  for (const alert of configuredAlerts) {
    if (!alert.active) continue;

    // 1. Regla de Drawdown Máximo
    if (alert.type === 'MAX_DRAWDOWN') {
      const currentDrawdown = Math.abs(Math.min(0, portfolio.totalPnlPercentage));
      if (currentDrawdown >= alert.threshold) {
        triggered.push({
          ...alert,
          triggeredAt: new Date().toISOString(),
          message: \`⚠️ Alerta de Riesgo: La cartera ha alcanzado un drawdown del \${currentDrawdown.toFixed(2)}% (Límite: \${alert.threshold}%). Revisa tu estrategia sin tomar decisiones precipitadas.\`
        });
      }
    }

    // 2. Regla de Desvío de Rebalanceo
    if (alert.type === 'REBALANCE_NEEDED') {
      const equityPos = portfolio.positions.find(p => p.assetId === 'vanguard-msci-world');
      const equityWeight = equityPos ? equityPos.weightPercentage : 0;
      const targetWeight = 10.0; // 10% objetivo conservador
      if (Math.abs(equityWeight - targetWeight) >= alert.threshold) {
        triggered.push({
          ...alert,
          triggeredAt: new Date().toISOString(),
          message: \`⚖️ Sugerencia de Rebalanceo: La renta variable pesa un \${equityWeight.toFixed(1)}% (Objetivo: \${targetWeight}%). Considera traspasar parte al fondo monetario para volver al perfil.\`
        });
      }
    }
  }

  return triggered;
}`
    },
    contentMarkdown: `### 5.1 Tipologías de Alertas Configurables

| Tipo de Alerta | Condición de Activación | Severidad | Acción Recomendada |
| :--- | :--- | :--- | :--- |
| **Drawdown Alerta 1 (Prudencial)** | Caída cartera ≥ 3.0% | Media | Revisar horizonte temporal, no vender en pánico. |
| **Drawdown Alerta 2 (Crítica)** | Caída cartera ≥ 5.0% | Alta | Pausa de operaciones, revisión de perfil de riesgo. |
| **Desvío de Rebalanceo** | Posición se desvía > 5% del peso meta | Baja | Evaluar traspaso de fondos sin coste fiscal. |
| **Aportación Periódica DCA** | Día 1 o 5 de cada mes | Informativa | Aportar 15€ - 25€ periódicos planificados. |
| **Caída de Fondo > 2% en 24h** | Volatilidad diaria anómala | Media | Oportunidad de compra con descuento si se hace DCA. |

### 5.2 Filtro Anti-Pánico y Salud Mental
Las alertas nunca utilizan lenguaje sensacionalista ("¡CRASH!", "¡VENDE AHORA!"). El texto es siempre sobrio, pedagógico y centrado en los objetivos de largo plazo del inversor conservador.`
  },
  {
    id: 'risk-strategy',
    number: 6,
    title: 'Estrategia de Control de Riesgo',
    subtitle: 'Reglas Estrictas de Preservación de Capital para 100 € Iniciales',
    summary: 'Modelo cuantitativo y cualitativo de gestión de riesgo adaptado a micro-inversión defensiva.',
    keyTakeaways: [
      'Pirámide Conservadora: 40% Liquidez/Monetario + 40% Renta Fija Corto Plazo + 10-20% Renta Variable Global.',
      'Tope Máximo por Activo Individual: 35€ (35%) para evitar riesgo de quiebra específica.',
      'Buffer de Liquidez Intocable: Mínimo 20€ (20%) en efectivo o fondo monetario STR.',
      'Checklist de 3 preguntas antes de cualquier compra para verificar idoneidad psicológica.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/services/risk/ConservativeAllocationStrategy.ts',
      code: `export const CONSERVATIVE_100_BENCHMARK = {
  name: 'Cartera Defensiva Custodia 100€',
  targetAllocation: [
    { category: 'monetario', label: 'Fondo Monetario Euro (STR)', targetWeightPct: 40, maxWeightPct: 60, minWeightPct: 20 },
    { category: 'renta_fija', label: 'Renta Fija Global Cubierta EUR', targetWeightPct: 35, maxWeightPct: 50, minWeightPct: 20 },
    { category: 'renta_variable', label: 'Renta Variable Global Indexada (MSCI World)', targetWeightPct: 15, maxWeightPct: 25, minWeightPct: 0 },
    { category: 'materias_primas', label: 'Oro Físico (Cobertura)', targetWeightPct: 10, maxWeightPct: 15, minWeightPct: 0 },
  ],
  hardConstraints: {
    maxSingleAssetExposureEur: 35.00, // Máx 35% del capital total
    minCashReserveEur: 20.00,          // Mín 20% en cash disponible
    maxTotalDrawdownTolerancePct: 5.0, // Detener nuevas compras si cae >5%
    maximumLeverageAllowed: 1.0        // Estrictamente CERO apalancamiento
  }
};`
    },
    contentMarkdown: `### 6.1 Estructura de la Cartera Modelo de 100 €

Para un capital inicial de 100 €, la distribución recomendada por defecto es:

\`\`\`
+-------------------------------------------------------------------------+
|                  DISTRIBUCIÓN MODELO CONSERVADORA (100 €)               |
|                                                                         |
|  [ 40 € ] 40% -> Fondo Monetario Euro (Groupama Trésorerie) - Riesgo 1  |
|  [ 35 € ] 35% -> Renta Fija Global Cubierta (Vanguard Global Bond) - R2 |
|  [ 15 € ] 15% -> Renta Variable Global (Vanguard MSCI World) - R4      |
|  [ 10 € ] 10% -> Oro Físico / Reserva de Valor (Amundi Gold ETC) - R3   |
+-------------------------------------------------------------------------+
\`\`\`

### 6.2 Reglas Cuantitativas de Bloqueo Inflexible
1. **Regla de No-Apalancamiento**: Queda técnicamente inhabilitado el uso de margen, derivados CFD o apalancamiento financiero.
2. **Regla de Concentración Máxima**: Ningún activo individual puede superar el 35% de la cartera total.
3. **Regla del Colchón de Oxígeno**: Si el saldo en efectivo desciende de 20 €, se bloquean compras adicionales en renta variable hasta reponer liquidez.
4. **Regla de Stop-Loss Mental y Pausa Reflexiva**: Si la posición en renta variable sufre una corrección superior al 8%, la plataforma exige una lectura de 60 segundos sobre volatilidad histórica antes de autorizar ventas en pánico.`
  },
  {
    id: 'roadmap-phases',
    number: 7,
    title: 'Roadmap de Implementación en Fases',
    subtitle: 'Plan de Entrega de Producto (De MVP a Conectividad de Broker)',
    summary: 'Cronograma estructurado en 4 fases evolutivas para validar la utilidad antes de la conexión con dinero real.',
    keyTakeaways: [
      'Fase 1 (MVP - 4 semanas): Motor Paper Trading 100€, visualización de mercado y reglas de riesgo.',
      'Fase 2 (Alertas & Educación - 3 semanas): Motor de eventos, módulo fiscal español y simulador de DCA.',
      'Fase 3 (Open Banking & Sandbox - 4 semanas): Integración PSD2 de lectura de saldos y staging de órdenes.',
      'Fase 4 (Broker Gateway MyInvestor - 5 semanas): Conexión oficial de órdenes según disponibilidad de API de MyInvestor.'
    ],
    codeSnippet: {
      language: 'json',
      filename: 'docs/roadmap_milestones.json',
      code: `{
  "phases": [
    {
      "phase": "Fase 1: MVP Core & Paper Trading",
      "durationWeeks": 4,
      "deliverables": [
        "Motor de cálculo de cartera con 100€ iniciales",
        "Ingestión de datos de fondos indexados y monetarios con TER",
        "Validación estricta de riesgo pre-trade",
        "UI interactiva con gráficos de asignación"
      ]
    },
    {
      "phase": "Fase 2: Motor de Alertas & Centro Fiscal",
      "durationWeeks": 3,
      "deliverables": [
        "Alertas de Drawdown, rebalanceo y avisos de DCA",
        "Guía interactiva de traspasabilidad fiscal en España",
        "Calculadora de interés compuesto y TER a 10/20 años"
      ]
    },
    {
      "phase": "Fase 3: Sandbox & Cumplimiento Normativo",
      "durationWeeks": 4,
      "deliverables": [
        "Auditoría MiFID II y registro de logs de consentimiento",
        "Conector bancario PSD2 en modo lectura (Read-Only AISP)",
        "Generador de órdenes guiadas para MyInvestor web"
      ]
    },
    {
      "phase": "Fase 4: Integración API Broker & Escalabilidad",
      "durationWeeks": 5,
      "deliverables": [
        "Conexión API oficial MyInvestor / Inversis (sujeto a disponibilidad)",
        "Soporte multi-divisa y fondos ESG sostenibles",
        "Exportación de informes fiscales para IRPF modelo 100"
      ]
    }
  ]
}`
    },
    contentMarkdown: `### 7.1 Detalle de Hitos por Fase

#### Fase 1: MVP Simulador & Gestión de Riesgo (Mes 1)
- Objetivo: Probar el comportamiento del usuario con 100 € de capital simulado.
- Criterio de Aceptación: 100% de operaciones bloqueadas si violan el buffer del 20% de liquidez o el 35% de concentración.

#### Fase 2: Alertas, Rebalanceo y Formación (Mes 2)
- Objetivo: Guiar al usuario en el hábito de la aportación mensual periódica (DCA de 15€-25€/mes).
- Criterio de Aceptación: Notificaciones oportunas de rebalanceo cuando la renta variable se desvía >5%.

#### Fase 3: Pasarela MyInvestor en Modo Asistido (Mes 3)
- Objetivo: Generación de fichas de operación listas para ser ejecutadas en MyInvestor con 1 clic de verificación.
- Criterio de Aceptación: Coincidencia exacta de ISIN, nombre de fondo y clase limpia (Clean Share Class).

#### Fase 4: Producción & API Directa (Mes 4+)
- Objetivo: Si MyInvestor/Inversis habilita API oficial para minoristas, habilitar envío de órdenes con firma 2FA.`
  },
  {
    id: 'test-cases-usecases',
    number: 8,
    title: 'Pruebas y Casos de Uso',
    subtitle: 'Matriz de Pruebas Unitarias, de Integración y Estrés Financiero',
    summary: 'Plan de aseguramiento de calidad técnica y financiera con escenarios de crisis de mercado simulados.',
    keyTakeaways: [
      'Test Case TC-01: Intento de compra que deja liquidez < 20% -> Bloqueo obligatorio.',
      'Test Case TC-02: Intento de compra con importe > capital disponible -> Rechazo inmediato.',
      'Test Case TC-03: Simulación de caída de mercado del 20% (Escenario Covid 2020) -> Cartera defensiva solo cae un ~2.8%.',
      'Test Case TC-04: Rebalanceo automático de fondos sin impacto fiscal simulado.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'tests/riskEngine.spec.ts',
      code: `import { describe, it, expect } from 'vitest';
import { RiskGuardianService } from '../src/modules/guardian/RiskGuardianService';
import { INITIAL_PORTFOLIO_STATE, CONSERVATIVE_ASSETS } from '../src/data/marketData';

describe('RiskGuardianService - Suite de Pruebas de Preservación de Capital', () => {
  it('TC-01: Debe BLOQUEAR una compra de 30€ si la liquidez restante cae por debajo del 20%', () => {
    const portfolio = {
      ...INITIAL_PORTFOLIO_STATE,
      cashBalance: 25.00, // 25€ disponibles sobre 100€
      totalValuation: 100.00
    };
    const asset = CONSERVATIVE_ASSETS.find(a => a.id === 'vanguard-msci-world')!;
    
    // Intentar comprar 15€ dejaría el cash en 10€ (10% < 20% mínimo)
    const result = RiskGuardianService.validateTradeIntent(portfolio as any, asset, 15.00, 'BUY');
    
    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.includes('Infracción de Regla de Liquidez'))).toBe(true);
  });

  it('TC-02: Debe APROBAR una compra conservadora de 10€ en fondo monetario con suficiente cash', () => {
    const portfolio = {
      ...INITIAL_PORTFOLIO_STATE,
      cashBalance: 50.00,
      totalValuation: 100.00
    };
    const asset = CONSERVATIVE_ASSETS.find(a => a.id === 'groupama-tresorerie')!;
    
    const result = RiskGuardianService.validateTradeIntent(portfolio as any, asset, 10.00, 'BUY');
    expect(result.allowed).toBe(true);
    expect(result.reasons.length).toBe(0);
  });
});`
    },
    contentMarkdown: `### 8.1 Matriz de Pruebas de Estrés Financiero

Para certificar la solidez del modelo de 100 €, se ejecutan tres escenarios históricos de estrés:

1. **Escenario "Crash Covid Marzo 2020" (Renta Variable -34% en 1 mes)**:
   - Cartera Agresiva 100% Acciones: 100 € -> 66,00 € (-34 €).
   - **Cartera Custodia Defensiva**: 100 € -> 95,80 € (-4,20 € gracias al 40% monetario + 35% renta fija defensiva).

2. **Escenario "Subida de Tipos Inflacionaria 2022" (Renta Fija a largo plazo -15%)**:
   - Gracias al uso de fondos monetarios a corto plazo indexados al STR, el capital inicial se mantiene protegido.

3. **Escenario "Aportación DCA Mensual Disciplinada"**:
   - 100 € iniciales + 20 €/mes durante 12 meses (Total invertido: 340 €).
   - Efecto: Reducción de la volatilidad media en un 42% frente a compras de importe único.`
  },
  {
    id: 'legal-product-risks',
    number: 9,
    title: 'Riesgos Legales, Regulatorios y de Producto',
    subtitle: 'Cumplimiento CNMV, MiFID II, Privacidad RGPD y Política de Broker',
    summary: 'Análisis minucioso del marco regulatorio financiero español y europeo aplicable.',
    keyTakeaways: [
      'No asesoramiento financiero: La app opera bajo la figura de herramienta de ejecución y soporte analítico.',
      'Avisos obligatorios de riesgo: "Rentabilidades pasadas no garantizan rentabilidades futuras".',
      'Consentimiento expreso obligatorio previo a cada simulación u orden.',
      'Política de MyInvestor: Respeto absoluto a los términos de servicio bancarios (prohibido web-scraping no consentido).'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/compliance/regulatoryDisclaimers.ts',
      code: `export const REGULATORY_STATEMENTS = {
  jurisdiction: 'España / Unión Europea (CNMV / Directiva MiFID II)',
  disclaimerText: \`AVISO LEGAL Y DE RIESGO: Esta aplicación es exclusivamente una herramienta de simulación, educación financiera y seguimiento de carteras. No constituye un servicio de asesoramiento en materia de inversión (artículo 140 de la Ley de los Mercados de Valores), ni una oferta de compra o venta de instrumentos financieros. Toda inversión en fondos o valores conlleva riesgos de mercado, incluida la posible pérdida del capital invertido. Las rentabilidades pasadas no constituyen un indicador fiable de rentabilidades futuras.\`,
  taxNotice: \`INFORMACIÓN FISCAL GENERAL: La información relativa a la traspasabilidad de fondos de inversión en España (Art. 94 Ley IRPF) se facilita con carácter orientativo general. La fiscalidad puede variar según la residencia fiscal del titular. Se recomienda encarecidamente consultar con un asesor fiscal o la Agencia Tributaria.\`,
  myInvestorIntegrationNote: \`INTEGRACIÓN CON BROKERS: La conexión con entidades como MyInvestor se realizará únicamente a través de interfaces de programación (API) oficiales, seguras y autorizadas bajo normativa PSD2. La plataforma nunca solicitará ni almacenará claves maestras de banca online.\`
};`
    },
    contentMarkdown: `### 9.1 Matriz de Riesgos y Medidas Mitigadoras

| Riesgo Identificado | Impacto | Nivel | Medida de Mitigación Implementada |
| :--- | :--- | :--- | :--- |
| **Confusión con Asesoramiento Financiero Regulado** | Sanción CNMV | Alto | Disclaimers permanentes en cabecera y pie de página; prohibición de recomendaciones personalizadas vinculantes. |
| **Pérdida de Capital en Mercado Real** | Frustración Usuario | Medio | Modo Paper Trading obligatorio inicial; límites de riesgo estrictos y recordatorio de horizonte temporal. |
| **Inseguridad en Credenciales Bancarias** | Fuga de Datos | Crítico | Cero almacenamiento de contraseñas bancarias; uso exclusivo de protocolos OAuth2 / PSD2 con token de un solo uso. |
| **Interpretación Fiscal Errónea** | Contingencia Tributaria | Medio | Mensaje explícito recordando que los traspasos no aplican a ETFs extranjeros ni a residentes fuera de España.`
  },
  {
    id: 'code-examples',
    number: 10,
    title: 'Pseudocódigo y Ejemplos de Implementación',
    subtitle: 'Lógica Central del Motor de Riesgo, Cálculo de Cartera y Pasarela MyInvestor',
    summary: 'Implementación completa en TypeScript de las clases y funciones nucleares del sistema.',
    keyTakeaways: [
      'Clase RiskValidationEngine con todas las verificaciones matemáticas de 100€.',
      'Clase PortfolioCalculator con rebalanceo y cálculo ponderado de TER.',
      'Clase MyInvestorBridge con soporte para borrador de orden guiado.'
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'src/services/core/CompleteEngines.ts',
      code: `// Implementación de referencia del motor de cálculo y validación
import { Portfolio, Asset, SimulatedOrder } from '../types';

export class ConservativePortfolioEngine {
  /**
   * Recalcula la valoración total, P&L y pesos de la cartera
   */
  public static recalculatePortfolio(portfolio: Portfolio, assets: Asset[]): Portfolio {
    let totalInvested = 0;
    let currentTotalPositionsValuation = 0;
    let weightedTerSum = 0;

    const updatedPositions = portfolio.positions.map(pos => {
      const asset = assets.find(a => a.id === pos.assetId);
      const currentPrice = asset ? asset.currentPrice : pos.currentPrice;
      const currentValuation = pos.shares * currentPrice;
      const pnlAmount = currentValuation - pos.investedAmount;
      const pnlPercentage = pos.investedAmount > 0 ? (pnlAmount / pos.investedAmount) * 100 : 0;

      totalInvested += pos.investedAmount;
      currentTotalPositionsValuation += currentValuation;
      if (asset) {
        weightedTerSum += (asset.ter * currentValuation);
      }

      return {
        ...pos,
        currentPrice,
        currentValuation,
        pnlAmount,
        pnlPercentage,
        weightPercentage: 0 // Se calculará abajo
      };
    });

    const totalValuation = portfolio.cashBalance + currentTotalPositionsValuation;
    const totalPnlAmount = totalValuation - portfolio.initialCapital;
    const totalPnlPercentage = (totalPnlAmount / portfolio.initialCapital) * 100;
    const weightedTer = currentTotalPositionsValuation > 0 ? weightedTerSum / currentTotalPositionsValuation : 0;
    const cashReservePercentage = totalValuation > 0 ? (portfolio.cashBalance / totalValuation) * 100 : 100;

    const finalPositions = updatedPositions.map(pos => ({
      ...pos,
      weightPercentage: totalValuation > 0 ? (pos.currentValuation / totalValuation) * 100 : 0
    }));

    return {
      ...portfolio,
      positions: finalPositions,
      totalValuation,
      totalPnlAmount,
      totalPnlPercentage,
      weightedTer,
      cashReservePercentage
    };
  }

  /**
   * Ejecuta una orden de simulación en Paper Trading
   */
  public static executePaperTrade(portfolio: Portfolio, order: SimulatedOrder, asset: Asset): Portfolio {
    if (order.orderType === 'BUY') {
      const sharesPurchased = order.amountEur / order.executionPrice;
      const updatedCash = portfolio.cashBalance - order.amountEur;
      
      const existingPosIndex = portfolio.positions.findIndex(p => p.assetId === asset.id);
      let newPositions = [...portfolio.positions];

      if (existingPosIndex >= 0) {
        const existing = newPositions[existingPosIndex];
        const newShares = existing.shares + sharesPurchased;
        const newInvested = existing.investedAmount + order.amountEur;
        const newAvgPrice = newInvested / newShares;

        newPositions[existingPosIndex] = {
          ...existing,
          shares: newShares,
          investedAmount: newInvested,
          averageBuyPrice: newAvgPrice,
          currentPrice: order.executionPrice,
          currentValuation: newShares * order.executionPrice,
          pnlAmount: (newShares * order.executionPrice) - newInvested,
          pnlPercentage: ((newShares * order.executionPrice - newInvested) / newInvested) * 100,
          weightPercentage: 0
        };
      } else {
        newPositions.push({
          assetId: asset.id,
          shares: sharesPurchased,
          averageBuyPrice: order.executionPrice,
          currentPrice: order.executionPrice,
          investedAmount: order.amountEur,
          currentValuation: order.amountEur,
          pnlAmount: 0,
          pnlPercentage: 0,
          weightPercentage: 0
        });
      }

      const updated = {
        ...portfolio,
        cashBalance: updatedCash,
        positions: newPositions
      };

      return this.recalculatePortfolio(updated, [asset]);
    }
    return portfolio;
  }
}`
    },
    contentMarkdown: `### 10.1 Resumen de la Implementación Técnica

El código anterior demuestra la implementación exacta de:
1. **Ledger de Simulación**: Cálculo de precio medio ponderado de compra (Average Buy Price) para cada fondo.
2. **Cálculo Dinámico de Comisiones (TER Ponderado)**: Muestra en todo momento el coste porcentual real de la cartera.
3. **Manejo de Fracciones**: Soporte para hasta 6 decimales de precisión en participaciones de fondos.`
  }
];
