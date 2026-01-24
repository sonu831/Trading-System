# UI Component Library

Production-ready reusable UI components for the Stock Analysis Portal.

## Components

### Button

Flexible button component with variants, sizes, and loading state.

- **Variants**: primary, secondary, outline, danger, ghost
- **Sizes**: sm, md, lg
- **States**: loading, disabled
- [Full Documentation](./Button/README.md)

### Card

Container component with optional header, body, and footer.

- **Variants**: default, glass, outlined
- **Padding**: none, sm, md, lg
- **Features**: hoverable effect
- [Full Documentation](./Card/README.md)

### Input

Form input with label, error, and helper text support.

- **Types**: text, date, number, etc.
- **Features**: validation, error states, required indicator
- [Full Documentation](./Input/README.md)

### Badge

Status indicator or label component.

- **Variants**: default, success, error, warning, info
- **Sizes**: sm, md, lg
- [Full Documentation](./Badge/README.md)

### Table

Data table with header and body sections.

- **Features**: striped rows, hover effects, responsive
- **Components**: Header, Body, Row, Cell, HeaderCell
- [Full Documentation](./Table/README.md)

## Usage

Import components from the central export:

```javascript
import { Button, Card, Input, Badge, Table } from '@/components/ui';

function MyComponent() {
  return (
    <Card variant="glass">
      <Card.Header>Title</Card.Header>
      <Card.Body>
        <Input label="Email" type="email" />
        <Badge variant="success">Active</Badge>
      </Card.Body>
      <Card.Footer>
        <Button variant="primary">Submit</Button>
      </Card.Footer>
    </Card>
  );
}
```

## Design Principles

1. **Consistency**: All components follow the same design language
2. **Reusability**: Generic and composable
3. **Accessibility**: Proper semantic HTML and ARIA attributes
4. **Documentation**: Every component has usage examples
5. **Type Safety**: PropTypes validation for all props
6. **Theme-Aware**: Styles use consistent color tokens

## File Structure

```
ui/
├── Button/
│   ├── Button.jsx
│   ├── README.md
│   └── index.js
├── Card/
│   ├── Card.jsx
│   ├── README.md
│   └── index.js
└── ...
```

## Next Steps

- [ ] Add theme system (dark/light mode)
- [ ] Create AppLayout wrapper
- [ ] Build feature-specific composite components
- [ ] Migrate existing pages to use these components
