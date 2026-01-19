# Modal Component

A reusable dialog component for alerts, forms, and custom content.

## Usage

```jsx
import { Modal, Button } from '@/components/ui';

const [open, setOpen] = useState(false);

<Modal isOpen={open} onClose={() => setOpen(false)} size="lg">
  <Modal.Header onClose={() => setOpen(false)}>Update Settings</Modal.Header>
  <Modal.Body>
    <p>Content goes here...</p>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={() => setOpen(false)}>
      Cancel
    </Button>
    <Button onClick={save}>Save</Button>
  </Modal.Footer>
</Modal>;
```

## Props

### Modal

| Prop      | Type    | Default  | Description                    |
| --------- | ------- | -------- | ------------------------------ |
| `isOpen`  | boolean | required | Controls visibility            |
| `onClose` | func    | required | Handler for backdrop click/esc |
| `size`    | enum    | 'md'     | 'sm', 'md', 'lg', 'xl', 'full' |

### Modal.Header

| Prop      | Type | Description                          |
| --------- | ---- | ------------------------------------ |
| `onClose` | func | Pass if you want an 'X' close button |
