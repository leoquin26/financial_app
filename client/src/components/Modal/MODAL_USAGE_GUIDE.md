# Modal System Usage Guide

## Overview
This modal system provides consistent, mobile-responsive, and accessible modals throughout the application using Material-UI's Dialog component.

## Components

### 1. BaseModal
The foundation component for all modals.

```tsx
import { BaseModal } from '@/components/Modal';

<BaseModal
  open={isOpen}
  onClose={handleClose}
  title="Modal Title"
  subtitle="Optional subtitle"
  icon={<SomeIcon />}
  maxWidth="sm"
  showCloseButton={true}
  transitionType="fade"
  actions={
    <>
      <Button onClick={handleCancel}>Cancel</Button>
      <Button onClick={handleConfirm} variant="contained">Confirm</Button>
    </>
  }
>
  {/* Your content here */}
</BaseModal>
```

### 2. FormModal
Specialized modal for forms with automatic form handling.

```tsx
import { FormModal } from '@/components/Modal';

<FormModal
  open={isOpen}
  onClose={handleClose}
  title="Edit Item"
  onSubmit={handleSubmit}
  submitText="Save"
  cancelText="Cancel"
  loading={isSubmitting}
  submitButtonColor="primary"
  maxWidth="md"
>
  <TextField fullWidth label="Name" {...register('name')} />
  <TextField fullWidth label="Description" {...register('description')} />
</FormModal>
```

### 3. ConfirmModal
Pre-styled confirmation dialogs with icons.

```tsx
import { ConfirmModal } from '@/components/Modal';

<ConfirmModal
  open={isOpen}
  onClose={handleClose}
  onConfirm={handleDelete}
  title="Delete Item?"
  message="This action cannot be undone."
  type="warning"
  confirmText="Delete"
  cancelText="Cancel"
  loading={isDeleting}
/>
```

## Migration Guide

### Before (Old Dialog):
```tsx
<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
  <DialogTitle>
    <Box display="flex" alignItems="center" justifyContent="space-between">
      <Typography variant="h6">Title</Typography>
      <IconButton onClick={onClose}><CloseIcon /></IconButton>
    </Box>
  </DialogTitle>
  <DialogContent>
    {/* Content */}
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button variant="contained" onClick={handleSubmit}>Submit</Button>
  </DialogActions>
</Dialog>
```

### After (New Modal System):
```tsx
<FormModal
  open={open}
  onClose={onClose}
  title="Title"
  onSubmit={handleSubmit}
  submitText="Submit"
  maxWidth="sm"
>
  {/* Content */}
</FormModal>
```

## Props Reference

### BaseModal Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | required | Controls modal visibility |
| onClose | () => void | required | Handler for closing the modal |
| title | ReactNode | - | Modal title |
| subtitle | string | - | Optional subtitle |
| children | ReactNode | required | Modal content |
| actions | ReactNode | - | Footer actions (buttons) |
| maxWidth | 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| false | 'sm' | Maximum width |
| fullWidth | boolean | true | Take full width up to maxWidth |
| showCloseButton | boolean | true | Show X close button |
| transitionType | 'slide' \| 'fade' \| 'none' | 'fade' | Animation type |
| icon | ReactNode | - | Icon to display with title |
| noPadding | boolean | false | Remove content padding |

### FormModal Props
Extends BaseModal props plus:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| onSubmit | (e: FormEvent) => void | required | Form submit handler |
| submitText | string | 'Save' | Submit button text |
| cancelText | string | 'Cancel' | Cancel button text |
| loading | boolean | false | Shows loading state |
| submitDisabled | boolean | false | Disables submit button |
| submitButtonColor | string | 'primary' | Submit button color |

### ConfirmModal Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| type | 'info' \| 'warning' \| 'success' \| 'error' \| 'confirm' | 'confirm' | Modal type (affects icon and colors) |
| confirmText | string | 'Confirm' | Confirm button text |
| confirmButtonColor | string | auto | Override button color |

## Mobile Responsiveness
- On mobile devices:
  - Modals slide up from bottom (with `transitionType="slide"`)
  - Full width with rounded top corners
  - Optimized touch targets
  - Proper keyboard handling

## Accessibility
- Keyboard navigation (Tab, Escape)
- Focus management
- ARIA attributes
- Screen reader support

## Examples

### Delete Confirmation
```tsx
const [deleteOpen, setDeleteOpen] = useState(false);

<ConfirmModal
  open={deleteOpen}
  onClose={() => setDeleteOpen(false)}
  onConfirm={async () => {
    await deleteItem(itemId);
    setDeleteOpen(false);
  }}
  title="Delete Item"
  message="Are you sure you want to delete this item?"
  type="error"
  confirmText="Delete"
  confirmButtonColor="error"
/>
```

### Edit Form
```tsx
const [editOpen, setEditOpen] = useState(false);
const { register, handleSubmit } = useForm();

<FormModal
  open={editOpen}
  onClose={() => setEditOpen(false)}
  title="Edit Profile"
  icon={<PersonIcon />}
  onSubmit={handleSubmit(async (data) => {
    await updateProfile(data);
    setEditOpen(false);
  })}
  loading={isUpdating}
>
  <Grid container spacing={2}>
    <Grid item xs={12}>
      <TextField fullWidth label="Name" {...register('name')} />
    </Grid>
    <Grid item xs={12}>
      <TextField fullWidth label="Email" {...register('email')} />
    </Grid>
  </Grid>
</FormModal>
```

## Best Practices
1. Always provide a clear title
2. Use appropriate modal size (maxWidth)
3. Include loading states for async operations
4. Use the correct modal type (Base, Form, or Confirm)
5. Provide keyboard shortcuts (Escape to close)
6. Test on mobile devices
7. Keep modals focused on single tasks
