/* @ds-bundle: {"format":4,"namespace":"AutoTrading_f56db4","components":[{"name":"Badge","sourcePath":"components/core/Badge/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardBody","sourcePath":"components/core/Card/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input/Input.jsx"},{"name":"RiskMeter","sourcePath":"components/data/RiskMeter/RiskMeter.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile/StatTile.jsx"},{"name":"Table","sourcePath":"components/data/Table/Table.jsx"},{"name":"TableHeader","sourcePath":"components/data/Table/Table.jsx"},{"name":"TableBody","sourcePath":"components/data/Table/Table.jsx"},{"name":"TableRow","sourcePath":"components/data/Table/Table.jsx"},{"name":"TableHeaderCell","sourcePath":"components/data/Table/Table.jsx"},{"name":"TableCell","sourcePath":"components/data/Table/Table.jsx"},{"name":"KillSwitchButton","sourcePath":"components/feedback/KillSwitchButton/KillSwitchButton.jsx"},{"name":"StaleBadge","sourcePath":"components/feedback/StaleBadge/StaleBadge.jsx"},{"name":"TradeModeBadge","sourcePath":"components/feedback/TradeModeBadge/TradeModeBadge.jsx"},{"name":"Modal","sourcePath":"components/overlay/Modal/Modal.jsx"},{"name":"ModalHeader","sourcePath":"components/overlay/Modal/Modal.jsx"},{"name":"ModalBody","sourcePath":"components/overlay/Modal/Modal.jsx"},{"name":"ModalFooter","sourcePath":"components/overlay/Modal/Modal.jsx"},{"name":"DailyRiskCard","sourcePath":"components/trading/DailyRiskCard/DailyRiskCard.jsx"},{"name":"OptionChainGrid","sourcePath":"components/trading/OptionChainGrid/OptionChainGrid.jsx"},{"name":"PositionsTable","sourcePath":"components/trading/PositionsTable/PositionsTable.jsx"},{"name":"SafetyBar","sourcePath":"components/trading/SafetyBar/SafetyBar.jsx"}],"sourceHashes":{"components/core/Badge/Badge.jsx":"31af3a6eff73","components/core/Button/Button.jsx":"f4826711a8ee","components/core/Card/Card.jsx":"82cc6b8b2ffe","components/core/Input/Input.jsx":"e749ecd375a7","components/data/RiskMeter/RiskMeter.jsx":"5970a222b890","components/data/StatTile/StatTile.jsx":"050f9b8081c6","components/data/Table/Table.jsx":"396aa58a195f","components/feedback/KillSwitchButton/KillSwitchButton.jsx":"b84ec4906082","components/feedback/StaleBadge/StaleBadge.jsx":"95474e2a3d4d","components/feedback/TradeModeBadge/TradeModeBadge.jsx":"d1a8ef9c2f47","components/overlay/Modal/Modal.jsx":"6cb9d00f4de3","components/trading/DailyRiskCard/DailyRiskCard.jsx":"ec2f3c9536e6","components/trading/OptionChainGrid/OptionChainGrid.jsx":"e3811f4a2fe3","components/trading/PositionsTable/PositionsTable.jsx":"da19fc66fc05","components/trading/SafetyBar/SafetyBar.jsx":"893bbb4b9013","ui_kits/trading-cockpit/App.jsx":"28b8e51c7b16","ui_kits/trading-cockpit/BackfillScreen.jsx":"4f95b76e8a8d","ui_kits/trading-cockpit/BrokersScreen.jsx":"f6bc3a09bc2a","ui_kits/trading-cockpit/DashboardScreen.jsx":"e1ef80588dae","ui_kits/trading-cockpit/MiniChart.jsx":"e3bb98522472","ui_kits/trading-cockpit/PositionalScreen.jsx":"9a6dfb0774f5","ui_kits/trading-cockpit/ScalpScreen.jsx":"421cc10e6e1c","ui_kits/trading-cockpit/StrategiesScreen.jsx":"8d2ef073feeb","ui_kits/trading-cockpit/data.js":"dfc0e8d8c122"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AutoTrading_f56db4 = window.AutoTrading_f56db4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizeStyles = {
  sm: {
    padding: '2px 8px',
    fontSize: '11px'
  },
  md: {
    padding: '4px 12px',
    fontSize: 'var(--text-xs)'
  },
  lg: {
    padding: '6px 16px',
    fontSize: 'var(--text-sm)'
  }
};
const variantStyles = {
  default: {
    background: 'var(--color-border)',
    color: 'var(--color-text-tertiary)'
  },
  success: {
    background: 'color-mix(in srgb, var(--color-success) 20%, transparent)',
    color: 'var(--color-success)'
  },
  error: {
    background: 'color-mix(in srgb, var(--color-error) 20%, transparent)',
    color: 'var(--color-error)'
  },
  warning: {
    background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)',
    color: 'var(--color-warning)'
  },
  info: {
    background: 'color-mix(in srgb, var(--color-info) 20%, transparent)',
    color: 'var(--color-info)'
  }
};

/** Badge — small status/label pill. Variants: default, success, error, warning, info. */
function Badge({
  variant = 'default',
  size = 'md',
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-xl)',
      fontWeight: 'var(--font-weight-semibold)',
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font-sans)',
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style
    }
  }, props), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizeStyles = {
  sm: {
    padding: '6px 12px',
    fontSize: 'var(--text-sm)'
  },
  md: {
    padding: '10px 20px',
    fontSize: 'var(--text-base)'
  },
  lg: {
    padding: '14px 28px',
    fontSize: 'var(--text-lg)'
  }
};
const variantStyles = {
  primary: {
    background: 'linear-gradient(to bottom right, var(--color-primary), var(--color-accent))',
    color: '#fff'
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)'
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-primary)',
    border: '2px solid var(--color-primary)'
  },
  danger: {
    background: 'linear-gradient(to bottom right, var(--color-error), #DC2626)',
    color: '#fff'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-tertiary)'
  }
};

/** Button — primary UI action. Variants: primary, secondary, outline, danger, ghost. Sizes: sm, md, lg. */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  type = 'button',
  style,
  ...props
}) {
  const busy = disabled || loading;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    onClick: onClick,
    disabled: busy,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      border: 'none',
      borderRadius: 'var(--radius-lg)',
      cursor: busy ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--font-weight-medium)',
      transition: `all var(--duration-base) var(--ease-standard)`,
      opacity: busy ? 0.5 : 1,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style
    }
  }, props), loading && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '2px solid transparent',
      borderTopColor: 'currentColor',
      animation: 'auto-trading-spin 0.7s linear infinite'
    }
  }), children, /*#__PURE__*/React.createElement("style", null, `@keyframes auto-trading-spin { to { transform: rotate(360deg); } }`));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const variantStyles = {
  default: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)'
  },
  glass: {
    background: 'color-mix(in srgb, var(--color-surface) 70%, transparent)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  outlined: {
    background: 'transparent',
    border: '2px solid var(--color-border)'
  }
};
const paddingStyles = {
  none: '0',
  sm: '12px',
  md: '20px',
  lg: '28px'
};

/** Card — surface container. Variants: default, glass, outlined. */
function Card({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: 'var(--radius-xl)',
      transition: `all var(--duration-slow) var(--ease-standard)`,
      padding: paddingStyles[padding],
      cursor: hoverable ? 'pointer' : undefined,
      ...variantStyles[variant],
      ...style
    }
  }, props), children);
}
function CardHeader({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottom: '1px solid var(--color-border)',
      ...style
    }
  }, props), children);
}
function CardBody({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      color: 'var(--color-text-secondary)',
      ...style
    }
  }, props), children);
}
function CardFooter({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      marginTop: 16,
      paddingTop: 12,
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      ...style
    }
  }, props), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardBody, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Input — labeled text field with error/helper text support. */
function Input({
  type = 'text',
  label,
  error,
  helperText,
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  id,
  style,
  ...props
}) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: '100%',
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-weight-medium)',
      color: 'var(--color-text-tertiary)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-error)',
      marginLeft: 4
    }
  }, "*")), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    required: required,
    style: {
      padding: '10px 14px',
      border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-lg)',
      background: 'var(--color-surface)',
      color: 'var(--color-text-primary)',
      fontSize: 'var(--text-sm)',
      fontFamily: 'inherit',
      opacity: disabled ? 0.5 : 1,
      outline: 'none',
      ...style
    }
  }, props)), error && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-error)',
      margin: 0
    }
  }, error), !error && helperText && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)',
      margin: 0
    }
  }, helperText));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input/Input.jsx", error: String((e && e.message) || e) }); }

// components/data/RiskMeter/RiskMeter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const RAMPS = {
  safe: {
    fill: 'var(--color-primary)',
    track: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
    text: 'var(--color-text-secondary)',
    word: 'Within limits'
  },
  warn: {
    fill: 'var(--color-warning)',
    track: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
    text: 'var(--color-warning)',
    word: 'Approaching limit'
  },
  danger: {
    fill: 'var(--color-error)',
    track: 'color-mix(in srgb, var(--color-error) 20%, transparent)',
    text: 'var(--color-error)',
    word: 'Limit reached'
  }
};
function severityFor(pct) {
  if (pct >= 100) return 'danger';
  if (pct >= 70) return 'warn';
  return 'safe';
}

/** RiskMeter — fill carries severity (primary -> warning -> error); severity is also stated in words. */
function RiskMeter({
  label,
  used,
  limit,
  formatValue,
  invertWords,
  style,
  ...props
}) {
  const known = Number.isFinite(used) && Number.isFinite(limit) && limit > 0;
  const rawPct = known ? used / limit * 100 : null;
  const pct = known ? Math.min(100, Math.max(0, rawPct)) : 0;
  const severity = known ? severityFor(rawPct) : 'safe';
  const ramp = RAMPS[severity];
  const fmt = formatValue || (v => Number.isFinite(v) ? String(v) : '—');
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)',
      color: 'var(--color-text-tertiary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-primary)'
    }
  }, known ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: severity === 'safe' ? undefined : ramp.text
    }
  }, fmt(used)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-tertiary)'
    }
  }, " / ", fmt(limit))) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-tertiary)'
    }
  }, "\u2014"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      width: '100%',
      borderRadius: 'var(--radius-full)',
      overflow: 'hidden',
      background: ramp.track
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      borderRadius: 'var(--radius-full)',
      background: ramp.fill,
      width: `${pct}%`,
      transition: 'width 0.5s'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: known ? ramp.text : 'var(--color-text-tertiary)'
    }
  }, known ? `${Math.round(rawPct)}% · ${invertWords?.[severity] || ramp.word}` : 'No data from engine'));
}
Object.assign(__ds_scope, { RiskMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RiskMeter/RiskMeter.jsx", error: String((e && e.message) || e) }); }

// components/data/StatTile/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const toneColor = {
  neutral: 'var(--color-text-primary)',
  positive: 'var(--color-success)',
  negative: 'var(--color-error)',
  warning: 'var(--color-warning)'
};

/** StatTile — label / value / optional delta. Unknown values render as an em-dash, never a confident 0. */
function StatTile({
  label,
  value,
  tone = 'neutral',
  delta,
  deltaLabel,
  deltaTone = 'neutral',
  icon,
  footnote,
  style,
  ...props
}) {
  const isEmpty = value === null || value === undefined || value === '—';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: 'var(--color-text-tertiary)',
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, icon), /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-weight-semibold)',
      lineHeight: 'var(--leading-tight)',
      color: isEmpty ? 'var(--color-text-tertiary)' : toneColor[tone]
    }
  }, isEmpty ? '—' : value), delta !== undefined && delta !== null && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      fontSize: 'var(--text-xs)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: toneColor[deltaTone]
    }
  }, delta), deltaLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-tertiary)'
    }
  }, deltaLabel)), footnote && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)',
      marginTop: 2
    }
  }, footnote));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatTile/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/data/Table/Table.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Table — thin styled wrapper around native table elements sharing the trading-portal look. */
function Table({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("table", _extends({
    style: {
      width: '100%',
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-sans)',
      borderCollapse: 'collapse',
      ...style
    }
  }, props), children);
}
function TableHeader({
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("thead", props, children);
}
function TableBody({
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("tbody", props, children);
}
function TableRow({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("tr", _extends({
    style: {
      borderBottom: '1px solid var(--color-border)',
      ...style
    }
  }, props), children);
}
function TableHeaderCell({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("th", _extends({
    style: {
      textAlign: 'left',
      padding: '12px 16px',
      color: 'var(--color-text-tertiary)',
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)',
      fontWeight: 'var(--font-weight-semibold)',
      ...style
    }
  }, props), children);
}
function TableCell({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("td", _extends({
    style: {
      padding: '12px 16px',
      color: 'var(--color-text-secondary)',
      ...style
    }
  }, props), children);
}
Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.HeaderCell = TableHeaderCell;
Table.Cell = TableCell;
Object.assign(__ds_scope, { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/KillSwitchButton/KillSwitchButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * KillSwitchButton — U1: the kill switch is always one click away.
 * Halting requires one confirmation; resuming requires typing a phrase (the
 * dangerous direction after a daily-loss circuit-breaker trip).
 */
function KillSwitchButton({
  active = false,
  onToggle,
  style,
  ...props
}) {
  const [confirming, setConfirming] = useState(false);
  const halted = active;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-block'
    }
  }, /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: () => setConfirming(true),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      borderRadius: 'var(--radius-lg)',
      border: 'none',
      fontWeight: 'var(--font-weight-bold)',
      fontSize: 'var(--text-sm)',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      background: halted ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : 'var(--color-error)',
      color: halted ? 'var(--color-warning)' : '#fff',
      border: halted ? '1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)' : 'none',
      boxShadow: halted ? 'none' : 'var(--shadow-md)',
      ...style
    }
  }, props), halted ? '▶ HALTED — Resume' : '⛔ KILL'), confirming && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '110%',
      right: 0,
      zIndex: 50,
      width: 260,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-2xl)',
      padding: 16,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--font-weight-bold)',
      color: 'var(--color-text-primary)',
      marginBottom: 8
    }
  }, halted ? 'Resume trading?' : 'Halt all trading?'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-secondary)',
      marginBottom: 12
    }
  }, halted ? 'New entries will be allowed again. Confirm the loss limit first.' : 'No new entries will be taken; open positions square off at market.'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirming(false),
    style: {
      padding: '6px 12px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      fontSize: 'var(--text-xs)',
      cursor: 'pointer'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onToggle && onToggle();
      setConfirming(false);
    },
    style: {
      padding: '6px 12px',
      borderRadius: 'var(--radius-md)',
      border: 'none',
      background: 'var(--color-error)',
      color: '#fff',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-weight-bold)',
      cursor: 'pointer'
    }
  }, halted ? 'Resume' : 'Halt'))));
}
Object.assign(__ds_scope, { KillSwitchButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/KillSwitchButton/KillSwitchButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StaleBadge/StaleBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
function levelFor(ts, warnAfter = 30, staleAfter = 120) {
  if (!ts) return 'unknown';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s >= staleAfter) return 'stale';
  if (s >= warnAfter) return 'warn';
  return 'fresh';
}
const dotColor = {
  fresh: 'var(--color-success)',
  warn: 'var(--color-warning)',
  stale: 'var(--color-error)',
  unknown: 'var(--color-text-tertiary)'
};
const textColor = {
  fresh: 'var(--color-text-tertiary)',
  warn: 'var(--color-warning)',
  stale: 'var(--color-error)',
  unknown: 'var(--color-text-tertiary)'
};

/**
 * StaleBadge — announces data freshness in words + color.
 * fresh (<30s) quiet · warn (>=30s) amber · stale (>=2min) red + explicit warning.
 */
function StaleBadge({
  timestamp,
  warnAfter,
  staleAfter,
  label,
  style,
  ...props
}) {
  const level = levelFor(timestamp, warnAfter, staleAfter);
  const text = level === 'unknown' ? 'no data' : level === 'stale' ? `STALE — ${timeAgo(timestamp)} · do not trade on this` : `updated ${timeAgo(timestamp)}`;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-xs)',
      fontFamily: 'var(--font-sans)',
      color: textColor[level],
      fontWeight: level === 'stale' ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: dotColor[level]
    }
  }), text);
}
Object.assign(__ds_scope, { StaleBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StaleBadge/StaleBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/TradeModeBadge/TradeModeBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const MODES = {
  paper: {
    label: 'PAPER',
    bg: 'var(--color-surface)',
    border: 'var(--color-border)',
    color: 'var(--color-text-secondary)'
  },
  shadow: {
    label: 'SHADOW',
    bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
    border: 'color-mix(in srgb, var(--color-warning) 40%, transparent)',
    color: 'var(--color-warning)'
  },
  live: {
    label: 'LIVE',
    bg: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
    border: 'var(--color-error)',
    color: 'var(--color-error)'
  },
  unknown: {
    label: 'MODE UNKNOWN',
    bg: 'var(--color-surface)',
    border: 'var(--color-border)',
    color: 'var(--color-text-tertiary)'
  }
};

/** TradeModeBadge — always-visible indicator of paper / shadow / live execution mode. */
function TradeModeBadge({
  mode,
  style,
  ...props
}) {
  const key = mode && MODES[mode] ? mode : 'unknown';
  const m = MODES[key];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${m.border}`,
      background: m.bg,
      color: m.color,
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-weight-bold)',
      letterSpacing: 'var(--tracking-wider)',
      fontFamily: 'var(--font-sans)',
      animation: key === 'live' ? 'auto-trading-pulse 1.6s ease-in-out infinite' : undefined,
      ...style
    }
  }, props), m.label, /*#__PURE__*/React.createElement("style", null, `@keyframes auto-trading-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }`));
}
Object.assign(__ds_scope, { TradeModeBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/TradeModeBadge/TradeModeBadge.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Modal/Modal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useEffect,
  useState
} = React;
/** Modal — centered dialog with backdrop blur and scale/fade transition. */
function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  style,
  ...props
}) {
  const [render, setRender] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setRender(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
    const t = setTimeout(() => setRender(false), 300);
    return () => clearTimeout(t);
  }, [isOpen]);
  if (!render) return null;
  const widths = {
    sm: 420,
    md: 520,
    lg: 720,
    xl: 960
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 300ms'
    }
  }), /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: '100%',
      maxWidth: widths[size] || widths.md,
      transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
      opacity: visible ? 1 : 0,
      transition: 'all 300ms',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-2xl)',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)'
    }
  }, children)));
}
function ModalHeader({
  children,
  onClose,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: 16,
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--font-weight-bold)',
      fontSize: 'var(--text-lg)',
      color: 'var(--color-text-primary)'
    }
  }, children), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: 'transparent',
      border: 'none',
      color: 'var(--color-text-tertiary)',
      cursor: 'pointer',
      fontSize: 16
    }
  }, "\u2715"));
}
function ModalBody({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: 16,
      overflowY: 'auto',
      flex: 1,
      ...style
    }
  }, props), children);
}
function ModalFooter({
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: 16,
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      ...style
    }
  }, props), children);
}
Object.assign(__ds_scope, { Modal, ModalHeader, ModalBody, ModalFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Modal/Modal.jsx", error: String((e && e.message) || e) }); }

// components/trading/DailyRiskCard/DailyRiskCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** DailyRiskCard — daily risk envelope: loss vs circuit breaker + trades-today meters. */
function DailyRiskCard({
  dailyLoss,
  maxDailyLoss,
  tradesToday,
  maxTrades,
  halted,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 20,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)',
      margin: 0
    }
  }, "Daily risk envelope"), halted && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-weight-bold)',
      color: 'var(--color-error)'
    }
  }, "HALTED")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.RiskMeter, {
    label: "Daily loss vs circuit breaker",
    used: dailyLoss,
    limit: maxDailyLoss,
    formatValue: v => `₹${v.toLocaleString('en-IN')}`,
    invertWords: {
      danger: 'Circuit breaker tripped — trading halted'
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.RiskMeter, {
    label: "Trades today",
    used: tradesToday,
    limit: maxTrades
  })));
}
Object.assign(__ds_scope, { DailyRiskCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/trading/DailyRiskCard/DailyRiskCard.jsx", error: String((e && e.message) || e) }); }

// components/trading/OptionChainGrid/OptionChainGrid.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function fmt(n, d = 2) {
  return n != null ? Number(n).toFixed(d) : '—';
}
function spreadPct(ask, bid) {
  return ask && bid && ask > 0 ? ((ask - bid) / ask * 100).toFixed(1) + '%' : '—';
}

/** OptionChainGrid — CALLS | STRIKE | PUTS ladder, ATM row highlighted, spreads colored by width. */
function OptionChainGrid({
  rows = [],
  spot,
  atm,
  expiry,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)'
    }
  }, "Option Chain"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, "Spot: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-primary)'
    }
  }, spot ?? '—'))), expiry && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, expiry)), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      fontSize: 'var(--text-xs)',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '1px solid var(--color-border)',
      color: 'var(--color-text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 6px',
      textAlign: 'right'
    }
  }, "LTP"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 6px',
      textAlign: 'right'
    }
  }, "OI"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 6px',
      textAlign: 'center',
      borderRight: '1px solid var(--color-border)',
      borderLeft: '1px solid var(--color-border)',
      color: 'var(--color-text-primary)'
    }
  }, "STRIKE"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 6px',
      textAlign: 'left'
    }
  }, "OI"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 6px',
      textAlign: 'left'
    }
  }, "LTP"))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.strike || i,
    style: {
      borderBottom: '1px solid var(--color-border)',
      background: r.strike === atm ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : undefined
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '4px 6px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      color: r.ce ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
    }
  }, r.ce ? fmt(r.ce.ltp) : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '4px 6px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--color-text-secondary)'
    }
  }, r.ce ? r.ce.oi?.toLocaleString() : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '4px 6px',
      textAlign: 'center',
      borderRight: '1px solid var(--color-border)',
      borderLeft: '1px solid var(--color-border)',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: r.strike === atm ? 'var(--color-warning)' : 'var(--color-text-primary)',
      fontWeight: r.strike === atm ? 'var(--font-weight-bold)' : undefined
    }
  }, r.strike), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '4px 6px',
      textAlign: 'left',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--color-text-secondary)'
    }
  }, r.pe ? r.pe.oi?.toLocaleString() : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '4px 6px',
      textAlign: 'left',
      fontVariantNumeric: 'tabular-nums',
      color: r.pe ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
    }
  }, r.pe ? fmt(r.pe.ltp) : '—'))))), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 32,
      color: 'var(--color-text-tertiary)',
      fontSize: 'var(--text-sm)'
    }
  }, "No option chain data.")));
}
Object.assign(__ds_scope, { OptionChainGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/trading/OptionChainGrid/OptionChainGrid.jsx", error: String((e && e.message) || e) }); }

// components/trading/PositionsTable/PositionsTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** PositionsTable — open-position book. Numeric cols tabular; SL shown loudly when missing. */
function PositionsTable({
  positions = [],
  style,
  ...props
}) {
  if (positions.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'center',
        padding: 32,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)'
      }
    }, "No open positions.");
  }
  const cell = {
    padding: '10px 12px',
    fontSize: 'var(--text-sm)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      overflowX: 'auto',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      textAlign: 'left',
      color: 'var(--color-text-tertiary)',
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)',
      borderBottom: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: cell
  }, "Contract"), /*#__PURE__*/React.createElement("th", {
    style: cell
  }, "Size"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...cell,
      textAlign: 'right'
    }
  }, "LTP"), /*#__PURE__*/React.createElement("th", {
    style: cell
  }, "Stop"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...cell,
      textAlign: 'right'
    }
  }, "P&L"))), /*#__PURE__*/React.createElement("tbody", null, positions.map(p => {
    const hasStop = Number.isFinite(p.stopLoss) && p.stopLoss > 0;
    const up = p.pnl > 0,
      down = p.pnl < 0;
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id,
      style: {
        borderBottom: '1px solid var(--color-border)'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: cell
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-primary)'
      }
    }, p.symbol), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--text-xs)',
        color: p.optionType === 'CE' ? 'var(--color-success)' : 'var(--color-error)'
      }
    }, p.optionType)), /*#__PURE__*/React.createElement("td", {
      style: {
        ...cell,
        color: 'var(--color-text-secondary)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, p.lots, " lot", p.lots === 1 ? '' : 's'), /*#__PURE__*/React.createElement("td", {
      style: {
        ...cell,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--color-text-primary)'
      }
    }, p.currentPrice), /*#__PURE__*/React.createElement("td", {
      style: cell
    }, hasStop ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--color-text-primary)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, p.stopLoss) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--color-error)',
        fontWeight: 'var(--font-weight-bold)'
      }
    }, "NO STOP")), /*#__PURE__*/React.createElement("td", {
      style: {
        ...cell,
        textAlign: 'right',
        fontWeight: 'var(--font-weight-semibold)',
        fontVariantNumeric: 'tabular-nums',
        color: up ? 'var(--color-success)' : down ? 'var(--color-error)' : 'var(--color-text-secondary)'
      }
    }, p.pnl > 0 ? '+' : '', p.pnl));
  }))));
}
Object.assign(__ds_scope, { PositionsTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/trading/PositionsTable/PositionsTable.jsx", error: String((e && e.message) || e) }); }

// components/trading/SafetyBar/SafetyBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** SafetyBar — sticky always-visible header: underlying + spot + trade mode + kill switch. */
function SafetyBar({
  underlying = 'NIFTY',
  spot,
  tradeModeBadge,
  killSwitchButton,
  staleBadge,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-primary)',
      fontSize: 'var(--text-sm)',
      borderRadius: 'var(--radius-md)',
      padding: '4px 8px'
    }
  }, underlying), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-weight-bold)',
      color: 'var(--color-text-primary)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, spot ?? '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), tradeModeBadge, staleBadge, killSwitchButton);
}
Object.assign(__ds_scope, { SafetyBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/trading/SafetyBar/SafetyBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/App.jsx
try { (() => {
function App() {
  const [tab, setTab] = React.useState('dashboard');
  const tabs = [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'layout-dashboard',
    Screen: window.DashboardScreen
  }, {
    id: 'scalp',
    label: 'Scalp',
    icon: 'zap',
    Screen: window.ScalpScreen
  }, {
    id: 'positional',
    label: 'Positional',
    icon: 'layers',
    Screen: window.PositionalScreen
  }, {
    id: 'backfill',
    label: 'Backfill',
    icon: 'database',
    Screen: window.BackfillScreen
  }, {
    id: 'brokers',
    label: 'Brokers',
    icon: 'key',
    Screen: window.BrokersScreen
  }, {
    id: 'strategies',
    label: 'Strategies',
    icon: 'target',
    Screen: window.StrategiesScreen
  }, {
    id: 'risk',
    label: 'Risk',
    icon: 'shield',
    Screen: window.RiskConfigScreen
  }];
  const Active = tabs.find(t => t.id === tab).Screen;
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [tab]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      margin: '0 auto',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-background)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Active, null)), /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      bottom: 0,
      display: 'flex',
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-2xl)'
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => setTab(t.id),
    style: {
      flex: 1,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '10px 0 8px',
      color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": t.icon
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: tab === t.id ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)'
    }
  }, t.label)))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
setTimeout(() => window.lucide && window.lucide.createIcons(), 50);
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/BackfillScreen.jsx
try { (() => {
function BackfillScreen() {
  const {
    Button,
    Card,
    Badge
  } = window.AutoTrading_f56db4;
  const {
    backfillSymbols
  } = window.MOCK;
  const [running, setRunning] = React.useState(true);
  const [progress, setProgress] = React.useState(62);
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setProgress(p => p >= 100 ? 100 : p + 1), 400);
    return () => clearInterval(t);
  }, [running]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      paddingBottom: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "database",
    style: {
      color: 'var(--color-info)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0
    }
  }, "Backfill Data")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-tertiary)',
      margin: 0
    }
  }, "Pull historical candles into the database for symbols the strategies need. Safe to re-run \u2014 existing candles are skipped."), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'var(--font-weight-semibold)'
    }
  }, "Nifty 50 \xB7 1m candles"), /*#__PURE__*/React.createElement(Badge, {
    variant: progress >= 100 ? 'success' : 'info',
    size: "sm"
  }, progress >= 100 ? 'Completed' : 'Running')), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: 'var(--radius-full)',
      background: 'var(--color-border)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${progress}%`,
      background: 'var(--color-primary)',
      transition: 'width 0.4s'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, progress, "% \xB7 ", backfillSymbols.length, " symbols"), /*#__PURE__*/React.createElement("span", null, "ETA ", Math.max(0, Math.round((100 - progress) / 5)), "m")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: running ? 'secondary' : 'primary',
    size: "sm",
    onClick: () => setRunning(r => !r)
  }, running ? 'Pause' : 'Resume'), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setProgress(0)
  }, "Restart"))), /*#__PURE__*/React.createElement(Card, {
    padding: "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border)',
      fontWeight: 'var(--font-weight-semibold)'
    }
  }, "Symbol status"), /*#__PURE__*/React.createElement("div", null, backfillSymbols.map((s, i) => {
    const done = i / backfillSymbols.length * 100 < progress;
    return /*#__PURE__*/React.createElement("div", {
      key: s,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: i < backfillSymbols.length - 1 ? '1px solid var(--color-border)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-primary)'
      }
    }, s), done ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--color-success)',
        fontSize: 'var(--text-xs)'
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": "check-circle-2"
    }), "Backfilled") : /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-xs)'
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": "loader-2",
      style: {
        animation: 'spin 1s linear infinite'
      }
    }), "Queued"));
  }))), /*#__PURE__*/React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`));
}
window.BackfillScreen = BackfillScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/BackfillScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/BrokersScreen.jsx
try { (() => {
function BrokersScreen() {
  const {
    Button,
    Card,
    Badge,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input
  } = window.AutoTrading_f56db4;
  const [brokers, setBrokers] = React.useState(window.MOCK.brokers);
  const [showAdd, setShowAdd] = React.useState(false);
  const user = window.CURRENT_USER;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      paddingBottom: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "key",
    style: {
      color: 'var(--color-accent)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0
    }
  }, "Broker Connections")), /*#__PURE__*/React.createElement(Card, {
    padding: "sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: 'var(--color-accent)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'var(--font-weight-bold)',
      flexShrink: 0
    }
  }, user.name[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, user.email, " \xB7 Account ", user.accountId)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, "Credentials below apply only to this account.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, brokers.map(b => /*#__PURE__*/React.createElement(Card, {
    key: b.id,
    padding: "sm"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)'
    }
  }, b.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, b.accountId || 'Not linked')), /*#__PURE__*/React.createElement(Badge, {
    size: "sm",
    variant: b.status === 'connected' ? 'success' : 'default'
  }, b.status === 'connected' ? 'Connected' : 'Disconnected')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTop: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, "Mode: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-primary)',
      textTransform: 'uppercase'
    }
  }, b.mode)), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: b.status === 'connected' ? 'secondary' : 'primary'
  }, b.status === 'connected' ? 'Manage' : 'Connect'))))), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => setShowAdd(true)
  }, "+ Add broker"), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showAdd,
    onClose: () => setShowAdd(false),
    size: "sm"
  }, /*#__PURE__*/React.createElement(ModalHeader, {
    onClose: () => setShowAdd(false)
  }, "Add broker"), /*#__PURE__*/React.createElement(ModalBody, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Broker",
    placeholder: "e.g. Angel One"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "API key",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "API secret",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    helperText: `Stored encrypted, scoped to ${user.name}'s account only`
  }))), /*#__PURE__*/React.createElement(ModalFooter, null, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowAdd(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => setShowAdd(false)
  }, "Save & test connection"))));
}
window.BrokersScreen = BrokersScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/BrokersScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/DashboardScreen.jsx
try { (() => {
function DashboardScreen() {
  window.useLiveTick();
  const {
    niftySeries,
    bankniftySeries,
    watchlist,
    signals
  } = window.MOCK;
  const {
    StatTile,
    Table,
    Badge,
    Card
  } = window.AutoTrading_f56db4;
  const niftyChg = ((niftySeries.at(-1) - niftySeries[0]) / niftySeries[0] * 100).toFixed(2);
  const bnChg = ((bankniftySeries.at(-1) - bankniftySeries[0]) / bankniftySeries[0] * 100).toFixed(2);
  const advances = watchlist.filter(w => w.chg > 0).length;
  const declines = watchlist.length - advances;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      paddingBottom: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "activity",
    style: {
      color: 'var(--color-primary)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0
    }
  }, "Market Dashboard")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, [{
    label: 'NIFTY 50',
    series: niftySeries,
    chg: niftyChg
  }, {
    label: 'BANK NIFTY',
    series: bankniftySeries,
    chg: bnChg
  }].map(idx => /*#__PURE__*/React.createElement("div", {
    key: idx.label,
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)'
    }
  }, idx.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-weight-semibold)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, idx.series.at(-1).toFixed(2)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: idx.chg >= 0 ? 'var(--color-success)' : 'var(--color-error)'
    }
  }, idx.chg >= 0 ? '+' : '', idx.chg, "%")), /*#__PURE__*/React.createElement(MiniChart, {
    data: idx.series,
    height: 56,
    color: idx.chg >= 0 ? 'var(--color-success)' : 'var(--color-error)'
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Market Sentiment",
    value: "Bullish",
    tone: "positive",
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "trending-up"
    })
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Advance / Decline",
    value: `${advances} / ${declines}`,
    tone: advances >= declines ? 'positive' : 'negative',
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "bar-chart-2"
    })
  })), /*#__PURE__*/React.createElement(Card, {
    padding: "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border)',
      fontWeight: 'var(--font-weight-semibold)'
    }
  }, "Watchlist"), /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement(Table.Header, null, /*#__PURE__*/React.createElement(Table.Row, null, /*#__PURE__*/React.createElement(Table.HeaderCell, null, "Symbol"), /*#__PURE__*/React.createElement(Table.HeaderCell, {
    style: {
      textAlign: 'right'
    }
  }, "LTP"), /*#__PURE__*/React.createElement(Table.HeaderCell, {
    style: {
      textAlign: 'right'
    }
  }, "Chg%"), /*#__PURE__*/React.createElement(Table.HeaderCell, {
    style: {
      textAlign: 'center'
    }
  }, "RSI"))), /*#__PURE__*/React.createElement(Table.Body, null, watchlist.map(w => /*#__PURE__*/React.createElement(Table.Row, {
    key: w.symbol
  }, /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      fontWeight: 'var(--font-weight-medium)',
      color: 'var(--color-text-primary)'
    }
  }, w.symbol), /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u20B9", w.ltp.toFixed(2)), /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      color: w.chg >= 0 ? 'var(--color-success)' : 'var(--color-error)',
      fontWeight: 'var(--font-weight-semibold)'
    }
  }, w.chg >= 0 ? '+' : '', w.chg, "%"), /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    size: "sm",
    variant: w.rsi > 70 ? 'error' : w.rsi < 30 ? 'success' : 'default'
  }, w.rsi))))))), /*#__PURE__*/React.createElement(Card, {
    padding: "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border)',
      fontWeight: 'var(--font-weight-semibold)'
    }
  }, "Live Signals"), /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement(Table.Header, null, /*#__PURE__*/React.createElement(Table.Row, null, /*#__PURE__*/React.createElement(Table.HeaderCell, null, "Time"), /*#__PURE__*/React.createElement(Table.HeaderCell, null, "Symbol"), /*#__PURE__*/React.createElement(Table.HeaderCell, null, "Action"), /*#__PURE__*/React.createElement(Table.HeaderCell, null, "Strategy"))), /*#__PURE__*/React.createElement(Table.Body, null, signals.map((s, i) => /*#__PURE__*/React.createElement(Table.Row, {
    key: i
  }, /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--color-text-tertiary)'
    }
  }, s.time), /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      fontWeight: 'var(--font-weight-medium)'
    }
  }, s.symbol), /*#__PURE__*/React.createElement(Table.Cell, null, /*#__PURE__*/React.createElement(Badge, {
    size: "sm",
    variant: s.action === 'BUY' ? 'success' : 'error'
  }, s.action)), /*#__PURE__*/React.createElement(Table.Cell, {
    style: {
      color: 'var(--color-text-tertiary)',
      fontSize: 'var(--text-xs)'
    }
  }, s.strategy)))))));
}
window.DashboardScreen = DashboardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/MiniChart.jsx
try { (() => {
// Lightweight canvas sparkline/candle chart — no chart library dependency.
function MiniChart({
  data = [],
  height = 120,
  color = 'var(--color-primary)',
  kind = 'line'
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || data.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth,
      h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const min = Math.min(...data),
      max = Math.max(...data);
    const range = max - min || 1;
    const pad = 8;
    const x = i => pad + i / (data.length - 1) * (w - pad * 2);
    const y = v => h - pad - (v - min) / range * (h - pad * 2);
    const resolved = getComputedStyle(canvas).getPropertyValue('--resolved-color') || color;

    // gradient fill under line
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colorWithAlpha(color, 0.25));
    grad.addColorStop(1, colorWithAlpha(color, 0));
    ctx.beginPath();
    data.forEach((v, i) => i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(data.length - 1), h - pad);
    ctx.lineTo(x(0), h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    data.forEach((v, i) => i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)));
    ctx.strokeStyle = getCssColor(color);
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [data, height, color]);
  function getCssColor(v) {
    if (!v.startsWith('var(')) return v;
    const varName = v.slice(4, -1);
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#3B82F6';
  }
  function colorWithAlpha(v, a) {
    const c = getCssColor(v);
    if (c.startsWith('#')) {
      const r = parseInt(c.slice(1, 3), 16),
        g = parseInt(c.slice(3, 5), 16),
        b = parseInt(c.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return c;
  }
  return /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    style: {
      width: '100%',
      height,
      display: 'block'
    }
  });
}
window.MiniChart = MiniChart;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/MiniChart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/PositionalScreen.jsx
try { (() => {
function PositionalScreen() {
  const {
    DailyRiskCard,
    Badge,
    Card,
    StatTile
  } = window.AutoTrading_f56db4;
  const {
    positions
  } = window.MOCK;
  const totalTheta = positions.reduce((s, p) => s + p.theta * p.lots, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const netDelta = positions.reduce((s, p) => s + p.delta * p.lots, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      paddingBottom: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "layers",
    style: {
      color: 'var(--color-accent)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0
    }
  }, "Positional \u2014 Option Selling")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Net P&L",
    value: `₹${totalPnl.toLocaleString('en-IN')}`,
    tone: totalPnl >= 0 ? 'positive' : 'negative'
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Theta / day",
    value: `₹${Math.round(totalTheta).toLocaleString('en-IN')}`,
    tone: "positive",
    footnote: "Decay works for a seller"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Net Delta",
    value: netDelta.toFixed(2),
    tone: Math.abs(netDelta) > 1 ? 'warning' : 'neutral'
  })), /*#__PURE__*/React.createElement(DailyRiskCard, {
    dailyLoss: 4200,
    maxDailyLoss: 10000,
    tradesToday: 4,
    maxTrades: 10
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, positions.map(p => {
    const ageMin = Math.round((Date.now() - p.entryTime) / 60000);
    return /*#__PURE__*/React.createElement(Card, {
      key: p.id,
      padding: "sm"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)'
      }
    }, p.symbol), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)'
      }
    }, "Sold ", p.lots, " lot", p.lots > 1 ? 's' : '', " \xB7 ", ageMin, "m ago")), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 'var(--font-weight-bold)',
        fontVariantNumeric: 'tabular-nums',
        color: p.pnl >= 0 ? 'var(--color-success)' : 'var(--color-error)'
      }
    }, p.pnl >= 0 ? '+' : '', "\u20B9", p.pnl), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)'
      }
    }, p.pnlPct >= 0 ? '+' : '', p.pnlPct, "%"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid var(--color-border)',
        fontSize: 'var(--text-xs)'
      }
    }, /*#__PURE__*/React.createElement(Greek, {
      label: "IV",
      value: `${p.iv}%`
    }), /*#__PURE__*/React.createElement(Greek, {
      label: "Theta",
      value: p.theta,
      accent: "var(--color-success)"
    }), /*#__PURE__*/React.createElement(Greek, {
      label: "Delta",
      value: p.delta
    }), /*#__PURE__*/React.createElement(Greek, {
      label: "Stop",
      value: p.stopLoss ? `₹${p.stopLoss}` : 'NO STOP',
      accent: p.stopLoss ? undefined : 'var(--color-error)',
      bold: !p.stopLoss
    })));
  })));
}
function Greek({
  label,
  value,
  accent,
  bold
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--color-text-tertiary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      color: accent || 'var(--color-text-primary)',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: bold ? 'var(--font-weight-bold)' : undefined
    }
  }, value));
}
window.PositionalScreen = PositionalScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/PositionalScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/ScalpScreen.jsx
try { (() => {
function ScalpScreen() {
  window.useLiveTick();
  const {
    SafetyBar,
    TradeModeBadge,
    StaleBadge,
    KillSwitchButton,
    OptionChainGrid,
    Badge,
    Card
  } = window.AutoTrading_f56db4;
  const [underlying, setUnderlying] = React.useState('NIFTY');
  const [timeframe, setTimeframe] = React.useState('1m');
  const [direction, setDirection] = React.useState('LONG');
  const [halted, setHalted] = React.useState(false);
  const spot = underlying === 'NIFTY' ? window.MOCK.niftySeries.at(-1) : window.MOCK.bankniftySeries.at(-1);
  const series = underlying === 'NIFTY' ? window.MOCK.niftySeries : window.MOCK.bankniftySeries;
  const rows = React.useMemo(() => window.MOCK.chainRows(spot), [underlying]);
  const atm = Math.round(spot / 50) * 50;
  const intent = {
    nfoSymbol: `${underlying}${atm}${direction === 'LONG' ? 'CE' : 'PE'}`,
    premium: direction === 'LONG' ? 128.4 : 64.1,
    lots: 2,
    lotSize: underlying === 'NIFTY' ? 25 : 15,
    sl: direction === 'LONG' ? 95 : 82,
    target: direction === 'LONG' ? 172 : 40
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement(SafetyBar, {
    underlying: underlying,
    spot: spot.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    tradeModeBadge: /*#__PURE__*/React.createElement(TradeModeBadge, {
      mode: "live"
    }),
    staleBadge: /*#__PURE__*/React.createElement(StaleBadge, {
      timestamp: new Date().toISOString()
    }),
    killSwitchButton: /*#__PURE__*/React.createElement(KillSwitchButton, {
      active: halted,
      onToggle: () => setHalted(h => !h)
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, ['NIFTY', 'BANKNIFTY'].map(u => /*#__PURE__*/React.createElement("button", {
    key: u,
    onClick: () => setUnderlying(u),
    style: pill(u === underlying)
  }, u)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), ['1m', '5m', '15m', '1h'].map(tf => /*#__PURE__*/React.createElement("button", {
    key: tf,
    onClick: () => setTimeframe(tf),
    style: pill(tf === timeframe, true)
  }, tf))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(MiniChart, {
    data: series,
    height: 140,
    color: "var(--color-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, "Day P&L"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-weight-bold)',
      color: 'var(--color-success)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "+\u20B91,100")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, "Session"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-warning)',
      fontFamily: 'var(--font-mono)'
    }
  }, "E: 00:24 \xB7 S: 00:39"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: '46vh',
      overflowY: 'auto',
      borderRadius: 'var(--radius-xl)'
    }
  }, /*#__PURE__*/React.createElement(OptionChainGrid, {
    rows: rows,
    spot: spot.toFixed(2),
    atm: atm,
    expiry: "25 Jul (0d, weekly)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-weight-semibold)'
    }
  }, "Engine Intent"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, ['LONG', 'SHORT'].map(d => /*#__PURE__*/React.createElement("button", {
    key: d,
    onClick: () => setDirection(d),
    style: pill(d === direction, false, d === 'LONG' ? 'var(--color-success)' : 'var(--color-error)')
  }, d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      fontSize: 'var(--text-xs)'
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Contract",
    value: intent.nfoSymbol,
    mono: true
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Premium",
    value: intent.premium.toFixed(2)
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Lots",
    value: `${intent.lots} × ${intent.lotSize}`
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Stop / Target",
    value: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--color-error)'
      }
    }, intent.sl), " / ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--color-success)'
      }
    }, intent.target))
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      bottom: 0,
      display: 'flex',
      gap: 10,
      padding: 12,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...actionBtn,
      background: 'var(--color-success)'
    }
  }, "BUY CE"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...actionBtn,
      background: 'var(--color-error)'
    }
  }, "BUY PE"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...actionBtn,
      background: 'var(--color-text-tertiary)',
      flex: '0 0 auto',
      width: 56
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "square",
    style: {
      color: '#fff'
    }
  }))));
}
function Row({
  label,
  value,
  mono
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-tertiary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-primary)',
      fontFamily: mono ? 'var(--font-mono)' : undefined
    }
  }, value));
}
function pill(active, small, activeColor) {
  return {
    padding: small ? '4px 10px' : '6px 12px',
    fontSize: 'var(--text-xs)',
    borderRadius: 'var(--radius-md)',
    border: active ? 'none' : '1px solid var(--color-border)',
    background: active ? activeColor || 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-tertiary)',
    cursor: 'pointer',
    fontWeight: 'var(--font-weight-medium)'
  };
}
const actionBtn = {
  flex: 1,
  padding: '14px 0',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  color: '#fff',
  fontWeight: 'var(--font-weight-bold)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
window.ScalpScreen = ScalpScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/ScalpScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/StrategiesScreen.jsx
try { (() => {
function StrategiesScreen() {
  const {
    Card,
    Badge,
    Button
  } = window.AutoTrading_f56db4;
  const [strategies, setStrategies] = React.useState([{
    id: 1,
    name: 'ORB-15',
    tier: 'Tier 1',
    description: 'Opening range breakout',
    enabled: true,
    winRate: 61
  }, {
    id: 2,
    name: 'VWAP-Reject',
    tier: 'Tier 1',
    description: 'Fade VWAP rejection',
    enabled: true,
    winRate: 54
  }, {
    id: 3,
    name: 'Momentum',
    tier: 'Tier 2',
    description: 'RSI + volume momentum',
    enabled: false,
    winRate: 47
  }]);
  const toggle = id => setStrategies(s => s.map(x => x.id === id ? {
    ...x,
    enabled: !x.enabled
  } : x));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      paddingBottom: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "target",
    style: {
      color: 'var(--color-primary)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0
    }
  }, "Strategy Registry")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-tertiary)',
      margin: 0
    }
  }, "Enable, disable, and tune strategies. Changes apply at runtime."), strategies.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.id,
    padding: "sm"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)'
    }
  }, s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, s.tier, " \xB7 ", s.description)), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: s.enabled ? 'secondary' : 'primary',
    onClick: () => toggle(s.id)
  }, s.enabled ? 'Enabled' : 'Disabled')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: '1px solid var(--color-border)',
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, "Win rate: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-primary)'
    }
  }, s.winRate, "%")))));
}
window.StrategiesScreen = StrategiesScreen;
function RiskConfigScreen() {
  const {
    Card,
    Input,
    Button
  } = window.AutoTrading_f56db4;
  const [cfg, setCfg] = React.useState({
    maxLots: 10,
    maxConcurrent: 3,
    maxTradesPerDay: 15,
    maxDailyLoss: 10000,
    maxRiskPerTradePct: 1.5
  });
  const set = (k, v) => setCfg(c => ({
    ...c,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      paddingBottom: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "shield",
    style: {
      color: 'var(--color-warning)'
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-weight-bold)',
      margin: 0
    }
  }, "Risk Configuration")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Max Lots",
    type: "number",
    value: cfg.maxLots,
    onChange: e => set('maxLots', e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Max Concurrent",
    type: "number",
    value: cfg.maxConcurrent,
    onChange: e => set('maxConcurrent', e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Max Trades/Day",
    type: "number",
    value: cfg.maxTradesPerDay,
    onChange: e => set('maxTradesPerDay', e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Daily Loss Limit (\u20B9)",
    type: "number",
    value: cfg.maxDailyLoss,
    onChange: e => set('maxDailyLoss', e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Risk Per Trade %",
    type: "number",
    value: cfg.maxRiskPerTradePct,
    onChange: e => set('maxRiskPerTradePct', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Save"))));
}
window.RiskConfigScreen = RiskConfigScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/StrategiesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading-cockpit/data.js
try { (() => {
// Mock data shared across the Trading Cockpit UI kit. No network calls — everything here is
// static/randomized client-side so the prototype works standalone.
window.MOCK = function () {
  function seedSeries(base, n, vol) {
    const out = [base];
    for (let i = 1; i < n; i++) out.push(Math.max(1, out[i - 1] + (Math.random() - 0.5) * vol));
    return out;
  }
  const niftySeries = seedSeries(24800, 60, 18);
  const bankniftySeries = seedSeries(51200, 60, 40);
  const watchlist = [{
    symbol: 'RELIANCE',
    ltp: 2945.6,
    chg: 0.82,
    rsi: 58
  }, {
    symbol: 'HDFCBANK',
    ltp: 1687.2,
    chg: -0.35,
    rsi: 42
  }, {
    symbol: 'INFY',
    ltp: 1789.4,
    chg: 1.24,
    rsi: 71
  }, {
    symbol: 'TCS',
    ltp: 3854.1,
    chg: -0.12,
    rsi: 49
  }, {
    symbol: 'ICICIBANK',
    ltp: 1234.8,
    chg: 0.44,
    rsi: 55
  }, {
    symbol: 'SBIN',
    ltp: 812.3,
    chg: -1.05,
    rsi: 33
  }];
  const signals = [{
    time: '14:32:08',
    symbol: 'NIFTY',
    action: 'BUY',
    price: 24812,
    strategy: 'ORB-15',
    confidence: 0.81
  }, {
    time: '14:29:41',
    symbol: 'BANKNIFTY',
    action: 'SELL',
    price: 51203,
    strategy: 'VWAP-Reject',
    confidence: 0.64
  }, {
    time: '14:21:03',
    symbol: 'RELIANCE',
    action: 'BUY',
    price: 2941,
    strategy: 'Momentum',
    confidence: 0.72
  }];
  function chainRows(spot) {
    const atm = Math.round(spot / 50) * 50;
    const strikes = [];
    for (let i = -4; i <= 4; i++) strikes.push(atm + i * 50);
    return strikes.map(strike => {
      const dist = Math.abs(strike - atm);
      const ceLtp = Math.max(2, 140 - dist * 1.1 + (Math.random() - 0.5) * 4);
      const peLtp = Math.max(2, 40 + dist * 0.9 + (Math.random() - 0.5) * 4);
      return {
        strike,
        isATM: strike === atm,
        ce: {
          ltp: ceLtp,
          bid: ceLtp - 0.5,
          ask: ceLtp + 0.5,
          oi: 28000 + Math.round(Math.random() * 20000)
        },
        pe: {
          ltp: peLtp,
          bid: peLtp - 0.5,
          ask: peLtp + 0.5,
          oi: 25000 + Math.round(Math.random() * 20000)
        }
      };
    });
  }
  const positions = [{
    id: 1,
    symbol: 'NIFTY24800CE',
    optionType: 'CE',
    strike: 24800,
    lots: 2,
    lotSize: 25,
    entryPrice: 96.4,
    currentPrice: 128.4,
    stopLoss: 95,
    pnl: 1420,
    pnlPct: 33.2,
    iv: 14.2,
    theta: -18.4,
    delta: 0.52,
    entryTime: Date.now() - 22 * 60000
  }, {
    id: 2,
    symbol: 'NIFTY24700PE',
    optionType: 'PE',
    strike: 24700,
    lots: 1,
    lotSize: 25,
    entryPrice: 58.2,
    currentPrice: 64.1,
    pnl: -320,
    pnlPct: -12.8,
    iv: 15.8,
    theta: -9.1,
    delta: -0.31,
    entryTime: Date.now() - 41 * 60000
  }, {
    id: 3,
    symbol: 'BANKNIFTY51200PE',
    optionType: 'PE',
    strike: 51200,
    lots: 1,
    lotSize: 15,
    entryPrice: 210.0,
    currentPrice: 178.5,
    stopLoss: 260,
    pnl: 472,
    pnlPct: 15.0,
    iv: 16.9,
    theta: -22.7,
    delta: -0.44,
    entryTime: Date.now() - 3 * 3600000
  }];
  const brokers = [{
    id: 'flattrade',
    name: 'Flattrade',
    status: 'connected',
    accountId: 'FT10234',
    mode: 'live'
  }, {
    id: 'mstock',
    name: 'mStock',
    status: 'connected',
    accountId: 'MS88213',
    mode: 'shadow'
  }, {
    id: 'zerodha',
    name: 'Zerodha Kite',
    status: 'disconnected',
    accountId: null,
    mode: 'paper'
  }];
  const backfillSymbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'ICICIBANK', 'SBIN'];

  // --- Live tick engine ---------------------------------------------------
  // Mutates the series/watchlist in place every ~1.1s and notifies subscribers,
  // so every screen reading from window.MOCK sees the same moving market
  // instead of a static snapshot. Call window.MOCK.subscribe(fn) in a
  // component's useEffect and setState on each notify to re-render live.
  const listeners = new Set();
  function notify() {
    listeners.forEach(fn => fn());
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  let started = false;
  function start() {
    if (started) return;
    started = true;
    setInterval(() => {
      const step = (arr, vol) => {
        arr.push(Math.max(1, arr[arr.length - 1] + (Math.random() - 0.5) * vol));
        arr.shift();
      };
      step(niftySeries, 12);
      step(bankniftySeries, 28);
      watchlist.forEach(w => {
        const delta = (Math.random() - 0.5) * (w.ltp * 0.0018);
        w.ltp = Math.max(0.5, w.ltp + delta);
        w.chg = w.chg + delta / w.ltp * 100 * 0.15;
        w.rsi = Math.min(90, Math.max(10, w.rsi + (Math.random() - 0.5) * 3));
      });
      notify();
    }, 1100);
  }
  return {
    niftySeries,
    bankniftySeries,
    watchlist,
    signals,
    chainRows,
    positions,
    brokers,
    backfillSymbols,
    subscribe,
    start
  };
}();

// Fire up the tick engine as soon as data.js loads.
window.MOCK.start();

// Shared hook-like helper: components call useLiveTick() to force a re-render
// on every tick without duplicating subscribe/unsubscribe boilerplate.
function useLiveTick() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => window.MOCK.subscribe(() => setTick(t => t + 1)), []);
}
window.useLiveTick = useLiveTick;

// Shared "current user" context (per-user broker config, as requested).
window.CURRENT_USER = {
  name: 'Utkarsh',
  email: 'utkarsh@example.com',
  accountId: 'AT-4471'
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading-cockpit/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardBody = __ds_scope.CardBody;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.RiskMeter = __ds_scope.RiskMeter;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.TableHeader = __ds_scope.TableHeader;

__ds_ns.TableBody = __ds_scope.TableBody;

__ds_ns.TableRow = __ds_scope.TableRow;

__ds_ns.TableHeaderCell = __ds_scope.TableHeaderCell;

__ds_ns.TableCell = __ds_scope.TableCell;

__ds_ns.KillSwitchButton = __ds_scope.KillSwitchButton;

__ds_ns.StaleBadge = __ds_scope.StaleBadge;

__ds_ns.TradeModeBadge = __ds_scope.TradeModeBadge;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.ModalHeader = __ds_scope.ModalHeader;

__ds_ns.ModalBody = __ds_scope.ModalBody;

__ds_ns.ModalFooter = __ds_scope.ModalFooter;

__ds_ns.DailyRiskCard = __ds_scope.DailyRiskCard;

__ds_ns.OptionChainGrid = __ds_scope.OptionChainGrid;

__ds_ns.PositionsTable = __ds_scope.PositionsTable;

__ds_ns.SafetyBar = __ds_scope.SafetyBar;

})();
