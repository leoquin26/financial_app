import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Tabs,
  Tab,
  Alert,
  Skeleton,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp,
  TrendingDown,
  Palette as PaletteIcon,
  Category as CategoryIcon,
  Refresh as RefreshIcon,
  EmojiEmotions,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import SimpleColorPicker from '../components/SimpleColorPicker';
import { axiosInstance as axios } from '../config/api';

interface Category {
  _id: string;
  id?: number; // For backwards compatibility
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  userId?: string | null;
  user_id?: number; // For backwards compatibility
}

interface CategoryForm {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

// Emoji picker data
const EMOJI_CATEGORIES = {
  common: ['💰', '💵', '💳', '💸', '🏠', '🚗', '🍔', '🛒', '💊', '🎓', '✈️', '🎬', '🎮', '📱', '💻', '👕', '🎁', '💼', '🏥', '⚡'],
  food: ['🍔', '🍕', '🍜', '🥗', '🍱', '☕', '🍺', '🥘', '🍳', '🥐'],
  transport: ['🚗', '🚌', '🚇', '✈️', '🚲', '🛵', '🚕', '⛽', '🚁', '🚢'],
  home: ['🏠', '🛋️', '🔌', '💡', '🚿', '🛏️', '🏡', '🔧', '🎨', '🌱'],
  health: ['💊', '🏥', '💉', '🦷', '👓', '🧘', '💪', '🏃', '⚕️', '🩺'],
  entertainment: ['🎬', '🎮', '🎵', '📚', '🎨', '🎭', '🎪', '🎯', '🎳', '🎰'],
  shopping: ['🛒', '👕', '👗', '👠', '👜', '💄', '💍', '⌚', '🕶️', '🎁'],
  work: ['💼', '💻', '📱', '🖥️', '⌨️', '🖱️', '📊', '📈', '📉', '📧'],
  education: ['🎓', '📚', '✏️', '📝', '🎒', '🔬', '🧮', '📐', '🖊️', '📖'],
  pets: ['🐕', '🐈', '🐠', '🦜', '🐹', '🐰', '🦎', '🐢', '🦴', '🐾'],
};

// Predefined colors
const PRESET_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#4CAF50', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688',
  '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
];

const Categories: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('common');
  const [deleteError, setDeleteError] = useState<{ open: boolean; message: string; transactionCount?: number }>({
    open: false,
    message: '',
  });

  // Form
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CategoryForm>({
    defaultValues: {
      name: '',
      type: 'expense',
      color: '#4A90E2',
      icon: '📁',
    },
  });

  const watchColor = watch('color');
  const watchIcon = watch('icon');

  // Queries
  const { data: categories, isLoading, refetch } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      console.log('Categories received:', response.data);
      return response.data; // Backend returns array directly
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CategoryForm) => {
      const response = await axios.post('/api/categories', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Categoría creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear categoría');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryForm> }) => {
      const response = await axios.put(`/api/categories/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Categoría actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar categoría');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/categories/${id}`);
    },
    onSuccess: () => {
      toast.success('Categoría eliminada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: any) => {
      if (error.response?.data?.transactionCount) {
        setDeleteError({
          open: true,
          message: `No se puede eliminar esta categoría porque tiene ${error.response.data.transactionCount} transacciones asociadas. Por favor, elimina o cambia la categoría de esas transacciones primero.`,
          transactionCount: error.response.data.transactionCount,
        });
      } else {
        toast.error(error.response?.data?.error || 'Error al eliminar categoría');
      }
    },
  });

  // Socket listeners
  React.useEffect(() => {
    if (!socket) return;

    const handleCategoryUpdate = () => {
      refetch();
    };

    socket.on('category-created', handleCategoryUpdate);
    socket.on('category-updated', handleCategoryUpdate);
    socket.on('category-deleted', handleCategoryUpdate);

    return () => {
      socket.off('category-created', handleCategoryUpdate);
      socket.off('category-updated', handleCategoryUpdate);
      socket.off('category-deleted', handleCategoryUpdate);
    };
  }, [socket, refetch]);

  // Handlers
  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      reset({
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
      });
    } else {
      setEditingCategory(null);
      reset();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCategory(null);
    setShowColorPicker(false);
    setShowEmojiPicker(false);
    reset();
  };

  const onSubmit = (data: CategoryForm) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (category: Category) => {
    if (window.confirm(`¿Estás seguro de eliminar la categoría "${category.name}"?`)) {
      deleteMutation.mutate(category._id);
    }
  };

  // Filter categories by type
  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];
  const displayCategories = tabValue === 0 ? expenseCategories : incomeCategories;
  
  console.log('Categories state:', { 
    total: categories?.length, 
    expense: expenseCategories.length, 
    income: incomeCategories.length,
    displaying: displayCategories.length
  });

  // Count statistics
  const totalCategories = categories?.length || 0;
  const userCategories = categories?.filter(c => c.userId !== null).length || 0;

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Categorías
        </Typography>
        <Box display="flex" gap={2}>
          <IconButton onClick={() => refetch()} color="primary">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nueva Categoría
          </Button>
        </Box>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <CategoryIcon color="primary" />
              <Box>
                <Typography variant="h6">{totalCategories}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Total de Categorías
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <TrendingDown color="error" />
              <Box>
                <Typography variant="h6">{expenseCategories.length}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Categorías de Gastos
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <TrendingUp color="success" />
              <Box>
                <Typography variant="h6">{incomeCategories.length}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Categorías de Ingresos
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`Gastos (${expenseCategories.length})`} />
          <Tab label={`Ingresos (${incomeCategories.length})`} />
        </Tabs>
      </Paper>

      {/* Categories Grid */}
      {isLoading ? (
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : displayCategories.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <CategoryIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" mb={2}>
            No hay categorías de {tabValue === 0 ? 'gastos' : 'ingresos'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Crear Primera Categoría
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {displayCategories.map((category) => (
            <Grid item xs={12} sm={6} md={4} key={category._id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: 2,
                          bgcolor: category.color + '20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem',
                        }}
                      >
                        {category.icon}
                      </Box>
                      <Box flex={1}>
                        <Typography variant="h6">
                          {category.name}
                        </Typography>
                        <Box display="flex" gap={1} mt={0.5}>
                          <Chip
                            label={category.type === 'income' ? 'Ingreso' : 'Gasto'}
                            size="small"
                            color={category.type === 'income' ? 'success' : 'error'}
                            variant="outlined"
                          />
                          {category.userId === null && (
                            <Chip
                              label="Predeterminada"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          bgcolor: category.color,
                          border: '2px solid',
                          borderColor: 'divider',
                        }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {category.color}
                      </Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(category)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(category)}
                  >
                    Eliminar
                  </Button>
                </CardActions>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} className="category-dialog">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <CategoryIcon color="primary" />
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: 'El nombre es requerido' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Nombre de la Categoría"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Tipo</InputLabel>
                      <Select {...field} label="Tipo" disabled={!!editingCategory}>
                        <MenuItem value="expense">
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingDown color="error" />
                            Gasto
                          </Box>
                        </MenuItem>
                        <MenuItem value="income">
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingUp color="success" />
                            Ingreso
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Icono
                </Typography>
                <Box display="flex" gap={2} alignItems="center">
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 2,
                      bgcolor: watchColor + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      border: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {watchIcon}
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<EmojiEmotions />}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    Elegir Icono
                  </Button>
                </Box>

                {showEmojiPicker && (
                  <Paper sx={{ mt: 2, p: 2 }}>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Categoría</InputLabel>
                      <Select
                        value={selectedEmojiCategory}
                        onChange={(e) => setSelectedEmojiCategory(e.target.value)}
                        label="Categoría"
                      >
                        <MenuItem value="common">Comunes</MenuItem>
                        <MenuItem value="food">Comida</MenuItem>
                        <MenuItem value="transport">Transporte</MenuItem>
                        <MenuItem value="home">Hogar</MenuItem>
                        <MenuItem value="health">Salud</MenuItem>
                        <MenuItem value="entertainment">Entretenimiento</MenuItem>
                        <MenuItem value="shopping">Compras</MenuItem>
                        <MenuItem value="work">Trabajo</MenuItem>
                        <MenuItem value="education">Educación</MenuItem>
                        <MenuItem value="pets">Mascotas</MenuItem>
                      </Select>
                    </FormControl>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {EMOJI_CATEGORIES[selectedEmojiCategory as keyof typeof EMOJI_CATEGORIES].map(emoji => (
                        <IconButton
                          key={emoji}
                          onClick={() => {
                            setValue('icon', emoji);
                            setShowEmojiPicker(false);
                          }}
                          sx={{
                            fontSize: '1.5rem',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          {emoji}
                        </IconButton>
                      ))}
                    </Box>
                  </Paper>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Color
                </Typography>
                <Box display="flex" gap={2} alignItems="center">
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 2,
                      bgcolor: watchColor,
                      border: '2px solid',
                      borderColor: 'divider',
                    }}
                  />
                  <TextField
                    value={watchColor}
                    onChange={(e) => setValue('color', e.target.value)}
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PaletteIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    Elegir Color
                  </Button>
                </Box>

                {showColorPicker && (
                  <Paper sx={{ mt: 2, p: 2 }}>
                    <SimpleColorPicker
                      color={watchColor}
                      onChange={(color: string) => setValue('color', color)}
                      presetColors={PRESET_COLORS}
                    />
                  </Paper>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingCategory ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Error Dialog */}
      <Dialog 
        open={deleteError.open} 
        onClose={() => setDeleteError({ open: false, message: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            No se puede eliminar la categoría
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {deleteError.message}
          </Alert>
          <Typography variant="body2" color="textSecondary">
            Para poder eliminar esta categoría, primero debes:
          </Typography>
          <Box component="ol" sx={{ mt: 1, pl: 2 }}>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              Ir a la sección de Transacciones
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              Filtrar por esta categoría
            </Typography>
            <Typography component="li" variant="body2">
              Cambiar la categoría de esas transacciones o eliminarlas
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteError({ open: false, message: '' })}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Categories;