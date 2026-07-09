"""
Backtest Engine
Verifies trading strategies against historical data before live deployment.
Part of Phase 3 Intelligence (TARGET_ARCHITECTURE.md §5).
"""
import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import statistics


@dataclass
class BacktestTrade:
    symbol: str
    direction: str  # LONG / SHORT
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    quantity: int
    strategy_id: str
    regime: str
    pnl: float
    pnl_pct: float
    exit_reason: str  # TARGET / STOP / TIME / SIGNAL

@dataclass
class BacktestResult:
    strategy_id: str
    period_start: str
    period_end: str
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    trades: List[BacktestTrade] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "strategy_id": self.strategy_id,
            "period": f"{self.period_start} to {self.period_end}",
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": round(self.win_rate, 4),
            "total_pnl": round(self.total_pnl, 2),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "profit_factor": round(self.profit_factor, 4),
            "max_drawdown_pct": round(self.max_drawdown_pct, 4),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "risk_reward_ratio": round(self.avg_win / abs(self.avg_loss), 4) if self.avg_loss != 0 else 0,
        }

class BacktestEngine:
    """
    Runs backtests against historical candle data with regime-aware evaluation.
    """

    def __init__(self, db_pool=None):
        self.db_pool = db_pool
        self.results: List[BacktestResult] = []

    def run(self, strategy_id: str, candles: List[Dict], initial_capital: float = 100000,
            position_size_pct: float = 0.02, commission: float = 0.0005) -> BacktestResult:
        """
        Run a strategy against historical candle data.
        
        Args:
            strategy_id: Strategy identifier
            candles: List of OHLCV candles [{time, open, high, low, close, volume}]
            initial_capital: Starting capital
            position_size_pct: Position size as % of capital
            commission: Commission rate per trade
        """
        result = BacktestResult(
            strategy_id=strategy_id,
            period_start=str(candles[0]["time"]) if candles else "N/A",
            period_end=str(candles[-1]["time"]) if candles else "N/A",
        )

        capital = initial_capital
        position = None
        peak_capital = initial_capital
        max_drawdown = 0.0
        daily_returns: List[float] = []

        for i, candle in enumerate(candles):
            # Track peak capital and drawdown
            if capital > peak_capital:
                peak_capital = capital
            drawdown = (peak_capital - capital) / peak_capital
            if drawdown > max_drawdown:
                max_drawdown = drawdown

            # Check for exit conditions
            if position:
                exit_signal = self._check_exit(candle, position, candles, i)
                if exit_signal:
                    trade = self._close_position(position, candle, exit_signal)
                    capital += trade.pnl
                    result.trades.append(trade)
                    result.total_trades += 1

                    if trade.pnl > 0:
                        result.winning_trades += 1
                    else:
                        result.losing_trades += 1

                    position = None

            # Check for entry conditions
            if not position:
                entry_signal = self._check_entry(candle, candles, i)
                if entry_signal:
                    position_size = capital * position_size_pct
                    quantity = int(position_size / candle["close"])
                    if quantity > 0:
                        position = {
                            "direction": entry_signal,
                            "entry_price": candle["close"],
                            "entry_time": candle["time"],
                            "quantity": quantity,
                            "stop_loss": candle["close"] * 0.98,  # -2%
                            "target": candle["close"] * 1.04,      # +4%
                            "max_hold_minutes": 30,
                            "entry_index": i,
                            "strategy_id": strategy_id,
                            "regime": entry_signal.get("regime", "UNKNOWN") if isinstance(entry_signal, dict) else "UNKNOWN",
                        }

        # Close any open position at end of period
        if position:
            trade = self._close_position(position, candles[-1], "END_OF_PERIOD")
            capital += trade.pnl
            result.trades.append(trade)
            result.total_trades += 1
            if trade.pnl > 0:
                result.winning_trades += 1
            else:
                result.losing_trades += 1

        # Compute metrics
        result.total_pnl = capital - initial_capital
        wins = [t.pnl for t in result.trades if t.pnl > 0]
        losses = [t.pnl for t in result.trades if t.pnl <= 0]

        if wins:
            result.avg_win = sum(wins) / len(wins)
        if losses:
            result.avg_loss = sum(losses) / len(losses)

        if result.total_trades > 0:
            result.win_rate = result.winning_trades / result.total_trades

        if abs(result.avg_loss) > 0:
            gross_profit = sum(wins) if wins else 0
            gross_loss = abs(sum(losses)) if losses else 0
            result.profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')

        result.max_drawdown_pct = max_drawdown
        result.sharpe_ratio = self._compute_sharpe(result.trades)

        self.results.append(result)
        return result

    def _check_entry(self, candle: Dict, candles: List[Dict], idx: int) -> Optional[Dict]:
        """Check entry conditions. Override per strategy."""
        return None

    def _check_exit(self, candle: Dict, position: Dict, candles: List[Dict], idx: int) -> Optional[str]:
        """Check exit conditions."""
        # Stop loss hit
        if candle["low"] <= position["stop_loss"]:
            return "STOP_LOSS"
        # Target hit
        if candle["high"] >= position["target"]:
            return "TARGET"

        # Time stop (max hold)
        bars_held = idx - position["entry_index"]
        max_bars = position.get("max_hold_bars", 30)
        if bars_held >= max_bars:
            return "TIME_STOP"

        return None

    def _close_position(self, position: Dict, candle: Dict, reason: str) -> BacktestTrade:
        """Close a position and calculate P&L."""
        direction = position["direction"]
        entry_price = position["entry_price"]
        quantity = position["quantity"]
        exit_price = candle["close"]

        if reason == "STOP_LOSS":
            exit_price = position["stop_loss"]
        elif reason == "TARGET":
            exit_price = position["target"]

        if direction == "LONG":
            pnl = (exit_price - entry_price) * quantity
        else:
            pnl = (entry_price - exit_price) * quantity

        pnl_pct = (exit_price - entry_price) / entry_price if direction == "LONG" \
            else (entry_price - exit_price) / entry_price

        return BacktestTrade(
            symbol=candle.get("symbol", "UNKNOWN"),
            direction=direction,
            entry_time=str(position["entry_time"]),
            exit_time=str(candle["time"]),
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=quantity,
            strategy_id=position.get("strategy_id", "unknown"),
            regime=position.get("regime", "UNKNOWN"),
            pnl=pnl,
            pnl_pct=pnl_pct,
            exit_reason=reason,
        )

    def _compute_sharpe(self, trades: List[BacktestTrade]) -> float:
        """Compute Sharpe ratio from trade returns."""
        if len(trades) < 2:
            return 0.0
        returns = [t.pnl_pct for t in trades]
        if statistics.stdev(returns) == 0:
            return 0.0
        return statistics.mean(returns) / statistics.stdev(returns) * (252 ** 0.5)  # Annualized

    def compare_strategies(self) -> List[Dict]:
        """Compare all strategies tested so far."""
        return [r.to_dict() for r in self.results]

    def get_best_strategy(self) -> Optional[Dict]:
        """Return the best performing strategy by Sharpe ratio."""
        if not self.results:
            return None
        best = max(self.results, key=lambda r: r.sharpe_ratio)
        return best.to_dict()
