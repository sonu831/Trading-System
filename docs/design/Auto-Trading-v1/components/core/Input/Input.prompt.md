Labeled form field for settings screens (risk config, broker credentials).

```jsx
<Input label="Max Daily Loss (₹)" type="number" value={v} onChange={handle} required />
```

Error state swaps the border to `--color-error` and shows the message below in place of helper text — only one of `error`/`helperText` renders at a time.
