Centered dialog for confirmations, broker add/edit, backfill progress.

```jsx
<Modal isOpen={open} onClose={close}>
  <ModalHeader onClose={close}>Add broker</ModalHeader>
  <ModalBody>…</ModalBody>
  <ModalFooter><Button onClick={close}>Cancel</Button><Button variant="primary">Save</Button></ModalFooter>
</Modal>
```

300ms fade + scale-up on open, blurred backdrop. Sizes sm(420)/md(520)/lg(720)/xl(960)px.
