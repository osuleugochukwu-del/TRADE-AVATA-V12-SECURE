# TA Script 1.0 — R4 AI & Access Specification

TA Script is Trade Avata's restricted trading-specific programming language. **TA Script 1.0 remains the product version.** `R4` is only the current internal revision of the 1.0 language/runtime.

TA Script is designed to power native Trade Avata indicators, signals, alerts, strategies, backtesting and permission-gated automation without exposing arbitrary browser JavaScript, DOM, network, storage, filesystem or `eval` capabilities.

## 1. Program header

```text
ta_script 1.0
revision R4
indicator "My Indicator"
overlay true
calculate on bar_close
```

`calculate on bar_close` excludes the host's final forming candle from state-machine actions when `hasLiveBar` is enabled. Calculated indicator series may still be evaluated by the host for live display.

## 2. Market data available to every script

```text
open
high
low
close
volume
tick_volume
hl2
hlc3
ohlc4
bar_index
pip_size
```

Historical access uses `[n]`:

```text
close[1]
high[3]
my_ma[10]
stoch.k[1]
```

## 3. Inputs, variables and pure user functions

```text
input period = 20
let average = ema(close, period)
function bullish(a,b) = a > b
```

R4 user functions are expression functions. They are pure calculations; arbitrary JavaScript and unsafe system access remain forbidden.

## 4. Plots and anchored markers

```text
plot average as "20 EMA"
marker "HH" at structure.swing_high anchor structure.swing_high_index when structure.hh
```

An anchored marker carries both the **pivot bar** and the later **confirmation bar**. This lets the Trade Avata adapter draw the label on the original swing while preserving truthful non-repainting confirmation timing.

## 5. Gold Hunter-grade state machines

```text
state armed_buy = false
state arm_bar = -1

set armed_buy = true when rsi14 < 30
set arm_bar = bar_index when rsi14 < 30 and arm_bar < 0

signal "BUY" when armed_buy and close[1] <= ema20[1] and close > ema20
set armed_buy = false when armed_buy and close[1] <= ema20[1] and close > ema20
```

State transitions execute in source order on each processed bar. This supports ordered systems such as Gold Hunter A++: RSI cross -> later Stochastic cross -> later trigger-MA cross.

## 6. Core technical indicators

Existing/certified core functions include:

```text
sma(source, period)
ema(source, period)
wma(source, period)
wilder(source, period)
ma(source, period, type)
rsi(source, period)
stochastic(...)
macd(...)
atr(period)
adx(period)
cci(period)
bollinger(source, period, deviation, ma_type)
vwap(anchor)
momentum(source, period)
roc(source, period)
highest(source, period)
lowest(source, period)
```

Moving-average types include SMA, EMA, WMA, Wilder, Time Series/Linear Regression, Triangular, Hull, DEMA, TEMA, VIDYA and Kaufman Adaptive.

R4 keeps the Gold Hunter-compatible Triangular MA definition:

```text
TMA(period) = SMA(SMA(source, period), period)
```

The default shorthand Stochastic is 9/3/9, SMA, Low/High. Explicit parameter scripts such as Gold Hunter keep their own configured values.

VWAP now supports explicit anchoring rather than depending on the arbitrary first loaded bar:

```text
vwap("session")
vwap("week")
vwap("month")
vwap("all")
```

Zero volume is not silently changed to fake volume.

## 7. Trade Avata native technical library

R4 exposes native language primitives for the baseline families discussed for Trade Avata:

```text
envelopes(source, period, deviation_percent, ma_type)
ichimoku(tenkan, kijun, senkou_b, displacement)
psar(step, maximum)
standard_deviation(source, period)
zigzag(depth, deviation_percent, backstep)

bears_power(period)
bulls_power(period)
demarker(period)
force_index(period, ma_type)
osma(source, fast, slow, signal)
rvi(period)
williams_r(period)

accumulation_distribution()
money_flow_index(period)
obv()
market_profile(lookback, bins, value_area)

accelerator_oscillator()
alligator(jaw_period, jaw_shift, teeth_period, teeth_shift, lips_period, lips_shift)
awesome_oscillator()
fractals(left, right)
gator()
market_facilitation_index()
```

These functions give TA Script the language surface needed for the Trade Avata native indicator library. All native primitives are validated by Trade Avata regression and golden-vector tests before release.

## 8. Candlestick intelligence

```text
let c = candle_patterns()
```

Returns candle anatomy:

```text
c.body
c.range
c.upperWick
c.lowerWick
c.bodyRatio
c.bullish
c.bearish
```

And common confirmed candle-shape/pattern booleans:

```text
c.doji
c.hammer
c.invertedHammer
c.shootingStar
c.hangingMan
c.bullishEngulfing
c.bearishEngulfing
c.bullishHarami
c.bearishHarami
c.morningStar
c.eveningStar
c.insideBar
c.outsideBar
c.pinBull
c.pinBear
```

## 9. Market structure

```text
let structure = market_structure(3, 3)
```

The first number is left-bar confirmation depth and the second is right-bar confirmation depth.

The returned object includes:

```text
structure.swing_high
structure.swing_low
structure.swing_high_index
structure.swing_low_index

structure.hh
structure.hl
structure.lh
structure.ll

structure.last_high
structure.last_low
structure.previous_high
structure.previous_low

structure.bos_bull
structure.bos_bear
structure.choch_bull
structure.choch_bear

structure.trend
structure.trend_code
```

`trend_code` is `1` bullish, `-1` bearish and `0` not-yet-established/transition.

### Non-repainting rule

A swing is not confirmed until the configured right-side bars exist. TA Script can visually anchor a confirmed label back to the pivot bar, but its `confirmedAt` bar remains available to the host/backtester. Strategies must not receive future knowledge.

## 10. Market regime: trend, range and transition

```text
let regime = market_regime(3, 3, 50, 0.25)
```

Returns:

```text
regime.state
regime.uptrend
regime.downtrend
regime.range
regime.transition
regime.efficiency
regime.score
```

The R4 regime engine combines confirmed structure with a configurable directional-efficiency measurement. It is deterministic and configurable; it is not presented as the only possible definition of market regime.

### Trend channels and range bounds

```text
let channel = trend_channel(3, 3)
let box = range_bounds(50)
```

`trend_channel()` projects upper/lower structure lines from the latest two confirmed swing highs and swing lows. `range_bounds()` exposes rolling high, low, midpoint and width so scripts can build range/high-low tools without reimplementing them.

```text
channel.upper
channel.lower
channel.mid
channel.upper_slope
channel.lower_slope
channel.valid

box.high
box.low
box.mid
box.width
```

## 11. Structure zones, breakout and retest

```text
let z = structure_zones(3, 3, 14, 0.25)
```

Returns:

```text
z.support
z.resistance
z.demand_low
z.demand_high
z.supply_low
z.supply_high
z.retest_demand
z.retest_supply
z.breakout_up
z.breakout_down
```

Generic helpers also exist:

```text
breaks_above(close, level)
breaks_below(close, level)
touch(level, tolerance)
```

## 12. Chart-pattern engine

```text
let p = pattern("double_top", 3, 3, 0.03, 160)
```

Returns:

```text
p.confirmed
p.score
p.bullish
p.bearish
p.neckline
p.target
p.anchor_index
```

R4 retains the pattern families requested during design:

- Double Top
- Double Bottom
- Head and Shoulders
- Inverse Head and Shoulders
- Rising Wedge
- Falling Wedge
- Bearish Flag
- Bullish Flag
- Bearish Pennant
- Bullish Pennant
- Three Drive Pattern (bearish)
- Three Drive Pattern (bullish)
- Diamond Top
- Diamond Bottom
- Rounding Top
- Rounding Bottom

Names are written with spaces or underscores, for example `"head_and_shoulders"`.

Pattern detection is a deterministic heuristic engine built from confirmed price structure. `score` is a matching score, not a promise of future profitability. Diamond/rounding and continuation-pattern recognition remain candidates for further market-data certification and tuning before production defaults are frozen.

## 13. Signals, alerts, strategies and automation

```text
signal "BUY" when condition
alert "Bullish setup" when condition

entry long "Long" when condition
exit "Long" when exit_condition

order buy qty 1 when condition
```

Real orders are never sent directly by TA Script. The language emits an order intent. Trade Avata must still verify authentication, broker connection, automation permission, account/risk limits and execution policy.

## 14. Higher-timeframe / isolated contexts

The same compiled script can run against isolated bar streams:

```js
compiled.runContexts({
  current: { bars: m1Bars, options: { hasLiveBar: true } },
  H1: { bars: h1Bars, options: { hasLiveBar: true } }
})
```

Each context gets an independent state machine. This is already required by Gold Hunter's current-timeframe and HTF logic.

## 15. Security boundary

TA Script does not expose arbitrary:

- `eval` / `Function`
- `fetch` / WebSocket
- DOM/window access
- local/session storage
- filesystem / process APIs

Trade Avata adapters decide what a script may draw, alert, store, license or trade.


## 16. Reusable AI / decision-scoring framework

TA Script R4 adds reusable explainable decision primitives. These are deterministic trading-decision tools, not a claim that a machine-learning model is present.

### Weighted components

```text
let trend_ok = ai_component(close > ema(close, 200), 25)
let structure_ok = ai_component(structure.hl or structure.hh, 25)
let momentum_ok = ai_component(rsi(close, 14) > 50, 20)
let volatility_ok = ai_component(atr(14) > atr(14)[1], 10)
let htf_ok = ai_component(htf_bullish, 20)

let ai = ai_decision(70, trend_ok, structure_ok, momentum_ok, volatility_ok, htf_ok)
```

`ai_decision()` normalizes the supplied component weights to a 0–100 score and returns:

```text
ai.score
ai.raw_score
ai.max_score
ai.threshold
ai.allow
ai.confidence
ai.passed_count
ai.failed_count
```

`score_when(condition, weight)` is an alias for `ai_component(condition, weight)`.

This lets any TA Script developer construct an explainable scoring/filter model without modifying the Trade Avata runtime.

### Gold Hunter Classic AI

R4 also exposes the existing Gold Hunter 40/30/30 decision model as a reusable primitive:

```text
let gh_ai = gold_hunter_ai(trend_ma, "buy", 10, 0.5, "filter")
```

It returns:

```text
gh_ai.direction_ok
gh_ai.distance_ok
gh_ai.slope_ok
gh_ai.score
gh_ai.regime
gh_ai.allow
gh_ai.would_cancel
```

Modes are `off`, `monitor` and `filter`. This preserves a Classic path for Gold Hunter while allowing other indicators to build completely different AI-style scoring models with `ai_component()` and `ai_decision()`.

## 17. Private/default indicators and TA ID grants

TA Script can declare an access contract:

```text
access owner_or_grant
entitlement "gold-hunter-v4"
default_attach owner
grant_via ta_id
```

Supported policies:

```text
access public
access owner_only
access owner_or_grant
```

`default_attach owner` means the host platform may automatically attach the indicator for the verified owner. `default_attach authorized` may be used for products that should auto-attach for every authorized account. `none` means no automatic attachment.

The `.tas` source must **not contain the owner's private backend UID or a hard-coded allow-list of TA IDs**. `grant_via ta_id` means a user-facing TA ID can be used by the owner to create/revoke a backend entitlement. The backend remains authoritative and returns a verified authorization context to the TA Script host.

For a non-public script, the runtime refuses execution when the production adapter does not supply verified authorization. A copied browser/source file therefore does not become the authority for licensing.

## 18. Attached/running indicator manager contract

TA Script exposes a descriptor (`compile(...).descriptor`) containing script name, kind, inputs and access metadata. The Trade Avata chart adapter should use that descriptor to preserve the existing indicator UI and add a **Running / Attached Indicators** view.

Each attached indicator instance should have its own instance ID and expose, without removing current chart features:

- visibility / eye toggle
- indicator name and automatic parameter label
- edit/settings
- remove
- pane/overlay placement
- current input values
- authorization/access state where relevant

Editing an instance changes only that attached instance. Removing an instance detaches it from that chart/workspace; it does not revoke the user's backend entitlement.

Owner-default private indicators such as Gold Hunter are attached by the host after backend authorization, not by trusting a client-side `owner=true` flag.
