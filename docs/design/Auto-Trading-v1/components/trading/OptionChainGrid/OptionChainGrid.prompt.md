CALLS | STRIKE | PUTS ladder — the core scalping instrument. ATM row tinted + strike bolded amber.

```jsx
<OptionChainGrid rows={chainRows} spot={24812} atm={24800} expiry="25 Jul (0d, weekly)" />
```

Keep numeric columns `tabular-nums`. Wrap in a fixed-height scroll container on mobile (`maxHeight: 60vh, overflowY: 'auto'`) with `position: sticky` header — see the Scalp Cockpit UI kit.
